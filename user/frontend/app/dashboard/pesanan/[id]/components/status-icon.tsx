import { CheckCircle2, Clock, XCircle } from "lucide-react"

export function StatusIcon({ status, className = "size-5" }: { status: string; className?: string }) {
  if (status === "paid") return <CheckCircle2 className={`${className} text-green-400`} />
  if (status === "cancelled") return <XCircle className={`${className} text-red-400`} />
  if (status === "awaiting_confirmation") return <Clock className={`${className} text-blue-400`} />
  return <Clock className={`${className} text-amber-400`} />
}
