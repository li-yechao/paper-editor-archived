// Copyright 2021 LiYechao
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { Typography } from '@material-ui/core'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import dashjs from 'dashjs'
import { TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import CupertinoActivityIndicator from '../../../components/CupertinoActivityIndicator'
import { getImageThumbnail, readAsDataURL } from '../../lib/image'
import { LazyComponent } from '../../lib/LazyComponent'
import { NodeViewReact, StrictProsemirrorNode } from '../Node'
import { VideoBlockAttrs, VideoBlockOptions } from './VideoBlock'
import VideoFile, { VideoFileStatus } from './VideoFile'

export default class VideoBlockNodeView extends NodeViewReact<VideoBlockAttrs> {
  constructor(
    node: StrictProsemirrorNode<VideoBlockAttrs>,
    private view: EditorView,
    private getPos: () => number,
    private options: VideoBlockOptions
  ) {
    super(node)
    this.reactDOM.contentEditable = 'false'
    this.dom.classList.add(css`
      margin: 1em 0;

      > figcaption {
        text-align: center;
      }
    `)
    this.dom.append(this.reactDOM, this.contentDOM)
    this._render()
  }

  dom = document.createElement('figure')

  reactDOM = document.createElement('div')

  contentDOM = document.createElement('figcaption')

  private isDragging = false

  private get attrs() {
    return this.node.attrs
  }

  stopEvent = (e: Event) => {
    if (e.type === 'dragstart') {
      this.isDragging = true
    } else if (e.type === 'dragend') {
      this.isDragging = false
    }
    return false
  }

  ignoreMutation = (e: MutationRecord | { type: 'selection'; target: Element }) => {
    return this.reactDOM.contains(e.target)
  }

  selectNode = () => {
    // NOTE: Move cursor to end of node,
    // do nothing if is dragging, otherwise DND will be duplicate this node.
    if (!this.isDragging) {
      setTimeout(() => {
        this.view.dispatch(
          this.view.state.tr.setSelection(
            TextSelection.create(this.view.state.doc, this.getPos() + this.node.nodeSize - 2)
          )
        )
        this._render()
      })
    }
  }

  private get aspectRatio() {
    const { naturalWidth, naturalHeight } = this.attrs
    if (naturalWidth && naturalHeight) {
      return (naturalHeight / naturalWidth) * 100
    }
    return 50
  }

  component = () => {
    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const file: File | undefined = (this.node as any).file

    const state = useRef<{
      videoFile?: VideoFile
      loading: boolean
      src?: string
      poster?: string
      visible: boolean
      playing: boolean
    }>({
      loading: false,
      visible: false,
      playing: false,
    })
    const setState = useCallback((s: Partial<typeof state.current>) => {
      state.current = { ...state.current, ...s }
      update()
    }, [])

    const togglePlaying = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.focus()
      setState({ playing: !state.current.playing })
    }, [])

    const onVisibleChange = useCallback((visible: boolean) => {
      if (!visible) {
        setState({ visible, playing: false })
        return
      }
      const { dashArchiveSrc } = this.attrs
      const s = dashArchiveSrc && this.options.getSrc(dashArchiveSrc)
      setState({
        src: s ? `${s}/dash/index.mpd` : undefined,
        poster: s ? `${s}/poster.jpeg` : undefined,
        playing: true,
        visible,
      })
    }, [])

    const onPlay = useCallback(() => {
      setState({ playing: true })
    }, [])

    const onPauseOrEnded = useCallback(() => {
      setState({ playing: false })
    }, [])

    useEffect(() => {
      if (state.current.visible) {
        ;(async () => {
          const { dashArchiveSrc } = this.attrs
          const s = dashArchiveSrc && (await this.options.getSrc(dashArchiveSrc))
          setState({
            src: `${s}/dash/index.mpd`,
            poster: `${s}/poster.jpeg`,
          })
        })()
      }
    }, [this.attrs.dashArchiveSrc, state.current.visible])

    useEffect(() => {
      if (!file) {
        return
      }
      ;(async () => {
        const videoFile = new VideoFile(file)
        setState({ videoFile, loading: true })
        try {
          videoFile.on('progress', update)
          const poster = await videoFile.poster()
          const { thumbnail, naturalWidth, naturalHeight } = await getImageThumbnail(
            poster,
            this.options.thumbnail
          )
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.attrs,
              thumbnail: await readAsDataURL(thumbnail),
              naturalWidth,
              naturalHeight,
            })
          )

          const dash = await videoFile.dash()
          const filenameFile = new File([new Blob([file.name], { type: 'text/plain' })], 'filename')
          const dashArchiveSrc = await this.options.upload([filenameFile, poster, ...dash, file])
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              dashArchiveSrc,
            })
          )
        } finally {
          videoFile.destroy()
          setState({ videoFile: undefined, loading: false })
        }
      })()
    }, [file])

    return (
      <LazyComponent component={_Content} onVisibleChange={onVisibleChange}>
        <_VideoContainer style={{ width: this.attrs.naturalWidth ?? '100%' }}>
          <div style={{ paddingBottom: `${this.aspectRatio}%` }} />

          {this.attrs.thumbnail && <img src={this.attrs.thumbnail} />}
          {state.current.poster && <img src={state.current.poster} />}

          <DashVideo
            muted
            playsInline
            autoPlay={state.current.playing}
            poster={state.current.poster}
            src={state.current.src}
            onEnded={onPauseOrEnded}
            onPause={onPauseOrEnded}
            onPlay={onPlay}
          />
        </_VideoContainer>

        <_PlayButton tabIndex={-1} onClick={togglePlaying}>
          {state.current.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </_PlayButton>

        {state.current.loading && (
          <_Loading>
            <_CupertinoActivityIndicator size={24} />
            <ProgressText
              status={state.current.videoFile?.status}
              ratio={state.current.videoFile?.ratio}
            />
          </_Loading>
        )}
      </LazyComponent>
    )
  }
}

