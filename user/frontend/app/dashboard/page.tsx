"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingBag, Package, Clock, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
}

interface RecentOrder {
  id: number
  createdAt: string
  status: string
  totalPrice: number
  product: { title: string }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  awaiting_confirmation: "Verifikasi",
  paid: "Selesai",
  cancelled: "Dibatalkan",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  awaiting_confirmation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
}

export default function DashboardPage() {
  const { user, token } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

  useEffect(() => {
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }

    fetch(`${API_BASE}/orders/stats`, { headers })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})

    fetch(`${API_BASE}/orders?limit=5`, { headers })
      .then((r) => r.json())
      .then((d) => setRecentOrders(Array.isArray(d) ? d : d.orders ?? []))
      .catch(() => {})
  }, [token])

  return (
    <div className="w-full">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Halo, {user?.name ?? "—"} 👋</h1>
        <p className="text-sm text-muted-foreground">Selamat datang di dashboard Buymium kamu.</p>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: ShoppingBag,
            label: "Total Pesanan",
            value: stats?.totalOrders ?? "—",
            color: "text-primary",
          },
          {
            icon: Clock,
            label: "Menunggu",
            value: stats?.pendingOrders ?? "—",
            color: "text-amber-500",
          },
          {
            icon: Package,
            label: "Selesai",
            value: stats?.completedOrders ?? "—",
            color: "text-green-500",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className={`mb-2 ${color}`}>
              <Icon className="size-5" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Pesanan Terbaru</h2>
          <Link
            href="/dashboard/pesanan"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Lihat semua <ArrowRight className="size-3" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ShoppingBag className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Belum ada pesanan</p>
            <Link
              href="/dashboard/produk"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Mulai belanja →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/dashboard/pesanan/${order.id}`}
                  className="flex flex-col gap-1.5 px-4 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5"
                >
                  <div className="min-w-0 sm:flex-1">
                    <p className="truncate text-sm font-medium">
                      {order.product?.title ?? "Pesanan"}
                    </p>
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-sm font-semibold sm:hidden">
                        Rp{order.totalPrice.toLocaleString("id")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <p className="hidden text-sm font-semibold sm:block">
                      Rp{order.totalPrice.toLocaleString("id")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
