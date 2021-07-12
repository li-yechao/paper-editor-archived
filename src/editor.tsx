import styled from '@emotion/styled'
import { Box } from '@material-ui/core'
import { Image } from '@material-ui/icons'
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@material-ui/lab'
import { createHotkey } from '@react-hook/hotkey'
import { collab, getVersion, receiveTransaction, sendableSteps } from 'prosemirror-collab'
import { baseKeymap } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { undo, redo, history } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Fragment, Node, Slice } from 'prosemirror-model'
import { Transaction } from 'prosemirror-state'
import { Step } from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import React, { createRef } from 'react'
import { useToggle } from 'react-use'
import { io, Socket } from 'socket.io-client'
import CupertinoActivityIndicator from './components/CupertinoActivityIndicator'
import _Editor from './Editor'
import Manager from './Editor/lib/Manager'
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
import ImageBlock from './Editor/nodes/ImageBlock'
import ListItem from './Editor/nodes/ListItem'
import OrderedList from './Editor/nodes/OrderedList'
import Paragraph from './Editor/nodes/Paragraph'
import Text from './Editor/nodes/Text'
import Title from './Editor/nodes/Title'
import TodoItem from './Editor/nodes/TodoItem'
import TodoList from './Editor/nodes/TodoList'
import VideoBlock from './Editor/nodes/VideoBlock'
import DropPasteFile from './Editor/plugins/DropPasteFile'
import Placeholder from './Editor/plugins/Placeholder'
import Plugins from './Editor/plugins/Plugins'
import { notEmpty } from './utils/array'

export type Version = number

export type DocJson = { [key: string]: any }

export type ClientID = string | number

export interface CollabEmitEvents {
  transaction: (e: { version: Version; steps: DocJson[] }) => void
  save: () => void
}

export interface CollabListenEvents {
  paper: (e: { clientID: ClientID; version: Version; doc: DocJson }) => void
  transaction: (e: { version: Version; steps: DocJson[]; clientIDs: ClientID[] }) => void
  persistence: (e: { version: Version; updatedAt: number }) => void
}

export interface EditorProps {
  ipfsApi?: string
  ipfsGateway?: string
  socketUri?: string
  paperId?: string
  accessToken?: string
  onPersistence?: (e: { version: Version; updatedAt: number }) => void
  onChange?: (e: { version: Version }) => void
  onTitleChange?: (e: { title: string }) => void
}

export default class Editor extends React.PureComponent<EditorProps> {
  private editor = createRef<_Editor>()

  private manager?: Manager

  private collabClient?: Socket<CollabListenEvents, CollabEmitEvents>

  private _title?: string
  private set title(title: string) {
    if (this._title !== title) {
      this._title = title
      this.props.onTitleChange?.({ title })
    }
  }

  private get editorView() {
    return this.editor.current?.editorView
  }

  componentDidMount() {
    window.addEventListener('keydown', e => {
      createHotkey(['mod', 's'], e => {
        e.preventDefault()
        this.save()
      })(e)
    })
    this.init()
  }

  componentDidUpdate(prevProps: EditorProps) {
    if (
      this.props.ipfsApi !== prevProps.ipfsApi ||
      this.props.ipfsGateway !== prevProps.ipfsGateway ||
      this.props.socketUri !== prevProps.socketUri ||
      this.props.paperId !== prevProps.paperId ||
      this.props.accessToken !== prevProps.accessToken
    ) {
      this.init()
    }
  }

  save() {
    this.collabClient?.emit('save')
  }

  private init() {
    const { socketUri, paperId, accessToken, ipfsApi, ipfsGateway } = this.props
    if (!socketUri || !paperId || !accessToken || !ipfsApi || !ipfsGateway) {
      return
    }

    this.collabClient = io(socketUri, {
      query: { paperId },
      extraHeaders: { authorization: `Bearer ${accessToken}` },
    })
    this.collabClient.on('paper', ({ version, doc, clientID }) => {
      this.initManager({ doc, collab: { version, clientID } })
    })
    this.collabClient.on('transaction', ({ steps, clientIDs }) => {
      const { editorView } = this
      if (editorView) {
        const { state } = editorView
        const tr = receiveTransaction(
          state,
          steps.map(i => Step.fromJSON(state.schema, i)),
          clientIDs
        )
        editorView.updateState(state.apply(tr))
      }
    })
    this.collabClient.on('persistence', e => this.props.onPersistence?.(e))
  }

