import { Link, useLocation, useNavigate } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { LogOut, EllipsisVertical } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type NavGroup = {
  group: string
  items: { label: string; href: string; icon: LucideIcon }[]
}

function NavItem({
  href,
  icon: Icon,
  label,
  allHrefs,
}: {
  href: string
  icon: LucideIcon
  label: string
  allHrefs: string[]
}) {
  const { pathname } = useLocation()
  const matches = allHrefs.filter((h) => pathname === h || (h !== "/" && pathname.startsWith(h + "/")))
  const bestMatch = matches.sort((a, b) => b.length - a.length)[0]
  const active = bestMatch === href

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={href}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({ navGroups }: { navGroups: NavGroup[] }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Pilih Modul">
              <Link to="/">
                <img src="/buymium_logo.png" alt="Buymium" className="size-8 shrink-0 object-contain" />
                <span className="font-semibold">Buymium Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem key={item.href} {...item} allHrefs={allHrefs} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <img src="/buymium_logo.png" alt="Buymium" className="h-7 w-7 shrink-0 object-contain" />
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground capitalize">{user?.role}</span>
                  </div>
                  <EllipsisVertical className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-48" side="top" align="end" sideOffset={4}>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate("/login") }}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
