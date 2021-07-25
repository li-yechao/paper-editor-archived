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
import { NodeSpec, NodeType } from 'prosemirror-model'
import { setTextSelection } from 'prosemirror-utils'
import Node, { StrictNodeSpec } from './Node'

export interface TagsAttrs {}

export default class TagList extends Node<TagsAttrs> {
  get name(): string {
    return 'tag_list'
  }

  get contentName(): string {
    return `tag_item`
  }

  get schema(): StrictNodeSpec<TagsAttrs> {
    return {
      attrs: {},
      content: `${this.contentName}+`,
      marks: '',
      selectable: false,
      isolating: true,
      parseDOM: [{ tag: 'ul[data-type="tag_list"]' }],
      toDOM: () => ['ul', { 'data-type': 'tag_list' }, 0],
    }
  }

  get schema_extra(): { [name: string]: NodeSpec } {
    return {
      [this.contentName]: {
        content: 'text*',
        marks: '',
        parseDOM: [{ tag: 'li' }],
        toDOM: () => ['li', 0],
      },
    }
  }

  keymap(_: { type: NodeType }): Keymap {
    return {
      Space: (state, dispatch) => {
        if (dispatch) {
          const { $from } = state.selection
          if ($from.node().type.name === this.contentName) {
            dispatch(state.tr.split($from.pos).scrollIntoView())
            return true
          }
        }
        return false
      },
      Enter: (state, dispatch) => {
        const { $from } = state.selection
        if (dispatch && $from.node().type.name === this.contentName) {
          const next = $from.node($from.depth - 1).maybeChild($from.indexAfter($from.depth - 1))
          dispatch(
            setTextSelection(
              next ? $from.after() + next.nodeSize : $from.after($from.depth - 1) + 1,
              -1
            )(state.tr)
          )
          return true
        }
        return false
      },
    }
  }
}
