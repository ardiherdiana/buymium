import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { DAYS_ID, DAYS_ORDER, HOURS, MINUTES, sortTime, type Schedule } from "./shared"

interface JadwalTabProps {
  channelId: number
  schedules: Schedule[]
  loadingSchedules: boolean
}

export function JadwalTab({ channelId, schedules, loadingSchedules }: JadwalTabProps) {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [slotHour, setSlotHour] = useState("07")
  const [slotMinute, setSlotMinute] = useState("00")
  const [slotAmpm, setSlotAmpm] = useState<"AM" | "PM">("PM")

  const updateMutation = useMutation({
    mutationFn: (updated: Schedule[]) =>
      api.put("/autoposting/schedules", {
        schedules: updated.map((s) => ({ id: s.id, isActive: s.isActive, slots: s.slots })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["autoposting-schedules", channelId] }),
    onError: () => alert.error("Gagal", "Gagal menyimpan jadwal"),
  })

  const toggleDay = (scheduleId: number) => {
    const updated = schedules.map((s) =>
      s.id === scheduleId ? { ...s, isActive: !s.isActive } : s
    )
    updateMutation.mutate(updated)
  }

  const addSlot = () => {
    if (!channelId) return
    const time = `${slotHour}:${slotMinute} ${slotAmpm}`
    const updated = schedules.map((s) => ({
      ...s,
      slots: s.isActive && !s.slots.includes(time) ? [...s.slots, time].sort(sortTime) : s.slots,
    }))
    updateMutation.mutate(updated)
  }

  const removeSlot = (scheduleId: number, slot: string) => {
    const updated = schedules.map((s) =>
      s.id === scheduleId ? { ...s, slots: s.slots.filter((sl) => sl !== slot) } : s
    )
    updateMutation.mutate(updated)
  }

  const clearAllSlots = async () => {
    const ok = await alert.confirm("Hapus Semua Slot", "Hapus semua slot posting?")
    if (!ok) return
    const updated = schedules.map((s) => ({ ...s, slots: [] }))
    updateMutation.mutate(updated)
  }

  const sortedSchedules = [...schedules].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">Slot Posting</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Waktu posting menentukan kapan postingan akan dikirim dari antrian.
        </p>
      </div>

      {/* Add slot form */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Tambah waktu posting untuk</span>
          <Select value="Every Day" disabled>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Every Day">Setiap Hari</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">pukul</span>
          <Select value={slotHour} onValueChange={setSlotHour}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={slotMinute} onValueChange={setSlotMinute}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {MINUTES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={slotAmpm} onValueChange={(v) => setSlotAmpm(v as "AM" | "PM")}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={addSlot}
              disabled={updateMutation.isPending}
              className="gap-2 bg-primary hover:bg-primary/90 h-9"
            >
              <Plus className="size-4" />
              Tambah Slot
            </Button>
            <Button
              variant="destructive"
              onClick={clearAllSlots}
              disabled={updateMutation.isPending}
              className="gap-2 h-9"
            >
              <Trash2 className="size-4" />
              Hapus Semua
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule grid */}
      {loadingSchedules ? (
        <p className="text-xs text-muted-foreground py-4">Memuat jadwal...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex divide-x">
            {sortedSchedules.map((schedule) => (
              <div key={schedule.id} className="flex-1 flex flex-col min-w-0">
                <div className="flex flex-col items-center gap-2 py-3 px-1 border-b bg-muted/20">
                  <span className="text-xs font-semibold text-center">{DAYS_ID[schedule.day] ?? schedule.day}</span>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={schedule.isActive}
                      onCheckedChange={() => toggleDay(schedule.id)}
                      className="scale-75"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 p-1.5 min-h-[100px]">
                  {schedule.slots.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center mt-3">—</p>
                  ) : (
                    schedule.slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => removeSlot(schedule.id, slot)}
                        className="w-full text-center text-[10px] py-1.5 px-0.5 rounded bg-muted/60 hover:bg-destructive/10 hover:text-destructive transition-colors leading-tight"
                        title="Klik untuk hapus"
                      >
                        {slot}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
