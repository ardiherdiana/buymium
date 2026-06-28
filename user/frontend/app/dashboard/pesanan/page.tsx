"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingBag, ChevronRight, Download } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

interface Order {
  id: number
  createdAt: string
  status: string
  totalPrice: number
  paymentProofUrl?: string
  product: { title: string; price: number }
  quantity: number
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  waiting_confirmation: "Menunggu Verifikasi",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  waiting_confirmation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
}

const TABS = ["Semua", "Menunggu", "Selesai", "Dibatalkan"] as const
type Tab = (typeof TABS)[number]

function tabToStatus(tab: Tab): string[] {
  if (tab === "Menunggu") return ["pending", "waiting_confirmation", "confirmed"]
  if (tab === "Selesai") return ["completed"]
  if (tab === "Dibatalkan") return ["cancelled"]
  return []
}

export default function PesananPage() {
  const { token } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("Semua")
  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : d.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const filtered =
    activeTab === "Semua"
      ? orders
      : orders.filter((o) => tabToStatus(activeTab).includes(o.status))

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pesanan Saya</h1>
        <p className="text-sm text-muted-foreground">Riwayat dan status semua pesanan kamu.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingBag className="mb-3 size-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Tidak ada pesanan di kategori ini</p>
          <Link href="/dashboard/produk" className="mt-2 text-sm text-primary hover:underline">
            Mulai belanja →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">#{String(order.id).slice(0, 8)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-medium">{order.product?.title ?? "Produk"}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.quantity}x · Rp{(order.product?.price ?? 0).toLocaleString("id")}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm font-semibold">
                  Total: Rp{order.totalPrice.toLocaleString("id")}
                </p>
                <div className="flex items-center gap-2">
                  {order.status === "completed" && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`${API_BASE}/orders/${order.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </Button>
                  )}
                  <Link
                    href={`/dashboard/pesanan/${order.id}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Detail <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
