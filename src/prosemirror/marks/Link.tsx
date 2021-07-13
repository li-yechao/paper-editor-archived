import styled from '@emotion/styled'
import { Button, TextField } from '@material-ui/core'
import { Launch, Link as LinkIcon } from '@material-ui/icons'
import { toggleMark } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType, Schema } from 'prosemirror-model'
import React, { useState } from 'react'
import createMenuComponent, { MenuComponentType } from '../lib/createMenuComponent'
import getMarkRange from '../lib/getMarkRange'
import isMarkActive from '../lib/isMarkActive'
import Mark from './Mark'

export default class Link extends Mark {
  get name() {
    return 'link'
  }

  get schema(): MarkSpec {
    return {
      attrs: { href: { default: '' } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: dom => ({
            href: (dom as HTMLElement).getAttribute('href'),
          }),
        },
      ],
      toDOM: node => [
        'a',
        { ...node.attrs, rel: 'noopener noreferrer nofollow', target: '__blank' },
        0,
      ],
    }
  }

  inputRules({ type, schema }: { type: MarkType; schema: Schema }): InputRule[] {
    return [
      new InputRule(/\[(.+)]\((https?:\/\/\S+)\)/, (state, match, start, end) => {
        const [okay, alt, href] = match
        const { tr } = state

        if (okay) {
          tr.replaceWith(start, end, schema.text(alt!)).addMark(
            start,
            start + alt!.length,
            type.create({ href })
          )
        }

        return tr
      }),
      new InputRule(/<(https?:\/\/\S+)>/, (state, match, start, end) => {
        const [okay, href] = match
        const { tr } = state

        if (okay) {
          tr.replaceWith(start, end, schema.text(href!)).addMark(
            start,
            start + href!.length,
            type.create({ href })
          )
        }

        return tr
      }),
    ]
  }

  menus({ type }: { type: MarkType }): MenuComponentType[] {
    return [
      {
        ...createMenuComponent({
          children: <LinkIcon />,
          isActive: isMarkActive(type),
          toggleMark: toggleMark(type),
        }),
        expand: ({ editorView }) => {
          const { selection } = editorView.state
          const range = getMarkRange(selection.$from, type)
          const [href, setHref] = useState(range?.mark.attrs.href || '')

          const submit = () => {
            editorView.dispatch(
              href.trim()
                ? editorView.state.tr.addMark(selection.from, selection.to, type.create({ href }))
                : editorView.state.tr.removeMark(selection.from, selection.to, type)
            )
          }

          const openLink = () => {
            if (href.trim()) {
              window.open(href, '__blank')
            }
          }

          return (
            <_LinkExpand>
              <_HrefInput
                variant="outlined"
                value={href}
                onChange={e => setHref(e.target.value)}
                onKeyUp={e => e.key === 'Enter' && submit()}
                onBlur={submit}
              />
              <_Button color="inherit" size="small" onClick={openLink}>
                <Launch />
              </_Button>
            </_LinkExpand>
          )
        },
        isExpandVisible: editorView => isMarkActive(type)(editorView.state),
      },
    ]
  }
}

const _HrefInput = styled(TextField)``

const _Button = styled(Button)`
  min-width: 0;
`

const _LinkExpand = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;

  ${_HrefInput} {
    flex: 1;
    margin-right: 4px;

    .MuiInputBase-root {
      color: inherit;
    }

    input {
      padding: 4px 8px;
    }
  }
`
