export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window ||
      window.location.protocol === "tauri:" ||
      window.location.hostname === "tauri.localhost")
  )
}
