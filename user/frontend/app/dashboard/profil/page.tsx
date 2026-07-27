"use client"

import { useState, useEffect, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Save, Lock, Eye, EyeOff, CheckCircle, LogOut } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"

export default function ProfilPage() {
  const { user, token, login, logout, authFetch } = useAuth()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push("/masuk")
  }

  const [avatar, setAvatar] = useState(user?.avatar ?? "")

  useEffect(() => {
    if (!token) return
    authFetch("/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.avatar) setAvatar(data.avatar) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const [name, setName] = useState(user?.name ?? "")
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [passSuccess, setPassSuccess] = useState(false)
  const [passError, setPassError] = useState("")

  const hasPassword = (user as any)?.hasPassword ?? true

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setProfileError("")
    setProfileSuccess(false)
    setProfileLoading(true)
    try {
      const res = await authFetch("/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Gagal menyimpan")
      login(data.user, token)
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPassError("Konfirmasi password tidak cocok")
      return
    }
    setPassError("")
    setPassSuccess(false)
    setPassLoading(true)
    try {
      const body: Record<string, string> = { newPassword }
      if (hasPassword) body.currentPassword = currentPassword
      const res = await authFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Gagal mengubah password")
      setPassSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setPassError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi akun kamu.</p>
      </div>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative size-16 shrink-0">
          {avatar ? (
            <Image
              src={avatar}
              alt={user?.name ?? ""}
              fill
              className="rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {user?.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Informasi akun (kiri) + Ganti password (kanan) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile form */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Informasi Akun</h2>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Nama</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
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

            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            {profileSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="size-4" /> Profil berhasil disimpan.
              </p>
            )}

            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Perubahan
            </Button>
          </form>
        </div>

        {/* Change password */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">
                {hasPassword ? "Ganti Password" : "Buat Password"}
              </h2>
            </div>
            {hasPassword && (
              <Link href="/lupa-password" className="text-xs text-primary hover:underline">
                Lupa password saat ini?
              </Link>
            )}
          </div>
          {!hasPassword && (
            <p className="mb-4 text-sm text-muted-foreground">
              Akun kamu terdaftar via Google. Kamu bisa membuat password untuk bisa masuk dengan email juga.
            </p>
          )}
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            {hasPassword && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Password Saat Ini</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Password lama kamu"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={INPUT_CLASS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Password Baru</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={INPUT_CLASS + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Konfirmasi Password Baru</label>
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {passError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {passError}
              </p>
            )}
            {passSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="size-4" /> Password berhasil diubah.
              </p>
            )}

            <Button type="submit" variant="outline" disabled={passLoading}>
              {passLoading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              {hasPassword ? "Ubah Password" : "Buat Password"}
            </Button>
          </form>
        </div>
      </div>

      {/* Logout */}
      <div className="mt-6 rounded-xl border border-destructive/20 bg-card p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Keluar Akun</h2>
            <p className="text-sm text-muted-foreground">Kamu akan keluar dari sesi ini di perangkat ini.</p>
          </div>
          <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
            <LogOut className="size-4" />
            Keluar
          </Button>
        </div>
      </div>

    </div>
  )
}
