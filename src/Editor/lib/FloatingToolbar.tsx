import styled from '@emotion/styled'
import { Box, ButtonGroup, Popper, Tooltip, TooltipProps } from '@material-ui/core'
import { EditorView } from 'prosemirror-view'
import React from 'react'
import { useEffect } from 'react'
import { useToggle } from 'react-use'
import { MenuComponentType } from './createMenuComponent'

export interface FloatingToolbarProps {
  editorView: EditorView
  menus: MenuComponentType[]
}

export const FloatingToolbar = (props: FloatingToolbarProps) => {
  const popperProps = usePopperProps(props.editorView)
  const isSelecting = useIsSelecting(props.editorView)

  return (
    <Tooltip
      {...popperProps}
      PopperComponent={_Popper}
      PopperProps={{ ...popperProps.PopperProps, active: !isSelecting } as any}
      title={
        <>
          <ButtonGroup variant="text" color="inherit">
            {props.menus.map((menu, index) => (
              <menu.button key={index} editorView={props.editorView} />
            ))}
          </ButtonGroup>
          {props.menus.map((menu, index) => {
            return (
              menu.expand &&
              menu.isExpandVisible?.(props.editorView) && (
                <Box key={index} borderTop={1} borderColor="rgba(0, 0, 0, 0.23)">
                  <menu.expand editorView={props.editorView} />
                </Box>
              )
            )
          })}
        </>
      }
    />
  )
}

function usePopperProps(editorView: EditorView) {
  const props: Omit<TooltipProps, 'title'> = {
    open: false,
    arrow: true,
    disableFocusListener: true,
    disableHoverListener: true,
    disableTouchListener: true,
    children: <div />,
  }

  const { selection } = editorView.state
  if (!selection.empty && !(selection as any).node) {
    const node = editorView.domAtPos(selection.from).node
    const anchorEl = node instanceof Element ? node : node.parentElement

    if (anchorEl) {
      const fromPos = editorView.coordsAtPos(selection.from)
      const toPos = editorView.coordsAtPos(selection.to)
      const { width, left, top } = anchorEl.getBoundingClientRect()
      const offsetX = (toPos.left - fromPos.left) / 2 + fromPos.left - left - width / 2
      const offsetY = top - fromPos.top

      props.placement = 'top'
      props.open = true
      props.PopperProps = {
        anchorEl,
        disablePortal: true,
        keepMounted: true,
        modifiers: {
          offset: { offset: `${offsetX},${offsetY}` },
          flip: { enabled: false },
          preventOverflow: { boundariesElement: editorView.dom },
        },
      }
    }
  }

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
