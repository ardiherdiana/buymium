"use client"

import { useState, type FormEvent } from "react"
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"

export default function LupaPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent) {
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
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <a
        href="/masuk"
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kembali ke halaman masuk
      </a>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/buymium_logo.png" alt="Buymium" width={48} height={48} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold">Lupa Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan emailmu dan kami kirimkan link reset password.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="size-12 text-green-500" />
              <h2 className="font-semibold">Email Terkirim!</h2>
              <p className="text-sm text-muted-foreground">
                Cek inbox <span className="font-medium text-foreground">{email}</span> dan klik
                link yang kami kirimkan. Link berlaku selama 30 menit.
              </p>
              <p className="text-xs text-muted-foreground">
                Tidak ada email? Cek folder spam atau{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary hover:underline"
                >
                  coba lagi
                </button>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                Kirim Link Reset
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
