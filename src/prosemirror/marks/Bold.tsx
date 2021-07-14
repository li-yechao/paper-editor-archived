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

import { FormatBold } from '@material-ui/icons'
import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType } from 'prosemirror-model'
import React from 'react'
import createMenuComponent, { MenuComponentType } from '../lib/createMenuComponent'
import isMarkActive from '../lib/isMarkActive'
import markInputRule from '../lib/markInputRule'
import toggleMark from '../lib/toggleMark'
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
