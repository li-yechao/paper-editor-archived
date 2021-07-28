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

import { collab, getVersion, receiveTransaction, sendableSteps } from 'prosemirror-collab'
import { baseKeymap } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { history, redo, undo } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Transaction } from 'prosemirror-state'
import { Step } from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useMountedState, useUpdate } from 'react-use'
import { io } from 'socket.io-client'
import { ClientID, DocJson, Socket, Version } from './io'
import { ProseMirrorEditorElement } from '../ProseMirrorEditor'
import Extension from '../ProseMirrorEditor/lib/Extension'
import Bold from '../ProseMirrorEditor/marks/Bold'
import Code from '../ProseMirrorEditor/marks/Code'
import Highlight from '../ProseMirrorEditor/marks/Highlight'
import Italic from '../ProseMirrorEditor/marks/Italic'
import Link from '../ProseMirrorEditor/marks/Link'
import Strikethrough from '../ProseMirrorEditor/marks/Strikethrough'
import Underline from '../ProseMirrorEditor/marks/Underline'
import Blockquote from '../ProseMirrorEditor/nodes/Blockquote'
import BulletList from '../ProseMirrorEditor/nodes/BulletList'
import CodeBlock from '../ProseMirrorEditor/nodes/CodeBlock'
import Doc from '../ProseMirrorEditor/nodes/Doc'
import Heading from '../ProseMirrorEditor/nodes/Heading'
import ImageBlock, { ImageBlockOptions } from '../ProseMirrorEditor/nodes/ImageBlock'
import OrderedList from '../ProseMirrorEditor/nodes/OrderedList'
import Paragraph from '../ProseMirrorEditor/nodes/Paragraph'
import TagList from '../ProseMirrorEditor/nodes/TagList'
import Text from '../ProseMirrorEditor/nodes/Text'
import Title from '../ProseMirrorEditor/nodes/Title'
import TodoList from '../ProseMirrorEditor/nodes/TodoList'
import VideoBlock, { VideoBlockOptions } from '../ProseMirrorEditor/nodes/VideoBlock'
import DropPasteFile from '../ProseMirrorEditor/plugins/DropPasteFile'
import Placeholder from '../ProseMirrorEditor/plugins/Placeholder'
import Plugins from '../ProseMirrorEditor/plugins/Plugins'

export default function useEditor({
  editor,
  socketUri,
  paperId,
  accessToken,
}: {
  editor: RefObject<ProseMirrorEditorElement>
  socketUri: string
  paperId: string
  accessToken?: string
}) {
  const _mounted = useMountedState()
  const _update = useUpdate()
  const update = useCallback(() => _mounted() && _update(), [])

  const socket = useRef<Socket>()
  const extensions = useRef<Extension[]>()
  const paper = useRef<{
    doc: DocJson
    version: Version
    clientID: ClientID
    ipfsGatewayUri: string
    writable: boolean
    persistence?: { version: Version; updatedAt: number }
  }>()

  const dispatchTransaction = useCallback(
    (view: EditorView, tr: Transaction) => {
      const newState = view.state.apply(tr)
      view.updateState(newState)

      let sendable: ReturnType<typeof sendableSteps>
      if (socket.current && (sendable = sendableSteps(newState))) {
        view.updateState(
          view.state.apply(
            receiveTransaction(
              view.state,
              sendable.steps,
              new Array(sendable.steps.length).fill(sendable.clientID)
            )
          )
        )

        socket.current.emit('transaction', {
          version: getVersion(newState),
          steps: sendable.steps,
        })
      }

      if (tr.docChanged && paper.current) {
        paper.current.version = getVersion(view.state)
        update()
      }
    },
    [socket]
  )

  useEffect(() => {
    socket.current?.close()

    const _socket: Socket = io(socketUri, {
      query: { paperId },
      extraHeaders: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
    })

    _socket
      .on('paper', e => {
        paper.current = e
        extensions.current = createExtensions({
          version: e.version,
          clientID: e.clientID,
          socket: _socket,
          ipfsGatewayUri: e.ipfsGatewayUri,
        })
        update()
      })
      .on('transaction', ({ steps, clientIDs }) => {
        const view = editor.current?.view
        if (view) {
          const { state } = view
          const tr = receiveTransaction(
            state,
            steps.map(i => Step.fromJSON(state.schema, i)),
            clientIDs
          )
          view.updateState(state.apply(tr))
        }
      })
      .on('persistence', ({ version, updatedAt, writable }) => {
        if (paper.current) {
          paper.current.persistence = { version, updatedAt }
          paper.current.writable = writable
          update()
        }
      })
      .on('error', () => {})
      .on('connect_error', () => {})
      .on('connect', () => {})
      .on('disconnect', () => {})

    socket.current = _socket
  }, [socketUri, paperId, accessToken])

  return {
    dispatchTransaction,
    extensions: extensions.current,
    socket: socket.current,
    version: paper.current?.version,
    defaultValue: paper.current?.doc,
    writable: paper.current?.writable,
  }
}

function createExtensions(options: {
  version: Version
  clientID: ClientID
  socket: Socket
  ipfsGatewayUri: string
}) {
  const uploadOptions: ImageBlockOptions & VideoBlockOptions = {
    upload: async (file: File | File[]) => {
      const source = Array.isArray(file)
        ? await Promise.all(
            file.map(async i => ({
              path: i.name,
              content: await i.arrayBuffer(),
            }))
          )
        : {
            path: file.name,
            content: await file.arrayBuffer(),
          }
      return new Promise<string>(resolve => {
        options.socket.emit('createFile', { source }, res => {
          resolve(res.hash[res.hash.length - 1]!)
        })
      })
    },
    getSrc: (hash: string) => `${options.ipfsGatewayUri}/${hash}`,
    thumbnail: {
      maxSize: 1024,
    },
  }

  const imageBlock = new ImageBlock(uploadOptions)
  const videoBlock = new VideoBlock(uploadOptions)

  return [
    new Placeholder(),

    new Doc(),
    new Text(),
    new TagList(),
    new Title(),
    new Paragraph(),
    new Heading(),
    new Blockquote(),
    new TodoList(),
    new OrderedList(),
    new BulletList(),
    new CodeBlock({ clientID: options.clientID }),

    new Bold(),
    new Italic(),
    new Underline(),
    new Strikethrough(),
    new Highlight(),
    new Code(),
    new Link(),

    new Plugins([
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        Backspace: undoInputRule,
      }),
      keymap(baseKeymap),
      history(),
      gapCursor(),
      dropCursor({ color: 'currentColor' }),
      collab({ version: options.version, clientID: options.clientID }),
    ]),

    imageBlock,
    videoBlock,

    new DropPasteFile({
      fileToNode: (view, file) => {
        if (imageBlock && file.type.startsWith('image/')) {
          return imageBlock.create(view.state.schema, file)
        } else if (videoBlock && file.type.startsWith('video/')) {
          return videoBlock.create(view.state.schema, file)
        }
        return
      },
    }),
  ]
}
