import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Upload, VideoIcon, Eye, Radar } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ProfilePhoto } from "@/components/app-shell"
import api from "@/lib/api"
import { assetUrl } from "./shared"

interface DailyMetric {
  date: string
  value: number
}

interface AccountMetrics {
  account_id: string | number
  metrics: {
    followers?: DailyMetric[]
  }
}

interface PostCount {
  date: string
  count: number
}

interface RecentPost {
  id: number
  caption: string
  imageUrl?: string | null
  postedAt?: string | null
  socialBuId?: string | null
}

interface LeaderboardEntry {
  channelId: number
  username: string
  profilePhotoPath?: string | null
  followers: number
  growth: number
}

function defaultDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const toStr = (d: Date) => d.toISOString().slice(0, 10)
  return { start: toStr(start), end: toStr(end) }
}

function DateRangePicker({
  start, end, onChange,
}: { start: string; end: string; onChange: (range: { start: string; end: string }) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="date"
        value={start}
        max={end}
        onChange={(e) => onChange({ start: e.target.value, end })}
        className="h-8 rounded-md border px-2 text-xs bg-background"
      />
      <span className="text-muted-foreground">s/d</span>
      <input
        type="date"
        value={end}
        min={start}
        max={defaultDateRange().end}
        onChange={(e) => onChange({ start, end: e.target.value })}
        className="h-8 rounded-md border px-2 text-xs bg-background"
      />
    </div>
  )
}

export function LeaderboardTab({ channelId }: { channelId: number }) {
  const [range, setRange] = useState(defaultDateRange)

  const { data, isLoading } = useQuery({
    queryKey: ["autoposting-leaderboard", range.start, range.end],
    queryFn: () => api.get("/autoposting/analytics/leaderboard", { params: { start: range.start, end: range.end } }).then((r) => r.data),
  })

  const entries: LeaderboardEntry[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold">Leaderboard Akun TikTok</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ranking followers semua akun TikTok pada periode terpilih.</p>
        </div>
        <DateRangePicker start={range.start} end={range.end} onChange={setRange} />
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Memuat leaderboard...</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Belum ada data leaderboard.</div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {entries.map((entry, i) => {
            const isCurrent = entry.channelId === channelId
            return (
              <div
                key={entry.channelId}
                className={cn("flex items-center gap-3 px-4 py-2.5", isCurrent && "bg-primary/5")}
              >
                <span className="w-5 text-xs text-muted-foreground text-center shrink-0">{i + 1}</span>
                <ProfilePhoto path={entry.profilePhotoPath ?? undefined} username={entry.username} />
                <p className={cn("flex-1 text-sm truncate", isCurrent ? "text-blue-600 font-semibold" : "text-foreground")}>
                  {entry.username}
                </p>
                <span className="text-sm font-semibold tabular-nums">{entry.followers.toLocaleString("id-ID")}</span>
                <span className={cn(
                  "text-xs tabular-nums w-16 text-right shrink-0",
                  entry.growth > 0 ? "text-green-600" : entry.growth < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {entry.growth > 0 ? "+" : ""}{entry.growth.toLocaleString("id-ID")}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AnalitikTab({ channelId }: { channelId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["autoposting-analytics", channelId],
    queryFn: () =>
      api.get("/autoposting/analytics", { params: { channel_id: channelId } }).then((r) => r.data),
  })

  if (isLoading) return <p className="text-xs text-muted-foreground">Memuat analitik...</p>

  if (isError) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Gagal memuat data analitik dari SocialBu.
      </div>
    )
  }

  const accounts: AccountMetrics[] = data?.data ?? []
  const account = accounts[0]
  const followers = account?.metrics?.followers ?? []
  const latest = followers.length > 0 ? followers[followers.length - 1].value : 0
  const earliest = followers[0]?.value ?? 0
  const growth = latest - earliest

  const postsCounts: PostCount[] = data?.postsCounts ?? []
  const totalPosts = postsCounts.reduce((sum, p) => sum + (p.count ?? 0), 0)

  const recentPosts: RecentPost[] = data?.recentPosts ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold">Analitik TikTok</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ringkasan bulan ini.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 flex items-center gap-3">
          <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Radar className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Followers Saat Ini</p>
            <p className="text-lg font-semibold">{latest.toLocaleString("id-ID")}</p>
          </div>
        </div>
        <div className="border rounded-lg p-4 flex items-center gap-3">
          <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Eye className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pertumbuhan</p>
            <p className="text-lg font-semibold">{growth >= 0 ? "+" : ""}{growth.toLocaleString("id-ID")}</p>
          </div>
        </div>
        <div className="border rounded-lg p-4 flex items-center gap-3">
          <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Upload className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Posting</p>
            <p className="text-lg font-semibold">{totalPosts.toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      {(followers.length > 0 || postsCounts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {followers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pertumbuhan Followers</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={followers} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.slice(-2)}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                      formatter={(v) => [v as number, "Followers"]}
                      labelFormatter={(v) => `Tanggal ${String(v).slice(-2)}`}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Followers" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {postsCounts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Jumlah Posting per Hari</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={postsCounts} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.slice(-2)}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                      formatter={(v) => [v as number, "Posting"]}
                      labelFormatter={(v) => `Tanggal ${String(v).slice(-2)}`}
                    />
                    <Bar dataKey="count" fill="var(--primary)" name="Posting" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {followers.length === 0 && postsCounts.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Belum ada data analitik untuk periode ini.
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Postingan Terbaru</p>
        {recentPosts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Belum ada postingan yang berhasil dipublikasikan.</p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => {
              const isVideo = post.imageUrl?.match(/\.(mp4|mov|avi|webm)$/i)
              const src = assetUrl(post.imageUrl)
              return (
                <div key={post.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card">
                  <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {isVideo || !src ? (
                      <VideoIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <img src={src} alt="" className="size-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2 text-foreground">{post.caption || "(tanpa caption)"}</p>
                    {post.postedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(post.postedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
