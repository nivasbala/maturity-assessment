export function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')
}

export async function triggerPdfDownload(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
