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

import { Plugin } from 'prosemirror-state'
import { findChildren } from 'prosemirror-utils'
import { Decoration, DecorationSet } from 'prosemirror-view'
import Extension from '../lib/Extension'

export default class Placeholder extends Extension {
  get name(): string {
    return 'placeholder'
  }

  get plugins(): Plugin[] {
    return [
      new Plugin({
        props: {
          decorations: state => {
            const decorations: Decoration[] = []

            const title = state.doc.firstChild
            if (title?.type.name === 'title' && title.textContent.trim().length === 0) {
              const placeholder = document.createElement('span')
              placeholder.setAttribute('data-placeholder', 'Untitled')
              placeholder.classList.add('ProseMirror-placeholder')
              decorations.push(Decoration.widget(1, placeholder))
            }

            const hasContent =
              findChildren(
                state.doc,
                n => n.type.name !== 'title' && n.isTextblock && n.textContent.trim().length > 0
              ).length > 0

            if (!hasContent) {
              const pos = findChildren(
                state.doc,
                n => n.type.name === 'paragraph' && n.textContent.trim().length === 0
              )[0]?.pos
              if (pos !== undefined) {
                const placeholder = document.createElement('span')
                placeholder.setAttribute('data-placeholder', 'Write something...')
                placeholder.classList.add('ProseMirror-placeholder')
                decorations.push(Decoration.widget(pos, placeholder))
              }
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  }
}
