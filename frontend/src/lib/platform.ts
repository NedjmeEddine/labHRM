import { invoke } from "@tauri-apps/api/core"

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window ||
      window.location.protocol === "tauri:" ||
      window.location.hostname === "tauri.localhost")
  )
}

export interface AppUpdateMetadata {
  available: boolean
  current_version: string
  version: string
  body?: string
}

export async function checkAppUpdate(): Promise<AppUpdateMetadata | null> {
  if (!isTauri()) return null
  return await invoke<AppUpdateMetadata | null>("check_app_update")
}

export async function installAppUpdate(): Promise<string> {
  if (!isTauri()) throw new Error("Only available in desktop application.")
  return await invoke<string>("install_app_update")
}

export async function startCloudflareTunnel(token: string): Promise<string> {
  if (!isTauri()) throw new Error("Only available in desktop application.")
  return await invoke<string>("start_cloudflare_tunnel", { token })
}

export async function stopCloudflareTunnel(): Promise<string> {
  if (!isTauri()) throw new Error("Only available in desktop application.")
  return await invoke<string>("stop_cloudflare_tunnel")
}

export async function getCloudflareTunnelStatus(): Promise<boolean> {
  if (!isTauri()) return false
  return await invoke<boolean>("get_tunnel_status")
}
