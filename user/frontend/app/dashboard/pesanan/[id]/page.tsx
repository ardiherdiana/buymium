"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft, Upload, Download, Package, CheckCircle2,
  Clock, XCircle, Copy, Check, ImageIcon, Banknote,
  ShoppingBag, AlertCircle, Loader2, FileImage, QrCode, Trash2,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const QRIS_URL = process.env.NEXT_PUBLIC_QRIS_URL ?? "/qris.jpeg"

interface OrderDetail {
  id: number
  createdAt: string
  status: string
  totalPrice: number
  quantity: number
  paymentProofUrl?: string
  groupId?: string
  product: { id: number; title: string; price: number; section?: { title: string } }
  bankAccount?: {
    id: number
    bankName: string
    accountHolder: string
    accountNumber: string
    logo?: string
  }
  relatedOrders: OrderDetail[]
}

const STEPS = [
  { key: "pending",              label: "Pembayaran", icon: Banknote },
  { key: "waiting_confirmation", label: "Verifikasi",  icon: Clock },
  { key: "paid",                 label: "Lunas",       icon: CheckCircle2 },
]
const STEP_ORDER = ["pending", "waiting_confirmation", "paid"]

const STATUS_CONFIG: Record<string, {
  label: string
  desc: string
  badge: string
  accent: string
}> = {
  pending: {
    label: "Menunggu Pembayaran",
    desc: "Silakan scan QRIS lalu upload bukti pembayaran.",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    accent: "border-border",
  },
  waiting_confirmation: {
    label: "Menunggu Verifikasi",
    desc: "Bukti pembayaran sedang diverifikasi oleh admin. Biasanya < 15 menit.",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    accent: "border-border",
  },
  paid: {
    label: "Lunas — Siap Didownload",
    desc: "Pembayaran dikonfirmasi. Silakan download kredensial akun kamu.",
    badge: "bg-green-500/15 text-green-400 border-green-500/20",
    accent: "border-border",
  },
  cancelled: {
    label: "Pesanan Dibatalkan",
    desc: "Pesanan ini telah dibatalkan.",
    badge: "bg-red-500/15 text-red-400 border-red-500/20",
    accent: "border-border",
  },
}

function StatusIcon({ status, className = "size-5" }: { status: string; className?: string }) {
  if (status === "paid") return <CheckCircle2 className={`${className} text-green-400`} />
  if (status === "cancelled") return <XCircle className={`${className} text-red-400`} />
  if (status === "waiting_confirmation") return <Clock className={`${className} text-blue-400`} />
  return <Clock className={`${className} text-amber-400`} />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95"
    >
      {copied
        ? <><Check className="size-3 text-green-400" />Tersalin</>
        : <><Copy className="size-3" />Salin</>}
    </button>
  )
}

