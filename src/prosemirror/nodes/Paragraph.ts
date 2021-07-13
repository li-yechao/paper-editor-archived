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

import { NodeSpec } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import Node from './Node'

export default class Paragraph extends Node {
  get name(): string {
    return 'paragraph'
  }

  get schema(): NodeSpec {
    return {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    }
  }

  get plugins() {
    return [
      new Plugin({
        appendTransaction: (_trs, _oldState, newState) => {
          if (newState.doc.lastChild?.type.name !== this.name) {
            const type = newState.schema.nodes[this.name]
            return newState.tr.insert(newState.doc.content.size, type.create())
          }
          return
        },
      }),
    ]
  }
}
