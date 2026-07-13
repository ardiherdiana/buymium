import { LandingNavbar } from "@/components/landing-navbar"

export default function ProdukLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">{children}</main>
    </div>
  )
}
