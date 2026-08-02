// Shared types and helpers used across the autoposting tabs (Jadwal / Antrian / Analitik / Leaderboard).

export interface Schedule {
  id: number
  day: string
  isActive: boolean
  slots: string[]
  channelId: number
}

export interface Channel {
  id: number
  username: string
  type?: string
}

export interface Post {
  id: number
  caption?: string
  source?: string
  imageUrl?: string
  status: string
  scheduledTime?: string
  createdAt: string
}

export const DAYS_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const DAYS_ID: Record<string, string> = {
  Sunday: "Minggu", Monday: "Senin", Tuesday: "Selasa", Wednesday: "Rabu",
  Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu",
}

export const sortTime = (a: string, b: string) => {
  const toMinutes = (t: string) => {
    const [time, period] = t.split(" ")
    const [h, m] = time.split(":").map(Number)
    return (period === "PM" ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h) * 60 + m
  }
  return toMinutes(a) - toMinutes(b)
}

export const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
export const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

// Convert "07:00 AM" style to Date on a given date
export function slotToDate(dateStr: string, slot: string): Date {
  const [time, period] = slot.split(" ")
  const [h, m] = time.split(":").map(Number)
  let hours = h
  if (period === "PM" && h !== 12) hours += 12
  if (period === "AM" && h === 12) hours = 0
  const [y, mo, day] = dateStr.split("-").map(Number)
  return new Date(y, mo - 1, day, hours, m, 0, 0)
}

export function formatDateLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, mo, day] = dateStr.split("-").map(Number)
  const d = new Date(y, mo - 1, day)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  const dayName = DAYS_ID[DAYS_ORDER[d.getDay()]] ?? ""
  const formatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  if (diff === 0) return `Hari ini, ${formatted}`
  if (diff === 1) return `Besok, ${formatted}`
  return `${dayName}, ${formatted}`
}

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith("http")) return path
  return `${import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5001"}${path}`
}

export interface DaySlot {
  dateStr: string   // "2026-06-01"
  label: string
  slots: { time: string; post: Post | null }[]
}

export function buildUpcomingSlots(schedules: Schedule[], posts: Post[], days = 14): DaySlot[] {
  const result: DaySlot[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dayName = DAYS_ORDER[d.getDay()]
    const schedule = schedules.find((s) => s.day === dayName)
    if (!schedule || !schedule.isActive || schedule.slots.length === 0) continue

    const dateStr = localDateStr(d)
    const isToday = d.toDateString() === today.toDateString()
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const slotRows = schedule.slots.filter((slotTime) => {
      if (!isToday) return true
      const [time, period] = slotTime.split(" ")
      const [h, m] = time.split(":").map(Number)
      let hours = h
      if (period === "PM" && h !== 12) hours += 12
      if (period === "AM" && h === 12) hours = 0
      return hours * 60 + m > currentMinutes
    }).map((slotTime) => {
      const slotDate = slotToDate(dateStr, slotTime)
      const matchedPost = posts.find((p) => {
        if (!p.scheduledTime) return false
        const pt = new Date(p.scheduledTime)
        return (
          pt.getFullYear() === slotDate.getFullYear() &&
          pt.getMonth() === slotDate.getMonth() &&
          pt.getDate() === slotDate.getDate() &&
          pt.getHours() === slotDate.getHours() &&
          pt.getMinutes() === slotDate.getMinutes()
        )
      }) ?? null
      return { time: slotTime, post: matchedPost }
    })

    if (slotRows.length === 0) continue
    result.push({ dateStr, label: formatDateLabel(dateStr), slots: slotRows })
  }
  return result
}

// Build empty slots for N days — returns slots with no post assigned
export function buildEmptySlots(schedules: Schedule[], existingPosts: Post[], days = 90) {
  const result: { dateStr: string; time: string; scheduledTime: Date }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dayName = DAYS_ORDER[d.getDay()]
    const schedule = schedules.find((s) => s.day === dayName)
    if (!schedule || !schedule.isActive || schedule.slots.length === 0) continue

    const dateStr = localDateStr(d)

    for (const slotTime of schedule.slots) {
      const slotDate = slotToDate(dateStr, slotTime)
      // Skip past times for today
      if (slotDate <= new Date()) continue

      const isTaken = existingPosts.some((p) => {
        if (!p.scheduledTime) return false
        const pt = new Date(p.scheduledTime)
        return (
          pt.getFullYear() === slotDate.getFullYear() &&
          pt.getMonth() === slotDate.getMonth() &&
          pt.getDate() === slotDate.getDate() &&
          pt.getHours() === slotDate.getHours() &&
          pt.getMinutes() === slotDate.getMinutes()
        )
      })

      if (!isTaken) result.push({ dateStr, time: slotTime, scheduledTime: slotDate })
    }
  }
  return result
}
