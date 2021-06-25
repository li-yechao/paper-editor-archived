import { FormatBold } from '@material-ui/icons'
import { Keymap, toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType } from 'prosemirror-model'
import React from 'react'
import createMenuComponent, { MenuComponentType } from '../lib/createMenuComponent'
import isMarkActive from '../lib/isMarkActive'
import markInputRule from '../lib/markInputRule'
import Mark from './Mark'

export default class Bold extends Mark {
  get name() {
    return 'bold'
  }

  get schema(): MarkSpec {
    return {
      parseDOM: [
        { tag: 'b' },
        { tag: 'strong' },
        {
          style: 'font-weight',
          getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
        },
      ],
      toDOM: () => ['strong'],
    }
  }

  inputRules({ type }: { type: MarkType }): InputRule[] {
    return [markInputRule(/(?:\*\*)([^*]+)(?:\*\*)$/, type)]
  }

  keymap({ type }: { type: MarkType }): Keymap {
    return {
      'Mod-b': toggleMark(type),
      'Mod-B': toggleMark(type),
    }
  }

  menus({ type }: { type: MarkType }): MenuComponentType[] {
    return [
      createMenuComponent({
        children: <FormatBold />,
        isActive: isMarkActive(type),
        toggleMark: toggleMark(type),
      }),
    ]
  }
}