  private initManager(e: { doc?: DocJson; collab?: { version: Version; clientID: ClientID } }) {
    const { ipfsApi, ipfsGateway } = this.props
    const uploadOptions =
      ipfsApi && ipfsGateway
        ? {
            upload: async (file: File | File[]) => {
              const form = new FormData()
              const query: { [key: string]: string } = {}
              if (Array.isArray(file)) {
                query['recursive'] = 'true'
                query['wrap-with-directory'] = 'true'
                for (const f of file) {
                  form.append(f.name, f, f.name)
                }
              } else {
                form.append(file.name, file, file.name)
              }

              const qs = Object.entries(query)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&')
              const res = await fetch(`${ipfsApi}/api/v0/add?${qs}`, {
                method: 'POST',
                body: form,
              })
              const texts = (await res.text()).split('\n').filter(i => !!i.trim())
              const array = texts.map(i => JSON.parse(i))
              if (array.length === 0) {
                throw new Error('Invalid upload response []')
              }
              return array[array.length - 1].Hash
            },
            getSrc: (hash: string) => {
              return `${ipfsGateway}/ipfs/${hash}`
            },
            thumbnail: {
              maxSize: 1024,
            },
          }
        : undefined

    const imageBlock = uploadOptions && new ImageBlock(uploadOptions)
    const videoBlock = uploadOptions && new VideoBlock(uploadOptions)

    const extensions = [
      new Placeholder(),

      new Doc(),
      new Text(),
      new Title(),
      new Paragraph(),
      new Heading(),
      new Blockquote(),
      new TodoList(),
      new TodoItem({ todoItemReadOnly: false }),
      new OrderedList(),
      new BulletList(),
      new ListItem(),
      new CodeBlock({ clientID: e.collab?.clientID }),

      new Bold(),
      new Italic(),
      new Underline(),
      new Strikethrough(),
      new Highlight(),
      new Code(),
      new Link(),

      new Plugins(
        [
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            Backspace: undoInputRule,
          }),
          keymap(baseKeymap),
          history(),
          gapCursor(),
          dropCursor({ color: 'currentColor' }),
          e.collab && collab({ version: e.collab.version, clientID: e.collab.clientID }),
        ].filter(notEmpty)
      ),

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

    this.manager = new Manager(extensions.filter(notEmpty), e.doc)
    this.forceUpdate()
  }

  private dispatchTransaction = (view: EditorView, tr: Transaction) => {
    const { collabClient } = this
    const newState = view.state.apply(tr)
    view.updateState(newState)

    let sendable: ReturnType<typeof sendableSteps>
    if (collabClient && (sendable = sendableSteps(newState))) {
      view.updateState(
        view.state.apply(
          receiveTransaction(
            view.state,
            sendable.steps,
            new Array(sendable.steps.length).fill(sendable.clientID)
          )
        )
      )

      collabClient.emit('transaction', {
        version: getVersion(newState),
        steps: sendable.steps,
      })
    }

    if (tr.docChanged) {
      const version = getVersion(view.state)
      this.props.onChange?.({ version })

      const title = this.getDocTitle(view.state.doc)
      if (title !== undefined) {
        this.title = title
      }
    }
  }

  private onEditorInited = (editorView: EditorView) => {
    this.title = this.getDocTitle(editorView.state.doc) ?? ''
  }

  private getDocTitle(doc?: Node) {
    const titleNode = doc?.firstChild?.type.name === 'title' ? doc.firstChild : undefined
    return titleNode?.textContent
  }

  render() {
    const { editor, manager } = this

    if (!manager) {
      return (
        <_Loading>
          <CupertinoActivityIndicator />
        </_Loading>
      )
    }

    return (
      <>
        <__Editor
          ref={editor}
          autoFocus
          manager={manager}
          dispatchTransaction={this.dispatchTransaction}
          onInited={this.onEditorInited}
        />
        <Box position="fixed" bottom={16} right={16}>
          <_SpeedDial editor={editor} manager={manager} />
        </Box>
      </>
    )
  }
}

const _SpeedDial = ({
  editor,
  manager,
}: {
  editor: React.RefObject<_Editor>
  manager: Manager
}) => {
  const [open, toggleOpen] = useToggle(false)

  const handleImageClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,video/*'
    input.multiple = true
    input.style.position = 'absolute'
    input.style.left = '-1000px'
    input.style.top = '0px'
    input.onchange = () => {
      try {
        const editorView = editor.current?.editorView
        const fileToNode = (manager.extensions.find(
          i => i instanceof DropPasteFile
        ) as DropPasteFile | null)?.options.fileToNode

        if (editorView && fileToNode && input.files?.length) {
          const nodes = Array.from(input.files)
            .map(i => fileToNode(editorView, i))
            .filter(notEmpty)
          Promise.all(nodes).then(nodes => {
            editorView.dispatch(
              editorView.state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0))
            )
          })
        }
      } finally {
        document.body.removeChild(input)
      }
    }

    document.body.append(input)
    input.click()
  }

  return (
    <SpeedDial
      ariaLabel="Add"
      open={open}
      onOpen={toggleOpen}
      onClose={toggleOpen}
      icon={<SpeedDialIcon />}
      direction="left"
    >
      <SpeedDialAction icon={<Image />} tooltipTitle="图片/视频" onClick={handleImageClick} />
    </SpeedDial>
  )
}

const _Loading = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

const __Editor = styled(_Editor)`
  .ProseMirror {
    min-height: 100vh;
    padding: 8px;
    padding-bottom: 100px;
    max-width: 800px;
    margin: auto;
  }
`
