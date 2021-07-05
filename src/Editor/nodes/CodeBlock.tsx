import styled from '@emotion/styled'
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { Node as ProsemirrorNode, NodeSpec, NodeType, Slice } from 'prosemirror-model'
import { Plugin, Transaction } from 'prosemirror-state'
import { ReplaceStep } from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import React from 'react'
import { v4 } from 'uuid'
import CupertinoActivityIndicator from '../../components/CupertinoActivityIndicator'
import Node, { lazyReactNodeView, NodeViewCreator, NodeViewWithContent } from './Node'

type MonacoInstance = import('../../components/MonacoEditor').MonacoInstance

const MonacoEditorTransactionMetaKey = 'MonacoEditorClientID'

export default class CodeBlock extends Node {
  constructor(public options: { clientID?: string | number } = {}) {
    super()
  }

  private _clientID?: number
  get clientID(): string | number {
    return this.options.clientID ?? (this._clientID ??= Math.floor(Math.random() * 100000))
  }

  get name(): string {
    return 'code_block'
  }

  get schema(): NodeSpec {
    return {
      attrs: { editorId: { default: null }, language: { default: null } },
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      isolating: true,
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: node => ({
            language: (node as HTMLElement).getAttribute('data-language') || null,
          }),
        },
      ],
      toDOM: node => {
        return [
          'pre',
          node.attrs.language ? { 'data-language': node.attrs.language } : {},
          ['code', 0],
        ]
      },
    }
  }

  private isCodeBlock(doc: ProsemirrorNode, from: number, to: number) {
    let res: { node: ProsemirrorNode; pos: number } | undefined
    try {
      doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === this.name) {
          if (from > pos && to < pos + node.nodeSize) {
            res = { node, pos }
          }
          return false
        }
        return
      })
    } catch {}
    return res
  }

  private _monacoEditorInstances = new Map<string, MonacoInstance>()
  private _checkEditorIdAttr(node: ProsemirrorNode): string {
    const { editorId } = node.attrs
    if (!editorId) {
      throw new Error(`Invalid editorId ${editorId}`)
    }
    return editorId
  }
  getMonacoEditorInstanceByNode(node: ProsemirrorNode): MonacoInstance | undefined {
    return this._monacoEditorInstances.get(this._checkEditorIdAttr(node))
  }
  setMonacoEditorInstanceByNode(node: ProsemirrorNode, instance: MonacoInstance) {
    return this._monacoEditorInstances.set(this._checkEditorIdAttr(node), instance)
  }
  deleteMonacoEditorInstanceByNode(node: ProsemirrorNode) {
    return this._monacoEditorInstances.delete(this._checkEditorIdAttr(node))
  }

  get plugins(): Plugin[] {
    return [
      new Plugin({
        appendTransaction: (trs, prevState, nextState) => {
          // Ensure every CodeBlock node have a editorId attribute
          {
            let tr: Transaction | undefined
            nextState.doc.descendants((node, pos) => {
              if (node.type.name === this.name && !node.attrs.editorId) {
                if (!tr) {
                  tr = nextState.tr
                }
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, editorId: v4() })
                return false
              }
              return true
            })
            if (tr) {
              return tr
            }
          }

          for (const tr of trs) {
            if (tr.getMeta(MonacoEditorTransactionMetaKey) === this.clientID) {
              continue
            }
            for (const step of tr.steps) {
              if (step instanceof ReplaceStep) {
                const from: number = (step as any).from
                const to: number = (step as any).to
                const codeBlock = this.isCodeBlock(prevState.doc, from, to)
                if (codeBlock) {
                  const slice: Slice = (step as any).slice
                  const { firstChild } = slice.content

                  if (
                    slice.content.childCount === 0 ||
                    (slice.content.childCount === 1 && firstChild?.isText)
                  ) {
                    const contentManager = this.getMonacoEditorInstanceByNode(codeBlock.node)
                      ?.contentManager

                    if (contentManager) {
                      const codePos = codeBlock.pos + 1
                      const index = from - codePos
                      const length = Math.abs(to - codePos - index)
                      if (firstChild?.text) {
                        if (length === 0) {
                          contentManager.insert(index, firstChild.text)
                        } else {
                          contentManager.replace(index, length, firstChild.text)
                        }
                      } else if (length > 0) {
                        contentManager.delete(index, length)
                      }
                    }
                  }
                }
              }
            }
          }

          return
        },
      }),
    ]
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [
      textblockTypeInputRule(/^```([a-z]+)?\s$/, type, match => ({
        language: match[1],
      })),
    ]
  }

  get nodeView(): NodeViewCreator {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new CodeBlockNodeView(node, view, getPos, this.clientID, this)
    }
  }
}

interface MonacoEditorInstanceManager {
  setMonacoEditorInstanceByNode(node: ProsemirrorNode, instance: MonacoInstance): void
  getMonacoEditorInstanceByNode(node: ProsemirrorNode): MonacoInstance | undefined
  deleteMonacoEditorInstanceByNode(node: ProsemirrorNode): void
}

class CodeBlockNodeView extends NodeViewWithContent {
  constructor(
    node: ProsemirrorNode,
    private view: EditorView,
    private getPos: () => number,
    private clientId: string | number,
    private monacoInstanceManager: MonacoEditorInstanceManager
  ) {
    super(node)
    this.dom.append(this.reactDOM)
  }

  dom = document.createElement('div')

  reactDOM = document.createElement('div')

  stopEvent = () => true

  ignoreMutation = () => true

  deselectNode = () => {}

  component = lazyReactNodeView(
    React.lazy(() => import('../../components/MonacoEditor')),
    <_FallbackContainer>
      <CupertinoActivityIndicator />
    </_FallbackContainer>,
    { lazy: true }
  )

  get language() {
    return this.node.attrs.language
  }

  onInsert = (index: number, text: string) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .insertText(text, pos + index)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onReplace = (index: number, length: number, text: string) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .insertText(text, pos + index, pos + index + length)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onDelete = (index: number, length: number) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .delete(pos + index, pos + index + length)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onLanguageChange = (language: string) => {
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
        ...this.node.attrs,
        language,
      })
    )
  }

  private isAtFirstPosition = false

  render() {
    return (
      <this.component
        defaultValue={this.node.textContent}
        language={this.language}
        readOnly={!this.view.editable}
        focused={this.selected}
        clientID={this.clientId}
        onInited={e => this.monacoInstanceManager.setMonacoEditorInstanceByNode(this.node, e)}
        onDestroyed={() => this.monacoInstanceManager.deleteMonacoEditorInstanceByNode(this.node)}
        onInsert={this.onInsert}
        onReplace={this.onReplace}
        onDelete={this.onDelete}
        onLanguageChange={this.onLanguageChange}
        onKeyDown={(_, editor) => {
          this.isAtFirstPosition =
            editor.getPosition()?.equals({ lineNumber: 1, column: 1 }) ?? false
        }}
        onKeyUp={e => {
          // KeyCode.Backspace is 1
          if (e.keyCode === 1 && this.isAtFirstPosition) {
            this.view.dispatch(
              this.view.state.tr.setNodeMarkup(
                this.getPos(),
                this.view.state.schema.nodes['paragraph']
              )
            )
            this.view.focus()
          }
        }}
      />
    )
  }
}

const _FallbackContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  margin: 16px 0;
  border-radius: 8px;
  padding: 8px 0;
  background-color: #fffffe;
  border: 1px solid #aeaeae;

  @media (prefers-color-scheme: dark) {
    background-color: #1e1e1e;
    border: 1px solid transparent;
  }
`
