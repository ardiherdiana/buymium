"use client"

import * as React from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  SquaresFourIcon,
  ShoppingBagIcon,
  UserCircleIcon,
  StorefrontIcon,
  QuestionIcon,
  TagIcon,
} from "@phosphor-icons/react"

const navMain = [
  {
    title: "Beranda",
    url: "/dashboard",
    icon: <SquaresFourIcon />,
  },
  {
    title: "Produk",
    url: "/dashboard/produk",
    icon: <TagIcon />,
  },
  {
    title: "Pesanan Saya",
    url: "/dashboard/pesanan",
    icon: <ShoppingBagIcon />,
  },
  {
    title: "Profil",
    url: "/dashboard/profil",
    icon: <UserCircleIcon />,
  },
]

const navSecondary = [
  {
    title: "Toko",
    url: "/katalog",
    icon: <StorefrontIcon />,
  },
  {
    title: "Bantuan",
    url: "/#faq",
    icon: <QuestionIcon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/">
                <Image
                  src="/buymium_logo.png"
                  alt="Buymium"
                  width={20}
                  height={20}
                  className="rounded-md"
                />
                <span className="text-base font-semibold">Buymium</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? "Pengguna",
            email: user?.email ?? "",
            avatar: user?.avatar ?? "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
