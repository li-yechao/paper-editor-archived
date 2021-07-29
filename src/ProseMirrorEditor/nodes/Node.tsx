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

import { StylesProvider } from '@material-ui/core'
import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import {
  DOMOutputSpec,
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
  ParseRule,
  Schema,
} from 'prosemirror-model'
import { Decoration, EditorView, NodeView as ProsemirrorNodeView } from 'prosemirror-view'
import React from 'react'
import ReactDOM from 'react-dom'
import Extension, { ExtensionType } from '../lib/Extension'

export { Node as ProsemirrorNode } from 'prosemirror-model'

export type StrictProsemirrorNode<T extends { [key: string]: any } = {}> = Omit<
  ProsemirrorNode,
  'attrs'
> & {
  attrs: T
}

export type NodeViewCreator<T> = (args: {
  node: StrictProsemirrorNode<T>
  view: EditorView
  getPos: (() => number) | boolean
}) => ProsemirrorNodeView | NodeView<T>

export interface StrictParseRule<T> extends ParseRule {
  getAttrs?: ((p: globalThis.Node | string) => T | false | null | undefined) | null
}

export interface StrictNodeSpec<T> extends Omit<RemoveIndex<NodeSpec>, 'toDOM'> {
  attrs: { [key in keyof T]: { default: T[key] } } & { _phantom?: any }

  toDOM?: ((node: StrictProsemirrorNode<T>) => DOMOutputSpec) | null

  parseDOM?: StrictParseRule<T>[] | null
}

export default abstract class Node<T> extends Extension {
  get type(): ExtensionType {
    return 'node'
  }

  abstract get schema(): StrictNodeSpec<T>

  readonly childNodes?: Node<any>[]

  inputRules<S extends Schema<any, any>>(_options: { type: NodeType<S> }): InputRule<S>[] {
    return []
  }

  keymap<S extends Schema<any, any>>(_options: { type: NodeType<S> }): Keymap<S> {
    return {}
  }

  get nodeView(): NodeViewCreator<T> | undefined {
    return undefined
  }
}

export abstract class NodeView<T> {
  abstract dom: HTMLElement

  contentDOM?: HTMLElement

  update?: (node: StrictProsemirrorNode<T>, decorations: Decoration[]) => boolean

  selectNode?: () => void

  deselectNode?: () => void

  setSelection?: (anchor: number, head: number, root: Document) => void

  stopEvent?: (event: Event) => boolean

  ignoreMutation?: (p: MutationRecord | { type: 'selection'; target: Element }) => boolean

  destroy?: () => void
}

export abstract class NodeViewReact<T> extends NodeView<T> {
  constructor(public node: StrictProsemirrorNode<T>) {
    super()
    setTimeout(() => this._render())
  }

  abstract reactDOM: HTMLElement

  update = (updatedNode: StrictProsemirrorNode<T>, _decorations: Decoration[]) => {
    if (updatedNode.type !== this.node.type) {
      return false
    }
    this.node = updatedNode
    this._render()
    return true
  }

  destroy = () => {
    ReactDOM.unmountComponentAtNode(this.reactDOM)
  }

  abstract component: React.ComponentType<{ node: StrictProsemirrorNode<T> }>

  _render() {
    ReactDOM.render(
      <StylesProvider injectFirst>
        <this.component node={this.node} />
      </StylesProvider>,
      this.reactDOM
    )
  }
}

export abstract class NodeViewReactSelectable<T> extends NodeViewReact<T> {
  constructor(node: StrictProsemirrorNode<T>) {
    super(node)
  }

  selected = false

  selectNode = () => {
    this.selected = true
    this._render()
  }

  deselectNode = () => {
    this.selected = false
    this._render()
  }

  setSelection = () => {
    this.selected = true
    this._render()
  }
}
