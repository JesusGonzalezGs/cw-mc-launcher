// In-memory log store — persists as long as the renderer process is alive (survives navigation)
const store: Record<string, string[]> = {}
const MAX_LINES = 500

export function getInstanceLogs(id: string): string[] {
  return store[id] ? [...store[id]] : []
}

export function appendInstanceLog(id: string, line: string): void {
  if (!store[id]) store[id] = []
  if (store[id].length >= MAX_LINES) store[id].shift()
  store[id].push(line)
}

export function clearInstanceLogs(id: string): void {
  store[id] = []
}
