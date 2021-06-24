import styled from '@emotion/styled'
import { createFFmpeg } from '@ffmpeg/ffmpeg'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import { NodeSpec } from 'prosemirror-model'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { FigureView } from '../lib/FigureView'
import Node, { createReactNodeViewCreator, NodeViewCreator } from './Node'

export interface VideoBlockOptions {
  upload: (file: File) => Promise<string>
  getSrc: (src: string) => Promise<string> | string
}

export default class VideoBlock extends Node {
  constructor(private options: VideoBlockOptions) {
    super()
  }

  private stopEvent = false

  get name(): string {
    return 'video_block'
  }

  get schema(): NodeSpec {
    return {
      attrs: { src: { default: null }, caption: { default: null } },
      marks: '',
      group: 'block',
      defining: true,
      isolating: true,
      atom: true,
      draggable: true,
      parseDOM: [
        {
          tag: 'figure[data-type="video_block"]',
          getAttrs: dom => {
            const video = (dom as HTMLElement).getElementsByTagName('video')[0]
            const caption = (dom as HTMLElement).getElementsByTagName('figcaption')[0]
            return {
              src: video?.getAttribute('data-src'),
              caption: caption?.textContent,
            }
          },
        },
      ],
      toDOM: node => {
        return [
          'figure',
          { 'data-type': 'video_block' },
          ['video', { 'data-src': node.attrs.src, title: node.attrs.caption }],
          ['figcaption', node.attrs.caption],
        ]
      },
    }
  }

  get nodeView(): NodeViewCreator {
    return createReactNodeViewCreator(
      ({
        file,
        src,
        caption,
        selected,
        readOnly,
        onSrcChange,
        onCaptionChange,
      }: {
        file?: File
        src?: string
        caption?: string
        selected?: boolean
        readOnly?: boolean
        onSrcChange?: (src: string) => void
        onCaptionChange?: (caption: string) => void
      }) => {
        const _mounted = useMountedState()
        const _update = useUpdate()
        const update = useCallback(() => _mounted() && _update(), [])

        const player = useRef<HTMLVideoElement>(null)
        const playing = useRef(true)
        const url = useRef<string>()
        const loading = useRef(false)

        const setPlaying = useCallback((p: boolean) => {
          playing.current = p
          update()
        }, [])

        const setUrl = useCallback((u: string) => {
          url.current = u
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
              if (file.type !== 'video/mp4') {
                const ffmpeg = createFFmpeg({
                  corePath: './static/ffmpeg-core/ffmpeg-core.js',
                })
                await ffmpeg.load()
                const buffer = await file.arrayBuffer()
                ffmpeg.FS('writeFile', file.name, new Uint8Array(buffer, 0, buffer.byteLength))
                await ffmpeg.run('-i', file.name, 'output.mp4')
                const output = await ffmpeg.FS('readFile', 'output.mp4')
                file = new File(
                  [new Blob([output.buffer], { type: 'video/mp4' })],
                  `${file.name}.mp4`
                )
              }

              setUrl(URL.createObjectURL(file))

              const src = await this.options.upload(file)
              setUrl(await this.options.getSrc(src))
              onSrcChange?.(src)
            } finally {
              setLoading(false)
            }
          })()
        }, [file])

        const handleCaptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
          onCaptionChange?.(e.target.value)
        }, [])

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
          <FigureView
            selected={selected}
            readOnly={readOnly}
            caption={caption}
            loading={loading.current}
            onCaptionChange={handleCaptionChange}
            toggleStopEvent={e => (this.stopEvent = e)}
          >
            <_Content>
              <video
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
            </_Content>
          </FigureView>
        )
      },
      ({ selected, node, view, getPos }) => {
        return {
          file: (node as any).file,
          src: node.attrs.src,
          caption: node.attrs.caption,
          selected,
          readOnly: !view.editable,
          onSrcChange: src => {
            view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, src }))
          },
          onCaptionChange: caption => {
            view.dispatch(
              view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, caption })
            )
          },
        }
      },
      {
        stopEvent: () => this.stopEvent,
        ignoreMutation: () => true,
      }
    )
  }
}

const _Content = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;

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
