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
import { EditorView } from 'prosemirror-view'
import React, { useCallback } from 'react'
import { useRef } from 'react'
import { useState } from 'react'
import { useEffect } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { MenuComponentType } from './createMenuComponent'

export interface FloatingToolbarProps {
  view: EditorView
  menus: MenuComponentType[]
}

const FloatingToolbar = ({ view, menus }: FloatingToolbarProps) => {
  const props = useTooltipProps(view)
  const [open, setOpen] = useState(false)

  // Avoid show toolbar when IME input in safari.
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(props.open)
    }, 50)
    return () => clearTimeout(timer)
  }, [props.open])

  return <_FloatingToolbar menus={menus} view={view} {...props} open={open} />
}

const _FloatingToolbar = React.memo(
  ({
    view,
    menus,
    isSelecting,
    offsetX,
    offsetY,
    ...popperProps
  }: {
    view: EditorView
    menus: MenuComponentType[]
    isSelecting?: boolean
    offsetX: number
    offsetY: number
  } & Partial<TooltipProps>) => {
    return (
      <Tooltip
        placement="top"
        arrow={false}
        disableFocusListener
        disableHoverListener
        disableTouchListener
        children={<div />}
        PopperProps={{
          anchorEl: view.dom,
          modifiers: {
            flip: { enabled: false },
            offset: { offset: `${offsetX},${offsetY}` },
            preventOverflow: { boundariesElement: 'viewport' },
          },
          style: { pointerEvents: isSelecting ? 'none' : 'all' },
        }}
        {...popperProps}
        PopperComponent={_Popper}
        title={
          <>
            <ButtonGroup variant="text" color="inherit">
              {menus.map((menu, index) => (
                <menu.button key={index} view={view} />
              ))}
            </ButtonGroup>
            {menus.map((menu, index) => {
              return (
                menu.expand &&
                menu.isExpandVisible?.(view) && (
                  <Box key={index} borderTop={1} borderColor="rgba(0, 0, 0, 0.23)">
                    <menu.expand view={view} />
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

function useTooltipProps(view: EditorView) {
  const _mounted = useMountedState()
  const _update = useUpdate()
  const update = useCallback(() => _mounted() && _update(), [])

  const state = useRef({
    isSelecting: false,
    open: false,
    offsetX: 0,
    offsetY: 0,
  })

  useEffect(() => {
    const onMouseDown = () => {
      state.current.isSelecting = true
    }
    const onMouseUp = () => {
      state.current.isSelecting = false
      update()
    }

    view.dom.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mouseup', onMouseUp, true)
    return () => {
      view.dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  state.current.open = false

  if (!state.current.isSelecting) {
    const { selection } = view.state
    if ((!selection.empty || selection.$from.marks().length) && !(selection as any).node) {
      const dom = view.dom
      const { width, left, top } = dom.getBoundingClientRect()
      const { left: fromLeft, top: fromTop } = view.coordsAtPos(selection.from)
      const { left: toLeft } = view.coordsAtPos(selection.to, -1)

      state.current.open = true
      state.current.offsetX = fromLeft + (toLeft - fromLeft) / 2 - left - width / 2
      state.current.offsetY = top - fromTop
    }
  }

  return state.current
}

const _Popper = styled(Popper)`
  user-select: none;

  > .MuiTooltip-tooltip {
    padding: 0;
  }
`

export default FloatingToolbar
