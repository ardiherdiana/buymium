"use client"

import { useState, useRef, type FormEvent, type KeyboardEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/google-signin-button"
import { useAuth } from "@/contexts/auth-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"

type Tab = "masuk" | "daftar"

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"

export default function MasukPage() {
  return (
    <Suspense>
      <MasukForm />
    </Suspense>
  )
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "")

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1)
    const next = [...digits]
    next[i] = d
    onChange(next.join(""))
    if (d && i < 5) inputs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted) { onChange(pasted.padEnd(6, "").slice(0, 6)); inputs.current[Math.min(pasted.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="size-11 rounded-lg border border-input bg-background text-center text-lg font-bold outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      ))}
    </div>
  )
}

function MasukForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const redirectTo = searchParams.get("redirect") ?? "/dashboard"

  const [tab, setTab] = useState<Tab>("masuk")
  const [step, setStep] = useState<"form" | "otp">("form")
  const [pendingEmail, setPendingEmail] = useState("")
  const [otpValue, setOtpValue] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setError("")
    setName("")
    setEmail("")
    setPassword("")
    setStep("form")
    setOtpValue("")
  }

  function startResendCooldown() {
    setResendCooldown(60)
    const iv = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 })
    }, 1000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (tab === "masuk") {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? data.error ?? "Terjadi kesalahan")
        login(data.user, data.token, data.refreshToken)
        router.push(redirectTo)
      } else {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? data.error ?? "Terjadi kesalahan")
        setPendingEmail(email)
        setStep("otp")
        startResendCooldown()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (otpValue.length < 6) { setError("Masukkan 6 digit kode OTP"); return }
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp: otpValue }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Verifikasi gagal")
      login(data.user, data.token, data.refreshToken)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi gagal")
      setOtpValue("")
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return
    setError("")
    try {
      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Gagal mengirim ulang")
      startResendCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim ulang OTP")
    }
  }

  async function handleGoogleCredential(credential: string) {
    setError("")
    setGoogleLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Login Google gagal")
      login(data.user, data.token, data.refreshToken)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login Google gagal")
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading

  if (step === "otp") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Mail className="size-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Verifikasi Email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Kode OTP dikirim ke
              </p>
              <p className="text-sm font-medium">{pendingEmail}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-center text-xs font-medium text-muted-foreground">
                  Masukkan 6 digit kode OTP
                </label>
                <OtpInput value={otpValue} onChange={setOtpValue} />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy || otpValue.length < 6}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Verifikasi & Buat Akun
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Tidak menerima kode?{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="font-medium text-primary disabled:opacity-50 hover:underline"
                >
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : "Kirim ulang"}
                </button>
              </p>
            </div>
          </div>

          <button
            onClick={() => { setStep("form"); setOtpValue(""); setError("") }}
            className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Kembali ke pendaftaran
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <a
        href="/"
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kembali ke beranda
      </a>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/buymium_logo.png" alt="Buymium" width={48} height={48} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold">
              {tab === "masuk" ? "Masuk ke Buymium" : "Buat Akun Baru"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "masuk"
                ? "Selamat datang kembali!"
                : "Daftar gratis, mulai belanja akun Instagram"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["masuk", "daftar"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); reset() }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "masuk" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Google Sign-In */}
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={busy} />

            {googleLoading && (
              <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Memverifikasi akun Google…
              </p>
            )}

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">atau dengan email</span>
              </div>
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {tab === "daftar" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Contoh: Budi Santoso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Email</label>
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

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Password</label>
                  {tab === "masuk" && (
                    <a href="/lupa-password" className="text-xs text-primary hover:underline">
                      Lupa password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={tab === "daftar" ? 8 : undefined}
                    autoComplete={tab === "masuk" ? "current-password" : "new-password"}
                    placeholder={tab === "daftar" ? "Min. 8 karakter" : "Password kamu"}
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

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {tab === "masuk" ? "Masuk" : "Daftar & Verifikasi Email"}
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dengan masuk, kamu menyetujui syarat & ketentuan Buymium.
        </p>
      </div>
    </div>
  )
}
