# paper-editor

A rich editor powered by [prosemirror](https://github.com/ProseMirror).

Collaborative backend [paper-collab](https://github.com/li-yechao/paper-collab)

## Features

- Markdown shortcut input
- Collaborative powered by [prosemirror-collab](https://github.com/ProseMirror/prosemirror-collab) and [Socket.IO](https://socket.io)
- Code Block powered by [Monaco](https://github.com/Microsoft/monaco-editor)
- Video powered by [dashjs](https://github.com/Dash-Industry-Forum/dash.js) and [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)

## Installation

Install the dependencies:

```shell
yarn install
```

Start:

```shell
yarn start -p 8888
```

Open <http://localhost:8888?paperId=60c9a03a00eaf09700b8500f&socketUri=https://paper.yechao.xyz&accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MjU4ODUxNTUsImV4cCI6MTY1NzQyMTE1NSwic3ViIjoiNjAxM2FmMjcwMGNiN2FhNzAwMjY4NzAwIiwicGFwZXJfaWQiOiI2MGM5YTAzYTAwZWFmMDk3MDBiODUwMGYifQ.CsXGYBxYxub8Lx8OtTH2FflMy1cnbPe2cibHjIzPwRs> .

## Online Demo

<https://paper.yechao.xyz/editor?paperId=60c9a03a00eaf09700b8500f&socketUri=https://paper.yechao.xyz&accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MjU4ODUxNTUsImV4cCI6MTY1NzQyMTE1NSwic3ViIjoiNjAxM2FmMjcwMGNiN2FhNzAwMjY4NzAwIiwicGFwZXJfaWQiOiI2MGM5YTAzYTAwZWFmMDk3MDBiODUwMGYifQ.CsXGYBxYxub8Lx8OtTH2FflMy1cnbPe2cibHjIzPwRs>

## License

[Apache 2.0](LICENSE)
