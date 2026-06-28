# Buymium Admin Frontend

Dashboard admin untuk platform Buymium, dibangun dengan React 19 + TypeScript + Vite.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Build Tool | Vite 7 |
| Language | TypeScript 5.9 |
| Framework | React 19 |
| Routing | React Router DOM 7 |
| State Management | Zustand 5 |
| Data Fetching | TanStack Query 5 + Axios |
| UI Library | shadcn/ui (Radix UI + Tailwind CSS 4) |
| Forms | React Hook Form 7 + Zod 4 |
| Charts | Recharts 3 |
| Icons | Lucide React + Phosphor Icons |
| Notifications | Sonner |
| Theme | Next Themes (dark/light mode) |

---

## Struktur Direktori

```
src/
├── components/
│   ├── ui/                  # shadcn/ui components (30+ komponen)
│   ├── app-shell.tsx        # Layout shell per modul (Ecommerce, Management, Autoposting)
│   ├── app-sidebar.tsx      # Navigasi sidebar dinamis
│   ├── AlertProvider.tsx    # Provider modal alert & konfirmasi global
│   ├── ProtectedRoute.tsx   # Guard autentikasi
│   └── theme-provider.tsx   # Provider dark/light mode
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx    # Pemilih modul utama
│   ├── ecommerce/           # Modul E-Commerce
│   │   ├── OrdersPage.tsx
│   │   ├── OrderDetailPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── ProductFormPage.tsx
│   │   ├── StockPage.tsx
│   │   ├── UsersPage.tsx
│   │   └── TestimonialsPage.tsx
│   ├── management/          # Modul Manajemen
│   │   ├── finance/
│   │   │   ├── sales/       # Laporan penjualan
│   │   │   ├── expenses/    # Pengeluaran
│   │   │   └── analytics/   # Analitik keuangan
│   │   ├── stock/
│   │   │   ├── accounts/    # Akun POS & Sales Mobile
│   │   │   └── accsmarket/  # Akun marketplace
│   │   └── master/
│   │       ├── customers/   # Data pelanggan
│   │       └── sources/     # Sumber penjualan
│   └── autoposting/         # Modul Autoposting media sosial
├── stores/
│   ├── authStore.ts         # State autentikasi (persist ke localStorage)
│   └── alertStore.ts        # State alert & konfirmasi global
├── lib/
│   ├── api.ts               # Axios instance + interceptors (auth & token refresh)
│   ├── queryClient.ts       # Konfigurasi TanStack Query
│   ├── config.ts            # Konstanta aplikasi
│   └── utils.ts             # Helper functions (cn, format, dll)
├── hooks/
│   └── use-mobile.ts        # Deteksi perangkat mobile
├── App.tsx                  # Definisi semua route
└── main.tsx                 # Entry point React
```

---

## Memulai

### Prasyarat

- Node.js >= 18
- npm atau pnpm

### Instalasi

```bash
npm install
```

### Konfigurasi Environment

Buat file `.env` di root folder ini:

```env
VITE_API_URL=http://localhost:5001/api
VITE_USER_API_URL=http://localhost:5000/api
```

### Menjalankan Dev Server

```bash
npm run dev
```

Aplikasi berjalan di `http://localhost:5173` (atau port berikutnya jika sudah terpakai).

### Build Production

```bash
npm run build
```

Output ada di folder `dist/`.

### Scripts Tersedia

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Jalankan dev server |
| `npm run build` | Build untuk production |
| `npm run preview` | Preview hasil build |
| `npm run lint` | Cek kualitas kode (ESLint) |
| `npm run format` | Format kode (Prettier) |
| `npm run typecheck` | Cek TypeScript tanpa build |

---

## Arsitektur & Pola

### Routing & Modul

Aplikasi dibagi menjadi 3 modul utama, masing-masing punya shell (layout + sidebar) sendiri:

```
/login              → LoginPage (publik)
/                   → DashboardPage (pemilih modul)
/ecommerce/*        → EcommerceShell + halaman e-commerce
/management/*       → ManagementShell + halaman manajemen
/stock/*            → ManagementShell (finance & stock)
/finance/*          → ManagementShell
/master/*           → ManagementShell
/autoposting        → AutopostingShell
```

Semua route kecuali `/login` dilindungi oleh `ProtectedRoute`.

### Autentikasi

1. Submit email/password di `LoginPage`
2. API `/auth/login` mengembalikan `{ user, token, refreshToken }`
3. `authStore.setAuth()` menyimpan ke Zustand + `localStorage`
4. Semua request API otomatis menyertakan `Authorization: Bearer {token}`
5. Jika response `401`, interceptor mencoba refresh token otomatis
6. Jika refresh gagal, pengguna di-redirect ke `/login`

### Data Fetching

Semua fetching data menggunakan **TanStack Query** + **Axios**:

```typescript
// Contoh pola yang digunakan di seluruh aplikasi
const { data, isLoading } = useQuery({
  queryKey: ["products", page, search],
  queryFn: () => api.get("/products", { params: { page, search } }).then(r => r.data),
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => api.delete(`/products/${id}`),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
})
```

- **Stale time**: 30 detik (default cache)
- **Retry**: 1 kali pada kegagalan

### State Management (Zustand)

```typescript
// authStore — state autentikasi, persist ke localStorage
const { user, token, setAuth, logout, isAuthenticated } = useAuthStore()

// alertStore — alert & konfirmasi modal global
const { showAlert, showConfirm } = useAlert()
```

### Path Alias

`@` di-resolve ke `./src`:

```typescript
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
```

---

## Konvensi Kode

- **Komponen**: PascalCase, satu komponen per file
- **Hooks**: camelCase dengan prefix `use`
- **Stores**: camelCase dengan suffix `Store`
- **API calls**: selalu melalui instance `api` dari `@/lib/api`, bukan `fetch` langsung
- **Styling**: Tailwind utility classes via `cn()` dari `@/lib/utils`
- **Validasi form**: selalu dengan Zod schema + React Hook Form