function OrderStepper({ status }: { status: string }) {
  if (status === "cancelled") return null
  const currentIdx = STEP_ORDER.indexOf(status)

  return (
    <div className="w-full">
      <div className="relative flex w-full items-center">
        {/* Background track */}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {/* Progress track */}
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-primary transition-all duration-500"
          style={{ width: currentIdx === 0 ? "0%" : `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((step, i) => {
          const StepIcon = step.icon
          const done = currentIdx === STEP_ORDER.length - 1 ? true : i < currentIdx
          const active = i === currentIdx && currentIdx < STEP_ORDER.length - 1
          return (
            <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center gap-2">
              <div
                className={`flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  done
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary)/0.4)]"
                    : active
                    ? "border-primary bg-background text-primary shadow-[0_0_16px_rgba(var(--primary)/0.3)] scale-110"
                    : "border-border bg-background text-muted-foreground/40"
                }`}
              >
                {done ? (
                  <Check className="size-4" />
                ) : (
                  <StepIcon className={`size-4 ${active ? "animate-pulse" : ""}`} />
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-tight transition-colors ${
                  active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40"
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UploadZone({ onFile, uploading, success }: {
  onFile: (f: File) => void
  uploading: boolean
  success: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {success ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          <CheckCircle2 className="size-8 text-green-400" />
          <p className="text-sm font-medium text-green-400">Bukti berhasil dikirim!</p>
          <p className="text-xs text-muted-foreground">Admin sedang memverifikasi pembayaranmu.</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => ref.current?.click()}
          className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          {uploading ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileImage className="size-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium">
              {uploading ? "Mengupload bukti..." : "Upload Bukti Transfer"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {uploading ? "Mohon tunggu sebentar" : "Klik atau drag & drop gambar ke sini · JPG, PNG, WEBP"}
            </p>
          </div>
          {!uploading && (
            <Button size="sm" variant="outline" className="pointer-events-none">
              <Upload className="size-3.5" />
              Pilih File
            </Button>
          )}
        </div>
      )}
    </>
  )
}

function LoadingSkeleton() {
  return (
    <div className="w-full space-y-4">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  )
}

export default function PesananDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (r.status === 404) { setNotFound(true); return null } return r.json() })
      .then((d) => { if (d) setOrder(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, token])

  async function handleCancel() {
    if (!token || !order) return
    setCancelling(true)
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setOrder((prev) => prev ? { ...prev, status: "cancelled" } : prev)
        setCancelConfirm(false)
      }
    } finally {
      setCancelling(false)
    }
  }

  async function handleUploadProof(file: File) {
    if (!token || !order) return
    setUploading(true)
    const form = new FormData()
    form.append("proof", file)
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (res.ok) {
        setUploadSuccess(true)
        setOrder((prev) => prev ? { ...prev, status: "waiting_confirmation" } : prev)
      }
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <LoadingSkeleton />

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <Package className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Pesanan tidak ditemukan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pesanan mungkin sudah dihapus atau ID tidak valid.</p>
        <Button className="mt-6" variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
      </div>
    )
  }

  const allOrders = order.relatedOrders?.length > 0 ? order.relatedOrders : [order]
  const grandTotal = allOrders.reduce((s, o) => s + o.totalPrice, 0)
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isPending = order.status === "pending"
  const isDone = order.status === "paid"
  const isCancelled = order.status === "cancelled"

  return (
    <div className="w-full space-y-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Kembali ke Pesanan
      </button>

      {/* ── Status Hero ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl border ${cfg.accent} bg-card`}>
        <div className="p-5 sm:p-6">
          {/* Top row: icon + label + badge */}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <StatusIcon status={order.status} className="size-5" />
              </div>
              <div>
                <p className="font-semibold leading-tight">{cfg.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xs">{cfg.desc}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>

          {/* Stepper */}
          {!isCancelled && (
            <div className="mb-5">
              <OrderStepper status={order.status} />
            </div>
          )}

          <Separator className="my-4 opacity-50" />

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">{order.groupId ?? `#${order.id}`}</span>
              <CopyButton text={order.groupId ?? String(order.id)} />
            </div>
            <span className="text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString("id-ID", {
                day: "numeric", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>

          {/* Cancel button — only pending */}
          {isPending && (
            <div className="mt-4">
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Batalkan pesanan ini
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <span className="flex-1 text-xs text-muted-foreground">Yakin ingin membatalkan pesanan?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={cancelling}
                    onClick={handleCancel}
                  >
                    {cancelling ? <Loader2 className="size-3 animate-spin" /> : "Ya, batalkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setCancelConfirm(false)}
                  >
                    Tidak
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Order Summary ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
          <ShoppingBag className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Ringkasan Pesanan</h2>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {allOrders.length} item
          </span>
        </div>

        <div className="divide-y divide-border">
          {allOrders.map((o) => (
            <div key={o.id} className="flex items-start gap-4 px-5 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{o.product?.title ?? "Produk"}</p>
                {o.product?.section && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{o.product.section.title}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.quantity}x · Rp{(o.product?.price ?? 0).toLocaleString("id")}/akun
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">Rp{o.totalPrice.toLocaleString("id")}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-4">
          <span className="text-sm text-muted-foreground">Total Pembayaran</span>
          <span className="text-base font-bold">Rp{grandTotal.toLocaleString("id")}</span>
        </div>
      </div>

      {/* ── Payment Instruction (pending only) ──────────────────────── */}
      {isPending && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <QrCode className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Pembayaran via QRIS</p>
              <p className="text-[11px] text-muted-foreground">Scan QR dengan aplikasi e-wallet atau m-banking apapun</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Total */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3.5">
              <div>
                <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                <p className="text-xl font-bold">Rp{grandTotal.toLocaleString("id")}</p>
              </div>
              <CopyButton text={String(grandTotal)} />
            </div>

            {/* Grid: QRIS kiri, Upload kanan */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Kiri — QRIS */}
              <div className="flex items-center justify-center rounded-xl border border-border bg-white p-4">
                <Image
                  src={QRIS_URL}
                  alt="QRIS Buymium"
                  width={260}
                  height={260}
                  className="rounded-lg object-contain"
                  unoptimized
                />
              </div>

              {/* Kanan — upload */}
              <UploadZone
                onFile={handleUploadProof}
                uploading={uploading}
                success={uploadSuccess}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Setelah bayar & upload bukti, admin memverifikasi dalam <strong className="text-foreground">5–15 menit</strong> di jam kerja (08.00–22.00 WIB).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Download (done) ──────────────────────────────────────────── */}
      {isDone && (
        <div className="rounded-2xl border border-green-500/20 bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-green-500/15 bg-green-500/5 px-5 py-3.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-green-500/15">
              <CheckCircle2 className="size-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-400">Akun Siap Didownload</p>
              <p className="text-[11px] text-green-400/70">Simpan file dengan aman di perangkatmu</p>
            </div>
          </div>
          <div className="p-5">
            <Button className="w-full" asChild>
              <a href={`${API_BASE}/orders/${order.id}/download`} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Download Kredensial Akun
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* ── Payment Proof Preview ─────────────────────────────────────── */}
      {order.paymentProofUrl && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <ImageIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Bukti Pembayaran</h2>
          </div>
          <div className="p-5">
            <img
              src={`${API_BASE}${order.paymentProofUrl}`}
              alt="Bukti transfer"
              className="w-full rounded-xl border border-border object-contain max-h-80"
            />
          </div>
        </div>
      )}

    </div>
  )
}
