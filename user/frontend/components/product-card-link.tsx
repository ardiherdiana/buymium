"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export function ProductCardLink({
  productId,
  children,
  className,
}: {
  productId: number
  children: React.ReactNode
  className?: string
}) {
  const { user } = useAuth()
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (user) {
      router.push(`/dashboard/produk/${productId}`)
    } else {
      router.push(`/masuk?redirect=/dashboard/produk/${productId}`)
    }
  }

  return (
    <div onClick={handleClick} className={`cursor-pointer ${className ?? ""}`}>
      {children}
    </div>
  )
}
