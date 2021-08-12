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

import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useRef } from 'react'
import { useSafeUpdate } from '../../../utils/useSafeUpdate'
import { LazyComponent } from '../../lib/LazyComponent'
import { NodeViewReact, StrictProsemirrorNode } from '../Node'
import { ImageBlockAttrs, ImageBlockOptions } from './ImageBlock'

export default class ImageBlockNodeView extends NodeViewReact<ImageBlockAttrs> {
  constructor(
    node: StrictProsemirrorNode<ImageBlockAttrs>,
    private view: EditorView,
    private getPos: () => number,
    private options: ImageBlockOptions
  ) {
    super(node)
    this.reactDOM.contentEditable = 'false'
    this.dom.classList.add(css`
      margin: 1em 0;
      text-align: center;
    `)
    this.dom.append(this.reactDOM, this.contentDOM)
    this._render()
  }

  dom = document.createElement('figure')

  reactDOM = document.createElement('div')

  contentDOM = document.createElement('figcaption')

  private isDragging = false

  private get attrs() {
    return this.node.attrs
  }

  stopEvent = (e: Event) => {
    if (e.type === 'dragstart') {
      this.isDragging = true
    } else if (e.type === 'dragend') {
      this.isDragging = false
    }
    return false
  }

  ignoreMutation = (e: MutationRecord | { type: 'selection'; target: Element }) => {
    return this.reactDOM.contains(e.target)
  }

  selectNode = () => {
    // NOTE: Move cursor to end of node,
    // do nothing if is dragging, otherwise DND will be duplicate this node.
    if (!this.isDragging) {
      setTimeout(() => {
        this.view.dispatch(
          this.view.state.tr.setSelection(
            TextSelection.create(this.view.state.doc, this.getPos() + this.node.nodeSize - 2)
          )
        )
        this._render()
      })
    }
  }

  private get aspectRatio() {
    const { naturalWidth, naturalHeight } = this.attrs
    if (naturalWidth && naturalHeight) {
      return (naturalHeight / naturalWidth) * 100
    }
    return 0
  }

  component = () => {
    const update = useSafeUpdate()

    const file: File | undefined = (this.node as any).file

    const state = useRef<{
      loading: boolean
      src?: string
      visible: boolean
    }>({
      loading: false,
      src: undefined,
      visible: false,
    })
    const setState = useCallback((s: Partial<typeof state.current>) => {
      state.current = { ...state.current, ...s }
      update()
    }, [])

    const onVisibleChange = useCallback((visible: boolean) => {
      setState({ visible })
    }, [])

    useEffect(() => {
      if (!file) {
        return
      }
      ;(async () => {
        setState({ loading: true })
        try {
          const src = await this.options.upload(file)
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.attrs,
              src,
            })
          )
        } finally {
          setState({ loading: false })
        }
      })()
    }, [file])

    useEffect(() => {
      if (state.current.visible) {
        ;(async () => {
          const src = (this.attrs.src && (await this.options.getSrc(this.attrs.src))) ?? undefined
          setState({ src })
        })()
      }
    }, [state.current.visible, this.attrs.src])

    return (
      <LazyComponent
        component={_ImgContainer}
        onVisibleChange={onVisibleChange}
        style={{ width: this.attrs.naturalWidth ?? undefined }}
      >
        <div style={{ paddingBottom: `${this.aspectRatio}%` }} />
        {this.attrs.thumbnail && <img src={this.attrs.thumbnail} />}
        {state.current.src && <img src={state.current.src} />}
      </LazyComponent>
    )
  }
}

const _ImgContainer = styled.div`
  max-width: 100%;
  display: inline-block;
  vertical-align: middle;
  position: relative;

  img {
    position: absolute;
    left: 0;
    top: 0;
    object-fit: contain;
    width: 100%;
    height: 100%;
  }
`
