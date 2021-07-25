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

import { createFFmpeg, FFmpeg } from '@ffmpeg/ffmpeg'
import { StrictEventEmitter } from '../../../utils/typed-events'

export enum VideoFileStatus {
  PrepareFFmpeg,
  ExtractPoster,
  ConvertDASH,
}

export interface Meta {
  codec: string
  format?: string
  profile?: string
}

export default class VideoFile extends StrictEventEmitter<
  {},
  {},
  { progress: (e: VideoFile) => void }
> {
  constructor(public file: File) {
    super()
  }

  private inProgress?: Promise<any>

  private __status?: VideoFileStatus
  private set _status(status: VideoFileStatus | undefined) {
    this.__status = status
    this._ratio = undefined
    this._time = undefined
  }
  get status() {
    return this.__status
  }

  private _videoMetas: Meta[] = []
  private _audioMetas: Meta[] = []

  private _duration?: number
  get duration() {
    return this._duration
  }

  private _time?: number
  get time() {
    return this._time
  }

  private __ratio?: number
  private set _ratio(ratio: number | undefined) {
    this.__ratio = ratio
    this.emitReserved('progress', this)
  }
  get ratio() {
    return this.__ratio
  }

  private _ffmpeg?: Promise<FFmpeg>
  private get ffmpeg(): Promise<FFmpeg> {
    if (!this._ffmpeg) {
      this._ffmpeg = (async () => {
        try {
          const ffmpeg = createFFmpeg({
            corePath: './static/ffmpeg-core/ffmpeg-core.js',
          })
          this._status = VideoFileStatus.PrepareFFmpeg
          await ffmpeg.load()
          const buffer = await this.file.arrayBuffer()
          ffmpeg.FS('writeFile', this.file.name, new Uint8Array(buffer, 0, buffer.byteLength))

          // Get video metas.
          ffmpeg.setLogger(log => {
            const video = log.message.match(
              /stream\s+#0:0\S+\s+video\:\s+(?<codec>\w+)(\s+\((?<profile>\w+)\))?(\s+\((?<format>\w+).*\))?,/i
            )?.groups
            const audio = log.message.match(
              /stream\s+#\d+:\d+\S+\s+audio\:\s+(?<codec>\w+)(\s+\((?<profile>\w+)\))?(\s+\((?<format>\w+).*\))?,/i
            )?.groups
            video && this._videoMetas.push(video as any)
            audio && this._audioMetas.push(audio as any)
          })
          await ffmpeg.run('-i', this.file.name)
          ffmpeg.setLogger(() => {})

          ffmpeg.setProgress(p => {
            const { duration, time, ratio } = p as any
            if (typeof duration === 'number' && duration >= 0) {
              this._duration = Number(duration.toFixed(2))
            }
            if (typeof time === 'number' && time >= 0) {
              this._time = Number(time.toFixed(2))
            }
            if (typeof ratio === 'number' && ratio >= 0) {
              this._ratio = Number(ratio.toFixed(4))
            }
          })
          return ffmpeg
        } finally {
          this._status = undefined
        }
      })()
    }
    return this._ffmpeg
  }

  async poster(): Promise<File> {
    await this.inProgress
    const promise = (async () => {
      try {
        const ffmpeg = await this.ffmpeg
        const filename = 'poster.jpeg'
        this._status = VideoFileStatus.ExtractPoster
        await ffmpeg.run('-i', this.file.name, '-vframes', '1', '-f', 'image2', filename)
        return this.readFile(ffmpeg, filename, 'image/jpeg')
      } finally {
        this._status = undefined
      }
    })()
    this.inProgress = promise
    return promise
  }

  async dash() {
    await this.inProgress
    const promise = (async () => {
      try {
        const ffmpeg = await this.ffmpeg
        this._status = VideoFileStatus.ConvertDASH
        ffmpeg.FS('mkdir' as any, 'dash')
        await ffmpeg.run('-i', this.file.name, '-f', 'dash', 'dash/index.mpd')
        const files: string[] = ffmpeg.FS('readdir' as any, 'dash') as string[]
        return files
          .filter(i => i !== '.' && i !== '..')
          .map(i => this.readFile(ffmpeg, `dash/${i}`))
      } finally {
        this._status = undefined
      }
    })()
    this.inProgress = promise
    return promise
  }

  destroy() {
    this.removeAllListeners()
    this._ffmpeg = undefined
  }

  private readFile(ffmpeg: FFmpeg, filename: string, type?: string): File {
    const file = ffmpeg.FS('readFile', filename)
    return new File([new Blob([file.buffer], { type })], filename, { type })
  }
}
