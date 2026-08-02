import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface StatCardComparison {
  change: number
  label: string
}

export type StatCardColor = "blue" | "red" | "emerald" | "amber" | "violet" | "muted"

const COLOR_MAP: Record<StatCardColor, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600" },
  red: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-500" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600" },
  violet: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600" },
  muted: { bg: "bg-muted", text: "text-muted-foreground" },
}

function ComparisonBadge({ change, label, invert }: { change: number; label: string; invert?: boolean }) {
  const isUp = change >= 0
  const positive = invert ? !isUp : isUp
  return (
    <p className={`text-xs mt-1 flex items-center gap-0.5 ${positive ? "text-green-600" : "text-red-500"}`}>
      <span>{isUp ? "↑" : "↓"}</span>
      <span>{Math.abs(change)}% {label}</span>
    </p>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  loading?: boolean
  valueClass?: string
  /** Short subtitle shown under the value, e.g. "Akun aktif" */
  description?: string
  /** Period-over-period change badge, e.g. used on the Analytics page */
  comparison?: StatCardComparison
  /** Flips the up/down → good/bad color mapping for the comparison badge */
  invert?: boolean
  /** Icon accent color; defaults to muted */
  color?: StatCardColor
}

/** Shared stat tile used across stock listings, dashboard, sales and analytics for a consistent look. */
export function StatCard({ title, value, icon: Icon, loading, valueClass, description, comparison, invert, color = "muted" }: StatCardProps) {
  const { bg, text } = COLOR_MAP[color]

  return (
    <Card>
      {/* Mobile: compact single-line row */}
      <CardContent className="sm:hidden p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          {loading ? <Skeleton className="h-5 w-20 mt-0.5" /> : (
            <p className={`text-base font-bold leading-tight ${valueClass ?? "text-foreground"}`}>{value}</p>
          )}
        </div>
        <Icon className={`size-5 shrink-0 ${text}`} />
      </CardContent>

      {/* Desktop: icon-circle card */}
      <CardContent className="hidden sm:flex p-4 items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
            <p className={`text-2xl font-bold mt-1 ${valueClass ?? "text-foreground"}`}>{value}</p>
          )}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {!loading && comparison && comparison.label && (
            <ComparisonBadge change={comparison.change} label={comparison.label} invert={invert} />
          )}
        </div>
        <div className={`size-10 rounded-full shrink-0 flex items-center justify-center ${bg}`}>
          <Icon className={`size-5 ${text}`} />
        </div>
      </CardContent>
    </Card>
  )
}
