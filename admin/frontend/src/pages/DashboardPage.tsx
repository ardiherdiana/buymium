import { useNavigate } from "react-router-dom"
import { ShoppingCart, Bot, BarChart3, LogOut, ArrowRight, Sun, Moon } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useTheme } from "@/components/theme-provider"

const modules = [
  {
    title: "E-Commerce",
    description: "Kelola produk, pesanan, pengguna dan inventori toko online Anda",
    icon: ShoppingCart,
    href: "/ecommerce/orders",
  },
  {
    title: "Autoposting",
    description: "Otomasi posting ke berbagai platform media sosial",
    icon: Bot,
    href: "/autoposting",
    hideMobile: true,
  },
  {
    title: "Management",
    description: "Analitik mendalam dan manajemen performa bisnis",
    icon: BarChart3,
    href: "/management",
  },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/buymium_logo.png" alt="Buymium" className="size-8 shrink-0 object-contain" />
          <div className="leading-tight">
            <p className="font-semibold text-sm text-foreground">Buymium</p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border"
          >
            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 h-8"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon
          return (
            <button
              key={mod.href}
              onClick={() => navigate(mod.href)}
              className={`relative flex flex-col items-center justify-center gap-6 px-10 py-12 text-center
                border-r border-border last:border-r-0 bg-background
                hover:bg-muted transition-all duration-300 group overflow-hidden
                ${"hideMobile" in mod && mod.hideMobile ? "hidden sm:flex" : ""}`}
            >
              {/* top accent line */}
              <span className="absolute top-0 left-0 h-0.5 w-0 group-hover:w-full bg-foreground transition-all duration-500 ease-out" />

              <div className="flex size-16 items-center justify-center bg-secondary text-foreground
                transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-7" />
              </div>

              <div className="space-y-2">
                <h2 className="font-bold text-lg text-foreground tracking-tight">{mod.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{mod.description}</p>
              </div>

              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground
                group-hover:text-foreground group-hover:gap-3 transition-all duration-300">
                Akses Modul <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
