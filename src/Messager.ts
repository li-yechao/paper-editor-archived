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

import { EventNames, EventParams, EventsMap, StrictEventEmitter } from './utils/typed-events'

export default class Messager<
  ListenEvents extends EventsMap,
  EmitEvents extends EventsMap,
  ReservedEvents extends EventsMap = {}
> extends StrictEventEmitter<ListenEvents, EmitEvents, ReservedEvents> {
  constructor() {
    super()
    window.addEventListener('message', this.recvMessage)
  }

  emit<Ev extends EventNames<EmitEvents>>(ev: Ev, ...args: EventParams<EmitEvents, Ev>): boolean {
    this.postMessage([ev.toString(), ...args])
    return true
  }

  dispose() {
    window.removeEventListener('message', this.recvMessage)
  }

  private recvMessage = ({ data }: MessageEvent<[string, ...any]>) => {
    if (!Array.isArray(data)) {
      return
    }
    const [ev, ...args] = data
    this.emitReserved(ev, ...(args as any))
  }

  private postMessage(e: [string, ...any]) {
    const inAppWebView = (window as any).flutter_inappwebview
    if (typeof inAppWebView !== 'undefined') {
      inAppWebView.callHandler('postMessage', ...e)
    } else if (window.parent !== window) {
      window.parent.postMessage(e, '*')
    }
  }
}
