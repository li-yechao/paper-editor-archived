import styled from '@emotion/styled'
import { ButtonGroup, Popper, Tooltip, TooltipProps } from '@material-ui/core'
import { EditorView } from 'prosemirror-view'
import React from 'react'
import { useEffect } from 'react'
import { useToggle } from 'react-use'

export interface FloatingToolbarProps {
  editorView: EditorView
  menus: React.ComponentType<{ editorView: EditorView }>[]
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
        <ButtonGroup variant="text" color="inherit">
          {props.menus.map((C, index) => (
            <C key={index} editorView={props.editorView} />
          ))}
        </ButtonGroup>
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
  if (!selection.empty) {
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
