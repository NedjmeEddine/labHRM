export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "U"
  return parts
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
