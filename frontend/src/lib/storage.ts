const STORAGE_KEYS = {
  accessToken: "access_token",
  language: "elamel_lang",
  theme: "vite-ui-theme",
} as const

const memoryStore = new Map<string, string>()

export function getStorageItem(key: string): string | null {
  try {
    const val = window.localStorage.getItem(key)
    if (val !== null) return val
  } catch {
    // Fallback to in-memory store in restricted WebViews or private browsing
  }
  return memoryStore.get(key) ?? null
}

export function setStorageItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Fallback to in-memory store in restricted WebViews or private browsing
  }
  memoryStore.set(key, value)
}

export function removeStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Fallback to in-memory store in restricted WebViews or private browsing
  }
  memoryStore.delete(key)
}

export { STORAGE_KEYS }
