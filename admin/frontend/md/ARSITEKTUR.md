# Arsitektur Admin Frontend

## Gambaran Umum

Admin frontend adalah Single Page Application (SPA) berbasis React 19 yang berkomunikasi dengan admin backend melalui REST API. Tidak ada server-side rendering — semua rendering dilakukan di browser.

```
Browser
  └── React SPA (Vite)
        ├── React Router → navigasi client-side
        ├── TanStack Query → cache & sinkronisasi data server
        ├── Zustand → state global (auth, alert)
        └── Axios → HTTP client ke Admin Backend (port 5001)
```

---

## Layer Arsitektur

### 1. Routing Layer (`src/App.tsx`)

Semua route didefinisikan di satu file. Struktur tiga level:

```
/ (root)
├── /login                  → publik
└── ProtectedRoute
    ├── /                   → DashboardPage (pemilih modul)
    ├── EcommerceShell
    │   ├── /ecommerce/orders
    │   ├── /ecommerce/orders/:id
    │   ├── /ecommerce/products
    │   ├── /ecommerce/products/new
    │   ├── /ecommerce/products/:id/edit
    │   ├── /ecommerce/stock
    │   ├── /ecommerce/users
    │   └── /ecommerce/testimonials
    ├── ManagementShell
    │   ├── /management
    │   ├── /stock/accounts
    │   ├── /stock/accsmarket
    │   ├── /finance/sales
    │   ├── /finance/sales/:id
    │   ├── /finance/expenses
    │   ├── /finance/analytics
    │   ├── /master/customers
    │   └── /master/sources
    └── AutopostingShell
        └── /autoposting
```

### 2. Layout Layer (`src/components/app-shell.tsx`)

Setiap modul punya shell sendiri yang membungkus konten dengan sidebar:

- **EcommerceShell** — sidebar e-commerce + `<Outlet />`
- **ManagementShell** — sidebar manajemen + `<Outlet />`
- **AutopostingShell** — sidebar dinamis berdasarkan channel sosmed + `<Outlet />`

Shell menerima konfigurasi `NavGroup[]` dan meneruskannya ke `AppSidebar`.

### 3. State Layer

**Zustand** — hanya untuk state yang benar-benar global:

| Store | Isi | Persist |
|-------|-----|---------|
| `authStore` | user, token, refreshToken | localStorage |
| `alertStore` | queue alert & konfirmasi modal | tidak |

**TanStack Query** — untuk semua state yang berasal dari server:
- Data di-cache per `queryKey`
- Stale time: 30 detik
- Invalidasi manual setelah mutasi (create/update/delete)

### 4. API Layer (`src/lib/api.ts`)

Satu Axios instance dipakai di seluruh aplikasi:

```
Request → interceptor tambah header Authorization: Bearer {token}
Response → interceptor tangkap 401 → coba refresh token → retry
                                   → jika gagal → redirect /login
```

Base URL diambil dari `VITE_API_URL` (env variable).

---

## Modul-Modul

### Modul E-Commerce
Mengelola operasional toko online: pesanan, produk, stok, pengguna, testimoni.

### Modul Manajemen
Dibagi 3 sub-modul:
- **Stock** — manajemen akun (POS & Sales Mobile) dan accsmarket
- **Finance** — laporan penjualan, pengeluaran, analitik
- **Master** — data master pelanggan dan sumber penjualan

### Modul Autoposting
Antarmuka untuk posting otomatis ke berbagai channel media sosial yang terhubung.

---

## Keamanan

- Semua route non-publik dilindungi `ProtectedRoute` yang mengecek `isAuthenticated()` dari authStore
- Token disimpan di localStorage (bukan httpOnly cookie) — cukup untuk kebutuhan admin internal
- Token refresh otomatis via interceptor Axios sebelum user sadar token expired
