import type { RefObject, FormEvent } from "react"
import { X, ShoppingCart, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface Accsmarket {
  id: number
  username?: string
  email?: string
  capital?: number
  targetFollowers?: number
  currentFollowers?: number
}

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
}

interface AccsmarketPosProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: number[]
  accsmarkets: Accsmarket[]
  customers: Customer[]
  customerDropdownRef: RefObject<HTMLDivElement | null>
  selectedCustomerId: number | null
  selectedCustomerName: string
  customerSearchQuery: string
  showCustomerDropdown: boolean
  isShopee: boolean
  totalSalesInput: string
  unitPrice: number
  submittingSale: boolean
  onCustomerQueryChange: (value: string) => void
  onCustomerSelect: (id: number, name: string) => void
  onDropdownFocus: () => void
  onClearCustomer: () => void
  onSetIsShopee: (v: boolean) => void
  onSetTotalSalesInput: (v: string) => void
  onSubmitSale: (e: FormEvent) => void
  onRemoveAccount: (id: number) => void
  formatCurrency: (n: number | null) => string
}

export default function AccsmarketPos({
  isOpen,
  onClose,
  selectedIds,
  accsmarkets,
  customers,
  customerDropdownRef,
  selectedCustomerId,
  selectedCustomerName,
  customerSearchQuery,
  showCustomerDropdown,
  isShopee,
  totalSalesInput,
  unitPrice,
  submittingSale,
  onCustomerQueryChange,
  onCustomerSelect,
  onDropdownFocus,
  onClearCustomer,
  onSetIsShopee,
  onSetTotalSalesInput,
  onSubmitSale,
  onRemoveAccount,
  formatCurrency,
}: AccsmarketPosProps) {
  const selected = accsmarkets.filter((a) => selectedIds.includes(a.id))
  const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-2xl w-[400px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            <span className="text-base font-semibold">Point of Sales</span>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmitSale} className="flex flex-col flex-1 min-h-0">
          {/* Fixed: Customer + Shopee */}
          <div className="px-5 pt-4 pb-3 space-y-4 border-b shrink-0">
            {/* Customer */}
            <div className="space-y-2" ref={customerDropdownRef}>
              <label className="text-sm font-semibold">Customer *</label>
              {selectedCustomerId ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{selectedCustomerName}</span>
                  <button type="button" onClick={onClearCustomer} className="ml-2 rounded hover:bg-muted p-0.5">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari customer (ketik nama/username)..."
                    value={customerSearchQuery}
                    onChange={(e) => onCustomerQueryChange(e.target.value)}
                    onFocus={onDropdownFocus}
                    className="pl-9"
                  />
                  {showCustomerDropdown && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-44 overflow-y-auto">
                      {customers.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">Tidak ada customer</p>
                      ) : (
                        customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => onCustomerSelect(c.id, c.usernameSh ?? String(c.id))}
                          >
                            <p className="font-medium">{c.usernameSh ?? "-"}</p>
                            {c.nomorHp && <p className="text-xs text-muted-foreground">{c.nomorHp}</p>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shopee */}
            <div className="flex items-center gap-3">
              <Checkbox id="pos-accs-shopee" checked={isShopee} onCheckedChange={(v) => onSetIsShopee(!!v)} />
              <label htmlFor="pos-accs-shopee" className="text-sm font-medium cursor-pointer">Shopee</label>
            </div>
          </div>

          {/* Scrollable: accounts list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Selected Accounts ({selected.length})</label>
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pilih akun dari tabel</p>
              ) : (
                <div className="space-y-2">
                  {selected.map((acc) => {
                    const profit = unitPrice - (acc.capital ?? 0)
                    return (
                      <div key={acc.id} className="rounded-md border p-3 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-semibold">{acc.username ?? acc.email ?? "-"}</span>
                          <button type="button" onClick={() => onRemoveAccount(acc.id)} className="rounded hover:bg-muted p-0.5 shrink-0 ml-2">
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Capital: {acc.capital != null ? formatCurrency(acc.capital) : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Followers: {acc.currentFollowers != null ? acc.currentFollowers.toLocaleString("id-ID") : "-"}
                        </p>
                        <div className="pt-1 space-y-0.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sale Price:</span>
                            <span className="font-medium">{formatCurrency(unitPrice || null)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Profit:</span>
                            <span className={`font-medium ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {totalSalePrice > 0 ? formatCurrency(profit) : formatCurrency(-(acc.capital ?? 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t shrink-0 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Total Sales *</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={totalSalesInput ? parseInt(totalSalesInput.replace(/\D/g, "") || "0").toLocaleString("id-ID") : ""}
                onChange={(e) => onSetTotalSalesInput(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submittingSale || selected.length === 0 || !selectedCustomerId || !totalSalesInput}
            >
              {submittingSale ? "Memproses..." : "Submit Sales"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
