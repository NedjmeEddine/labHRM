const STORAGE_KEYS = {
  accessToken: "access_token",
  language: "elamel_lang",
  theme: "vite-ui-theme",
} as const

export function getStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setStorageItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage errors in restricted WebViews or private browsing modes
  }
}

export function removeStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage errors in restricted WebViews or private browsing modes
  }
}

export { STORAGE_KEYS }
