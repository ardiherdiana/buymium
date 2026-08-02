import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Upload, ImageIcon, VideoIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import BulkUploadModal from "./BulkUploadModal"
import { buildEmptySlots, buildUpcomingSlots, type Post, type Schedule } from "./shared"

function PostRow({ post, onDelete }: { post: Post; onDelete: () => void }) {
  const isVideo = post.imageUrl?.match(/\.(mp4|mov|avi|webm)$/i)
  return (
    <div className="flex-1 flex items-center gap-3 border rounded-lg px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
      {post.imageUrl && (
        <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {isVideo ? (
            <VideoIcon className="size-4 text-muted-foreground" />
          ) : (
            <img src={post.imageUrl} alt="" className="size-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          )}
        </div>
      )}
      {!post.imageUrl && (
        <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="size-4 text-muted-foreground" />
        </div>
      )}
      <p className="flex-1 text-sm line-clamp-2 text-foreground">{post.caption || "(tanpa caption)"}</p>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

export function AntrianTab({ channelId, schedules }: { channelId: number; schedules: Schedule[] }) {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; label: string } | null>(null)


  const { data, isLoading } = useQuery({
    queryKey: ["autoposting-posts", channelId, "scheduled"],
    queryFn: () =>
      api.get("/autoposting/posts", { params: { channel_id: channelId, status: "scheduled", limit: 500 } }).then((r) => r.data),
  })

  const posts: Post[] = data?.data ?? []

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete("/autoposting/posts", { params: { channel_id: channelId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoposting-posts", channelId, "scheduled"] })
      alert.success("Berhasil", "Semua postingan antrian dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus postingan"),
  })

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/autoposting/posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["autoposting-posts", channelId, "scheduled"] }),
    onError: () => alert.error("Gagal", "Gagal menghapus postingan"),
  })

  const handleDeleteAll = async () => {
    const ok = await alert.confirm("Hapus Semua", "Hapus semua postingan dalam antrian?")
    if (ok) deleteAllMutation.mutate()
  }

  // Same as Go: find empty slots → assign files → AI caption → POST scheduled
  const handleBulkUpload = async (files: File[], source: string) => {
    setBulkOpen(false)
    setIsPosting(true)

    try {
      // 1. Fetch latest scheduled posts for 90 days
      const now = new Date()
      const end = new Date(now)
      end.setDate(end.getDate() + 90)
      const res = await api.get("/autoposting/posts", {
        params: {
          channel_id: channelId,
          status: "scheduled",
          start_date: now.toISOString(),
          end_date: end.toISOString(),
          limit: 1000,
        },
      })
      const existingPosts: Post[] = res.data?.data ?? []

      // 2. Find empty slots in next 90 days
      const emptySlots = buildEmptySlots(schedules, existingPosts, 90)

      if (emptySlots.length === 0) {
        alert.error("Tidak Ada Slot", "Tidak ada slot kosong tersedia dalam 90 hari ke depan.")
        return
      }

      const filesToUpload = files.slice(0, emptySlots.length)
      const skipped = files.length - filesToUpload.length

      if (skipped > 0) {
        const ok = await alert.confirm(
          "Slot Tidak Cukup",
          `Hanya ${emptySlots.length} slot kosong tersedia. Proses ${filesToUpload.length} file pertama dan abaikan sisanya?`
        )
        if (!ok) return
      }

      // 3. Sequential: AI caption → POST to slot
      setUploadProgress({ current: 0, total: filesToUpload.length, label: "Memulai..." })

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        const slot = emptySlots[i]

        // AI caption
        setUploadProgress({ current: i + 1, total: filesToUpload.length, label: `AI caption: ${file.name}` })
        let caption = ""
        try {
          const aiRes = await api.post("/autoposting/ai/caption", { filename: file.name })
          caption = aiRes.data?.caption ?? ""
        } catch { /* lanjut tanpa caption */ }

        // Upload to slot
        setUploadProgress({ current: i + 1, total: filesToUpload.length, label: `Mengupload: ${file.name}` })
        const formData = new FormData()
        formData.append("file", file)
        formData.append("channelIds", String(channelId))
        formData.append("status", "scheduled")
        formData.append("caption", caption)
        formData.append("scheduledTime", slot.scheduledTime.toISOString())
        if (source) formData.append("source", source)

        try {
          await api.post("/autoposting/posts", formData, { headers: { "Content-Type": "multipart/form-data" } })
        } catch { /* lanjut file berikutnya */ }
      }

      queryClient.invalidateQueries({ queryKey: ["autoposting-posts", channelId, "scheduled"] })
      alert.success("Berhasil", `${filesToUpload.length} postingan berhasil dijadwalkan dengan AI caption!`)
    } catch (err) {
      alert.error("Gagal", "Terjadi kesalahan saat bulk upload")
      console.error(err)
    } finally {
      setIsPosting(false)
      setUploadProgress(null)
    }
  }

  const upcomingDays = useMemo(() => buildUpcomingSlots(schedules, posts, 14), [schedules, posts])

  if (isLoading) return <p className="text-xs text-muted-foreground">Memuat...</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Antrian Postingan</h2>
        <div className="flex items-center gap-2">
          {uploadProgress && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {uploadProgress.label} ({uploadProgress.current}/{uploadProgress.total})
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setBulkOpen(true)}
            disabled={isPosting}
          >
            <Upload className="size-4" />
            Unggah Massal
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handleDeleteAll}
            disabled={deleteAllMutation.isPending || isPosting}
          >
            <Trash2 className="size-4" />
            Hapus Semua
          </Button>
        </div>
      </div>

      {/* Upcoming scheduled slots */}
      {upcomingDays.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada jadwal aktif. Aktifkan hari di tab Jadwal terlebih dahulu.
        </div>
      )}

      {upcomingDays.map((day) => (
        <div key={day.dateStr} className="space-y-2">
          <p className="text-sm font-semibold text-primary">{day.label}</p>
          {day.slots.map((slot) => (
            <div key={slot.time} className="flex items-stretch gap-4">
              <span className="text-sm text-muted-foreground w-20 shrink-0 pt-3">{slot.time}</span>
              {slot.post ? (
                <PostRow
                  post={slot.post}
                  onDelete={() => deletePostMutation.mutate(slot.post!.id)}
                />
              ) : (
                <div className="flex-1 flex items-center gap-2 border border-dashed rounded-lg px-4 py-3 text-sm text-muted-foreground">
                  <Plus className="size-4" />
                  Buat Postingan
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onUpload={handleBulkUpload}
        loading={isPosting}
      />
    </div>
  )
}
