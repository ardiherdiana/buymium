"use client"

import { useEffect, useRef, useState } from "react"

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void
  disabled?: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, options: object) => void
          prompt: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

export function GoogleSignInButton({ onCredential, disabled }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  const initializedRef = useRef(false)
  const [ready, setReady] = useState(false)

  // Keep ref current without triggering re-init
  useEffect(() => { onCredentialRef.current = onCredential }, [onCredential])

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    function initGoogle() {
      if (!window.google || !containerRef.current || initializedRef.current) return
      initializedRef.current = true
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          onCredentialRef.current(response.credential)
        },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
        logo_alignment: "left",
      })
      setReady(true)
    }

    if (window.google) {
      initGoogle()
    } else if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement("script")
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
    }

    return () => {
      window.google?.accounts.id.disableAutoSelect()
    }
  }, []) // empty deps — init once on mount

  return (
    <div className={`relative ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Google renders its own iframe button here */}
      <div ref={containerRef} className="flex justify-center" />
      {/* Skeleton while GSI loads */}
      {!ready && (
        <div className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm text-muted-foreground">
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Memuat Google…
        </div>
      )}
    </div>
  )
}
