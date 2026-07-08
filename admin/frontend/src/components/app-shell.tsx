import { useState } from "react"
import { Outlet, useNavigate, useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ShoppingCart, Package, Users, Star,
  BarChart3, ShoppingBag, TrendingUp, PieChart, UserSquare, Database,
  LayoutDashboard, Plus, Trash2, Sun, Moon,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { AppSidebar, type NavGroup } from "@/components/app-sidebar"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuthStore } from "@/stores/authStore"
import { EllipsisVertical, LogOut } from "lucide-react"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Link } from "react-router-dom"

// ── nav definitions ────────────────────────────────────────────────

const ECOMMERCE_NAV: NavGroup[] = [
  {
    group: "Utama",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    group: "E-Commerce",
    items: [
      { label: "Pesanan", href: "/ecommerce/orders", icon: ShoppingCart },
      { label: "Produk", href: "/ecommerce/products", icon: Package },
      { label: "Testimoni", href: "/ecommerce/testimonials", icon: Star },
      { label: "Pengguna", href: "/ecommerce/users", icon: Users },
    ],
  },
]

const MANAGEMENT_NAV: NavGroup[] = [
  {
    group: "Utama",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    group: "Management",
    items: [{ label: "Ringkasan", href: "/management", icon: BarChart3 }],
  },
  {
    group: "Stok Akun",
    items: [
      { label: "Instagram", href: "/stock/accounts", icon: Users },
      { label: "Accsmarket", href: "/stock/accsmarket", icon: ShoppingBag },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Penjualan", href: "/finance/sales", icon: TrendingUp },
      { label: "Analitik", href: "/finance/analytics", icon: PieChart },
    ],
  },
  {
    group: "Master",
    items: [
      { label: "Pelanggan", href: "/master/customers", icon: UserSquare },
      { label: "Source", href: "/master/sources", icon: Database },
    ],
  },
]

// ── generic shell ─────────────────────────────────────────────────

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

function Shell({ navGroups }: { navGroups: NavGroup[] }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar navGroups={navGroups} />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <div className="ml-auto">
              <ThemeToggleButton />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export function EcommerceShell() {
  return <Shell navGroups={ECOMMERCE_NAV} />
}

export function ManagementShell() {
  return <Shell navGroups={MANAGEMENT_NAV} />
}

// ── autoposting sidebar with channels ─────────────────────────────

interface Channel {
  id: number
  username: string
  type?: string
  profilePhotoPath?: string
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok",
    twitter: "Twitter", facebook: "Facebook", google: "Google", other: "Other",
  }
  return map[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

function ProfilePhoto({ path, username }: { path?: string; username: string }) {
  if (!path) {
    return (
      <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
        {username.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  const src = path.startsWith("http")
    ? path
    : `${import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5001"}${path}`
  return (
    <img src={src} alt={username} className="size-6 rounded-full object-cover shrink-0"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
  )
}

function AutopostingSidebarContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get("channel_id") ? Number(searchParams.get("channel_id")) : null
  const { state } = useSidebar()

  const { data, isLoading } = useQuery({
    queryKey: ["autoposting-channels"],
    queryFn: () => api.get("/autoposting/channels").then((r) => r.data),
  })

  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/autoposting/channels/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["autoposting-channels"] }),
  })

  const channels: Channel[] = data?.data ?? []
  const grouped: Record<string, Channel[]> = {}
  channels.forEach((ch) => {
    const t = (ch.type ?? "other").toLowerCase()
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(ch)
  })

  const select = (ch: Channel) => {
    setSearchParams({ channel_id: String(ch.id) })
  }

  return (
    <SidebarContent>
      {/* Dashboard link */}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard">
                <Link to="/"><LayoutDashboard /><span>Dashboard</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Channel list */}
      <SidebarGroup>
        <SidebarGroupLabel>Saluran</SidebarGroupLabel>
        <SidebarGroupContent>
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-2 py-1">Loading...</p>
          ) : (
            Object.entries(grouped).map(([type, chs]) => (
              <div key={type}>
                {state === "expanded" && (
                  <div className="px-2 py-1">
                    <span className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                      {typeLabel(type)}
                    </span>
                  </div>
                )}
                <SidebarMenu>
                  {chs.map((ch) => (
                    <SidebarMenuItem key={ch.id} className="group/item">
                      <SidebarMenuButton
                        isActive={selectedId === ch.id}
                        onClick={() => select(ch)}
                        tooltip={ch.username}
                        className={cn(selectedId === ch.id && "bg-sidebar-accent text-sidebar-accent-foreground")}
                      >
                        <ProfilePhoto path={ch.profilePhotoPath} username={ch.username} />
                        <span className="flex-1 truncate">{ch.username}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(ch.id) }}
                          disabled={deleteMutation.isPending}
                          className="opacity-0 group-hover/item:opacity-100 text-sidebar-foreground/40 hover:text-destructive transition-all shrink-0"
                          title="Hapus saluran"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            ))
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

function AutopostingSidebarComponent() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <img src="/buymium_logo.png" alt="Buymium" className="size-8 shrink-0 object-contain" />
                <span className="font-semibold">Buymium Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <AutopostingSidebarContent />

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

export function AutopostingShell() {
  const [manageOpen, setManageOpen] = useState(false)
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: () => api.get("/autoposting/channels"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoposting-channels"] })
      setManageOpen(false)
    },
  })

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AutopostingSidebarComponent />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <div className="ml-auto">
              <ThemeToggleButton />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
            <Outlet />
            {/* FAB — Tambah Saluran */}
            <button
              onClick={() => setManageOpen(true)}
              className="fixed bottom-6 right-6 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
              title="Tambah / kelola saluran"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kelola Saluran</DialogTitle>
            <DialogDescription>
              Kelola akun sosial media kamu melalui SocialBu. Hubungkan akun baru di SocialBu, lalu klik Sinkronisasi di sini.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => window.open("https://socialbu.com/app/accounts/add", "_blank")}
            >
              Hubungkan Akun
            </Button>
            <Button
              className="flex-1"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? "Menyinkron..." : "Sinkronisasi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
