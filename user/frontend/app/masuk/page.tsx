"use client"

import { useState, type FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react"
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

function MasukForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const redirectTo = searchParams.get("redirect") ?? "/dashboard"

  const [tab, setTab] = useState<Tab>("masuk")
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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const endpoint = tab === "masuk" ? "/auth/login" : "/auth/register"
      const body = tab === "masuk" ? { email, password } : { name, email, password }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Terjadi kesalahan")
      login(data.user, data.token)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
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
      login(data.user, data.token)
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login Google gagal")
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading

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
                {tab === "masuk" ? "Masuk" : "Buat Akun"}
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dengan masuk, kamu setuju dengan{" "}
          <a href="/syarat" className="underline hover:text-foreground">
            Syarat & Ketentuan
          </a>{" "}
          dan{" "}
          <a href="/privasi" className="underline hover:text-foreground">
            Kebijakan Privasi
          </a>
        </p>
      </div>
    </div>
  )
}
