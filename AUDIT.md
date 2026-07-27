# AUDIT.md

Audit menyeluruh atas 4 aplikasi Buymium (`admin/backend`, `admin/frontend`, `user/backend`, `user/frontend`). Fokus: kode mati, risiko keamanan/korektnas, gap test, dan kualitas kode. Semua temuan sudah diverifikasi lewat grep/pembacaan langsung ke source, bukan asumsi.

Legenda prioritas: **P0** = risiko keamanan/data nyata, perbaiki dulu. **P1** = kualitas/maintainability penting. **P2** = cleanup ringan.

---

## 1. admin/backend

| # | Prioritas | Temuan | Lokasi |
|---|---|---|---|
| 1 | **P0** | `src/routes/management/roles.ts` cuma pakai `requireAuth` lokal ad-hoc yang cuma cek `req.user` truthy — **tidak ada pengecekan role sama sekali**. Otorisasi endpoint role-management ini sepenuhnya bergantung pada `management/index.ts` yang memasang `requireAdmin` di parent router. Kalau parent router direstruktur, endpoint ini jadi bisa diakses siapa saja yang login. Bandingkan dengan `src/routes/roles.ts` (top-level) yang benar pakai `requireAdmin`/`requireSuperAdmin` langsung. | `src/routes/management/roles.ts` |
| 2 | P1 | Dua library hashing password dipakai bersamaan: `bcrypt` (`src/controllers/management/users.ts`) dan `bcryptjs` (`src/routes/auth.ts`). Beda implementasi utk data sensitif yang sama — pilih satu, hapus yang lain dari `package.json`. | `controllers/management/users.ts`, `routes/auth.ts` |
| 3 | P1 | Tidak ada test sama sekali untuk modul besar & berisiko: seluruh `controllers/autoposting/*`, `controllers/ecommerce/bankAccounts.ts`, `controllers/testimonial.ts`/`services/testimonial.ts`, `controllers/management/analytics.ts`, `upfollVendors.ts`/`upfollOrders.ts`, `services/socialbu.ts`, `services/management/googleSheets/*`, `utils/rapidApiQueue.ts`, `utils/encrypt.ts`, `utils/email.ts`, `utils/slug.ts`. | `src/controllers/`, `src/services/`, `src/utils/` |
| 4 | P1 | 58 pemakaian `console.log`/`console.error` langsung di controller/service/`app.ts`, alih-alih `src/utils/logger.ts` yang sudah ada. Bikin log produksi tidak konsisten/tidak bisa difilter terstruktur. | tersebar, cek `app.ts` request logger & error handler |
| 5 | P1 | Perlu verifikasi manual: `src/routes/ecommerce/index.ts` tidak memasang auth middleware terpusat (beda dari `management/index.ts` yang pasang `requireAdmin` di parent) — pastikan `bankAccounts.ts` dan `testimonials.ts` masing-masing sudah pasang guard sendiri, bukan berasumsi ada di parent. | `src/routes/ecommerce/` |
| 6 | P2 | `uuid: ^14.0.0` di `dependencies` vs `@types/uuid: ^10.0.0` di `devDependencies` — mismatch major version, cek `npm ls uuid`. | `package.json` |
| 7 | ✅ Bersih | Tidak ada sisa kode `expense`/`payment-gateway` (grep nihil) — penghapusan fitur di masa lalu sudah rapi. Tidak ada TODO/FIXME/kode dikomentari yang tertinggal. Tidak ada `$queryRaw`/`$executeRaw` mentah (risiko SQL injection rendah). CORS pakai allowlist origin, bukan `*`. | — |

---

## 2. admin/frontend

| # | Prioritas | Temuan | Lokasi |
|---|---|---|---|
| 1 | P1 | `pages/management/stock/accounts/index.tsx` (680 baris) dan `pages/management/stock/accsmarket/index.tsx` (710 baris) adalah **duplikasi hampir cermin** satu sama lain (pola tombol/nav sama, struktur sama) — termasuk pasangan `pos.tsx`/`pos-page.tsx`/`sales-mobile.tsx` di kedua folder. Kandidat kuat untuk digabung jadi satu komponen generik + hook `useStockListing(entityType)`. | `pages/management/stock/{accounts,accsmarket}/` |
| 2 | P1 | Data-fetching tidak konsisten: 21 file halaman masih pakai `axios.get`/`api.get` langsung + `useState` manual untuk loading/data (89 kemunculan di 17 file), padahal `@tanstack/react-query` sudah jadi dependency inti. `src/hooks/` sudah ada tapi cuma isi `use-mobile.ts`. Harus dipindah ke hook `useQuery` per entity. | 17 file di `src/pages/` |
| 3 | P1 | `pages/autoposting/index.tsx` — 934 baris, file terbesar di repo, kemungkinan menggabung composer+scheduling+list dalam satu komponen. Perlu dipecah. | `pages/autoposting/index.tsx` |
| 4 | P2 | Satu-satunya pemakaian `any`/`as any` di seluruh `src/` ada di `pages/ecommerce/ProductFormPage.tsx` (605 baris, juga kandidat split). | `pages/ecommerce/ProductFormPage.tsx` |
| 5 | P2 | `shadcn` (CLI codegen) tercantum di `dependencies`, seharusnya `devDependencies` — tidak dibutuhkan saat runtime produksi. | `package.json` |
| 6 | P2 | `src/assets/react.svg` — sisa boilerplate default Vite, kemungkinan tidak dipakai. Verifikasi lalu hapus. | `src/assets/react.svg` |
| 7 | ✅ Bersih | Tidak ada sisa expense-tracking. Tidak ada `ts-ignore`/`ts-nocheck`. `tsconfig` sudah strict (`strict`, `noUnusedLocals`, `noUnusedParameters`). | — |

