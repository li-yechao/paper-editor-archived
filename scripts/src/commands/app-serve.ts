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

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import portfinder from 'portfinder'

export function runAppServe(args: {
  entry: string
  host: string
  port: number
  envPath?: string
  publicPath: string
}) {
  let webpackBin = path.resolve(process.cwd(), 'node_modules/webpack/bin/webpack.js')
  if (!fs.existsSync(webpackBin)) {
    webpackBin = 'webpack'
  }

  portfinder.getPortPromise({ port: args.port }).then(port => {
    spawnSync(
      'node',
      [
        webpackBin,
        'serve',
        '--config',
        path.resolve(__dirname, '../config/webpack.config.app.serve.js'),
        '--hot',
        '--host',
        args.host,
        '--port',
        port.toString(),
        '--history-api-fallback',
        '--disable-host-check',
        '--output-public-path',
        args.publicPath,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          __WEBPACK_ENTRY__: args.entry,
          __DOTENV_PATH__: args.envPath,
        },
      }
    )
  })
}
