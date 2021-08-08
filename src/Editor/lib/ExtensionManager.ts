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

import { InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { MarkSpec, NodeSpec, Schema, Node as ProsemirrorNode } from 'prosemirror-model'
import { EditorState, Plugin } from 'prosemirror-state'
import { Decoration, DirectEditorProps, EditorView, NodeView } from 'prosemirror-view'
import { notEmpty } from '../../utils/array'
import Mark from '../marks/Mark'
import Node, { ChildNode } from '../nodes/Node'
import { MenuComponentType } from './createMenuComponent'
import Extension from './Extension'

export default class ExtensionManager {
  constructor(public extensions: Extension[] = []) {
    this.schema = new Schema({
      nodes: this.nodeSpecs,
      marks: this.markSpecs,
    })
  }

  private readonly schema: Schema

  private get nodes(): Node[] {
    return this.extensions.filter((i): i is Node => i instanceof Node)
  }

  private get childNodes(): ChildNode[] {
    return this.nodes.flatMap(i => i.childNodes ?? [])
  }

  private get allNodes(): Node[] {
    return this.nodes.concat(this.childNodes)
  }

  private get nodeSpecs(): { [key: string]: NodeSpec } {
    return this.allNodes.reduce((res, i) => ({ ...res, [i.name]: i.schema }), {})
  }

  private get marks(): Mark[] {
    return this.extensions.filter((i): i is Mark => i instanceof Mark)
  }

  private get markSpecs(): { [key: string]: MarkSpec } {
    return this.marks.reduce((res, i) => ({ ...res, [i.name]: i.schema }), {})
  }

  private async plugins(): Promise<Plugin[]> {
    const plugins = (await Promise.all(this.extensions.map(i => i.plugins))).flat()
    const childNodePlugins = (await Promise.all(this.childNodes.map(i => i.plugins))).flat()
    return plugins.concat(childNodePlugins)
  }

  private get inputRules(): InputRule[] {
    return this.allNodes
      .flatMap(i => i.inputRules({ type: this.schema.nodes[i.name]! }))
      .concat(
        this.marks.flatMap(i =>
          i.inputRules({ type: this.schema.marks[i.name]!, schema: this.schema })
        )
      )
  }

  private get keymap(): Plugin[] {
    return this.allNodes
      .map(i => keymap(i.keymap({ type: this.schema.nodes[i.name]! })))
      .concat(this.marks.map(i => keymap(i.keymap({ type: this.schema.marks[i.name]! }))))
  }

  private get nodeViews() {
    return this.allNodes.reduce<{
      [name: string]: (
        node: ProsemirrorNode,
        view: EditorView,
        getPos: (() => number) | boolean,
        decorations: Decoration[]
      ) => NodeView
    }>((res, i) => {
      const { nodeView } = i
      if (nodeView) {
        res[i.name] = (node, view, getPos) => nodeView({ node, view, getPos })
      }
      return res
    }, {})
  }

  private get menus(): MenuComponentType[] {
    return this.marks.flatMap(i => i.menus({ type: this.schema.marks[i.name]! }))
  }

  private async createState() {
    const defaultValue = await this.extensions.find(i => i.defaultValue)?.defaultValue?.()

    return EditorState.create({
      schema: this.schema,
      doc: defaultValue && ProsemirrorNode.fromJSON(this.schema, defaultValue),
      plugins: [inputRules({ rules: this.inputRules }), ...this.keymap, ...(await this.plugins())],
    })
  }

  private get dispatchTransactionHandlers() {
    return this.extensions
      .map(i => i.dispatchTransaction)
      .filter(notEmpty)
      .concat(this.childNodes.map(i => i.dispatchTransaction).filter(notEmpty))
  }

  private get editable() {
    return this.extensions.find(i => i.editable)?.editable
  }

  async createEditor(
    place:
      | globalThis.Node
      | ((p: globalThis.Node) => void)
      | { mount: globalThis.Node }
      | undefined,
    props: Omit<DirectEditorProps, 'state' | 'nodeViews'>
  ): Promise<{ view: EditorView; menus: MenuComponentType[] }> {
    const { dispatchTransactionHandlers, editable } = this

    const view = new EditorView(place, {
      ...props,
      state: await this.createState(),
      nodeViews: this.nodeViews,
      editable,
      dispatchTransaction: function (tr) {
        let state = view.state.apply(tr)

        for (const f of dispatchTransactionHandlers) {
          state = f(view, tr, state)
        }

        view.updateState(state)
      },
    })

    const setView = (exts: Extension[], view: EditorView) => {
      for (const ext of exts) {
        ext.view = view

        if (ext instanceof Node && ext.childNodes) {
          setView(ext.childNodes, view)
        }
      }
    }
    setView(this.extensions, view)

    return { view, menus: this.menus }
  }
}
