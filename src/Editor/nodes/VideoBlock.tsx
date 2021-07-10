import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { createFFmpeg, FFmpeg } from '@ffmpeg/ffmpeg'
import { Typography } from '@material-ui/core'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import dashjs from 'dashjs'
import { Keymap } from 'prosemirror-commands'
import { Node as ProsemirrorNode, NodeSpec, NodeType, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import CupertinoActivityIndicator from '../../components/CupertinoActivityIndicator'
import { StrictEventEmitter } from '../../utils/typed-events'
import { getImageThumbnail, readAsDataURL } from '../lib/image'
import Node, { NodeViewReact, NodeViewCreator } from './Node'

export interface VideoBlockOptions {
  upload: (file: File | File[]) => Promise<string>
  getSrc: (src: string) => Promise<string> | string
  getPoster: (poster: string) => Promise<string> | string
  thumbnail: {
    maxSize: number
  }
}

export default class VideoBlock extends Node {
  constructor(private options: VideoBlockOptions) {
    super()
  }

  async create(schema: Schema, file: File): Promise<ProsemirrorNode> {
    const node = schema.nodes[this.name]!.create(
      {},
      schema.nodes[this.contentName]!.create(undefined, schema.text(file.name))
    )
    ;(node as any).file = file
    return node
  }

  get name(): string {
    return 'video_block'
  }

  get contentName(): string {
    return `${this.name}_content`
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        src: { default: null },
        naturalWidth: { default: null },
        naturalHeight: { default: null },
        thumbnail: { default: null },
        poster: { default: null },
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
            const video = (dom as HTMLElement).getElementsByTagName('video')[0]
            return { src: video?.getAttribute('data-src') }
          },
        },
      ],
      toDOM: node => {
        return [
          'figure',
          { 'data-type': 'video_block' },
          ['video', { 'data-src': node.attrs.src }],
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
        const { $from, $to } = state.selection
        const node = $from.node(-1)
        if (!dispatch || node.type !== type || node !== $to.node(-1)) {
          return false
        }
        dispatch(
          state.tr.setSelection(
            TextSelection.create(state.doc, $from.pos - $from.parentOffset + node.nodeSize - 1)
          )
        )
        return true
      },
      // NOTE: Remove this node when backspace at first position.
      Backspace: (state, dispatch) => {
        const { $from, $to, empty } = state.selection
        const node = $from.node()
        if (!dispatch || !empty || node.type.name !== this.contentName || node !== $to.node()) {
          return false
        }
        if ($from.parentOffset === 0) {
          dispatch(removeParentNodeOfType(type)(state.tr))
          return true
        }
        return false
      },
    }
  }

  get nodeView(): NodeViewCreator {
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

class VideoBlockNodeView extends NodeViewReact {
  constructor(
    node: ProsemirrorNode,
    private view: EditorView,
    private getPos: () => number,
    private options: VideoBlockOptions
  ) {
    super(node)
    this.reactDOM.contentEditable = 'false'
    this.dom.classList.add(css`
      > figcaption {
        text-align: center;
      }
    `)
    this.dom.append(this.reactDOM, this.contentDOM)
  }

  dom = document.createElement('figure')

  reactDOM = document.createElement('div')

  contentDOM = document.createElement('figcaption')

  private isDragging = false

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

  component = () => {
    const file: File | undefined = (this.node as any).file

    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const player = useRef<HTMLVideoElement>(null)
    const playing = useRef(true)
    const loading = useRef(false)
    const src = useRef<string>()
    const dashSrc = useRef<string>()
    const poster = useRef<string>()
    const videoFile = useRef<VideoFile>()

    const setPlaying = useCallback((p: boolean) => {
      playing.current = p
      update()
    }, [])

    const setLoading = useCallback((l: boolean) => {
      loading.current = l
      update()
    }, [])

    useEffect(() => {
      ;(async () => {
        if (this.node.attrs.src) {
          src.current = await this.options.getSrc(this.node.attrs.src)
          update()
        }
      })()
    }, [this.node.attrs.src])

    useEffect(() => {
      ;(async () => {
        if (this.node.attrs.poster) {
          poster.current = await this.options.getPoster(this.node.attrs.poster)
          update()
        }
      })()
    }, [this.node.attrs.poster])

    useEffect(() => {
      ;(async () => {
        const { dashArchiveSrc } = this.node.attrs
        if (dashArchiveSrc) {
          const s = await this.options.getSrc(dashArchiveSrc)
          dashSrc.current = `${s}/dash/index.mpd`
          poster.current = `${s}/poster.jpeg`
          update()
        }
      })()
    }, [this.node.attrs.dashArchiveSrc])

    useEffect(() => {
      if (!file) {
        return
      }
      ;(async () => {
        setLoading(true)
        videoFile.current = new VideoFile(file)
        try {
          videoFile.current.on('progress', update)
          const poster = await videoFile.current.poster()
          const { thumbnail, naturalWidth, naturalHeight } = await getImageThumbnail(
            poster,
            this.options.thumbnail
          )
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              thumbnail: await readAsDataURL(thumbnail),
              naturalWidth,
              naturalHeight,
            })
          )

          const dash = await videoFile.current.dash()
          const filenameFile = new File([new Blob([file.name], { type: 'text/plain' })], 'filename')
          const dashArchiveSrc = await this.options.upload([filenameFile, poster, ...dash, file])
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              dashArchiveSrc,
            })
          )
        } finally {
          videoFile.current.destroy()
          videoFile.current = undefined
          setLoading(false)
        }
      })()
    }, [file])

    const playPause = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (playing.current) {
        player.current?.pause()
      } else {
        player.current?.play()
      }
      setPlaying(!playing.current)
    }, [])

    return (
      <_Content>
        {dashSrc.current ? (
          <DashPlayer
            poster={poster.current || this.node.attrs.thumbnail}
            width={this.node.attrs.naturalWidth}
            muted
            autoPlay={playing.current}
            playsInline
            src={dashSrc.current}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
        ) : (
          <video
            poster={poster.current || this.node.attrs.thumbnail}
            width={this.node.attrs.naturalWidth}
            ref={player}
            muted
            autoPlay={playing.current}
            playsInline
            src={src.current || undefined}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
        )}

        <_PlayButton onMouseUp={e => e.stopPropagation()} onClick={playPause}>
          {playing.current ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </_PlayButton>

        {loading.current && (
          <_Loading>
            <_CupertinoActivityIndicator />
            <ProgressText status={videoFile.current?.status} ratio={videoFile.current?.ratio} />
          </_Loading>
        )}
      </_Content>
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

const DashPlayer = (props: React.VideoHTMLAttributes<HTMLVideoElement>) => {
  const video = useRef<HTMLVideoElement>(null)
  const player = useRef<dashjs.MediaPlayerClass>()

  const initPlayer = useCallback((src?: string, autoPlay?: boolean) => {
    player.current?.destroy()
    player.current = dashjs.MediaPlayer().create()
    player.current.initialize(video.current!, src, autoPlay)
  }, [])

  useEffect(() => {
    initPlayer(props.src, props.autoPlay)
    return () => player.current?.destroy()
  }, [props.src])

  useEffect(() => {
    if (props.autoPlay) {
      if (video.current?.ended) {
        initPlayer(props.src, props.autoPlay)
      }
      player.current?.play()
    } else {
      player.current?.pause()
    }
  }, [props.autoPlay])

  return (
    <video
      ref={video}
      {...props}
      onEnded={e => {
        props.onEnded?.(e)
      }}
    />
  )
}

const _Content = styled.div`
  position: relative;
  text-align: center;

  > video {
    vertical-align: middle;
    object-fit: contain;
    max-width: 100%;
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
  width: 56px;
  height: 56px;
  color: currentColor;
  margin: 0;
`
