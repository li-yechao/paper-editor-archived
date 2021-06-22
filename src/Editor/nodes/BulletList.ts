import { InputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { NodeSpec, NodeType } from 'prosemirror-model'
import Node from './Node'

export default class BulletList extends Node {
  get name(): string {
    return 'bullet_list'
  }

  get schema(): NodeSpec {
    return {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [wrappingInputRule(/^\s*([-+*])\s$/, type)]
  }
}
