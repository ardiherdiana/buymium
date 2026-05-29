import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface FabProps {
  onClick: () => void
  title?: string
  className?: string
}

export function Fab({ onClick, title, className }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "fixed bottom-6 right-6 z-30 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors",
        className
      )}
    >
      <Plus className="size-6" />
    </button>
  )
}
