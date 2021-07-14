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

import { toggleMark as _toggleMark } from 'prosemirror-commands'
import { MarkType } from 'prosemirror-model'
import { EditorState, Transaction } from 'prosemirror-state'

export default function toggleMark(type: MarkType) {
  const cmd = _toggleMark(type)

  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const { empty, $from } = state.selection
    if (dispatch && empty && type.isInSet($from.marks())) {
      const start = $from.posAtIndex($from.index())
      const length = $from.parent.maybeChild($from.index())?.text?.length
      if (length) {
        dispatch(state.tr.removeMark(start, start + length, type))
        return true
      }
    }
    return cmd(state, dispatch)
  }
}
