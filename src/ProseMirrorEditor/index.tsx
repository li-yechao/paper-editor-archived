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

import { cx } from '@emotion/css'
import { TextSelection, Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import React, { forwardRef, useCallback } from 'react'
import { useEffect } from 'react'
import { useImperativeHandle } from 'react'
import { useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { MenuComponentType } from './lib/createMenuComponent'
import FloatingToolbar from './lib/FloatingToolbar'
import Manager from './lib/Manager'
import { proseMirrorStyle } from './style'

export interface ProseMirrorEditorProps {
  className?: string
  readOnly?: boolean
  autoFocus?: boolean
  manager: Manager
  dispatchTransaction?: ((view: EditorView, tr: Transaction) => void) | null
  onInited?: (editorView: EditorView) => void
}

export interface ProseMirrorEditorElement {
  focus(): void
  readonly view: EditorView | undefined
}

const ProseMirrorEditor = React.memo(
  forwardRef<ProseMirrorEditorElement, ProseMirrorEditorProps>((props, ref) => {
    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const container = useRef<HTMLDivElement>(null)
    const view = useRef<EditorView>()
    const menus = useRef<MenuComponentType[]>([])

    useImperativeHandle(
      ref,
      () => ({
        focus: () => view.current?.focus(),
        get view() {
          return view.current
        },
      }),
      []
    )

    useEffect(() => {
      view.current?.destroy()

      if (!container.current) {
        return
      }

      const { manager, dispatchTransaction } = props

      menus.current = manager.menus

      view.current = new EditorView(
        { mount: container.current },
        {
          state: manager.createState(),
          editable: () => !props.readOnly,
          nodeViews: manager.nodeViews,
          dispatchTransaction: tr => {
            if (props.readOnly && tr.docChanged) {
              return
            }
            dispatchTransaction?.(view.current!, tr)
            update()
          },
        }
      )

      props.onInited?.(view.current)
    }, [props.manager])

    useEffect(() => {
      if (props.autoFocus && view.current) {
        const { tr, doc } = view.current.state
        view.current.dispatch(tr.setSelection(TextSelection.atEnd(doc)))
        view.current.focus()
      }
    }, [])

    return (
      <>
        <div
          className={cx(props.className, proseMirrorStyle)}
          ref={container}
          data-editable={!props.readOnly}
        />
        {view.current && (
          <FloatingToolbar
            editorView={view.current}
            state={view.current.state}
            menus={menus.current}
          />
        )}
      </>
    )
  })
)

export default ProseMirrorEditor
