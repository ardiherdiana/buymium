"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"

export default function LupaPasswordPage() {
  const router = useRouter()
  const { user } = useAuth()
  const backHref = user ? "/dashboard/profil" : "/masuk"
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Terjadi kesalahan")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Password tidak cocok"); return }
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Terjadi kesalahan")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <a
        href={backHref}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {user ? "Kembali ke profil" : "Kembali ke halaman masuk"}
      </a>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/buymium_logo.png" alt="Buymium" width={48} height={48} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold">Lupa Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "email"
                ? "Masukkan emailmu dan kami kirimkan kode OTP."
                : "Masukkan kode OTP dan password baru."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="size-12 text-green-500" />
              <h2 className="font-semibold">Password Berhasil Diubah!</h2>
              <p className="text-sm text-muted-foreground">
                Kamu sudah bisa masuk dengan password baru.
              </p>
              <Button className="mt-2 w-full" onClick={() => router.push("/masuk")}>
                Masuk Sekarang
              </Button>
            </div>
          ) : step === "email" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Alamat Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="email@contoh.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Kirim Kode OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Kode OTP dikirim ke <span className="font-medium text-foreground">{email}</span>, berlaku 10 menit.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Kode OTP</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit kode"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={INPUT_CLASS + " tracking-widest text-center font-mono"}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT_CLASS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Konfirmasi Password</label>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Simpan Password Baru
              </Button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ganti email atau kirim ulang kode
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
