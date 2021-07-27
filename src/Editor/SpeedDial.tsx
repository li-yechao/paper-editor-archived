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

import { Image } from '@material-ui/icons'
import { SpeedDial as _SpeedDial, SpeedDialAction, SpeedDialIcon } from '@material-ui/lab'
import { Fragment, Slice } from 'prosemirror-model'
import React from 'react'
import { useToggle } from 'react-use'
import { ProseMirrorEditorElement } from '../ProseMirrorEditor'
import Extension from '../ProseMirrorEditor/lib/Extension'
import DropPasteFile from '../ProseMirrorEditor/plugins/DropPasteFile'
import { notEmpty } from '../utils/array'

const SpeedDial = React.memo(
  ({
    editor,
    extensions,
  }: {
    editor: React.RefObject<ProseMirrorEditorElement>
    extensions: Extension[]
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
          const view = editor.current?.view
          const fileToNode = (extensions.find(
            i => i instanceof DropPasteFile
          ) as DropPasteFile | null)?.options.fileToNode

          if (view && fileToNode && input.files?.length) {
            const nodes = Array.from(input.files)
              .map(i => fileToNode(view, i))
              .filter(notEmpty)
            Promise.all(nodes).then(nodes => {
              view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0)))
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
      <_SpeedDial
        ariaLabel="Add"
        open={open}
        onOpen={toggleOpen}
        onClose={toggleOpen}
        icon={<SpeedDialIcon />}
        direction="left"
      >
        <SpeedDialAction icon={<Image />} tooltipTitle="图片/视频" onClick={handleImageClick} />
      </_SpeedDial>
    )
  }
)

export default SpeedDial
