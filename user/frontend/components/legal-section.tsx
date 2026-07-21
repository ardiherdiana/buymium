export function LegalSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_strong]:font-medium">
        {children}
      </div>
    </div>
  )
}
