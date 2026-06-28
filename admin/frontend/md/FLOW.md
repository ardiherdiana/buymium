# Flow Admin Frontend

## Flow Autentikasi

```
User buka halaman protected
        ↓
ProtectedRoute cek isAuthenticated()
        ↓
  [Tidak login] ──────────────────────→ Redirect ke /login
        ↓
  [Sudah login]
        ↓
Render halaman
```

### Login

```
User submit form (email + password)
        ↓
Validasi Zod (client-side)
        ↓
POST /api/auth/login
        ↓
  [Error] → tampil pesan error di form
        ↓
  [Sukses] → authStore.setAuth({ user, token, refreshToken })
        ↓
Zustand persist ke localStorage
        ↓
Navigate ke /
```

### Token Refresh Otomatis

```
Request API apapun
        ↓
Interceptor tambah header Authorization: Bearer {token}
        ↓
Response 401 (token expired)
        ↓
Interceptor tangkap → POST /api/auth/refresh dengan refreshToken
        ↓
  [Sukses] → simpan token baru → retry request original
  [Gagal]  → logout() → redirect /login
```

---

## Flow Data Fetching

### Read (GET)

```
Komponen mount
        ↓
useQuery({ queryKey, queryFn })
        ↓
  [Cache hit & tidak stale] → pakai data cache, tidak fetch
        ↓
  [Cache miss / stale]
        ↓
queryFn dipanggil → api.get(...)
        ↓
  [Loading] → tampil skeleton/spinner
  [Error]   → tampil pesan error
  [Sukses]  → render data, simpan ke cache
```

### Create/Update/Delete (Mutasi)

```
User submit form / klik hapus
        ↓
useMutation.mutate(data)
        ↓
  [Loading] → tombol disabled, tampil spinner
        ↓
api.post / api.put / api.delete
        ↓
  [Error]   → toast error, form tetap terbuka
  [Sukses]  → toast sukses
              queryClient.invalidateQueries(queryKey) → refetch list
              navigate kembali (jika form page)
```

---

## Flow Sync Google Sheets (Akun Konten)

```
User klik tombol "Sync Sheets"
        ↓
POST /api/management/accsmarkets/sync { sourceId }
        ↓
Backend: ambil Source dari DB → dapat spreadsheetId
        ↓
Google Sheets API: baca semua sheet di spreadsheet
        ↓
Untuk setiap sheet:
  - Baca header row A1:Z1 → deteksi kolom
  - Baca data A2:G110 (max 109 baris per sheet)
  - Skip baris tanpa email & username
        ↓
Delete semua accsmarket yang belum terjual (isSold=false)
        ↓
Insert ulang dari data sheets
        ↓
Response: { syncedCount, totalSheets }
        ↓
Frontend: invalidate query → list terupdate
```

---

## Flow Navigasi Modul

```
User login → DashboardPage (/)
        ↓
Pilih modul (E-Commerce / Manajemen / Autoposting)
        ↓
Navigate ke root modul (/ecommerce, /management, /autoposting)
        ↓
Shell modul render: Sidebar + <Outlet />
        ↓
Sidebar tampilkan menu sesuai modul
        ↓
User pilih menu → Outlet render halaman yang sesuai
```

---

## Flow Halaman List (Pola Umum)

```
Halaman mount
        ↓
Baca state dari URL query params (page, search, filter)
        ↓
useQuery fetch data dengan params tersebut
        ↓
Render tabel + pagination + search/filter input
        ↓
User ketik search → update URL query → reset page ke 1 → refetch
User ganti filter → update URL query → reset page ke 1 → refetch
User ganti halaman → update URL query → refetch
        ↓
User klik Edit → navigate ke /halaman/:id/edit
User klik Hapus → showConfirm modal
                    → konfirmasi → deleteMutation → invalidate → list refresh
```

---

## Flow Halaman Form (Create/Edit)

```
Buka /halaman/new atau /halaman/:id/edit
        ↓
[Edit] useQuery fetch data by ID → populate form default values
        ↓
User isi form → React Hook Form track perubahan
        ↓
Submit → validasi Zod
  [Invalid] → tampil error per field, tidak submit
  [Valid]   → useMutation.mutate(formData)
                ↓
              [Sukses] → toast + navigate kembali ke list
              [Error]  → toast error, tetap di halaman
```

---

## Flow Alert & Konfirmasi

```
Kode panggil showAlert() atau showConfirm()
        ↓
alertStore simpan ke queue
        ↓
AlertProvider (di root app) render modal
        ↓
[showAlert]   → user klik OK → modal tutup
[showConfirm] → user klik Konfirmasi → jalankan onConfirm callback
              → user klik Batal → modal tutup, tidak ada aksi
```
