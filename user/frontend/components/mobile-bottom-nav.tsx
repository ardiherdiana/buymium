"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SquaresFourIcon,
  ShoppingBagIcon,
  UserCircleIcon,
  TagIcon,
} from "@phosphor-icons/react"

const items = [
  { title: "Beranda", url: "/dashboard", icon: SquaresFourIcon },
  { title: "Produk", url: "/dashboard/produk", icon: TagIcon },
  { title: "Pesanan", url: "/dashboard/pesanan", icon: ShoppingBagIcon },
  { title: "Profil", url: "/dashboard/profil", icon: UserCircleIcon },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active =
            item.url === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.url)
          const Icon = item.icon
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" weight={active ? "fill" : "regular"} />
              {item.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
