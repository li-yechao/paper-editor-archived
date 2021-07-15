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

import { InputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { NodeType } from 'prosemirror-model'
import Node, { StrictNodeSpec } from './Node'

export interface OrderedListAttrs {}

export default class OrderedList extends Node<OrderedListAttrs> {
  get name(): string {
    return 'ordered_list'
  }

  get schema(): StrictNodeSpec<OrderedListAttrs> {
    return {
      attrs: {},
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ol' }],
      toDOM: () => ['ol', 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [wrappingInputRule(/^(\d+)\.\s$/, type)]
  }
}
