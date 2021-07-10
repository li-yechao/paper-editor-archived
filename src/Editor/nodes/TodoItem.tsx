import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { Checkbox } from '@material-ui/core'
import { Keymap } from 'prosemirror-commands'
import { Node as ProsemirrorNode, NodeSpec, NodeType } from 'prosemirror-model'
import { splitListItem } from 'prosemirror-schema-list'
import { EditorView } from 'prosemirror-view'
import React from 'react'
import Node, { NodeViewReact, NodeViewCreator } from './Node'

export default class TodoItem extends Node {
  constructor(private options: { readonly todoItemReadOnly?: boolean } = {}) {
    super()
  }

  get name(): string {
    return 'todo_item'
  }

  get schema(): NodeSpec {
    return {
      attrs: { checked: { default: false } },
      content: 'paragraph block*',
      defining: true,
      draggable: true,
      parseDOM: [
        {
          tag: 'li[data-type="todo_item"]',
          getAttrs: dom => ({
            checked: (dom as HTMLElement).getAttribute('data-checked') === 'true',
          }),
        },
      ],
      toDOM: node => {
        return [
          'li',
          {
            'data-type': 'todo_item',
            'data-checked': node.attrs.checked ? 'true' : 'false',
          },
          ['div', 0],
        ]
      },
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      Enter: splitListItem(type),
    }
  }

  get nodeView(): NodeViewCreator {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new TodoItemNodeView(node, view, getPos, this.options.todoItemReadOnly ?? true)
    }
  }
}

class TodoItemNodeView extends NodeViewReact {
  constructor(
    node: ProsemirrorNode,
    private view: EditorView,
    private getPos: () => number,
    private todoItemReadOnly: boolean
  ) {
    super(node)

    this.dom.classList.add(css`
      position: relative;
      list-style: none;
    `)
    this.reactDOM.contentEditable = 'false'
    this.reactDOM.classList.add(css`
      position: absolute;
      left: -32px;
      top: 0;
    `)
    const zero = document.createElement('span')
    zero.innerText = '\u200b'
    zero.classList.add(css`
      position: absolute;
      left: 0;
      top: 0;
    `)

    this.dom.append(this.reactDOM, zero, this.contentDOM)
  }

  dom = document.createElement('li')
  reactDOM = document.createElement('span')
  contentDOM = document.createElement('div')

  ignoreMutation = (e: MutationRecord | { type: 'selection'; target: Element }) => {
    return this.reactDOM.contains(e.target)
  }

  get checked() {
    return this.node.attrs.checked === true
  }

  get disabled() {
    return this.todoItemReadOnly
  }

  component = () => {
    return (
      <_Checkbox
        checked={this.checked}
        disabled={this.disabled}
        onChange={(e, checked) => {
          e.target.focus()
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              checked,
            })
          )
        }}
      />
    )
  }
}

const _Checkbox = styled(Checkbox)`
  color: inherit !important;
  padding: 0;
  vertical-align: text-bottom;
`
