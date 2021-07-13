import { FormatColorText } from '@material-ui/icons'
import { Keymap, toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType } from 'prosemirror-model'
import React from 'react'
import createMenuComponent, { MenuComponentType } from '../lib/createMenuComponent'
import isMarkActive from '../lib/isMarkActive'
import markInputRule from '../lib/markInputRule'
import Mark from './Mark'

export default class Highlight extends Mark {
  get name() {
    return 'highlight'
  }

  get schema(): MarkSpec {
    return {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark'],
    }
  }

  inputRules({ type }: { type: MarkType }): InputRule[] {
    return [markInputRule(/(?:==)([^=]+)(?:==)$/, type)]
  }

  keymap({ type }: { type: MarkType }): Keymap {
    return {
      'Mod-Ctrl-h': toggleMark(type),
    }
  }

  menus({ type }: { type: MarkType }): MenuComponentType[] {
    return [
      createMenuComponent({
        children: <FormatColorText />,
        isActive: isMarkActive(type),
        toggleMark: toggleMark(type),
      }),
    ]
  }
}
