import { StockPosPage, type StockPosPageConfig } from "@/components/stock/stock-pos-page"

const config: StockPosPageConfig = {
  customerSearchPath: "/management/accounts/search/customers",
  fetchItemsPath: "/management/accounts/sales-mobile",
  fetchIdsParam: "account_ids",
  itemsQueryKey: "accounts-pos-items",
  responseKey: "accounts",
  itemIdKey: "account_id",
  backPath: "/stock/accounts",
  completedStatusValue: "Completed",
  renderFollowers: (acc) => (
    <>
      <span>Followers: {acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</span>
      {acc.phoneModel && (
        <span className="flex items-center gap-1">
          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <circle cx="12" cy="17" r="1" />
          </svg>
          {acc.phoneModel}
        </span>
      )}
    </>
  ),
  dropdownVariant: "inline",
  clearShopeeOrderOnUncheck: false,
  summaryPosition: "before-submit",
  shopeeOrderPlaceholder: "Nomor order Shopee...",
}

export default function AccountsPosPage() {
  return <StockPosPage config={config} />
}
