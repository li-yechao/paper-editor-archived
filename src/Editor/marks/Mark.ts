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

import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType, Schema } from 'prosemirror-model'
import { MenuComponentType } from '../lib/createMenuComponent'
import Extension from '../lib/Extension'

export default abstract class Mark extends Extension {
  abstract get schema(): MarkSpec

  inputRules<S extends Schema<any, any>>(_options: {
    type: MarkType<S>
    schema: S
  }): InputRule<S>[] {
    return []
  }

  keymap<S extends Schema<any, any>>(_options: { type: MarkType<S> }): Keymap<S> {
    return {}
  }

  menus<S extends Schema<any, any>>(_options: { type: MarkType<S> }): MenuComponentType[] {
    return []
  }
}
