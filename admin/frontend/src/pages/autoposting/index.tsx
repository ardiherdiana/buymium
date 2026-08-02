import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { JadwalTab } from "./JadwalTab"
import { AntrianTab } from "./AntrianTab"
import { AnalitikTab, LeaderboardTab } from "./AnalitikTab"
import type { Channel, Schedule } from "./shared"

export default function AutopostingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const channelId = searchParams.get("channel_id") ? Number(searchParams.get("channel_id")) : null

  const { data: channelsData } = useQuery({
    queryKey: ["autoposting-channels"],
    queryFn: () => api.get("/autoposting/channels").then((r) => r.data),
  })

  const channels: Channel[] = channelsData?.data ?? []
  const currentChannel = channels.find((c) => c.id === channelId)
  const isTiktok = (currentChannel?.type ?? "").toLowerCase() === "tiktok"

  useEffect(() => {
    if (!channelId) {
      const first = channelsData?.data?.[0] as { id: number } | undefined
      if (first) setSearchParams({ channel_id: String(first.id) }, { replace: true })
    }
  }, [channelId, channelsData, setSearchParams])

  const [activeTabState, setActiveTab] = useState<"jadwal" | "antrian" | "analitik" | "leaderboard">("jadwal")
  const activeTab = (activeTabState === "analitik" || activeTabState === "leaderboard") && !isTiktok ? "jadwal" : activeTabState

  const { data: schedulesData, isLoading: loadingSchedules } = useQuery({
    queryKey: ["autoposting-schedules", channelId],
    queryFn: () =>
      api.get("/autoposting/schedules", { params: { channel_id: channelId! } }).then((r) => r.data),
    enabled: !!channelId,
  })

  const schedules: Schedule[] = schedulesData?.data ?? []

  if (!channelId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Memuat saluran...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-0 border-b">
        {(isTiktok
          ? ([["jadwal", "Jadwal"], ["antrian", "Antrian"], ["analitik", "Analitik"], ["leaderboard", "Leaderboard"]] as const)
          : ([["jadwal", "Jadwal"], ["antrian", "Antrian"]] as const)
        ).map(([tab, label]) => (
          <Button
            key={tab}
            variant="ghost"
            onClick={() => setActiveTab(tab)}
            className={`h-auto rounded-none px-4 py-2 text-xs font-medium border-b-2 -mb-px hover:bg-transparent ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "jadwal" && (
        <JadwalTab channelId={channelId} schedules={schedules} loadingSchedules={loadingSchedules} />
      )}

      {activeTab === "antrian" && channelId && (
        <AntrianTab channelId={channelId} schedules={schedules} />
      )}

      {activeTab === "analitik" && channelId && isTiktok && (
        <AnalitikTab channelId={channelId} />
      )}

      {activeTab === "leaderboard" && channelId && isTiktok && (
        <LeaderboardTab channelId={channelId} />
      )}

    </div>
  )
}
