// In-memory log store — persists as long as the renderer process is alive (survives navigation)
const store: Record<string, string[]> = {}
const MAX_LINES = 500

export function getInstanceLogs(id: string): string[] {
  return store[id] ? [...store[id]] : []
}

export function appendInstanceLog(id: string, line: string): void {
  if (!store[id]) store[id] = []
  if (store[id].length >= MAX_LINES) store[id].shift()
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  store[id].push(`[${ts}] ${line}`)
}

export function clearInstanceLogs(id: string): void {
  store[id] = []
}
