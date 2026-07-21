import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2, Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface VendorTier { id: number; name: string; target_followers: number; price: number }
interface Vendor {
  id: number
  name: string
  is_active: boolean
  tiers: VendorTier[]
}

interface VendorForm { name: string; is_active: boolean }
const emptyForm: VendorForm = { name: "", is_active: true }

// target_followers/price are stored as raw digit strings and rendered with
// toLocaleString("id-ID") for the dot thousand-separator display used elsewhere (e.g. totalSalesInput)
interface TierForm { target_followers: string; price: string }
const emptyTierForm: TierForm = { target_followers: "", price: "" }
const deriveTierName = (targetFollowers: number) => `${targetFollowers.toLocaleString("id-ID")} Followers`
const digitsOnly = (v: string) => v.replace(/\D/g, "")
const formatDigits = (v: string) => (v ? parseInt(v).toLocaleString("id-ID") : "")

interface NewTierRow extends TierForm { key: number }
let newTierRowKeySeq = 0
const emptyNewTierRow = (): NewTierRow => ({ key: newTierRowKeySeq++, ...emptyTierForm })

export default function UpfollVendorsPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<VendorForm>(emptyForm)
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)

  const [tierFormOpen, setTierFormOpen] = useState(false)
  const [editingTierId, setEditingTierId] = useState<number | null>(null)
  const [tierForm, setTierForm] = useState<TierForm>(emptyTierForm)

  const [newTierRows, setNewTierRows] = useState<NewTierRow[]>([emptyNewTierRow()])
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery<{ vendors: Vendor[] }>({
    queryKey: ["upfoll-vendors"],
    queryFn: () => api.get("/management/upfoll-vendors").then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: object) => api.put(`/management/upfoll-vendors/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upfoll-vendors"] })
      alert.success("Berhasil", "Vendor diperbarui")
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal menyimpan vendor"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/upfoll-vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upfoll-vendors"] })
      alert.success("Berhasil", "Vendor berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus vendor"),
  })

  const saveTierMutation = useMutation({
    mutationFn: (payload: { vendorId: number; tierId: number | null; name: string; target_followers: number; price: number }) =>
      payload.tierId
        ? api.put(`/management/upfoll-vendors/tiers/${payload.tierId}`, { name: payload.name, target_followers: payload.target_followers, price: payload.price }).then((r) => r.data)
        : api.post(`/management/upfoll-vendors/${payload.vendorId}/tiers`, { name: payload.name, target_followers: payload.target_followers, price: payload.price }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upfoll-vendors"] })
      alert.success("Berhasil", editingTierId ? "Tier diperbarui" : "Tier ditambahkan")
      closeTierForm()
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal menyimpan tier"),
  })

  const deleteTierMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/upfoll-vendors/tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upfoll-vendors"] })
      alert.success("Berhasil", "Tier berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus tier — mungkin masih dipakai order"),
  })

  const handleDelete = async (v: Vendor) => {
    const ok = await alert.confirm("Hapus Vendor", `Hapus vendor "${v.name}"? Semua tier miliknya ikut terhapus.`)
    if (ok) deleteMutation.mutate(v.id)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setCurrentVendor(null)
    setForm(emptyForm)
    setNewTierRows([emptyNewTierRow()])
    closeTierForm()
  }

  const handleEdit = (v: Vendor) => {
    setEditingId(v.id)
    setCurrentVendor(v)
    setForm({ name: v.name, is_active: v.is_active })
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingId(null)
    setCurrentVendor(null)
    setForm(emptyForm)
    setNewTierRows([emptyNewTierRow()])
    setModalOpen(true)
  }

  const updateNewTierRow = (key: number, patch: Partial<TierForm>) => {
    setNewTierRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const addNewTierRow = () => setNewTierRows((rs) => [...rs, emptyNewTierRow()])
  const removeNewTierRow = (key: number) => setNewTierRows((rs) => rs.filter((r) => r.key !== key))

  // Edit mode: just update the vendor's name/active flag (tiers already exist and are managed separately)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert.error("Validasi", "Nama vendor wajib diisi")
      return
    }
    saveMutation.mutate({ name: form.name.trim(), is_active: form.is_active })
  }

  // Create mode: vendor + all filled-in tier rows are submitted together in one go
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert.error("Validasi", "Nama vendor wajib diisi")
      return
    }
    const filledRows = newTierRows.filter((r) => r.target_followers || r.price)
    for (const r of filledRows) {
      if (!r.target_followers || !r.price) {
        alert.error("Validasi", "Lengkapi target followers dan harga di setiap baris tier yang diisi")
        return
      }
    }

    setCreating(true)
    try {
      const vendorRes = await api.post("/management/upfoll-vendors", { name: form.name.trim(), is_active: form.is_active })
      const vendorId = vendorRes.data.vendor.id
      await Promise.all(filledRows.map((r) => {
        const targetFollowers = parseInt(r.target_followers)
        return api.post(`/management/upfoll-vendors/${vendorId}/tiers`, {
          name: deriveTierName(targetFollowers),
          target_followers: targetFollowers,
          price: parseFloat(r.price),
        })
      }))
      queryClient.invalidateQueries({ queryKey: ["upfoll-vendors"] })
      alert.success("Berhasil", "Vendor & tier berhasil ditambahkan")
      closeModal()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menambahkan vendor"
      alert.error("Gagal", msg)
    } finally {
      setCreating(false)
    }
  }

  const closeTierForm = () => {
    setTierFormOpen(false)
    setEditingTierId(null)
    setTierForm(emptyTierForm)
  }

  const openNewTierForm = () => {
    setEditingTierId(null)
    setTierForm(emptyTierForm)
    setTierFormOpen(true)
  }

  const openEditTierForm = (t: VendorTier) => {
    setEditingTierId(t.id)
    setTierForm({ target_followers: String(t.target_followers), price: String(t.price) })
    setTierFormOpen(true)
  }

  const handleSaveTier = () => {
    if (!editingId) return
    if (!tierForm.target_followers || !tierForm.price) {
      alert.error("Validasi", "Target followers dan harga wajib diisi")
      return
    }
    const targetFollowers = parseInt(tierForm.target_followers)
    saveTierMutation.mutate({
      vendorId: editingId,
      tierId: editingTierId,
      name: deriveTierName(targetFollowers),
      target_followers: targetFollowers,
      price: parseFloat(tierForm.price),
    })
  }

  const handleDeleteTier = async (t: VendorTier) => {
    const ok = await alert.confirm("Hapus Tier", `Hapus tier "${t.name}"?`)
    if (ok) deleteTierMutation.mutate(t.id)
  }

  const vendors = data?.vendors ?? []
  // Keep the modal's tier list live as the vendors query refetches after mutations
  const liveVendor = currentVendor ? vendors.find((v) => v.id === currentVendor.id) ?? currentVendor : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Vendor Upfoll</h1>
        <p className="text-sm text-muted-foreground mt-1">Master vendor upfoll — tiap vendor punya tier &amp; harga sendiri</p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !vendors.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada vendor</p>
        ) : vendors.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{v.name}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${v.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                    {v.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => handleEdit(v)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => handleDelete(v)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>

              {v.tiers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada tier</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {v.tiers.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground">{formatIDR(t.price)}</span>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Fab onClick={handleAdd} title="Tambah Vendor" />

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? "Edit Vendor" : "Tambah Vendor"}>
        {!editingId ? (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nama Vendor</label>
              <Input placeholder="Vendor Upfoll A" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2.5">
              <Checkbox id="vendor-active" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: !!v }))} />
              <label htmlFor="vendor-active" className="text-sm cursor-pointer">Aktif</label>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tier &amp; Harga</label>
                <button type="button" onClick={addNewTierRow}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="size-3" /> Tambah baris
                </button>
              </div>
              <div className="space-y-2">
                {newTierRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <Input type="text" inputMode="numeric" placeholder="Target followers" value={formatDigits(row.target_followers)} onChange={(e) => updateNewTierRow(row.key, { target_followers: digitsOnly(e.target.value) })} />
                    <Input type="text" inputMode="numeric" placeholder="Harga" value={formatDigits(row.price)} onChange={(e) => updateNewTierRow(row.key, { price: digitsOnly(e.target.value) })} />
                    {newTierRows.length > 1 && (
                      <button type="button" onClick={() => removeNewTierRow(row.key)}
                        className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? "Menyimpan..." : "Simpan Vendor"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nama Vendor</label>
              <Input placeholder="Vendor Upfoll A" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2.5">
              <Checkbox id="vendor-active-edit" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: !!v }))} />
              <label htmlFor="vendor-active-edit" className="text-sm cursor-pointer">Aktif</label>
            </div>

            <Button type="submit" variant="outline" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan Perubahan Nama"}
            </Button>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tier &amp; Harga</label>
                {!tierFormOpen && (
                  <button type="button" onClick={openNewTierForm}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Plus className="size-3" /> Tier baru
                  </button>
                )}
              </div>

              {tierFormOpen ? (
                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{editingTierId ? "Edit Tier" : "Tier Baru"}</span>
                    <button type="button" onClick={closeTierForm}
                      className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Input type="text" inputMode="numeric" placeholder="Target followers, mis. 1.000" value={formatDigits(tierForm.target_followers)} onChange={(e) => setTierForm((f) => ({ ...f, target_followers: digitsOnly(e.target.value) }))} />
                  <Input type="text" inputMode="numeric" placeholder="Harga, mis. 15.000" value={formatDigits(tierForm.price)} onChange={(e) => setTierForm((f) => ({ ...f, price: digitsOnly(e.target.value) }))} />
                  <Button type="button" size="sm" className="w-full" onClick={handleSaveTier} disabled={saveTierMutation.isPending}>
                    {saveTierMutation.isPending ? "Menyimpan..." : "Simpan Tier"}
                  </Button>
                </div>
              ) : !liveVendor?.tiers.length ? (
                <p className="text-xs text-muted-foreground">Belum ada tier untuk vendor ini</p>
              ) : (
                <div className="space-y-1">
                  {liveVendor.tiers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/60">
                      <span className="text-muted-foreground">{t.name} · {t.target_followers.toLocaleString("id-ID")} followers · {formatIDR(t.price)}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => openEditTierForm(t)} className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="size-3" />
                        </button>
                        <button type="button" onClick={() => handleDeleteTier(t)} className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="button" variant="ghost" className="w-full" onClick={closeModal}>
              Selesai
            </Button>
          </form>
        )}
      </Modal>
    </div>
  )
}
