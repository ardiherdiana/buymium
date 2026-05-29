import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

// Radix Select doesn't allow empty string values — use this sentinel internally
const EMPTY_SENTINEL = "__empty__"

function toInternal(v: string) {
  return v === "" ? EMPTY_SENTINEL : v
}

function fromInternal(v: string) {
  return v === EMPTY_SENTINEL ? "" : v
}

export function Dropdown({ options, value, onChange, placeholder, className }: DropdownProps) {
  return (
    <Select value={toInternal(value)} onValueChange={(v) => onChange(fromInternal(v))}>
      <SelectTrigger
        className={cn(
          "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground w-full",
          className
        )}
      >
        <SelectValue placeholder={placeholder ?? options[0]?.label} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((opt) => (
          <SelectItem key={toInternal(opt.value)} value={toInternal(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
