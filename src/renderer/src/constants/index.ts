export const LOADER_NAMES: Record<string, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
}

export const LOADER_COLORS: Record<string, string> = {
  vanilla: 'text-green-400',
  fabric: 'text-yellow-400',
  quilt: 'text-purple-400',
  forge: 'text-orange-400',
  neoforge: 'text-red-400',
}

export const LOADER_TYPE_MAP: Record<string, number> = {
  Forge: 1,
  Fabric: 4,
  Quilt: 5,
  NeoForge: 6,
}

export const MC_RELEASE_VERSIONS = [
  '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1',
  '1.19.4', '1.19.2', '1.18.2', '1.17.1',
  '1.16.5', '1.15.2', '1.14.4', '1.12.2', '1.8.9', '1.7.10',
]
