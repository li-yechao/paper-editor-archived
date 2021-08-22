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
import { StylesProvider } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { getVersion } from 'prosemirror-collab'
import { baseKeymap } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { history, redo, undo } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import Extension from './Editor/lib/Extension'
import Bold from './Editor/marks/Bold'
import Code from './Editor/marks/Code'
import Highlight from './Editor/marks/Highlight'
import Italic from './Editor/marks/Italic'
import Link from './Editor/marks/Link'
import Strikethrough from './Editor/marks/Strikethrough'
import Underline from './Editor/marks/Underline'
import Blockquote from './Editor/nodes/Blockquote'
import BulletList from './Editor/nodes/BulletList'
import CodeBlock from './Editor/nodes/CodeBlock'
import Doc from './Editor/nodes/Doc'
import Heading from './Editor/nodes/Heading'
import ImageBlock, { ImageBlockOptions } from './Editor/nodes/ImageBlock'
import Math from './Editor/nodes/Math'
import OrderedList from './Editor/nodes/OrderedList'
import Paragraph from './Editor/nodes/Paragraph'
import TagList from './Editor/nodes/TagList'
import Text from './Editor/nodes/Text'
import Title from './Editor/nodes/Title'
import TodoList from './Editor/nodes/TodoList'
import VideoBlock, { VideoBlockOptions } from './Editor/nodes/VideoBlock'
import Collab, { isError, Version } from './Editor/plugins/Collab'
import DropPasteFile from './Editor/plugins/DropPasteFile'
import Placeholder from './Editor/plugins/Placeholder'
import Plugins from './Editor/plugins/Plugins'
import Editor from './index'
import Messager from './Messager'
import { useOnSave } from './utils/useOnSave'
import { useSafeUpdate } from './utils/useSafeUpdate'

type Config = {
  socketUri?: string
  paperId?: string
  accessToken?: string
}

interface MessagerEmitEvents {
  ready: () => void
  persistence: (e: { version: Version; updatedAt: number }) => void
  change: (e: { version: Version }) => void
  titleChange: (e: { title: string }) => void
}

interface MessagerReservedEvents {
  init: (config?: Config) => void
  save: () => void
}

const _Editor = styled(Editor)`
  min-height: 100vh;
  padding: 8px;
  padding-bottom: 100px;
  max-width: 800px;
  margin: auto;
`

const App = () => {
  const update = useSafeUpdate()

  const messager = useRef(new Messager<{}, MessagerEmitEvents, MessagerReservedEvents>())
  const [config, setConfig] = useState<Config>(
    (() => {
      const query = new URLSearchParams(window.location.search)
      return {
        socketUri: query.get('socketUri') ?? undefined,
        paperId: query.get('paperId') ?? undefined,
        accessToken: query.get('accessToken') ?? undefined,
      }
    })()
  )

  const collab = useRef<Collab>()
  const extensions = useRef<Extension[]>()
  const error = useRef<Error>()

  const save = useCallback(() => collab.current?.save(), [])

  useEffect(() => {
    messager.current.on('init', config => setConfig(config ?? {}))
    messager.current.on('save', save)
    messager.current.emit('ready')
  }, [])

  const _title = useRef<string>()

  useEffect(() => {
    ;(async () => {
      if (!config.socketUri || !config.paperId) {
        return
      }

      const _collab = (collab.current = new Collab({
        socketUri: config.socketUri,
        paperId: config.paperId,
        accessToken: config.accessToken,
        onPersistence: e => messager.current.emit('persistence', e),
        onDispatchTransaction: (view, tr) => {
          if (tr.docChanged) {
            messager.current.emit('change', { version: getVersion(view.state) })

            const firstChild = view.state.doc.firstChild
            if (firstChild?.type.name === 'title') {
              const title = firstChild.textContent
              if (_title.current !== title) {
                _title.current = title
              }
              messager.current.emit('titleChange', { title })
            }
          }
        },
        onError: e => {
          error.current = e
          update()
        },
      }))

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
          return new Promise<string>((resolve, reject) => {
            _collab.socket.emit('createFile', { source }, res => {
              if (isError(res)) {
                reject(new Error(res.message))
              } else {
                resolve(res.hash[res.hash.length - 1]!)
              }
            })
          })
        },
        getSrc: hash => _collab.paper.then(p => `${p.ipfsGatewayUri}/${hash}`),
        thumbnail: {
          maxSize: 1024,
        },
      }

      const imageBlock = new ImageBlock(uploadOptions)
      const videoBlock = new VideoBlock(uploadOptions)

      extensions.current = [
        _collab,
        new Placeholder(),
        new Doc('title tag_list block+'),
        new Text(),
        new Title(),
        new Paragraph(),
        new Heading(),
        new TagList(),
        new Blockquote(),
        new TodoList(),
        new OrderedList(),
        new BulletList(),
        new CodeBlock({ clientID: (await _collab.paper).clientID }),
        new Math(),

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
            'Shift-Mod-z': redo,
            'Mod-y': redo,
            Backspace: undoInputRule,
          }),
          keymap(baseKeymap),
          history(),
          gapCursor(),
          dropCursor({ color: 'currentColor' }),
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

      update()
    })()
  }, [config])

  useOnSave(save)

  if (!extensions.current) {
    return null
  }

  return (
    <StylesProvider injectFirst>
      <_Editor autoFocus extensions={extensions.current} />
      {error.current && (
        <_ErrorMask>
          <Alert severity="error">{error.current.message}</Alert>
        </_ErrorMask>
      )}
    </StylesProvider>
  )
}

const _ErrorMask = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10%;
  background-color: rgba(250, 250, 250, 0.8);

  @media (prefers-color-scheme: dark) {
    background-color: rgba(48, 48, 48, 0.8);
  }
`

ReactDOM.render(<App />, document.getElementById('app'))
