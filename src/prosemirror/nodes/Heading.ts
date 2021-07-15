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

import { css } from '@emotion/css'
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { NodeType } from 'prosemirror-model'
import Node, { NodeViewCreator, NodeView, StrictNodeSpec, StrictProsemirrorNode } from './Node'

export interface HeadingAttrs {
  level: number
}

export default class Heading extends Node<HeadingAttrs> {
  get name(): string {
    return 'heading'
  }

  get schema(): StrictNodeSpec<HeadingAttrs> {
    return {
      attrs: { level: { default: 1 } },
      content: 'text*',
      marks: '',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM: node => ['h' + node.attrs.level, 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [
      textblockTypeInputRule(/^(#{1,6})\s$/, type, match => ({
        level: match[1]!.length,
      })),
    ]
  }

  get nodeView(): NodeViewCreator<HeadingAttrs> {
    return ({ node }) => {
      return new HeadingNodeView(node)
    }
  }
}

class HeadingNodeView extends NodeView<HeadingAttrs> {
  constructor(node: StrictProsemirrorNode<HeadingAttrs>) {
    super()
    this.dom = document.createElement(`h${node.attrs.level}`)

    this.dom.classList.add(css`
      position: relative;
      list-style: none;
    `)
    const zero = document.createElement('span')
    zero.innerText = '\u200b'
    zero.classList.add(css`
      position: absolute;
      left: 0;
      top: 0;
    `)

    this.dom.append(zero, this.contentDOM)
  }

  dom: HTMLElement
  contentDOM = document.createElement('div')
}
