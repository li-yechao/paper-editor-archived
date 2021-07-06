import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { Keymap } from 'prosemirror-commands'
import { Schema } from 'prosemirror-model'
import { Node as ProsemirrorNode, NodeSpec, NodeType } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { readAsDataURL, getImageThumbnail } from '../lib/image'
import Node, { NodeView, NodeViewCreator } from './Node'

export interface ImageBlockOptions {
  upload: (file: File) => Promise<string>
  getSrc: (src: string) => Promise<string> | string
  thumbnail: {
    maxSize: number
  }
}

export default class ImageBlock extends Node {
  constructor(private options: ImageBlockOptions) {
    super()
  }

  async create(schema: Schema, file: File): Promise<ProsemirrorNode> {
    return getImageThumbnail(file, { maxSize: this.options.thumbnail.maxSize })
      .then(res =>
        readAsDataURL(res.thumbnail).then(thumbnail => ({
          ...res,
          thumbnail,
        }))
      )
      .then(({ thumbnail, naturalWidth, naturalHeight }) => {
        const node = schema.nodes[this.name]!.create(
          {
            src: null,
            thumbnail,
            naturalWidth,
            naturalHeight,
          },
          schema.text(file.name)
        )
        ;(node as any).file = file
        return node
      })
  }

  get name(): string {
    return 'image_block'
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        src: { default: null },
        naturalWidth: { default: null },
        naturalHeight: { default: null },
        thumbnail: { default: null },
      },
      content: 'text*',
      marks: '',
      group: 'block',
      draggable: true,
      isolating: true,
      parseDOM: [
        {
          tag: 'figure[data-type="image_block"]',
          getAttrs: dom => {
            const img = (dom as HTMLElement).getElementsByTagName('img')[0]
            return { src: img?.getAttribute('data-src') }
          },
        },
      ],
      toDOM: node => {
        return [
          'figure',
          { 'data-type': 'image_block' },
          ['img', { 'data-src': node.attrs.src }],
          ['figcaption', 0],
        ]
      },
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      // NOTE: Move cursor to next node when input Enter.
      Enter: (state, dispatch) => {
        const { $from, $to } = state.selection
        const node = $from.node()
        if (!dispatch || node.type !== type || node !== $to.node()) {
          return false
        }
        dispatch(
          state.tr.setSelection(
            TextSelection.create(state.doc, $from.pos - $from.parentOffset + node.nodeSize)
          )
        )
        return true
      },
      // NOTE: Remove this node when backspace at first position.
      Backspace: (state, dispatch) => {
        const { $from, $to, empty } = state.selection
        const node = $from.node()
        if (!dispatch || !empty || node.type !== type || node !== $to.node()) {
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

      return new ImageBlockNodeView(node, view, getPos, this.options)
    }
  }
}

class ImageBlockNodeView extends NodeView {
  constructor(
    node: ProsemirrorNode,
    private view: EditorView,
    private getPos: () => number,
    private options: ImageBlockOptions
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
    return e.type !== 'characterData'
  }

  selectNode = () => {
    // NOTE: Move cursor to end of node,
    // do nothing if is dragging, otherwise DND will be duplicate this node.
    if (!this.isDragging) {
      setTimeout(() => {
        this.view.dispatch(
          this.view.state.tr.setSelection(
            TextSelection.create(this.view.state.doc, this.getPos() + this.node.nodeSize - 1)
          )
        )
        this._render()
      })
    }
  }

  component = () => {
    const { src } = this.node.attrs
    const file: File | undefined = (this.node as any).file

    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const url = useRef<string>(this.node.attrs.thumbnail)
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
      ;(async () => {
        setLoading(true)
        try {
          const src = await this.options.upload(file)
          setUrl(await this.options.getSrc(src))
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, { ...this.node.attrs, src })
          )
        } finally {
          setLoading(false)
        }
      })()
    }, [file])

    return (
      <_Picture>
        <img src={url.current} width={this.node.attrs.naturalWidth} />
      </_Picture>
    )
  }
}

const _Picture = styled.picture`
  text-align: center;

  > img {
    vertical-align: middle;
    object-fit: contain;
    max-width: 100%;
  }
`
