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

import { EditorContentManager } from '@convergencelabs/monaco-collab-ext'
import styled from '@emotion/styled'
import { editor, IKeyboardEvent } from 'monaco-editor'
import React, { useRef, useEffect, useCallback } from 'react'
import { useMountedState, useUpdate } from 'react-use'

export type MonacoInstance = {
  editor: editor.ICodeEditor
  contentManager: EditorContentManager
}

export interface MonacoEditorProps {
  defaultValue?: string
  language?: string
  readOnly?: boolean
  focused?: boolean
  clientID?: string | number
  lineHeight?: number
  onInited?: (e: MonacoInstance) => void
  onDestroyed?: () => void
  onInsert?: (index: number, text: string) => void
  onReplace?: (index: number, length: number, text: string) => void
  onDelete?: (index: number, length: number) => void
  onKeyDown?: (e: IKeyboardEvent, editor: editor.ICodeEditor) => void
  onKeyUp?: (e: IKeyboardEvent, editor: editor.ICodeEditor) => void
}

const MonacoEditor = (props: MonacoEditorProps) => {
  const _isMounted = useMountedState()
  const _update = useUpdate()
  const update = useCallback(() => _isMounted() && _update(), [])

  const container = useRef<HTMLDivElement>(null)
  const monacoEditor = useRef<editor.ICodeEditor>()
  const contentManager = useRef<EditorContentManager>()

  useEffect(() => {
    if (!container.current) {
      return
    }

    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)')
    const getTheme = (e: { matches: boolean }) => (e.matches ? 'vs-dark' : 'vs')
    const theme = getTheme(matchMedia)
    const themeListener = (e: MediaQueryListEvent) => {
      editor.setTheme(getTheme(e))
    }
    matchMedia.addEventListener('change', themeListener)

    monacoEditor.current = editor.create(container.current, {
      model: createModel(props.defaultValue, props.language),
      language: props.language,
      theme,
      lineHeight: props.lineHeight,
      automaticLayout: true,
      minimap: {
        enabled: false,
      },
      scrollbar: {
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 6,
        alwaysConsumeMouseWheel: false,
      },
      renderWhitespace: 'all',
      readOnly: props.readOnly,
      scrollBeyondLastLine: false,
    })

    contentManager.current = new EditorContentManager({
      editor: monacoEditor.current,
      remoteSourceId: props.clientID?.toString(),
      onInsert: props.onInsert,
      onReplace: props.onReplace,
      onDelete: props.onDelete,
    })

    const updateHeight = () => {
      const _editor = monacoEditor.current
      const _container = container.current
      if (_editor && _container) {
        const contentHeight = _editor.getContentHeight()
        _editor.getDomNode()!.style.height = `${contentHeight}px`
        _editor.layout({ width: _container.clientWidth, height: contentHeight })
      }
    }
    monacoEditor.current.onDidContentSizeChange(updateHeight)
    updateHeight()

    update()

    props.onInited?.({ editor: monacoEditor.current, contentManager: contentManager.current })

    const model = monacoEditor.current.getModel()
    if (model) {
      const lineNumber = model.getLineCount()
      monacoEditor.current.setPosition({ lineNumber, column: model.getLineLength(lineNumber) + 1 })
    }

    const keyDownDisposable =
      props.onKeyDown &&
      monacoEditor.current.onKeyDown(e => {
        props.onKeyDown!(e, monacoEditor.current!)
      })

    const keyUpDisposable =
      props.onKeyUp &&
      monacoEditor.current.onKeyUp(e => {
        props.onKeyUp!(e, monacoEditor.current!)
      })

    return () => {
      matchMedia.removeEventListener('change', themeListener)
      props.onDestroyed?.()
      keyDownDisposable?.dispose()
      keyUpDisposable?.dispose()
      contentManager.current?.dispose()
      monacoEditor.current?.dispose()
    }
  }, [])

  useEffect(() => {
    const e = monacoEditor.current
    if (e) {
      const hasFocus = e.hasWidgetFocus()
      if (props.focused && !hasFocus) {
        e.focus()
      } else if (!props.focused && hasFocus && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [props.focused, monacoEditor.current])

  useEffect(() => {
    monacoEditor.current?.updateOptions({ readOnly: props.readOnly })
  }, [props.readOnly])

  useEffect(() => {
    const model = monacoEditor.current?.getModel()
    model && editor.setModelLanguage(model, props.language || 'plaintext')
  }, [props.language])

  return <_Editor ref={container} />
}

function createModel(value?: string, language?: string) {
  const model = editor.createModel(value || '', language)
  model.updateOptions({ tabSize: 2 })
  return model
}

const _Editor = styled.div`
  .iPadShowKeyboard {
    display: none;
  }
`

export default MonacoEditor
