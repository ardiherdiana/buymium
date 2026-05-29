"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Suspense } from "react"

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { login } = useAuth()

  useEffect(() => {
    const token = params.get("token")
    const userParam = params.get("user")
    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam))
        login(user, token)
        router.replace("/dashboard")
      } catch {
        router.replace("/masuk?error=invalid_callback")
      }
    } else {
      router.replace("/masuk?error=no_token")
    }
  }, [params, login, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Sedang masuk…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  )
}
