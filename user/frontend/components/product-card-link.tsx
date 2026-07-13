"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export function ProductCardLink({
  productId,
  slug,
  children,
  className,
}: {
  productId: number
  slug?: string
  children: React.ReactNode
  className?: string
}) {
  const { user } = useAuth()
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    const path = user ? `/dashboard/produk/${slug ?? productId}` : `/produk/${slug ?? productId}`
    router.push(path)
  }

  return (
    <div onClick={handleClick} className={`cursor-pointer ${className ?? ""}`}>
      {children}
    </div>
  )
}
