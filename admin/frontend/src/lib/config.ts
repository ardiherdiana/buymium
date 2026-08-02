export const USER_API_BASE =
  import.meta.env.VITE_USER_API_URL ?? "http://localhost:5000/api"

const USER_ORIGIN = USER_API_BASE.replace(/\/api\/?$/, "")

export function getProofImageUrl(path: string): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  // paymentProofUrl already includes the /api prefix (and a signed token), so it hangs
  // off the bare origin rather than USER_API_BASE (which already ends in /api).
  if (path.startsWith("/api/")) return `${USER_ORIGIN}${path}`
  return `${USER_API_BASE}/${path.replace(/^\//, "")}`
}

export function formatIDR(val: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)
}
