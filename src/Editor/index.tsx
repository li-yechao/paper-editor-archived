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
import { TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import React, { forwardRef, useCallback } from 'react'
import { useEffect } from 'react'
import { useImperativeHandle } from 'react'
import { useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { MenuComponentType } from './lib/createMenuComponent'
import Extension from './lib/Extension'
import FloatingToolbar from './lib/FloatingToolbar'
import ExtensionManager from './lib/ExtensionManager'
import { proseMirrorStyle } from './style'
import styled from '@emotion/styled'
import CupertinoActivityIndicator from '../components/CupertinoActivityIndicator'

export interface EditorProps {
  className?: string
  autoFocus?: boolean
  extensions: Extension[]
}

export interface EditorElement {
  focus(): void
  readonly view?: EditorView
}

const Editor = React.memo(
  forwardRef<EditorElement, EditorProps>((props, ref) => {
    const _mounted = useMountedState()
    const _update = useUpdate()
    const update = useCallback(() => _mounted() && _update(), [])

    const container = useRef<HTMLDivElement>(null)
    const editor = useRef<{ view: EditorView; menus: MenuComponentType[] }>()

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor.current?.view.focus(),
        get view() {
          return editor.current?.view
        },
      }),
      []
    )

    useEffect(() => {
      ;(async () => {
        if (editor.current) {
          editor.current.view.destroy()
          editor.current = undefined
        }

        if (!container.current) {
          return
        }

        editor.current = await new ExtensionManager(props.extensions).createEditor(
          { mount: container.current },
          {}
        )
        update()
      })()
    }, [props.extensions])

    useEffect(() => {
      const view = editor.current?.view
      if (view && props.autoFocus) {
        const { tr, doc } = view.state
        view.dispatch(tr.setSelection(TextSelection.atEnd(doc)))
        view.focus()
      }
    }, [])

    return (
      <>
        <div ref={container} className={cx(props.className, proseMirrorStyle)} />
        {editor.current ? (
          <FloatingToolbar view={editor.current.view} menus={editor.current.menus} />
        ) : (
          <_Loading>
            <CupertinoActivityIndicator />
          </_Loading>
        )}
      </>
    )
  })
)

const _Loading = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

export default Editor
