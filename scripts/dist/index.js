#!/usr/bin/env node
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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const app_build_1 = require("./commands/app-build");
const app_serve_1 = require("./commands/app-serve");
commander_1.program.name('angela');
commander_1.program
    .command('serve <entry>')
    .description('Start app for development')
    .option('--host [host]', 'Listening address', 'localhost')
    .option('-p, --port [port]', 'Listening port', '8080')
    .option('--env-path [dot env file]', 'Dotenv file path')
    .option('--public-path [path]', 'Public path', '/')
    .action((entry, options) => {
    app_serve_1.runAppServe({
        entry,
        host: options.host,
        port: options.port,
        envPath: options.envPath,
        publicPath: options.publicPath,
    });
});
commander_1.program
    .command('build <entry>')
    .description('Bundle app for production')
    .option('--env-path [dot env file]', 'Dotenv file path')
    .option('--public-path [path]', 'Public path', '/')
    .option('-o --output-path [path]', 'Output path', 'dist/')
    .option('--compress', 'Compress output files use gzip')
    .option('--analyze', 'Open bundle analyzer')
    .action((entry, options) => {
    app_build_1.runAppBuild({
        entry,
        envPath: options.envPath,
        publicPath: options.publicPath,
        outputPath: options.outputPath,
        compress: options.compress,
        analyze: options.analyze,
    });
});
commander_1.program.parse(process.argv);
