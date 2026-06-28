import { Geist, JetBrains_Mono } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  metadataBase: new URL("https://buymium.id"),
  title: {
    default: "Buymium – Jual Beli Akun Instagram Terpercaya di Indonesia",
    template: "%s | Buymium",
  },
  description:
    "Platform jual beli akun Instagram terverifikasi terpercaya di Indonesia. Harga terjangkau, pengiriman cepat, garansi 24 jam, dan kredensial terenkripsi.",
  keywords: [
    "jual beli akun instagram",
    "beli akun instagram",
    "jual akun instagram",
    "akun instagram murah",
    "akun instagram terverifikasi",
    "marketplace akun instagram indonesia",
    "buymium",
  ],
  authors: [{ name: "Buymium" }],
  creator: "Buymium",
  publisher: "Buymium",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://buymium.id",
    siteName: "Buymium",
    title: "Buymium – Jual Beli Akun Instagram Terpercaya di Indonesia",
    description: "Beli akun Instagram terverifikasi dengan harga terjangkau. Proses cepat, aman, garansi 24 jam.",
    images: [{ url: "/buymium_logo.png", width: 512, height: 512, alt: "Buymium Logo" }],
  },
  twitter: {
    card: "summary",
    title: "Buymium – Jual Beli Akun Instagram Terpercaya",
    description: "Platform jual beli akun Instagram terverifikasi terpercaya di Indonesia.",
    images: ["/buymium_logo.png"],
  },
  icons: {
    icon: [{ url: "/buymium_logo.png", type: "image/png" }],
    shortcut: "/buymium_logo.png",
    apple: "/buymium_logo.png",
  },
  alternates: {
    canonical: "https://buymium.id",
    languages: { "id-ID": "https://buymium.id" },
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, "font-mono", fontMono.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
