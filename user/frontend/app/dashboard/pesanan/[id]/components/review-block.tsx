import { CheckCircle2, Star } from "lucide-react"
import type { OrderDetail } from "../use-order-detail"
import { ReviewDisplay, ReviewForm } from "./review-section"

export function ReviewBlock({ order, token, authFetch, submittedReview, setSubmittedReview }: {
  order: OrderDetail
  token: string | null
  authFetch: (path: string, init?: RequestInit) => Promise<Response>
  submittedReview: { rating: number; message: string } | null
  setSubmittedReview: (v: { rating: number; message: string }) => void
}) {
  return (
    <>
      {token && !order.hasTestimonial && !submittedReview && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <Star className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Beri Ulasan</h2>
          </div>
          <ReviewForm orderId={order.id} authFetch={authFetch} onSubmitted={(rating, message) => setSubmittedReview({ rating, message })} />
        </div>
      )}
      {(order.hasTestimonial || submittedReview) && (
        <div className="rounded-2xl border border-green-500/20 bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-green-500/15 bg-green-500/5 px-5 py-3.5">
            <CheckCircle2 className="size-4 text-green-400" />
            <h2 className="text-sm font-semibold text-green-400">Ulasanmu</h2>
          </div>
          <ReviewDisplay
            rating={submittedReview?.rating ?? order.testimonial?.rating ?? 0}
            message={submittedReview?.message ?? order.testimonial?.message ?? ""}
          />
        </div>
      )}
    </>
  )
}
