import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { createFFmpeg, FFmpeg } from '@ffmpeg/ffmpeg'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import { Keymap } from 'prosemirror-commands'
import { Node as ProsemirrorNode, NodeSpec, NodeType, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import CupertinoActivityIndicator from '../../components/CupertinoActivityIndicator'
import { getImageThumbnail, readAsDataURL } from '../lib/image'
import Node, { NodeView, NodeViewCreator } from './Node'

export interface VideoBlockOptions {
  upload: (file: File) => Promise<string>
  getSrc: (src: string) => Promise<string> | string
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

class VideoFile {
  constructor(public file: File) {}

  private _ffmpeg?: Promise<FFmpeg>
  private get ffmpeg(): Promise<FFmpeg> {
    if (!this._ffmpeg) {
      this._ffmpeg = new Promise(async resolve => {
        const ffmpeg = createFFmpeg({
          corePath: './static/ffmpeg-core/ffmpeg-core.js',
        })
        await ffmpeg.load()
        const buffer = await this.file.arrayBuffer()
        ffmpeg.FS('writeFile', this.file.name, new Uint8Array(buffer, 0, buffer.byteLength))
        resolve(ffmpeg)
      })
    }
    return this._ffmpeg
  }

  async getThumbnail(): Promise<File> {
    const thumbnailName = `${this.file.name}.jpeg`

    await (await this.ffmpeg).run(
      '-i',
      this.file.name,
      '-vframes',
      '1',
      '-f',
      'image2',
      thumbnailName
    )

    const output = await (await this.ffmpeg).FS('readFile', thumbnailName)

    return new File([new Blob([output.buffer], { type: 'image/jpeg' })], thumbnailName, {
      type: 'image/jpeg',
    })
  }

  async convert(type: 'mp4' = 'mp4'): Promise<File> {
    const filename = `${this.file.name}.${type}`
    await (await this.ffmpeg).run('-i', this.file.name, filename)
    const output = await (await this.ffmpeg).FS('readFile', filename)
    return new File([new Blob([output.buffer], { type: `video/${type}` })], filename, {
      type: `video/${type}`,
    })
  }
}

class VideoBlockNodeView extends NodeView {
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
    const { src, thumbnail } = this.node.attrs
    const file: File | undefined = (this.node as any).file

    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const player = useRef<HTMLVideoElement>(null)
    const playing = useRef(true)
    const url = useRef<string>()
    const loading = useRef(false)

    const setUrl = useCallback((u: string) => {
      url.current = u
      update()
    }, [])

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
        if (src) {
          setUrl(await this.options.getSrc(src))
        }
      })()
    }, [src])

    useEffect(() => {
      if (!file) {
        return
      }
      ;(async () => {
        setLoading(true)
        try {
          const videoFile = new VideoFile(file)
          const { thumbnail, naturalWidth, naturalHeight } = await getImageThumbnail(
            await videoFile.getThumbnail(),
            {
              maxSize: this.options.thumbnail.maxSize,
            }
          )

          const thumbnailDataUrl = await readAsDataURL(thumbnail)
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              thumbnail: thumbnailDataUrl,
              naturalWidth,
              naturalHeight,
            })
          )

          const newFile = await videoFile.convert('mp4')
          const src = await this.options.upload(newFile)
          setUrl(await this.options.getSrc(src))
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, { ...this.node.attrs, src })
          )
        } finally {
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
      setPlaying(!playing)
    }, [])

    return (
      <_Content>
        <video
          poster={thumbnail}
          width={this.node.attrs.naturalWidth}
          ref={player}
          muted
          autoPlay={playing.current}
          playsInline
          src={url.current || undefined}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />

        <_PlayButton onMouseUp={e => e.stopPropagation()} onClick={playPause}>
          {playing.current ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </_PlayButton>

        {loading.current && (
          <_Loading>
            <_CupertinoActivityIndicator />
          </_Loading>
        )}
      </_Content>
    )
  }
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
  align-items: center;
  justify-content: center;
  background-color: rgba(128, 128, 128, 0.5);
`

const _CupertinoActivityIndicator = styled(CupertinoActivityIndicator)`
  width: 56px;
  height: 56px;
  color: currentColor;
`
