import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Search, Trash2 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface GrowthPoint {
  date: string
  count: number
}

function UserGrowthChart() {
  const { data, isLoading } = useQuery<{ data: GrowthPoint[]; total: number }>({
    queryKey: ["users-growth"],
    queryFn: () => api.get("/users/growth").then((r) => r.data),
  })

  const points = data?.data ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Pertumbuhan Pengguna Baru — Bulan Ini</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Memuat...</p>
        ) : points.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Belum ada data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(-2)}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                formatter={(v) => [v as number, "Pengguna Baru"]}
                labelFormatter={(v: string) => `Tanggal ${v.slice(-2)}`}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Pengguna Baru" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

interface User {
  id: number
  name: string
  email: string
  roleId: number
  avatar?: string
  orderCount: number
  totalSpent: number
  createdAt: string
}

interface UsersResponse {
  data: User[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

function DeleteUserButton({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.delete(`/users/${user.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
          <AlertDialogDescription>
            Pengguna <strong>{user.name}</strong> ({user.email}) akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); mutate() }}
            disabled={isPending}
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const PAGE_SIZE = 20

export default function UsersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const goToOrders = (user: User) => navigate(`/ecommerce/orders?userId=${user.id}`)

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["users", page, search],
    queryFn: () =>
      api.get("/users", { params: { page, limit: PAGE_SIZE, search: search || undefined } }).then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pengguna</h1>
        <p className="text-sm text-muted-foreground mt-1">Daftar pembeli terdaftar</p>
      </div>

      <UserGrowthChart />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead className="text-right">Pesanan</TableHead>
                <TableHead className="text-right">Total Belanja</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={5} />
              ) : !data?.data?.length ? (
                <EmptyRow colSpan={5} message="Tidak ada pengguna ditemukan" />
              ) : (
                data.data.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => goToOrders(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {user.name?.charAt(0).toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{user.orderCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatIDR(user.totalSpent)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <DeleteUserButton user={user} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={data?.meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !data?.data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pengguna ditemukan</p>
        ) : (
          data.data.map((user) => (
            <Card key={user.id} className="cursor-pointer" onClick={() => goToOrders(user)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {user.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {new Date(user.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm">
                  <div className="text-center">
                    <p className="font-semibold">{user.orderCount}</p>
                    <p className="text-xs text-muted-foreground">Pesanan</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{formatIDR(user.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">Total Belanja</p>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-3 pt-3 border-t">
                  <DeleteUserButton user={user} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {!!data?.data?.length && (
          <Pagination
            page={page}
            total={data?.meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
