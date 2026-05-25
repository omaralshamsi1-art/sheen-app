// Resize + re-encode an image File to keep upload size small.
// Falls back to the original file on any failure or if the result would be larger.
export async function compressImage(
  file: File,
  options: { maxDim?: number; quality?: number; skipIfSmallerThan?: number } = {}
): Promise<File> {
  const { maxDim = 800, quality = 0.8, skipIfSmallerThan = 100_000 } = options

  if (!file.type.startsWith('image/')) return file
  if (file.size < skipIfSmallerThan) return file

  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('image load failed'))
      i.src = dataUrl
    })

    let width = img.naturalWidth
    let height = img.naturalHeight
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/webp', quality)
    })

    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^./\\]+$/, '')
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  }
}
