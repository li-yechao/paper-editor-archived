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

import {
  insertMathCmd,
  makeBlockMathInputRule,
  makeInlineMathInputRule,
  mathBackspaceCmd,
  mathPlugin,
  REGEX_BLOCK_MATH_DOLLARS,
  REGEX_INLINE_MATH_DOLLARS,
} from '@benrbray/prosemirror-math'
import {
  chainCommands,
  deleteSelection,
  joinBackward,
  Keymap,
  selectNodeBackward,
} from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { NodeType } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import Node, { StrictNodeSpec } from './Node'

import '@benrbray/prosemirror-math/style/math.css'
import 'katex/dist/katex.min.css'

export interface MathAttrs {}

export default class Math extends Node<MathAttrs> {
  get name(): string {
    return 'math_inline'
  }

  get schema(): StrictNodeSpec<MathAttrs> {
    return {
      attrs: {},
      content: 'text*',
      group: 'inline',
      inline: true,
      atom: true,
      parseDOM: [{ tag: 'math-inline' }],
      toDOM: () => ['math-inline', 0],
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      'Mod-Space': insertMathCmd(type),
      // modify the default keymap chain for backspace
      Backspace: chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, type)]
  }

  get plugins(): Plugin[] {
    return [mathPlugin]
  }

  readonly childNodes = [new MathBlock()]
}

export interface MathBlockAttrs {}

class MathBlock extends Node<MathBlockAttrs> {
  get name(): string {
    return 'math_display'
  }

  get schema(): StrictNodeSpec<MathBlockAttrs> {
    return {
      attrs: {},
      content: 'text*',
      group: 'block',
      atom: true,
      code: true,
      parseDOM: [{ tag: 'math-display' }],
      toDOM: () => ['math-display', 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, type)]
  }
}
