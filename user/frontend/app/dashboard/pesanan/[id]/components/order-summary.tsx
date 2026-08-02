import { Package, ShoppingBag } from "lucide-react"
import type { OrderDetail } from "../use-order-detail"

export function OrderSummary({ allOrders, grandSubtotal, grandTotal }: {
  allOrders: OrderDetail[]
  grandSubtotal: number
  grandTotal: number
}) {
  return (
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
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
              <Package className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{o.product?.title ?? "Produk"}</p>
              {o.product?.section && (
                <p className="mt-0.5 text-xs text-muted-foreground">{o.product.section.title}</p>
              )}
              {o.variantLabel && (
                <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {o.variantLabel}
                </span>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {o.quantity}x · Rp{Math.round((o.subtotal ?? o.totalPrice) / o.quantity).toLocaleString("id")}/akun
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">Rp{(o.subtotal ?? o.totalPrice).toLocaleString("id")}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>Rp{grandSubtotal.toLocaleString("id")}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">Total Pembayaran</span>
          <span className="text-base font-bold">Rp{grandTotal.toLocaleString("id")}</span>
        </div>
      </div>
    </div>
  )
}
