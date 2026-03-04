import { net } from 'electron'
import { createWriteStream } from 'fs'
import { URL } from 'url'

export interface DownloadProgress {
  downloaded: number
  total: number
  percent: number
}

export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (p: DownloadProgress) => void,
  headers?: Record<string, string>,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) throw new Error('CANCELLED')
  await download(url, destPath, onProgress, headers, 0, signal)
  return destPath
}

function getHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
  const val = headers[name]
  if (Array.isArray(val)) return val[0]
  return val
}

function download(
  url: string,
  destPath: string,
  onProgress: ((p: DownloadProgress) => void) | undefined,
  headers: Record<string, string> | undefined,
  redirectCount: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error(`Demasiadas redirecciones descargando ${url}`))
    }
    if (signal?.aborted) return reject(new Error('CANCELLED'))

    const request = net.request({ method: 'GET', url })

    if (headers) {
      for (const [key, val] of Object.entries(headers)) {
        request.setHeader(key, val)
      }
    }

    let activeStream: ReturnType<typeof createWriteStream> | null = null

    const onAbort = () => {
      try { request.abort() } catch {}
      if (activeStream) {
        activeStream.destroy()
        activeStream.on('close', () => reject(new Error('CANCELLED')))
      } else {
        reject(new Error('CANCELLED'))
      }
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const cleanup = () => signal?.removeEventListener('abort', onAbort)

    request.on('response', (response) => {
      const status = response.statusCode

      if (status >= 300 && status < 400) {
        const loc = getHeader(response.headers, 'location')
        if (!loc) { cleanup(); return reject(new Error(`Redirección sin Location header desde ${url}`)) }
        response.on('data', () => {})
        let redirectUrl: string
        try {
          redirectUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
        } catch {
          cleanup()
          return reject(new Error(`Location header inválido: ${loc}`))
        }
        download(redirectUrl, destPath, onProgress, headers, redirectCount + 1, signal)
          .then(() => { cleanup(); resolve() })
          .catch((e) => { cleanup(); reject(e) })
        return
      }

      if (status < 200 || status >= 300) {
        response.on('data', () => {})
        cleanup()
        return reject(new Error(`HTTP ${status} descargando ${url}`))
      }

      const total = parseInt(getHeader(response.headers, 'content-length') ?? '0', 10)
      let downloaded = 0

      const dest = createWriteStream(destPath)
      activeStream = dest
      dest.on('error', (e) => { cleanup(); reject(e) })

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        onProgress?.({
          downloaded,
          total,
          percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
        })
        if (!dest.write(chunk)) {
          (response as any).pause()
          dest.once('drain', () => (response as any).resume())
        }
      })

      response.on('error', (err: Error) => {
        dest.destroy(err)
        cleanup()
        reject(err)
      })

      response.on('end', () => {
        dest.end(() => {
          cleanup()
          if (total > 0 && downloaded < total) {
            reject(new Error(`Descarga incompleta de ${url}: ${downloaded} de ${total} bytes`))
          } else {
            resolve()
          }
        })
      })
    })

    request.on('error', (e) => { cleanup(); reject(e) })
    request.end()
  })
}
