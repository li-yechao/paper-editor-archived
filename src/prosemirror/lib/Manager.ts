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
import { Decoration, EditorView, NodeView } from 'prosemirror-view'
import Mark from '../marks/Mark'
import Node from '../nodes/Node'
import Extension from './Extension'

export default class Manager {
  constructor(public extensions: Extension[] = [], private doc?: { [key: string]: any }) {
    this.schema = new Schema({
      nodes: this.nodeSpecs,
      marks: this.markSpecs,
    })
  }

  readonly schema: Schema

  get nodes(): Node<any>[] {
    return <Node<any>[]>this.extensions.filter(i => i.type === 'node')
  }

  get nodeSpecs(): { [key: string]: NodeSpec } {
    return this.nodes.reduce((res, i) => ({ ...res, [i.name]: i.schema, ...i.schema_extra }), {})
  }

  get marks(): Mark[] {
    return <Mark[]>this.extensions.filter(i => i.type === 'mark')
  }

  get markSpecs(): { [key: string]: MarkSpec } {
    return this.marks.reduce((res, i) => ({ ...res, [i.name]: i.schema }), {})
  }

  get plugins(): Plugin[] {
    return this.extensions.reduce((res, i) => res.concat(i.plugins), [] as Plugin[])
  }

  get inputRules(): InputRule[] {
    return this.nodes
      .flatMap(i => i.inputRules({ type: this.schema.nodes[i.name]! }))
      .concat(
        this.marks.flatMap(i =>
          i.inputRules({ type: this.schema.marks[i.name]!, schema: this.schema })
        )
      )
  }

  get keymap(): Plugin[] {
    return this.nodes
      .map(i => keymap(i.keymap({ type: this.schema.nodes[i.name]! })))
      .concat(this.marks.map(i => keymap(i.keymap({ type: this.schema.marks[i.name]! }))))
  }

  get nodeViews() {
    return this.nodes.reduce(
      (res, i) => {
        const { nodeView } = i
        if (nodeView) {
          res[i.name] = (node, view, getPos) => nodeView({ node, view, getPos })
        }
        return res
      },
      <
        {
          [name: string]: (
            node: ProsemirrorNode,
            view: EditorView,
            getPos: (() => number) | boolean,
            decorations: Decoration[]
          ) => NodeView
        }
      >{}
    )
  }

  get menus() {
    return this.marks.flatMap(i => i.menus({ type: this.schema.marks[i.name]! }))
  }

  createState() {
    return EditorState.create({
      schema: this.schema,
      doc: this.doc && ProsemirrorNode.fromJSON(this.schema, this.doc),
      plugins: [inputRules({ rules: this.inputRules }), ...this.keymap, ...this.plugins],
    })
  }
}
