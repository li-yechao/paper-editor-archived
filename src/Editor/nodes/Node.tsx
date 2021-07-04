import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { StylesProvider } from '@material-ui/core'
import { throttle } from 'lodash'
import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { NodeSpec, Node as ProsemirrorNode, NodeType, Schema } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
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
}) => NodeView

export default abstract class Node extends Extension {
  get type(): ExtensionType {
    return 'node'
  }

  abstract get schema(): NodeSpec

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

export function createReactNodeViewCreator<P>(
  Component: React.ComponentType<P>,
  props: (args: {
    node: ProsemirrorNode
    view: EditorView
    getPos: () => number
    selected: boolean
  }) => P,
  options: {
    createDom?: () => {
      dom?: Element
      reactDOM?: Element
      contentDOM?: Element
    }
    stopEvent?: (event: Event) => boolean
    ignoreMutation?: (
      p:
        | MutationRecord
        | {
            type: 'selection'
            target: Element
          }
    ) => boolean
  } = {}
): NodeViewCreator {
  return ({ node, view, getPos }) => {
    if (typeof getPos !== 'function') {
      throw new Error(`Invalid getPos ${getPos}`)
    }

    const {
      dom = document.createElement('div'),
      reactDOM = document.createElement('div'),
      contentDOM,
    } = options.createDom?.() ?? {}
    dom.append(reactDOM)

    if (contentDOM) {
      // NOTE: Apply correct node type in safari when IME input.
      const zero = document.createElement('span')
      zero.innerText = '\u200b'
      zero.classList.add(css`
        position: absolute;
        left: 0;
        top: 0;
      `)

      dom.append(zero, contentDOM)
    }

    let selected = false

    const render = () => {
      ReactDOM.render(
        <StylesProvider injectFirst>
          <Component {...props({ node, view, getPos, selected })} />
        </StylesProvider>,
        reactDOM
      )
    }
    render()

    const nodeView: NodeView = {
      dom,
      contentDOM,
      update: updatedNode => {
        if (updatedNode.type !== node.type) {
          return false
        }
        node = updatedNode
        render()
        return true
      },
      stopEvent: options.stopEvent,
      ignoreMutation: options.ignoreMutation,
      destroy: () => {
        ReactDOM.unmountComponentAtNode(reactDOM)
      },
    }

    if (!contentDOM) {
      nodeView.selectNode = () => {
        if (view.editable) {
          selected = true
          render()
        }
      }
      nodeView.setSelection = nodeView.selectNode
      nodeView.deselectNode = () => {
        selected = false
        render()
      }
    }

    return nodeView
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
