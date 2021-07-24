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
import React, { createRef } from 'react'
import { MenuComponentType } from './lib/createMenuComponent'
import FloatingToolbar from './lib/FloatingToolbar'
import Manager from './lib/Manager'
import { proseMirrorStyle } from './style'

export interface EditorProps {
  className?: string
  readOnly?: boolean
  autoFocus?: boolean
  manager: Manager
  dispatchTransaction?: ((view: EditorView, tr: Transaction) => void) | null
  onInited?: (editorView: EditorView) => void
}

export default class Editor extends React.PureComponent<EditorProps> {
  container = createRef<HTMLDivElement>()

  editorView?: EditorView

  private menus: MenuComponentType[] = []

  componentDidMount() {
    this.initEditor()
    this.props.autoFocus && this.focus()
  }

  componentDidUpdate(prevProps: EditorProps) {
    if (this.props.manager !== prevProps.manager) {
      this.initEditor()
    }
  }

  focus() {
    this.editorView?.focus()
  }

  private initEditor() {
    this.editorView?.destroy()

    const container = this.container.current
    if (!container) {
      return
    }

    const { manager, dispatchTransaction } = this.props

    this.menus = manager.menus

    this.editorView = new EditorView(
      { mount: container },
      {
        state: manager.createState(),
        editable: () => !this.props.readOnly,
        nodeViews: manager.nodeViews,
        dispatchTransaction: tr => {
          if (this.props.readOnly && tr.docChanged) {
            return
          }
          dispatchTransaction?.(this.editorView!, tr)
          this.forceUpdate()
        },
      }
    )

    const { tr, doc } = this.editorView.state
    this.editorView.dispatch(tr.setSelection(TextSelection.atEnd(doc)))

    this.props.onInited?.(this.editorView)
    this.forceUpdate()
  }

  render() {
    return (
      <>
        <div
          className={cx(this.props.className, proseMirrorStyle)}
          ref={this.container}
          data-editable={!this.props.readOnly}
        />
        {this.editorView && (
          <FloatingToolbar
            editorView={this.editorView}
            state={this.editorView.state}
            menus={this.menus}
          />
        )}
      </>
    )
  }
}
