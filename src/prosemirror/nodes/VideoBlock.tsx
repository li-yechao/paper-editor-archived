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
import { createFFmpeg, FFmpeg } from '@ffmpeg/ffmpeg'
import { Typography } from '@material-ui/core'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import dashjs from 'dashjs'
import { Keymap } from 'prosemirror-commands'
import { NodeSpec, NodeType, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType, setTextSelection } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import CupertinoActivityIndicator from '../../components/CupertinoActivityIndicator'
import { StrictEventEmitter } from '../../utils/typed-events'
import { getImageThumbnail, readAsDataURL } from '../lib/image'
import { LazyComponent } from '../lib/LazyComponent'
import Node, {
  NodeViewReact,
  NodeViewCreator,
  StrictNodeSpec,
  StrictProsemirrorNode,
  ProsemirrorNode,
} from './Node'

export interface VideoBlockOptions {
  upload: (file: File | File[]) => Promise<string>
  getSrc: (src: string) => string
  thumbnail: {
    maxSize: number
  }
}

export interface VideoBlockAttrs {
  naturalWidth: number | null
  naturalHeight: number | null
  thumbnail: string | null
  dashArchiveSrc: string | null
}

export default class VideoBlock extends Node<VideoBlockAttrs> {
  constructor(private options: VideoBlockOptions) {
    super()
  }

  async create(schema: Schema, file: File): Promise<ProsemirrorNode> {
    const node = schema.nodes[this.name]!.create(
      {},
      schema.nodes[this.contentName]!.create(undefined, schema.text(file.name))
    )
    ;(node as any).file = file
    return node as any
  }

  get name(): string {
    return 'video_block'
  }

  get contentName(): string {
    return `${this.name}_content`
  }

  get schema(): StrictNodeSpec<VideoBlockAttrs> {
    return {
      attrs: {
        naturalWidth: { default: null },
        naturalHeight: { default: null },
        thumbnail: { default: null },
        dashArchiveSrc: { default: null },
      },
      content: this.contentName,
      marks: '',
      group: 'block',
      draggable: true,
      isolating: true,
      parseDOM: [
        {
          tag: 'figure[data-type="video_block"]',
          getAttrs: dom => {
            if (dom instanceof HTMLElement) {
              const { dataset } = dom
              return {
                thumbnail: dataset['thumbnail'] || null,
                naturalWidth: Number(dataset['naturalWidth']) || null,
                naturalHeight: Number(dataset['naturalHeight']) || null,
                dashArchiveSrc: dataset['dashArchiveSrc'] || null,
              }
            }
            return undefined
          },
        },
      ],
      toDOM: ({ attrs }) => {
        return [
          'figure',
          {
            'data-type': 'video_block',
            'data-natural-width': attrs.naturalWidth?.toString(),
            'data-natural-height': attrs.naturalHeight?.toString(),
            'data-thumbnail': attrs.thumbnail,
            'data-dash-archive-src': attrs.dashArchiveSrc,
          },
          ['video'],
          ['figcaption', 0],
        ]
      },
    }
  }

  get schema_extra(): { [name: string]: NodeSpec } {
    return {
      [this.contentName]: {
        content: 'text*',
        marks: '',
        parseDOM: [{ tag: 'div' }],
        toDOM: () => ['div', 0],
      },
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      // NOTE: Move cursor to next node when input Enter.
      Enter: (state, dispatch) => {
        if (dispatch) {
          const { $from, $to } = state.selection
          const fromNode = $from.node($from.depth)
          const toNode = $to.node($to.depth)
          if (fromNode.type.name === this.contentName && fromNode === toNode) {
            const endPos = $from.end($from.depth - 1)
            const { tr } = state
            dispatch(
              tr
                .insert(endPos, type.schema.nodes['paragraph'].createAndFill())
                .setSelection(new TextSelection(tr.doc.resolve(endPos + 2)))
            )
            return true
          }
        }
        return false
      },
      // NOTE: Remove this node when backspace at first position.
      Backspace: (state, dispatch) => {
        const { $from, empty } = state.selection
        const fromNode = $from.node()
        if (
          dispatch &&
          empty &&
          fromNode.type.name === this.contentName &&
          $from.parentOffset === 0
        ) {
          dispatch(
            setTextSelection(
              $from.pos - 2,
              -1
            )(removeParentNodeOfType(type)(state.tr)).scrollIntoView()
          )
          return true
        }
        return false
      },
    }
  }

  get nodeView(): NodeViewCreator<VideoBlockAttrs> {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new VideoBlockNodeView(node, view, getPos, this.options)
    }
  }
}

enum VideoFileStatus {
  PrepareFFmpeg,
  ExtractPoster,
  ConvertDASH,
}

interface Meta {
  codec: string
  format?: string
  profile?: string
}

