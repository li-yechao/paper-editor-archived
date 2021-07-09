import styled from '@emotion/styled'
import { StylesProvider } from '@material-ui/core'
import { throttle } from 'lodash'
import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { NodeSpec, Node as ProsemirrorNode, NodeType, Schema } from 'prosemirror-model'
import { Decoration, EditorView, NodeView as ProsemirrorNodeView } from 'prosemirror-view'
import React, { useEffect } from 'react'
import { useState } from 'react'
import { useRef } from 'react'
import ReactDOM from 'react-dom'
import CupertinoActivityIndicator from '../../components/CupertinoActivityIndicator'
import Extension, { ExtensionType } from '../lib/Extension'

export type NodeViewCreator = (args: {
  node: ProsemirrorNode
  view: EditorView
  getPos: (() => number) | boolean
}) => ProsemirrorNodeView

export default abstract class Node extends Extension {
  get type(): ExtensionType {
    return 'node'
  }

  abstract get schema(): NodeSpec

  get schema_extra(): { [name: string]: NodeSpec } {
    return {}
  }

  inputRules<S extends Schema<any, any>>(_options: { type: NodeType<S> }): InputRule<S>[] {
    return []
  }

  keymap<S extends Schema<any, any>>(_options: { type: NodeType<S> }): Keymap<S> {
    return {}
  }

  get nodeView(): NodeViewCreator | undefined {
    return undefined
  }
}

export abstract class NodeView implements ProsemirrorNodeView {
  constructor(public node: ProsemirrorNode) {
    setTimeout(() => this._render())
  }

  abstract dom: HTMLElement

  abstract reactDOM: HTMLElement

  contentDOM?: HTMLElement

  selectNode?: () => void

  deselectNode?: () => void

  setSelection?: (anchor: number, head: number, root: Document) => void

  stopEvent?: (event: Event) => boolean

  ignoreMutation?: (p: MutationRecord | { type: 'selection'; target: Element }) => boolean

  update(updatedNode: ProsemirrorNode, _decorations: Decoration[]) {
    if (updatedNode.type !== this.node.type) {
      return false
    }
    this.node = updatedNode
    this._render()
    return true
  }

  destroy() {
    ReactDOM.unmountComponentAtNode(this.reactDOM)
  }

  abstract component: React.ComponentType

  _render() {
    ReactDOM.render(
      <StylesProvider injectFirst>
        <this.component />
      </StylesProvider>,
      this.reactDOM
    )
  }
}

export abstract class NodeViewSelectable extends NodeView {
  constructor(node: ProsemirrorNode) {
    super(node)
  }

  selected = false

  selectNode = () => {
    this.selected = true
    this._render()
  }

  deselectNode = () => {
    this.selected = false
    this._render()
  }

  setSelection = () => {
    this.selected = true
    this._render()
  }
}

export function lazyReactNodeView<P>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>,
  fallback: React.ReactElement = (
    <_FallbackContainer>
      <CupertinoActivityIndicator />
    </_FallbackContainer>
  ),
  { lazy = false }: { lazy?: boolean } = {}
): React.ComponentType<P> {
  if (!lazy) {
    return (p: P) => {
      return (
        <React.Suspense fallback={fallback}>
          <Component {...p} />
        </React.Suspense>
      )
    }
  }

  return (p: P) => {
    const container = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    useEffect(() => {
      const handleScroll = throttle(() => {
        if (container.current && !visible) {
          const rect = container.current.getBoundingClientRect()
          if (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          ) {
            setVisible(true)
          }
        }
      }, 500)

      handleScroll()
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
      <div ref={container}>
        {!visible ? (
          fallback
        ) : (
          <React.Suspense fallback={fallback}>{visible && <Component {...p} />}</React.Suspense>
        )}
      </div>
    )
  }
}

const _FallbackContainer = styled.div`
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
`
