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
  headers?: Record<string, string>
): Promise<string> {
  await download(url, destPath, onProgress, headers, 0)
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
  redirectCount: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error(`Demasiadas redirecciones descargando ${url}`))
    }

    const request = net.request({ method: 'GET', url })

    if (headers) {
      for (const [key, val] of Object.entries(headers)) {
        request.setHeader(key, val)
      }
    }

    request.on('response', (response) => {
      const status = response.statusCode

      // Follow redirects
      if (status >= 300 && status < 400) {
        const loc = getHeader(response.headers, 'location')
        if (!loc) return reject(new Error(`Redirección sin Location header desde ${url}`))
        // Drain the redirect response body
        response.on('data', () => {})
        let redirectUrl: string
        try {
          redirectUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
        } catch {
          return reject(new Error(`Location header inválido: ${loc}`))
        }
        download(redirectUrl, destPath, onProgress, headers, redirectCount + 1)
          .then(resolve)
          .catch(reject)
        return
      }

      if (status < 200 || status >= 300) {
        response.on('data', () => {})
        return reject(new Error(`HTTP ${status} descargando ${url}`))
      }

      const total = parseInt(getHeader(response.headers, 'content-length') ?? '0', 10)
      let downloaded = 0

      const dest = createWriteStream(destPath)
      dest.on('error', reject)

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        onProgress?.({
          downloaded,
          total,
          percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
        })
        // Handle backpressure
        if (!dest.write(chunk)) {
          (response as any).pause()
          dest.once('drain', () => (response as any).resume())
        }
      })

      response.on('error', (err: Error) => {
        dest.destroy(err)
        reject(err)
      })

      response.on('end', () => {
        dest.end(() => {
          if (total > 0 && downloaded < total) {
            reject(new Error(`Descarga incompleta de ${url}: ${downloaded} de ${total} bytes`))
          } else {
            resolve()
          }
        })
      })
    })

    request.on('error', reject)
    request.end()
  })
}
