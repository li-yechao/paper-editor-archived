import { FormatUnderlined } from '@material-ui/icons'
import { Keymap, toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType } from 'prosemirror-model'
import React from 'react'
import createMenuComponent, { MenuComponentType } from '../lib/createMenuComponent'
import isMarkActive from '../lib/isMarkActive'
import markInputRule from '../lib/markInputRule'
import Mark from './Mark'

export default class Underline extends Mark {
  get name() {
    return 'underline'
  }

  get schema(): MarkSpec {
    return {
      parseDOM: [
        { tag: 'u' },
        {
          style: 'text-decoration',
          getAttrs: value => value === 'underline' && null,
        },
      ],
      toDOM: () => ['u'],
    }
  }

  inputRules({ type }: { type: MarkType }): InputRule[] {
    return [markInputRule(/(?:__)([^_]+)(?:__)$/, type)]
  }

  keymap({ type }: { type: MarkType }): Keymap {
    return {
      'Mod-u': toggleMark(type),
    }
  }

  menus({ type }: { type: MarkType }): MenuComponentType[] {
    return [
      createMenuComponent({
        children: <FormatUnderlined />,
        isActive: isMarkActive(type),
        toggleMark: toggleMark(type),
      }),
    ]
  }
}
