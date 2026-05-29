"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export function LandingNavbar() {
  const { user, isLoading } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/buymium_logo.png" alt="Buymium" width={24} height={24} className="rounded-md" />
          <span>Buymium</span>
        </a>

        <div className="flex items-center gap-2">
          {!isLoading && (
            user ? (
              <Button size="sm" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <a href="/masuk">Masuk</a>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  )
}
