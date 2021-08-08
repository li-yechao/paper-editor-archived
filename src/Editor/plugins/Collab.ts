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
import { EditorState, Plugin, Transaction } from 'prosemirror-state'
import { Step } from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import { io, Socket as _Socket } from 'socket.io-client'
import Extension from '../lib/Extension'

export interface CollabOptions {
  socketUri: string
  paperId: string
  accessToken?: string
  onDispatchTransaction?: (view: EditorView, tr: Transaction) => void
  onPersistence?: (e: { version: Version; updatedAt: number; writable: boolean }) => void
}

export default class Collab extends Extension {
  constructor(public readonly options: CollabOptions) {
    super()
    this.socket = io(options.socketUri, {
      query: { paperId: options.paperId },
      extraHeaders: options.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : undefined,
    })
    this.paper = new Promise(resolve => {
      this.socket.once('paper', e => {
        this._editable = e.writable
        resolve(e)
      })
    })

    this.socket
      .on('transaction', ({ steps, clientIDs }) => {
        const view = this.view
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
      .on('persistence', e => {
        this._editable = e.writable
        this.options.onPersistence?.(e)
      })
      .on('error', () => {})
      .on('connect_error', () => {})
      .on('connect', () => {})
      .on('disconnect', () => {})
  }

  private _editable = false

  readonly socket: Socket
  readonly paper: Promise<{
    clientID: ClientID
    version: Version
    doc: DocJson
    ipfsGatewayUri: string
    writable: boolean
  }>

  get name() {
    return 'collab'
  }

  get plugins(): PromiseOr<Plugin[]> {
    return this.paper.then(({ version, clientID }) => {
      return [collab({ version, clientID })]
    })
  }

  defaultValue = () => this.paper.then(p => p.doc)

  editable = () => this._editable

  dispatchTransaction = (view: EditorView, tr: Transaction, state: EditorState) => {
    if (tr.docChanged) {
      const sendable = sendableSteps(state)
      if (sendable) {
        this.socket.emit('transaction', {
          version: getVersion(state),
          steps: sendable.steps,
        })
      }

      this.options.onDispatchTransaction?.(view, tr)
    }

    return state
  }

  save() {
    this.socket.emit('save')
  }
}

export type Version = number

export type DocJson = { [key: string]: any }

export type ClientID = string | number

export type Socket = _Socket<IOListenEvents, IOEmitEvents>

export interface CreateFileSource {
  path: string
  content: ArrayBuffer
}

export interface IOEmitEvents {
  transaction: (e: { version: Version; steps: DocJson[] }) => void
  save: () => void
  createFile: (
    e: { source: CreateFileSource | CreateFileSource[] },
    cb: (e: { hash: string[] }) => void
  ) => void
}

export interface IOListenEvents {
  error: (e: { message: string }) => void
  paper: (e: {
    clientID: ClientID
    version: Version
    doc: DocJson
    ipfsGatewayUri: string
    readable: boolean
    writable: boolean
  }) => void
  transaction: (e: { version: Version; steps: DocJson[]; clientIDs: ClientID[] }) => void
  persistence: (e: {
    version: Version
    updatedAt: number
    readable: boolean
    writable: boolean
  }) => void
}
