import { redirect } from "next/navigation"

export default async function ProdukRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/masuk?redirect=/dashboard/produk/${id}`)
}
