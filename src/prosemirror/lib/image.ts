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

export async function getImageThumbnail(
  file: File,
  {
    type = 'image/jpeg',
    quality = 0.5,
    maxSize = 1024,
  }: {
    type?: string
    quality?: number
    maxSize?: number
  } = {}
): Promise<{ thumbnail: File; naturalWidth: number; naturalHeight: number }> {
  const scale = 0.5

  const image = await fileToImage(file)
  const { naturalWidth, naturalHeight } = image
  const canvas = document.createElement('canvas')
  canvas.width = naturalWidth * scale
  canvas.height = naturalHeight * scale
  const ctx = canvas.getContext('2d')
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height)

  let thumbnail = await new Promise<File>(resolve => {
    canvas.toBlob(blob => resolve(new File([blob!], file.name, { type })), type, quality)
  })

  while (thumbnail.size > maxSize) {
    thumbnail = (await getImageThumbnail(thumbnail, { type, quality, maxSize })).thumbnail
  }

  return { thumbnail, naturalWidth, naturalHeight }
}

export async function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = e => reject(e)
    reader.readAsDataURL(file)
  })
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve(image)
      URL.revokeObjectURL(image.src)
    }
    image.onerror = e => {
      reject(e)
      URL.revokeObjectURL(image.src)
    }
    image.src = URL.createObjectURL(file)
  })
}
