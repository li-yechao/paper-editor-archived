import { ThemeProvider as EmotionThemeProvider } from '@emotion/react'
import { createMuiTheme, MuiThemeProvider, StylesProvider } from '@material-ui/core'
import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import { useCallback } from 'react'
import { useRef } from 'react'
import ReactDOM from 'react-dom'
import { hot } from 'react-hot-loader/root'
import Editor, { Version } from './index'
import Messager from './Messager'

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

const App = hot(() => {
  const theme = createMuiTheme()

  const editorRef = useRef<Editor>(null)
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

  useEffect(() => {
    messager.current.on('init', config => setConfig(config ?? {}))
    messager.current.on('save', () => editorRef.current?.save())
    messager.current.emit('ready')
  }, [])

  const onPersistence = useCallback((e: { version: Version; updatedAt: number }) => {
    messager.current.emit('persistence', e)
  }, [])

  const onChange = useCallback((e: { version: Version }) => {
    messager.current.emit('change', e)
  }, [])

  const onTitleChange = useCallback((e: { title: string }) => {
    messager.current.emit('titleChange', e)
  }, [])

  return (
    <StylesProvider injectFirst>
      <MuiThemeProvider theme={theme}>
        <EmotionThemeProvider theme={theme}>
          <Editor
            ref={editorRef}
            socketUri={config.socketUri}
            paperId={config.paperId}
            accessToken={config.accessToken}
            onPersistence={onPersistence}
            onChange={onChange}
            onTitleChange={onTitleChange}
          />
        </EmotionThemeProvider>
      </MuiThemeProvider>
    </StylesProvider>
  )
})

ReactDOM.render(<App />, document.getElementById('app'))
