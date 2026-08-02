import fs from 'fs'

export type SniffedImageType = 'jpeg' | 'png' | 'webp'

const EXT_BY_TYPE: Record<SniffedImageType, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
}

/** Detects an image's real format from its magic bytes — client-supplied mimetype/
 * extension are spoofable and must not be trusted for what gets written to disk. */
export function sniffImageType(buffer: Buffer): SniffedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png'
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp'
  return null
}

export function extensionFor(type: SniffedImageType): string {
  return EXT_BY_TYPE[type]
}

export function sniffImageTypeFromFile(filePath: string): SniffedImageType | null {
  const fd = fs.openSync(filePath, 'r')
  try {
    const header = Buffer.alloc(12)
    fs.readSync(fd, header, 0, 12, 0)
    return sniffImageType(header)
  } finally {
    fs.closeSync(fd)
  }
}
