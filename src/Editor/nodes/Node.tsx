import { StylesProvider } from '@material-ui/core'
import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { NodeSpec, Node as ProsemirrorNode, NodeType, Schema } from 'prosemirror-model'
import { Decoration, EditorView, NodeView as ProsemirrorNodeView } from 'prosemirror-view'
import React from 'react'
import ReactDOM from 'react-dom'
import Extension, { ExtensionType } from '../lib/Extension'

export type NodeViewCreator = (args: {
  node: ProsemirrorNode
  view: EditorView
  getPos: (() => number) | boolean
}) => ProsemirrorNodeView

export default abstract class Node extends Extension {
  get type(): ExtensionType {
    return 'node'
  }

  abstract get schema(): NodeSpec

  get schema_extra(): { [name: string]: NodeSpec } {
    return {}
  }

  inputRules<S extends Schema<any, any>>(_options: { type: NodeType<S> }): InputRule<S>[] {
    return []
  }

  keymap<S extends Schema<any, any>>(_options: { type: NodeType<S> }): Keymap<S> {
    return {}
  }

  get nodeView(): NodeViewCreator | undefined {
    return undefined
  }
}

export abstract class NodeView implements ProsemirrorNodeView {
  abstract dom: HTMLElement

  contentDOM?: HTMLElement

  update?: (node: ProsemirrorNode, decorations: Decoration[]) => boolean

  selectNode?: () => void

  deselectNode?: () => void

  setSelection?: (anchor: number, head: number, root: Document) => void

  stopEvent?: (event: Event) => boolean

  ignoreMutation?: (p: MutationRecord | { type: 'selection'; target: Element }) => boolean

  destroy?: () => void
}

export abstract class NodeViewReact extends NodeView {
  constructor(public node: ProsemirrorNode) {
    super()
    setTimeout(() => this._render())
  }

  abstract reactDOM: HTMLElement

  update = (updatedNode: ProsemirrorNode, _decorations: Decoration[]) => {
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

  abstract component: React.ComponentType

  _render() {
    ReactDOM.render(
      <StylesProvider injectFirst>
        <this.component />
      </StylesProvider>,
      this.reactDOM
    )
  }
}

export abstract class NodeViewReactSelectable extends NodeViewReact {
  constructor(node: ProsemirrorNode) {
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
