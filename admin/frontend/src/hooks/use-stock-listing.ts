import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

export interface ProgressState {
  status: "idle" | "syncing" | "scanning" | "done" | "error"
  current: number
  total: number
  sourceNames?: string[]
  error?: string
}

const idleProgress = (): ProgressState => ({ status: "idle", current: 0, total: 0, sourceNames: [] })

export interface StockEntityConfig<T extends { id: number }> {
  /** Base query key used for the listing query, e.g. "management-accounts" */
  queryKey: string
  /** Base REST path for the entity, e.g. "/management/accounts" */
  basePath: string
  /** Path used for the "sync with Google Sheets" action, e.g. `${basePath}/sync` */
  syncPath: string
  /** Path used to fetch the list of ids eligible for scanning, e.g. `${basePath}/scan/list` */
  scanListPath: string
  /** Key holding the array of items in the scan-list response payload */
  scanListItemsKey: string
  /** Build the request body sent to `syncPath` for a given source id ("all" or a numeric-id string) */
  buildSyncBody: (sourceId: string) => Record<string, unknown>
  /** Extract the entity's own array of items from a bulk operation's source list (already loaded page data) */
  getItems: (data: T[] | undefined) => T[]
  labels?: {
    deleteSuccess?: string
    deleteError?: string
    refreshError?: string
    scanDone?: string
  }
}

/**
 * Shared listing behaviour for the accounts stock page: selection state,
 * delete/refresh mutations, and the sync-with-sheets / scan-followers dialog+progress flows.
 * Table rendering, filters, and stats stay page-specific.
 */
export function useStockListing<T extends { id: number }>(config: StockEntityConfig<T>, items: T[]) {
  const queryClient = useQueryClient()
  const alert = useAlert()

  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncSourceId, setSyncSourceId] = useState("all")
  const [syncProgress, setSyncProgress] = useState<ProgressState>(idleProgress())

  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [scanSourceId, setScanSourceId] = useState("all")
  const [scanProgress, setScanProgress] = useState<ProgressState>(idleProgress())

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${config.basePath}/${id}`),
    onSuccess: () => {
      invalidate()
      alert.success("Berhasil", config.labels?.deleteSuccess ?? "Akun berhasil dihapus")
    },
    onError: () => alert.error("Gagal", config.labels?.deleteError ?? "Gagal menghapus akun"),
  })

  const refreshMutation = useMutation({
    mutationFn: (id: number) => api.post(`${config.basePath}/${id}/refresh-followers`),
    onSuccess: () => invalidate(),
    onError: () => alert.error("Gagal", config.labels?.refreshError ?? "Gagal memperbarui followers"),
  })

  const handleDelete = async (id: number, label: string) => {
    const ok = await alert.confirm("Hapus Akun", `Hapus akun "${label}"?`)
    if (ok) deleteMutation.mutate(id)
  }

  const handleBulkDelete = async () => {
    const ok = await alert.confirm("Hapus Akun", `Hapus ${selectedIds.length} akun yang dipilih?`)
    if (!ok) return
    await Promise.all(selectedIds.map((id) => api.delete(`${config.basePath}/${id}`).catch(() => {})))
    invalidate()
    alert.success("Berhasil", `${selectedIds.length} akun dihapus`)
    setSelectedIds([])
  }

  const handleBulkScan = async () => {
    const toScan = config.getItems(items).filter((a) => selectedIds.includes(a.id))
    if (!toScan.length) return
    for (const acc of toScan) {
      try { await api.post(`${config.basePath}/${acc.id}/refresh-followers`) } catch { /* continue */ }
    }
    invalidate()
    alert.success("Selesai", `${toScan.length} ${config.labels?.scanDone ?? "akun berhasil di-scan"}`)
  }

  const openSyncDialog = () => {
    setSyncSourceId("all")
    setSyncProgress(idleProgress())
    setSyncDialogOpen(true)
  }

  const openScanDialog = () => {
    setScanSourceId("all")
    setScanProgress(idleProgress())
    setScanDialogOpen(true)
  }

  const runSync = async (sources: { id: number; name: string }[]) => {
    const toSync = syncSourceId === "all" ? sources : sources.filter((s) => String(s.id) === syncSourceId)
    const isSingleCall = syncSourceId !== "all" || toSync.length === 0
    if (isSingleCall) {
      setSyncProgress({ status: "syncing", current: 0, total: 1, sourceNames: [toSync[0]?.name ?? "All"] })
      try {
        await api.post(config.syncPath, config.buildSyncBody(syncSourceId))
        setSyncProgress((p) => ({ ...p, status: "done", current: 1 }))
        invalidate()
      } catch (err: unknown) {
        setSyncProgress((p) => ({
          ...p,
          status: "error",
          error: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal",
        }))
      }
      return
    }
    setSyncProgress({ status: "syncing", current: 0, total: toSync.length, sourceNames: toSync.map((s) => s.name) })
    for (let i = 0; i < toSync.length; i++) {
      try { await api.post(config.syncPath, config.buildSyncBody(String(toSync[i].id))) } catch { /* continue */ }
      setSyncProgress((p) => ({ ...p, current: i + 1 }))
    }
    setSyncProgress((p) => ({ ...p, status: "done" }))
    invalidate()
  }

  const runScan = async () => {
    const sourceParam = scanSourceId !== "all" ? scanSourceId : undefined
    setScanProgress({ status: "scanning", current: 0, total: 0, sourceNames: [] })
    let ids: number[] = []
    try {
      const list = await api.get(config.scanListPath, { params: { source_id: sourceParam } })
      ids = ((list.data?.[config.scanListItemsKey] ?? []) as { id: number }[]).map((a) => a.id)
    } catch (err: unknown) {
      setScanProgress((p) => ({
        ...p,
        status: "error",
        error: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal",
      }))
      return
    }
    setScanProgress((p) => ({ ...p, total: ids.length }))
    for (let i = 0; i < ids.length; i++) {
      try { await api.post(`${config.basePath}/${ids[i]}/refresh-followers`) } catch { /* continue */ }
      setScanProgress((p) => ({ ...p, current: i + 1 }))
    }
    setScanProgress((p) => ({ ...p, status: "done" }))
    invalidate()
  }

  const allIds = items.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
  const toggleAll = () => setSelectedIds(allSelected ? [] : allIds)
  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return {
    selectedIds, setSelectedIds, allSelected, toggleAll, toggleOne,
    deleteMutation, refreshMutation, handleDelete, handleBulkDelete, handleBulkScan,
    syncDialogOpen, setSyncDialogOpen, syncSourceId, setSyncSourceId, syncProgress, openSyncDialog, runSync,
    scanDialogOpen, setScanDialogOpen, scanSourceId, setScanSourceId, scanProgress, openScanDialog, runScan,
    invalidate,
  }
}
