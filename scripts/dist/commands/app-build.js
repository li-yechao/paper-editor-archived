"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAppBuild = void 0;
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
function runAppBuild(args) {
    let webpackBin = path_1.default.resolve(process.cwd(), 'node_modules/webpack/bin/webpack.js');
    if (!fs_1.default.existsSync(webpackBin)) {
        webpackBin = 'webpack';
    }
    child_process_1.spawnSync('node', [
        webpackBin,
        'build',
        '--config',
        path_1.default.resolve(__dirname, '../config/webpack.config.app.build.js'),
        '--output-public-path',
        args.publicPath,
        '--output-path',
        args.outputPath,
    ], {
        stdio: 'inherit',
        env: {
            ...process.env,
            __WEBPACK_ENTRY__: args.entry,
            __DOTENV_PATH__: args.envPath,
            __ENABLE_WEBPACK_BUNDLE_ANALYZER__: args.analyze ? '1' : undefined,
            __ENABLE_WEBPACK_COMPRESSION__: args.compress ? '1' : undefined,
        },
    });
}
exports.runAppBuild = runAppBuild;
