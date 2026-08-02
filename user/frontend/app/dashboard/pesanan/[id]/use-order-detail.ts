"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export interface OrderDetail {
  id: number
  createdAt: string
  status: string
  totalPrice: number
  subtotal?: number
  quantity: number
  paymentProofUrl?: string
  groupId?: string
  product: { id: number; title: string; price: number; section?: { title: string } }
  variantLabel?: string | null
  bankAccount?: {
    id: number
    bankName: string
    accountHolder: string
    accountNumber: string
    logo?: string
  }
  hasTestimonial?: boolean
  testimonial?: { rating: number; message: string } | null
  relatedOrders: OrderDetail[]
}

export function useOrderDetail(id: string) {
  const { token, authFetch } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [submittedReview, setSubmittedReview] = useState<{ rating: number; message: string } | null>(null)

  useEffect(() => {
    if (!token) return
    authFetch(`/orders/${id}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null } return r.json() })
      .then((d) => { if (d) setOrder(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token])

  async function handleCancel() {
    if (!token || !order) return
    setCancelling(true)
    try {
      const res = await authFetch(`/orders/${order.id}/cancel`, { method: "POST" })
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
      const res = await authFetch(`/orders/${order.id}/proof`, {
        method: "POST",
        body: form,
      })
      if (res.ok) {
        setUploadSuccess(true)
        setOrder((prev) => prev ? { ...prev, status: "awaiting_confirmation" } : prev)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload() {
    if (!token || !order) return
    setDownloading(true)
    try {
      const res = await authFetch(`/orders/${order.id}/download`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `buymium-order-${order.id}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadInvoice() {
    if (!token || !order) return
    setDownloadingInvoice(true)
    try {
      const res = await authFetch(`/orders/${order.id}/invoice`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${order.groupId ?? order.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingInvoice(false)
    }
  }

  return {
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
  }
}
