import { ShoppingBag } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import type { OrderDetail } from "../use-order-detail"
import { StatusIcon } from "./status-icon"
import { OrderStepper } from "./order-stepper"
import { CopyButton } from "./copy-button"
import { STATUS_CONFIG } from "./status-config"

export function StatusHero({ order }: { order: OrderDetail }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isCancelled = order.status === "cancelled"

  return (
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
          <span className={`hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:inline-block ${cfg.badge}`}>
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
      </div>
    </div>
  )
}