class VideoFile extends StrictEventEmitter<{}, {}, { progress: (e: VideoFile) => void }> {
  constructor(public file: File) {
    super()
  }

  private inProgress?: Promise<any>

  private __status?: VideoFileStatus
  private set _status(status: VideoFileStatus | undefined) {
    this.__status = status
    this._ratio = undefined
    this._time = undefined
  }
  get status() {
    return this.__status
  }

  private _videoMetas: Meta[] = []
  private _audioMetas: Meta[] = []

  private _duration?: number
  get duration() {
    return this._duration
  }

  private _time?: number
  get time() {
    return this._time
  }

  private __ratio?: number
  private set _ratio(ratio: number | undefined) {
    this.__ratio = ratio
    this.emitReserved('progress', this)
  }
  get ratio() {
    return this.__ratio
  }

  private _ffmpeg?: Promise<FFmpeg>
  private get ffmpeg(): Promise<FFmpeg> {
    if (!this._ffmpeg) {
      this._ffmpeg = (async () => {
        try {
          const ffmpeg = createFFmpeg({
            corePath: './static/ffmpeg-core/ffmpeg-core.js',
          })
          this._status = VideoFileStatus.PrepareFFmpeg
          await ffmpeg.load()
          const buffer = await this.file.arrayBuffer()
          ffmpeg.FS('writeFile', this.file.name, new Uint8Array(buffer, 0, buffer.byteLength))

          // Get video metas.
          ffmpeg.setLogger(log => {
            const video = log.message.match(
              /stream\s+#0:0\S+\s+video\:\s+(?<codec>\w+)(\s+\((?<profile>\w+)\))?(\s+\((?<format>\w+).*\))?,/i
            )?.groups
            const audio = log.message.match(
              /stream\s+#\d+:\d+\S+\s+audio\:\s+(?<codec>\w+)(\s+\((?<profile>\w+)\))?(\s+\((?<format>\w+).*\))?,/i
            )?.groups
            video && this._videoMetas.push(video as any)
            audio && this._audioMetas.push(audio as any)
          })
          await ffmpeg.run('-i', this.file.name)
          ffmpeg.setLogger(() => {})

          ffmpeg.setProgress(p => {
            const { duration, time, ratio } = p as any
            if (typeof duration === 'number' && duration >= 0) {
              this._duration = Number(duration.toFixed(2))
            }
            if (typeof time === 'number' && time >= 0) {
              this._time = Number(time.toFixed(2))
            }
            if (typeof ratio === 'number' && ratio >= 0) {
              this._ratio = Number(ratio.toFixed(4))
            }
          })
          return ffmpeg
        } finally {
          this._status = undefined
        }
      })()
    }
    return this._ffmpeg
  }

  async poster(): Promise<File> {
    await this.inProgress
    const promise = (async () => {
      try {
        const ffmpeg = await this.ffmpeg
        const filename = 'poster.jpeg'
        this._status = VideoFileStatus.ExtractPoster
        await ffmpeg.run('-i', this.file.name, '-vframes', '1', '-f', 'image2', filename)
        return this.readFile(ffmpeg, filename, 'image/jpeg')
      } finally {
        this._status = undefined
      }
    })()
    this.inProgress = promise
    return promise
  }

  async dash() {
    await this.inProgress
    const promise = (async () => {
      try {
        const ffmpeg = await this.ffmpeg
        this._status = VideoFileStatus.ConvertDASH
        ffmpeg.FS('mkdir' as any, 'dash')
        await ffmpeg.run('-i', this.file.name, '-f', 'dash', 'dash/index.mpd')
        const files: string[] = ffmpeg.FS('readdir' as any, 'dash') as string[]
        return files
          .filter(i => i !== '.' && i !== '..')
          .map(i => this.readFile(ffmpeg, `dash/${i}`))
      } finally {
        this._status = undefined
      }
    })()
    this.inProgress = promise
    return promise
  }

  destroy() {
    this.removeAllListeners()
    this._ffmpeg = undefined
  }

  private readFile(ffmpeg: FFmpeg, filename: string, type?: string): File {
    const file = ffmpeg.FS('readFile', filename)
    return new File([new Blob([file.buffer], { type })], filename, { type })
  }
}

class VideoBlockNodeView extends NodeViewReact<VideoBlockAttrs> {
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
      if (!state.current.visible) {
        return
      }
      ;(async () => {
        const { dashArchiveSrc } = this.attrs
        const s = dashArchiveSrc && (await this.options.getSrc(dashArchiveSrc))
        setState({
          src: `${s}/dash/index.mpd`,
          poster: `${s}/poster.jpeg`,
        })
      })()
    }, [this.attrs.dashArchiveSrc])

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

        <_PlayButton onClick={togglePlaying}>
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
