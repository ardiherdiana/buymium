# Desain Sistem Admin Frontend

## Komponen UI

### shadcn/ui sebagai fondasi

Semua komponen UI dasar (Button, Input, Table, Dialog, Select, dll.) menggunakan shadcn/ui — bukan library eksternal yang di-install, melainkan source code yang di-copy ke `src/components/ui/`. Artinya komponen bisa dimodifikasi langsung tanpa override CSS.

### Komponen Kustom

Selain shadcn/ui, ada komponen kustom yang dipakai berulang:

| Komponen | Lokasi | Fungsi |
|----------|--------|--------|
| `TableExtras` | `src/components/ui/table-extras.tsx` | Pagination + empty state + loading state untuk tabel |
| `DateRangePicker` | `src/components/ui/date-range-picker.tsx` | Picker rentang tanggal (filter laporan) |
| `FAB` | `src/components/ui/fab.tsx` | Floating Action Button (tombol tambah di mobile) |
| `AlertProvider` | `src/components/AlertProvider.tsx` | Modal alert & konfirmasi global via store |
| `ProtectedRoute` | `src/components/ProtectedRoute.tsx` | Guard autentikasi |

---

## Desain Form

Semua form menggunakan kombinasi:
- **React Hook Form** — manajemen state & submit
- **Zod** — validasi schema
- **shadcn/ui Form** — wrapper dengan error message otomatis

Pola standar:

```typescript
const schema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  harga: z.number().positive("Harga harus positif"),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})
```

---

## Desain Tabel & List

Semua halaman list mengikuti pola yang sama:

1. **Search** — input teks, di-debounce, reset ke halaman 1 saat berubah
2. **Filter** — dropdown (status, sumber, dll.), reset ke halaman 1 saat berubah
3. **Date range** — DateRangePicker untuk filter periode
4. **Tabel** — shadcn/ui Table dengan loading skeleton & empty state
5. **Pagination** — komponen TableExtras, mengambil `page` dari state

State halaman di-sync ke URL query params sehingga bisa di-share/di-refresh.

---

## Desain Tema

Dark/light mode diimplementasi dengan **Next Themes**:

```
ThemeProvider (di main.tsx)
  └── attribute="class" → tambah class "dark" ke <html>
        └── Tailwind dark: prefix → semua komponen ikut
```

Toggle tema ada di DashboardPage (pemilih modul), bukan di setiap halaman.

---

## Desain Notifikasi

Dua mekanisme notifikasi:

| Mekanisme | Library | Kapan dipakai |
|-----------|---------|---------------|
| Toast | Sonner | Feedback singkat (berhasil simpan, gagal hapus) |
| Modal Alert | alertStore + AlertProvider | Konfirmasi destruktif (hapus data) atau error penting |

Pemanggilan modal dari mana saja:

```typescript
const { showConfirm } = useAlert()

showConfirm({
  title: "Hapus produk?",
  description: "Tindakan ini tidak bisa dibatalkan.",
  onConfirm: () => deleteMutation.mutate(id),
})
```

---

## Desain Responsif

- Layout utama menggunakan Tailwind grid/flex
- Sidebar collapse di mobile menggunakan `useMobile()` hook
- FAB muncul di mobile sebagai alternatif tombol di header
- Tabel di mobile bisa di-scroll horizontal
- Breakpoint mengikuti Tailwind default: `sm` 640px, `md` 768px, `lg` 1024px

---

## Path Alias

`@` selalu merujuk ke `src/`:

```typescript
// Benar
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"

// Hindari
import { api } from "../../lib/api"
```

---

## Environment Variables

| Variable | Dipakai di | Fungsi |
|----------|-----------|--------|
| `VITE_API_URL` | `src/lib/api.ts` | Base URL admin backend (port 5001) |
| `VITE_USER_API_URL` | referensi | Base URL user backend (port 5000) |

Semua env variable wajib prefix `VITE_` agar ter-expose ke browser oleh Vite.
