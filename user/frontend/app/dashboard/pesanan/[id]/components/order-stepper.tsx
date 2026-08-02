import { Check } from "lucide-react"
import { STEPS, STEP_ORDER } from "./status-config"

export function OrderStepper({ status }: { status: string }) {
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
