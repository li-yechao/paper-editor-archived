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

import { Keymap } from 'prosemirror-commands'
import { NodeType, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType, setTextSelection } from 'prosemirror-utils'
import Node, { NodeViewCreator, StrictNodeSpec, ProsemirrorNode } from '../Node'
import VideoBlockNodeView from './VideoBlockNodeView'

const VIDEO_BLOCK_CAPTION_NAME = 'video_block_caption'

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
      schema.nodes[VIDEO_BLOCK_CAPTION_NAME]!.create(undefined, schema.text(file.name))
    )
    ;(node as any).file = file
    return node as any
  }

  get name(): string {
    return 'video_block'
  }

  get schema(): StrictNodeSpec<VideoBlockAttrs> {
    return {
      attrs: {
        naturalWidth: { default: null },
        naturalHeight: { default: null },
        thumbnail: { default: null },
        dashArchiveSrc: { default: null },
      },
      content: VIDEO_BLOCK_CAPTION_NAME,
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

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      // NOTE: Move cursor to next node when input Enter.
      Enter: (state, dispatch) => {
        if (dispatch) {
          const { $from, $to } = state.selection
          const fromNode = $from.node($from.depth)
          const toNode = $to.node($to.depth)
          if (fromNode.type.name === VIDEO_BLOCK_CAPTION_NAME && fromNode === toNode) {
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
          fromNode.type.name === VIDEO_BLOCK_CAPTION_NAME &&
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

  childNodes = [new VideoBlockCaption()]
}

interface VideoBlockCaptionAttrs {}

class VideoBlockCaption extends Node<VideoBlockCaptionAttrs> {
  get name(): string {
    return VIDEO_BLOCK_CAPTION_NAME
  }

  get schema(): StrictNodeSpec<VideoBlockCaptionAttrs> {
    return {
      attrs: {},
      content: 'text*',
      marks: '',
      parseDOM: [{ tag: 'div' }],
      toDOM: () => ['div', 0],
    }
  }
}
