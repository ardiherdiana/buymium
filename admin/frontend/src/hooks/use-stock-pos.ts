import { useState, useEffect, useRef, useMemo } from "react"
import { useLocation, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { useCustomerSearch } from "@/hooks/use-customer-search"

export interface StockPosItem {
  id: number
  username?: string
  email?: string
  capital?: number
  targetFollowers?: number
  currentFollowers?: number
  accountStatus?: string
  phoneModel?: string
  year?: string
}

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
}

export interface StockPosConfig {
  /** Path used to search/list customers for the dropdown, e.g. "/management/accounts/search/customers" */
  customerSearchPath: string
  /** Path used to fetch the selected items' full data, e.g. "/management/accounts/sales-mobile" */
  fetchItemsPath: string
  /** Query param name the fetch endpoint expects for the id list, e.g. "account_ids" */
  fetchIdsParam: string
  /** React Query key prefix for the items fetch */
  itemsQueryKey: string
  /** Key holding the items array in the fetch response, e.g. "accounts" | "accsmarkets" */
  responseKey: string
  /** Key used for each line item's id field when posting the sale, e.g. "account_id" | "accsmarket_id" */
  itemIdKey: string
  /** Route to navigate back to after a successful sale, e.g. "/stock/accounts" */
  backPath: string
}

/**
 * Shared state + submit logic for the "stock" POS pages (accounts / accsmarket): loads the
 * selected items, tracks the customer/shopee/price inputs, computes totals, and submits the sale.
 * Rendering stays page-specific since the two entities differ slightly in layout/fields.
 */
export function useStockPos(config: StockPosConfig) {
  const navigate = useNavigate()
  const location = useLocation()
  const alert = useAlert()

  const initialIds: number[] = location.state?.selectedIds ?? []

  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds)
  const { customers, searchQuery: customerSearchQuery, setSearchQuery: setCustomerSearchQuery } =
    useCustomerSearch(config.customerSearchPath)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isShopee, setIsShopee] = useState(false)
  const [shopeeOrderNumber, setShopeeOrderNumber] = useState("")
  const [totalSalesInput, setTotalSalesInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const customerInputWrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<Record<string, StockPosItem[]>>({
    queryKey: [config.itemsQueryKey, initialIds],
    queryFn: () =>
      api.get(config.fetchItemsPath, { params: { [config.fetchIdsParam]: initialIds.join(",") } })
        .then((r) => r.data),
    enabled: initialIds.length > 0,
  })

  const selected = (data?.[config.responseKey] ?? []).filter((a) => selectedIds.includes(a.id))

  const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")
  const unitPrice = useMemo(() => {
    if (!totalSalesInput || selected.length === 0) return 0
    return Math.floor(totalSalePrice / selected.length)
  }, [totalSalePrice, selected.length])

  const totalCapital = selected.reduce((s, a) => s + (a.capital ?? 0), 0)
  const totalProfit = totalSalePrice - totalCapital

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
    }
    if (showCustomerDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showCustomerDropdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) { alert.error("Validasi", "Pilih customer"); return }
    if (selected.length === 0) { alert.error("Validasi", "Tidak ada akun dipilih"); return }
    if (!totalSalesInput.trim()) { alert.error("Validasi", "Masukkan harga jual"); return }
    setSubmitting(true)
    try {
      const salesNumber = `BUYMIUM${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Date.now().toString().slice(-3)}`
      await api.post("/management/sales", {
        sales_number: salesNumber,
        customer_id: selectedCustomer.id,
        total_sale_price: totalSalePrice,
        total_profit: totalProfit,
        is_shopee: isShopee,
        shopee_order_number: isShopee ? shopeeOrderNumber : undefined,
        items: selected.map((a) => ({
          [config.itemIdKey]: a.id,
          unit_sale_price: unitPrice,
          profit: unitPrice - (a.capital ?? 0),
        })),
      })
      alert.success("Berhasil", "Penjualan berhasil dibuat")
      navigate(config.backPath)
    } catch {
      alert.error("Gagal", "Gagal membuat penjualan")
    } finally {
      setSubmitting(false)
    }
  }

  return {
    selectedIds, setSelectedIds,
    customers, customerSearchQuery, setCustomerSearchQuery,
    selectedCustomer, setSelectedCustomer,
    showCustomerDropdown, setShowCustomerDropdown,
    isShopee, setIsShopee,
    shopeeOrderNumber, setShopeeOrderNumber,
    totalSalesInput, setTotalSalesInput,
    submitting,
    customerDropdownRef, customerInputWrapRef,
    selected,
    totalSalePrice, unitPrice, totalCapital, totalProfit,
    handleSubmit,
  }
}
