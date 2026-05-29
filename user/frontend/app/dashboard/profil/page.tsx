"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Save } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

export default function ProfilPage() {
  const { user, token, login, logout } = useAuth()
  const router = useRouter()

  const [name, setName] = useState(user?.name ?? "")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError("")
    setSuccess(false)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Gagal menyimpan")
      login(data.user, token)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    logout()
    router.push("/")
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi akun kamu.</p>
      </div>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold">Informasi Akun</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nama</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">Email tidak dapat diubah.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">Profil berhasil disimpan.</p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Simpan Perubahan
          </Button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="mb-1 font-semibold text-destructive">Keluar</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Kamu akan keluar dari sesi ini di perangkat ini.
        </p>
        <Button variant="outline" onClick={handleLogout} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          <LogOut className="size-4" />
          Keluar dari Akun
        </Button>
      </div>
    </div>
  )
}
