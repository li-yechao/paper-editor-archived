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

import styled from '@emotion/styled'
import React, { useRef } from 'react'
import CupertinoActivityIndicator from '../components/CupertinoActivityIndicator'
import { Version } from './io'
import ProseMirrorEditor, { ProseMirrorEditorElement } from '../ProseMirrorEditor'
import useEditor from './useEditor'
import { useEffect } from 'react'
import { useCallback } from 'react'
import { EditorView } from 'prosemirror-view'
import { forwardRef } from 'react'
import { useImperativeHandle } from 'react'
import { useSaveShortcut } from './useSaveShortcut'

export interface EditorProps {
  socketUri: string
  paperId: string
  accessToken?: string
  onPersistence?: (e: { version: Version; updatedAt: number }) => void
  onChange?: (e: { version: Version }) => void
  onTitleChange?: (e: { title: string }) => void
}

export interface EditorElement {
  save: () => void
}

const Editor = React.memo(
  forwardRef<EditorElement, EditorProps>((props, ref) => {
    const editor = useRef<ProseMirrorEditorElement>(null)
    const { dispatchTransaction, socket, extensions, writable, defaultValue, version } = useEditor({
      editor,
      socketUri: props.socketUri,
      paperId: props.paperId,
      accessToken: props.accessToken,
    })

    const save = useCallback(() => {
      socket?.emit('save')
    }, [socket])

    useSaveShortcut(save)

    useImperativeHandle(ref, () => ({ save }), [save])

    const handleTitleChange = useTitleChanged(props.onTitleChange)

    useEffect(() => {
      if (version) {
        props.onChange?.({ version })
      }

      handleTitleChange(editor.current?.view)
    }, [version])

    if (!extensions) {
      return (
        <_Loading>
          <CupertinoActivityIndicator />
        </_Loading>
      )
    }

    return (
      <_ProseMirrorEditor
        ref={editor}
        autoFocus
        defaultValue={defaultValue}
        readOnly={!writable}
        extensions={extensions}
        dispatchTransaction={dispatchTransaction}
      />
    )
  })
)

function useTitleChanged(onChanged?: (e: { title: string }) => void) {
  const _title = useRef<string>()
  const cb = useCallback((view?: EditorView) => {
    if (view && onChanged) {
      const firstChild = view.state.doc.firstChild
      if (firstChild?.type.name === 'title') {
        const title = firstChild.textContent
        if (_title.current !== title) {
          _title.current = title
        }
        onChanged({ title })
      }
    }
  }, [])

  return cb
}

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

const _ProseMirrorEditor = styled(ProseMirrorEditor)`
  min-height: 100vh;
  padding: 8px;
  padding-bottom: 100px;
  max-width: 800px;
  margin: auto;
`

export default Editor
