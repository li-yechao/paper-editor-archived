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
import { setTextSelection } from 'prosemirror-utils'
import Node, { StrictNodeSpec } from './Node'

export interface TitleAttrs {}

export default class Title extends Node<TitleAttrs> {
  get name(): string {
    return 'title'
  }

  get schema(): StrictNodeSpec<TitleAttrs> {
    return {
      attrs: {},
      content: 'text*',
      marks: '',
      defining: true,
      parseDOM: [{ tag: 'h1.title' }],
      toDOM: () => ['h1', { class: 'title' }, 0],
    }
  }

  keymap(): Keymap {
    return {
      Enter: (state, dispatch) => {
        const { $from } = state.selection
        if (dispatch && $from.node().type.name === this.name) {
          const next = $from.node($from.depth - 1).maybeChild($from.indexAfter($from.depth - 1))
          dispatch(setTextSelection($from.end() + (next?.nodeSize ?? 0) - 1, 1)(state.tr))
          return true
        }
        return false
      },
    }
  }
}
