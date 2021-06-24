import styled from '@emotion/styled'
import { NodeSpec } from 'prosemirror-model'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { FigureView } from '../lib/FigureView'
import Node, { createReactNodeViewCreator, NodeViewCreator } from './Node'

export interface ImageBlockOptions {
  upload: (file: File) => Promise<string>
  getSrc: (src: string) => Promise<string> | string
}

export default class ImageBlock extends Node {
  constructor(private options: ImageBlockOptions) {
    super()
  }

  private stopEvent = false

  get name(): string {
    return 'image_block'
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
          tag: 'figure[data-type="image_block"]',
          getAttrs: dom => {
            const img = (dom as HTMLElement).getElementsByTagName('img')[0]
            const caption = (dom as HTMLElement).getElementsByTagName('figcaption')[0]
            return {
              src: img?.getAttribute('data-src'),
              caption: caption?.textContent,
            }
          },
        },
      ],
      toDOM: node => {
        return [
          'figure',
          { 'data-type': 'image_block' },
          ['img', { 'data-src': node.attrs.src, title: node.attrs.caption }],
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

        const url = useRef<string>()
        const loading = useRef(false)

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
          setUrl(URL.createObjectURL(file))
          ;(async () => {
            setLoading(true)
            try {
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
              <img src={url.current || undefined} />
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

  > img {
    vertical-align: middle;
    object-fit: contain;
    max-width: 100%;
  }
`
