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