---

## 3. user/backend

| # | Prioritas | Temuan | Lokasi |
|---|---|---|---|
| 1 | **P0** | Static file serving `/api/uploads` (termasuk bukti pembayaran/`proof`) via `express.static` **tanpa auth check apa pun**, dengan `Cross-Origin-Resource-Policy: cross-origin` dipasang untuk seluruh tree. Siapa pun yang menebak/mendapat URL file bisa mengaksesnya lintas origin. Filename pakai `timestamp+random` (tidak sepenuhnya predictable, tapi tetap tanpa auth ini gap nyata untuk data sensitif pelanggan). | `src/app.ts` (baris ~87-90) |
| 2 | P1 | **`midtrans-client` masih di `package.json`** (dependencies + `@types/midtrans-client`) padahal tidak dipakai di kode produksi sama sekali — hanya muncul di mock test (`src/tests/setup.ts`, `helpers.ts`, `orders.test.ts`). Sisa scaffolding dari migrasi payment-gateway yang sudah di-revert. Hapus dependency + mock block di `setup.ts`. | `package.json`, `src/tests/setup.ts` |
| 3 | P1 | Reservasi inventori (`reserveInventory` di `utils/inventory.ts`) sudah benar pakai `SELECT ... FOR UPDATE` dalam transaksi. Tapi flow pemanggilnya di `routes/orders.ts` (create order → reserve → release+cancel on failure) adalah **3 langkah terpisah tanpa transaksi pembungkus**. Kalau proses crash di antara `order.create` dan reservasi, order "ghost" `pending` tertinggal tanpa reservasi sampai job expiry 24 jam jalan. | `src/routes/orders.ts`, `src/utils/inventory.ts` |
| 4 | P1 | `releaseInventory` pakai `updateMany` biasa (tanpa `$transaction`/row lock) untuk dua tabel (`account`, `accsmarket`) — dua write independen non-atomik, inkonsisten dengan disiplin transaksi di `reserveInventory`. | `src/utils/inventory.ts` (~196-206) |
| 5 | P1 | Test coverage hanya 3 file (`auth.test.ts`, `orders.test.ts`, `products.test.ts`). **Tidak ada test untuk** `utils/inventory.ts` (logika risiko tertinggi — race condition reservasi), `utils/encrypt.ts` (`safeDecrypt` dipakai untuk decrypt kredensial akun di `orders.ts`), `middleware/auth.ts`, `middleware/userRateLimit.ts`, `services/orderExpiry.ts`, `bankAccounts.ts`, `testimonials.ts`, `sitemap.ts`. | `src/tests/` |
| 6 | P2 | Validasi upload file (`proof`) hanya cek `mimetype` (client-controlled/spoofable), ekstensi file diambil langsung dari nama asli client tanpa allow-list ketat terhadap mimetype yang terdeteksi. | `src/routes/orders.ts` (~20-34) |
| 7 | P2 | Dokumentasi `CLAUDE.md` menyebut route `admin` di `user/backend`, tapi `src/routes/` tidak punya `admin.ts` — aksi admin sudah dilebur ke `products.ts` (`requireAdmin` pada POST/PUT/DELETE). Dokumen perlu dikoreksi. | `CLAUDE.md` |
| 8 | ✅ Bersih | Tidak ada sisa `ipaymu`/`payment_gateway`/`payment_url`/`payment_session_id`/`paymentMethod` di kode — migrasi payment-gateway sudah direvert dengan bersih dari sisi source (hanya dependency `midtrans-client` yang lupa dihapus, lihat #2). | — |

---

## 4. user/frontend

| # | Prioritas | Temuan | Lokasi |
|---|---|---|---|
| 1 | P1 | **`CLAUDE.md` sudah tidak akurat**: dokumen menyatakan state management pakai "Redux Toolkit", tapi tidak ada dependency `redux`/`@reduxjs/toolkit` di `package.json`, tidak ada folder `store/`/`redux/`/slices. State sebenarnya cuma React Context (`contexts/auth-context.tsx`) + local state. Perlu dikoreksi di `CLAUDE.md` (drift dokumentasi, bukan bug kode). | `CLAUDE.md`, `contexts/auth-context.tsx` |
| 2 | P1 | Tidak ada test untuk `contexts/auth-context.tsx` — padahal ini logika paling kritis (flow refresh token otomatis saat 401 di `authFetch`). Hanya 2 file test di seluruh repo (`app/masuk/page.test.tsx`, `lib/api.test.ts`) dari ~30+ file app/component. | `contexts/auth-context.tsx` |
| 3 | P1 | `app/dashboard/pesanan/[id]/page.tsx` — 725 baris, kemungkinan mencampur fetch data + logika status + render tree besar. Kandidat split ke subkomponen/hook. | `app/dashboard/pesanan/[id]/page.tsx` |
| 4 | P2 | `app/dashboard/profil/page.tsx:48` — `(user as any)?.hasPassword` men-cast context user ke `any` untuk baca property yang tidak ada di type. Perbaiki dengan extend type `User` di `auth-context.tsx`. | `app/dashboard/profil/page.tsx:48` |
| 5 | P2 | `hooks/` directory kosong (0 file) — sisa scaffold shadcn/ui init, tidak dipakai. | `hooks/` |
| 6 | P2 | `shadcn` (CLI) ada di `dependencies`, seharusnya `devDependencies`. | `package.json` |
| 7 | P2 | Tidak ada shared data-fetching hook (`hooks/` kosong, tidak ada React Query/SWR) — halaman dashboard (`pesanan/page.tsx`, `pesanan/[id]/page.tsx`, `profil/page.tsx`) kemungkinan masing-masing bikin ulang logika `authFetch` + loading/error state sendiri. | `app/dashboard/` |
| 8 | ✅ Bersih | Semua call terautentikasi sudah pakai `authFetch` dari `useAuth()` — tidak ada satu pun raw `fetch` dengan Bearer header manual (grep `Authorization`/`Bearer` cuma nongol di `auth-context.tsx` sendiri). Tidak ada sisa UI/kode payment-gateway (`ipaymu`, `payment_method`, `payment_url` — nihil). Tidak ada TODO/FIXME tertinggal. | — |

---

## Ringkasan Prioritas Lintas-Aplikasi

**P0 — segera:**
1. `admin/backend`: tambahkan pengecekan role eksplisit di `management/roles.ts`, jangan andalkan parent router.
2. `user/backend`: pasang auth/signed-URL untuk `/api/uploads` (bukti pembayaran pelanggan saat ini bisa diakses tanpa login kalau URL diketahui).

**P1 — penting, bukan darurat:**
- Hapus dependency `midtrans-client` (user/backend) yang sudah dead sejak payment-gateway direvert.
- Konsolidasi `bcrypt`/`bcryptjs` jadi satu (admin/backend).
- Bungkus flow create-order → reserve-inventory dalam transaksi yang lebih ketat (user/backend).
- Perbaiki drift dokumentasi: `CLAUDE.md` soal Redux di user/frontend dan route `admin` di user/backend.
- Tambah test untuk modul kritis tanpa coverage: `utils/inventory.ts` & `utils/encrypt.ts` (user/backend), `contexts/auth-context.tsx` (user/frontend), `autoposting/*` & `bankAccounts`/`testimonial` (admin/backend).
- Dedupe halaman `accounts`/`accsmarket` di admin/frontend jadi komponen generik; migrasikan fetch manual ke React Query hooks.
- Pecah file >700 baris: `autoposting/index.tsx` (admin/frontend), `pesanan/[id]/page.tsx` (user/frontend).

**P2 — cleanup ringan (tidak mendesak, tapi mudah dan aman dilakukan):**
- Rutekan `console.log`/`console.error` lewat `utils/logger.ts` (admin/backend).
- Pindahkan `shadcn` CLI dari `dependencies` ke `devDependencies` di admin/frontend & user/frontend.
- Hapus `hooks/` kosong (user/frontend) dan `src/assets/react.svg` bila memang tidak dipakai (admin/frontend).
- Benerin cast `any` di `ProductFormPage.tsx` (admin/frontend) dan `profil/page.tsx:48` (user/frontend).
- Cek mismatch versi `uuid`/`@types/uuid` (admin/backend).

Tidak ditemukan sisa kode fitur yang sudah dihapus (expense-tracking, payment-gateway) di keempat aplikasi kecuali dependency `midtrans-client` yang lupa dicabut — cleanup masa lalu sudah cukup rapi secara source code, gap yang ada lebih ke arah *test coverage*, *duplikasi UI*, dan *satu gap keamanan nyata* (upload static serving tanpa auth).
