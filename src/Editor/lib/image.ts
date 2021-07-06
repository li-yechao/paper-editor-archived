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
