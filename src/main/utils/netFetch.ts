/**
 * Cliente HTTP mínimo usando el módulo https de Node.js.
 * Soporta gzip/deflate, timeout, AbortSignal y retry en 429.
 */
import https from 'https'
import http from 'http'
import zlib from 'zlib'

const TIMEOUT_MS = 15_000

export function netFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {},
  _retries = 2,
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))

    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method: options.method ?? 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          ...options.headers,
        },
      },
      (res) => {
        clearTimeout(timer)

        // Retry en rate-limit
        if (res.statusCode === 429 && _retries > 0) {
          const wait = Math.min(Number(res.headers['retry-after'] ?? 2) * 1000, 5_000)
          res.resume()
          setTimeout(() => netFetch(url, options, _retries - 1).then(resolve, reject), wait)
          return
        }

        // Descompresión automática
        const enc = res.headers['content-encoding'] ?? ''
        const stream: NodeJS.ReadableStream = enc.includes('gzip')
          ? res.pipe(zlib.createGunzip())
          : enc.includes('deflate')
            ? res.pipe(zlib.createInflate())
            : res

        const chunks: Buffer[] = []
        stream.on('data', (c: Buffer) => chunks.push(c))
        stream.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8')
          if ((res.statusCode ?? 0) >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`))
          }
          try { resolve(JSON.parse(text)) }
          catch { reject(new Error('Respuesta inválida del servidor')) }
        })
        stream.on('error', reject)
      },
    )

    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('La petición tardó demasiado. Comprueba tu conexión.'))
    }, TIMEOUT_MS)

    req.on('error', (err) => { clearTimeout(timer); reject(err) })

    const onAbort = () => { req.destroy(); reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })) }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    if (options.body) req.write(options.body)
    req.end()
  })
}
