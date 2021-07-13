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

import { Button } from '@material-ui/core'
import { EditorState, Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import React from 'react'

export type MenuComponentType = {
  button: React.ComponentType<{
    className?: string
    editorView: EditorView
  }>
  expand?: React.ComponentType<{ editorView: EditorView }>
  isExpandVisible?: (editorView: EditorView) => boolean
}

export default function createMenuComponent({
  children,
  isActive,
  toggleMark,
}: {
  children: React.ReactNode
  isActive?: (state: EditorState) => boolean
  toggleMark?: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
}): MenuComponentType {
  return {
    button: ({ className, editorView }) => {
      const active = isActive?.(editorView.state)
      return (
        <Button
          className={className}
          style={{ opacity: active ? 1 : 0.6 }}
          color="inherit"
          onClick={() => {
            if (toggleMark) {
              const top = window.scrollY
              toggleMark(editorView.state, editorView.dispatch)
              window.scrollTo({ top })
              editorView.focus()
            }
          }}
        >
          {children}
        </Button>
      )
    },
  }
}
