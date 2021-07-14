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
import { Box, ButtonGroup, Popper, Tooltip, TooltipProps } from '@material-ui/core'
import { throttle } from 'lodash'
import { EditorView } from 'prosemirror-view'
import React from 'react'
import { useState } from 'react'
import { useCallback } from 'react'
import { useEffect } from 'react'
import { useToggle } from 'react-use'
import { MenuComponentType } from './createMenuComponent'

export interface FloatingToolbarProps {
  editorView: EditorView
  menus: MenuComponentType[]
}

const FloatingToolbar = React.memo(
  ({ editorView, menus }: FloatingToolbarProps) => {
    const popperProps = usePopperProps(editorView)
    const isSelecting = useIsSelecting(editorView)

    return (
      <_FloatingToolbar
        {...popperProps}
        isSelecting={isSelecting}
        menus={menus}
        editorView={editorView}
      />
    )
  },
  (prev, next) => {
    return (
      prev.menus !== next.menus &&
      prev.editorView.state.selection !== next.editorView.state.selection
    )
  }
)

const _FloatingToolbar = React.memo(
  ({
    editorView,
    menus,
    isSelecting,
    ...popperProps
  }: {
    editorView: EditorView
    menus: MenuComponentType[]
    isSelecting?: boolean
  } & Omit<TooltipProps, 'title'>) => {
    return (
      <Tooltip
        {...popperProps}
        PopperComponent={_Popper}
        PopperProps={{ ...popperProps.PopperProps, active: !isSelecting } as any}
        title={
          <>
            <ButtonGroup variant="text" color="inherit">
              {menus.map((menu, index) => (
                <menu.button key={index} editorView={editorView} />
              ))}
            </ButtonGroup>
            {menus.map((menu, index) => {
              return (
                menu.expand &&
                menu.isExpandVisible?.(editorView) && (
                  <Box key={index} borderTop={1} borderColor="rgba(0, 0, 0, 0.23)">
                    <menu.expand editorView={editorView} />
                  </Box>
                )
              )
            })}
          </>
        }
      />
    )
  }
)

const defaultProps: Omit<TooltipProps, 'title'> = {
  open: false,
  placement: 'top',
  arrow: false,
  disableFocusListener: true,
  disableHoverListener: true,
  disableTouchListener: true,
  children: <div />,
}

function usePopperProps(editorView: EditorView) {
  const [props, setProps] = useState(defaultProps)

  const refresh = useCallback(
    throttle(
      (editorView: EditorView) => {
        const props = { ...defaultProps }

        const { selection } = editorView.state
        if (!selection.empty && !(selection as any).node) {
          const dom = editorView.dom
          const { width, left, top } = dom.getBoundingClientRect()
          const { left: fromLeft, top: fromTop } = editorView.coordsAtPos(selection.from)
          const { left: toLeft } = editorView.coordsAtPos(selection.to)
          const offsetX = fromLeft + (toLeft - fromLeft) / 2 - left - width / 2
          const offsetY = -(top + fromTop)

          props.open = true
          props.PopperProps = {
            anchorEl: dom,
            keepMounted: true,
            modifiers: {
              flip: { enabled: false },
              offset: { offset: `${offsetX},${offsetY}` },
              preventOverflow: { boundariesElement: 'viewport' },
            },
          }
        }

        setProps(props)
      },
      1000,
      { leading: true, trailing: true }
    ),
    []
  )

  useEffect(() => {
    refresh(editorView)
  }, [editorView.state.selection])

  return props
}

function useIsSelecting(editorView: EditorView) {
  const [isSelecting, toggleIsSelection] = useToggle(false)
  useEffect(() => {
    const onMouseDown = () => toggleIsSelection(true)
    const onMouseUp = () => toggleIsSelection(false)
    editorView.dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      editorView.dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])
  return isSelecting
}

const _Popper = styled(Popper, { shouldForwardProp: p => p !== 'active' })<{ active?: boolean }>`
  user-select: none;
  pointer-events: ${props => (props.active ? 'all' : 'none')};

  > .MuiTooltip-tooltip {
    padding: 0;
  }
`

export default FloatingToolbar
