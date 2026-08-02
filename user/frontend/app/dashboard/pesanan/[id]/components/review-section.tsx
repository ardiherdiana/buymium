"use client"

import { useState } from "react"
import { Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ReviewForm({ orderId, authFetch, onSubmitted }: {
  orderId: number
  authFetch: (path: string, init?: RequestInit) => Promise<Response>
  onSubmitted: (rating: number, message: string) => void
}) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (rating < 1 || !message.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await authFetch("/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, message: message.trim() }),
      })
      if (res.ok) {
        onSubmitted(rating, message.trim())
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || "Gagal mengirim ulasan")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(s)}
          >
            <Star
              className={`size-7 transition-colors ${
                s <= (hovered || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Ceritakan pengalamanmu dengan produk ini..."
        className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        className="w-full"
        disabled={submitting || rating < 1 || !message.trim()}
        onClick={handleSubmit}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Kirim Ulasan
      </Button>
    </div>
  )
}

export function ReviewDisplay({ rating, message }: { rating: number; message: string }) {
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`size-5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
    </div>
  )
}
