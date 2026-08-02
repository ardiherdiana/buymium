"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOrderDetail } from "./use-order-detail"
import { LoadingSkeleton } from "./components/loading-skeleton"
import { StatusHero } from "./components/status-hero"
import { OrderSummary } from "./components/order-summary"
import { PaymentInstructions } from "./components/payment-instructions"
import { DownloadSection } from "./components/download-section"
import { ReviewBlock } from "./components/review-block"
import { PaymentProofPreview } from "./components/payment-proof-preview"
import { CancelOrder } from "./components/cancel-order"

export default function PesananDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    token,
    authFetch,
    order,
    loading,
    notFound,
    uploading,
    uploadSuccess,
    cancelling,
    cancelConfirm,
    setCancelConfirm,
    downloading,
    downloadingInvoice,
    submittedReview,
    setSubmittedReview,
    handleCancel,
    handleUploadProof,
    handleDownload,
    handleDownloadInvoice,
  } = useOrderDetail(id)

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
  const grandSubtotal = allOrders.reduce((s, o) => s + (o.subtotal ?? o.totalPrice), 0)
  const grandTotal = grandSubtotal
  const isPending = order.status === "pending"
  const isDone = order.status === "paid"

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
      <StatusHero order={order} />

      {/* ── Order Summary ─────────────────────────────────────────────── */}
      <OrderSummary allOrders={allOrders} grandSubtotal={grandSubtotal} grandTotal={grandTotal} />

      {/* ── Payment Instruction (pending only) ──────────────────────── */}
      {isPending && (
        <PaymentInstructions
          grandTotal={grandTotal}
          onFile={handleUploadProof}
          uploading={uploading}
          uploadSuccess={uploadSuccess}
        />
      )}

      {/* ── Download (done) ──────────────────────────────────────────── */}
      {isDone && (
        <DownloadSection
          downloading={downloading}
          downloadingInvoice={downloadingInvoice}
          onDownload={handleDownload}
          onDownloadInvoice={handleDownloadInvoice}
        />
      )}

      {/* ── Review / Ulasan (paid) ──────────────────────────────────────── */}
      {isDone && (
        <ReviewBlock
          order={order}
          token={token}
          authFetch={authFetch}
          submittedReview={submittedReview}
          setSubmittedReview={setSubmittedReview}
        />
      )}

      {/* ── Payment Proof Preview ─────────────────────────────────────── */}
      {order.paymentProofUrl && (
        <PaymentProofPreview paymentProofUrl={order.paymentProofUrl} />
      )}

      {/* Cancel button — only pending */}
      {isPending && (
        <CancelOrder
          cancelConfirm={cancelConfirm}
          setCancelConfirm={setCancelConfirm}
          cancelling={cancelling}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
