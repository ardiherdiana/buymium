import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

interface Source {
  id: number
  name: string
  prefix?: string
  color?: string
  index?: number
  is_accsmarket: boolean
  image_url?: string
}

export default function SourcesPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()

  const { data, isLoading } = useQuery<{ sources: Source[] }>({
    queryKey: ["management-sources"],
    queryFn: () => api.get("/management/sources").then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-sources"] })
      alert.success("Berhasil", "Source berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus source"),
  })

  const handleDelete = async (source: Source) => {
    const ok = await alert.confirm("Hapus Source", `Hapus source "${source.name}"?`)
    if (ok) deleteMutation.mutate(source.id)
  }

  const sources = data?.sources ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Source</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola sumber akun</p>
        </div>
        <Button><Plus className="size-4 mr-2" />Tambah Source</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Urutan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={5} /> : !sources.length ? (
                <EmptyRow colSpan={5} message="Belum ada source" />
              ) : (
                sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{s.index ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.color && (
                          <span className="size-3 rounded-full shrink-0" style={{ background: s.color }} />
                        )}
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.prefix ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_accsmarket ? "blue" : "outline"}>
                        {s.is_accsmarket ? "Accsmarket" : "Instagram"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
