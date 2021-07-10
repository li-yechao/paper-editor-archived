import { css } from '@emotion/css'
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { Node as ProsemirrorNode, NodeSpec, NodeType } from 'prosemirror-model'
import Node, { NodeView, NodeViewCreator } from './Node'

export default class Heading extends Node {
  get name(): string {
    return 'heading'
  }

  get schema(): NodeSpec {
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

  get nodeView(): NodeViewCreator {
    return ({ node }) => {
      return new HeadingNodeView(node)
    }
  }
}

class HeadingNodeView extends NodeView {
  constructor(node: ProsemirrorNode) {
    super(node)
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
  reactDOM = document.createElement('span')
  contentDOM = document.createElement('div')

  component = () => null
}
