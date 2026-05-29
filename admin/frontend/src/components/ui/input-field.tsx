import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface InputFieldProps extends React.ComponentProps<"input"> {
  label?: string
  fullWidth?: boolean
  error?: string
}

export function InputField({ label, fullWidth, error, className, id, ...props }: InputFieldProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Input
        id={inputId}
        className={cn(error && "border-destructive", className)}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
