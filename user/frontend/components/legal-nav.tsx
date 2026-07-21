import { FileText, RotateCcw, HelpCircle, Phone } from "lucide-react"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/syarat", label: "Syarat & Ketentuan", icon: FileText },
  { href: "/refund", label: "Kebijakan Refund", icon: RotateCcw },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/kontak", label: "Kontak", icon: Phone },
] as const

export function LegalNav({ active }: { active: "syarat" | "refund" | "faq" | "kontak" }) {
  return (
    <nav className="mb-10 grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 sm:grid-cols-4">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = href === `/${active}`
        return (
          <a
            key={href}
            href={href}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-[11px] font-medium leading-tight transition-colors sm:text-sm",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="hidden size-3.5 shrink-0 sm:block" />
            <span>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
