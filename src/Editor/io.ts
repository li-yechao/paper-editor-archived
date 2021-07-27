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

import { Socket as _Socket } from 'socket.io-client'

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