const ProgressText = ({ status, ratio }: Pick<VideoFile, 'status' | 'ratio'>) => {
  if (status === undefined) {
    return null
  }

  const statusText = {
    [VideoFileStatus.PrepareFFmpeg]: '加载解码器...',
    [VideoFileStatus.ExtractPoster]: '提取封面...',
    [VideoFileStatus.ConvertDASH]: '正在转码...',
  }[status]

  return (
    <Typography variant="caption">
      {statusText}
      {ratio !== undefined && Number((ratio * 100).toFixed(4)) + '%'}
    </Typography>
  )
}

const DashVideo = ({ src, ...props }: React.VideoHTMLAttributes<HTMLVideoElement>) => {
  const video = useRef<HTMLVideoElement>(null)
  const player = useRef<dashjs.MediaPlayerClass>()

  async function playerReady(player: dashjs.MediaPlayerClass) {
    while (true) {
      if (player.isReady()) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  const destroyPlayer = useCallback(async () => {
    const p = player.current
    if (p) {
      await playerReady(p)
      p.destroy()
    }
  }, [])

  const initPlayer = useCallback(async (src: string, autoPlay?: boolean) => {
    await destroyPlayer()
    if (video.current) {
      const newPlayer = dashjs.MediaPlayer().create()
      newPlayer.initialize(video.current, src, autoPlay)
      await playerReady(newPlayer)
      player.current = newPlayer
    }
  }, [])

  useEffect(() => {
    if (src) {
      initPlayer(src, props.autoPlay)
    } else {
      destroyPlayer()
    }

    return () => {
      destroyPlayer()
    }
  }, [src])

  useEffect(() => {
    if (!player.current?.isReady()) {
      return
    }
    if (props.autoPlay) {
      if (video.current?.ended && src) {
        initPlayer(src, props.autoPlay)
      }
      player.current?.play()
    } else {
      player.current?.pause()
    }
  }, [props.autoPlay])

  return (
    <video
      {...props}
      ref={video}
      onEnded={e => {
        props.onEnded?.(e)
      }}
    />
  )
}

const _Content = styled.div`
  position: relative;
  text-align: center;
`

const _VideoContainer = styled.div`
  max-width: 100%;
  display: inline-block;
  vertical-align: middle;
  position: relative;

  > img,
  > video {
    position: absolute;
    left: 0;
    top: 0;
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
`

const _PlayButton = styled.button`
  position: absolute;
  left: 8px;
  top: 8px;
  background-color: transparent;
  border: 1px solid currentColor;
  outline: none;
  border-radius: 4px;
  color: currentColor;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`

const _Loading = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(128, 128, 128, 0.5);
`

const _CupertinoActivityIndicator = styled(CupertinoActivityIndicator)`
  margin: 8px;
`
