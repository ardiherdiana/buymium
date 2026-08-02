import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useDebounce } from "./use-debounce"

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
}

/**
 * Customer search-and-list used by the POS pages (accounts stock / upfoll orders):
 * loads the initial customer list on mount, then re-queries (debounced) as the user types.
 */
export function useCustomerSearch(searchPath: string) {
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedQuery = useDebounce(searchQuery, 300)

  const { data } = useQuery<{ customers: Customer[] }>({
    queryKey: ["customer-search", searchPath, debouncedQuery],
    queryFn: () =>
      api.get(searchPath, { params: debouncedQuery ? { search: debouncedQuery } : undefined })
        .then((r) => ({ customers: r.data?.customers ?? [] })),
  })

  return {
    customers: data?.customers ?? [],
    searchQuery,
    setSearchQuery,
  }
}
