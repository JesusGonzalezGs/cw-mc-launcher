import { spawn } from 'child_process'
import fs from 'fs'

export const isWindows = process.platform === 'win32'

export function killProcess(pid: number): void {
  if (isWindows) {
    const tk = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false })
    tk.on('error', (err) => console.warn(`[killProcess] taskkill falló para PID ${pid}:`, err.message))
  } else {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try { process.kill(pid, 'SIGKILL') } catch { /* ya terminó */ }
    }
  }
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const unzipper = (await import('unzipper')).default
  const directory = await unzipper.Open.file(zipPath)
  await directory.extract({ path: destDir })
}

/**
 * Like spawnAsync but calls onLine for each stdout/stderr line in real time.
 * Useful for long-running processes (Forge installer) where progress visibility matters.
 */
export function spawnWithOutput(
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: 'pipe' })
    const errorLines: string[] = []
    let stdoutBuf = ''
    let stderrBuf = ''

    function flush(buf: string, chunk: Buffer, isError: boolean): string {
      // Normalize \r\n and standalone \r (used by some installers for progress overwriting)
      const combined = (buf + chunk.toString('utf-8')).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = combined.split('\n')
      const remaining = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.replace(/\r$/, '').trim()
        if (line) {
          onLine(line)
          if (isError) errorLines.push(line)
        }
      }
      return remaining
    }

    proc.stdout?.on('data', (chunk: Buffer) => { stdoutBuf = flush(stdoutBuf, chunk, false) })
    proc.stderr?.on('data', (chunk: Buffer) => { stderrBuf = flush(stderrBuf, chunk, true) })

    proc.on('close', (code) => {
      if (stdoutBuf.trim()) onLine(stdoutBuf.trim())
      if (stderrBuf.trim()) { onLine(stderrBuf.trim()); errorLines.push(stderrBuf.trim()) }
      if (code === 0) {
        resolve()
      } else {
        const detail = errorLines.length > 0 ? `\n${errorLines.slice(-10).join('\n').slice(0, 500)}` : ''
        reject(new Error(`Proceso "${cmd}" terminó con código ${code}${detail}`))
      }
    })
    proc.on('error', reject)
  })
}

export function spawnAsync(
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: 'pipe' })
    const stderrChunks: Buffer[] = []
    proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim()
        const detail = stderr ? `\n${stderr.slice(0, 500)}` : ''
        reject(new Error(`Proceso "${cmd}" terminó con código ${code}${detail}`))
      }
    })
    proc.on('error', reject)
  })
}
