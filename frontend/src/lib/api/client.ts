import axios, { AxiosError } from "axios"

import { isTauri } from "@/lib/platform"
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/lib/storage"

function getBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  if (isTauri()) {
    return "http://127.0.0.1:8000"
  }
  return ""
}

export const api = axios.create({
  baseURL: getBaseUrl(),
})

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

api.interceptors.request.use((config) => {
  const token = getStorageItem(STORAGE_KEYS.accessToken)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    if (status === 401 || status === 403) {
      removeStorageItem(STORAGE_KEYS.accessToken)
      if (unauthorizedHandler) {
        unauthorizedHandler()
      } else if (isTauri()) {
        window.location.hash = "#/login"
      } else if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }
    return Promise.reject(err)
  },
)

export function extractApiErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)
      ?.detail
    if (Array.isArray(detail) && detail.length > 0) {
      const firstMsg = (detail[0] as { msg?: string } | undefined)?.msg
      if (firstMsg) return firstMsg
    }
    if (typeof detail === "string" && detail.trim()) {
      return detail
    }
    if (err.message) {
      return err.message
    }
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

export async function downloadAuthenticatedFile(
  url: string,
  filename: string,
  openInNewTab = false,
): Promise<void> {
  const res = await api.get(url, { responseType: "blob" })
  const blobUrl = window.URL.createObjectURL(res.data)
  if (openInNewTab) {
    window.open(blobUrl, "_blank")
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
    return
  }
  const link = document.createElement("a")
  link.href = blobUrl
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5_000)
}
