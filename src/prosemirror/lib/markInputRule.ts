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

import { MarkType, Mark } from 'prosemirror-model'
import { InputRule } from 'prosemirror-inputrules'
import { EditorState } from 'prosemirror-state'

function getMarksBetween(start: number, end: number, state: EditorState) {
  let marks: { start: number; end: number; mark: Mark }[] = []

  state.doc.nodesBetween(start, end, (node, pos) => {
    marks = [
      ...marks,
      ...node.marks.map(mark => ({
        start: pos,
        end: pos + node.nodeSize,
        mark,
      })),
    ]
  })

  return marks
}

export default function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: (match: string[]) => Record<string, unknown>
): InputRule {
  return new InputRule(
    regexp,
    (state: EditorState, match: string[], start: number, end: number) => {
      const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
      const { tr } = state
      const m = match.length - 1
      let markEnd = end
      let markStart = start

      if (match[m]) {
        const matchStart = start + match[0]!.indexOf(match[m - 1]!)
        const matchEnd = matchStart + match[m - 1]!.length - 1
        const textStart = matchStart + match[m - 1]!.lastIndexOf(match[m]!)
        const textEnd = textStart + match[m]!.length

        const excludedMarks = getMarksBetween(start, end, state)
          .filter(item => item.mark.type.excludes(markType))
          .filter(item => item.end > matchStart)

        if (excludedMarks.length) {
          return null
        }

        if (textEnd < matchEnd) {
          tr.delete(textEnd, matchEnd)
        }
        if (textStart > matchStart) {
          tr.delete(matchStart, textStart)
        }
        markStart = matchStart
        markEnd = markStart + match[m]!.length
      }

      tr.addMark(markStart, markEnd, markType.create(attrs))
      tr.removeStoredMark(markType)
      return tr
    }
  )
}
