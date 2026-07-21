import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import LoginPage from "@/pages/LoginPage"
import ProtectedRoute from "@/components/ProtectedRoute"
import { EcommerceShell, ManagementShell, AutopostingShell } from "@/components/app-shell"
import { AlertProvider } from "@/components/AlertProvider"

const DashboardPage = lazy(() => import("@/pages/DashboardPage"))

// E-Commerce
const OrdersPage = lazy(() => import("@/pages/ecommerce/OrdersPage"))
const OrderDetailPage = lazy(() => import("@/pages/ecommerce/OrderDetailPage"))
const ProductsPage = lazy(() => import("@/pages/ecommerce/ProductsPage"))
const ProductFormPage = lazy(() => import("@/pages/ecommerce/ProductFormPage"))
const EcommerceUsersPage = lazy(() => import("@/pages/ecommerce/UsersPage"))
const TestimonialsPage = lazy(() => import("@/pages/ecommerce/TestimonialsPage"))

// Management
const ManagementPage = lazy(() => import("@/pages/management/index"))

// Stock
const StockIndexPage = lazy(() => import("@/pages/management/stock/index"))
const AccountsPage = lazy(() => import("@/pages/management/stock/accounts/index"))
const AccountsPosPage = lazy(() => import("@/pages/management/stock/accounts/pos-page"))
const AccountsSalesMobilePage = lazy(() => import("@/pages/management/stock/accounts/sales-mobile"))
const AccsmarketPage = lazy(() => import("@/pages/management/stock/accsmarket/index"))
const AccsmarketPosPage = lazy(() => import("@/pages/management/stock/accsmarket/pos-page"))
const AccsmarketSalesMobilePage = lazy(() => import("@/pages/management/stock/accsmarket/sales-mobile"))

// Finance
const SalesPage = lazy(() => import("@/pages/management/finance/sales/index"))
const SaleDetailPage = lazy(() => import("@/pages/management/finance/sales/show"))
const AnalyticsPage = lazy(() => import("@/pages/management/finance/analytics/index"))

// Master
const CustomersPage = lazy(() => import("@/pages/management/master/customers/index"))
const SourcesPage = lazy(() => import("@/pages/management/master/sources/index"))

// Upfoll
const UpfollVendorsPage = lazy(() => import("@/pages/management/upfoll/vendors/index"))
const UpfollOrdersPage = lazy(() => import("@/pages/management/upfoll/orders/index"))
const UpfollOrderFormPage = lazy(() => import("@/pages/management/upfoll/orders/form"))

// Autoposting
const AutopostingPage = lazy(() => import("@/pages/autoposting/index"))

function PL() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PL />}>{children}</Suspense>
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertProvider />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          {/* Dashboard — no sidebar */}
          <Route path="/" element={<S><DashboardPage /></S>} />

          {/* E-Commerce module */}
          <Route element={<EcommerceShell />}>
            <Route path="/ecommerce/orders" element={<S><OrdersPage /></S>} />
            <Route path="/ecommerce/orders/:id" element={<S><OrderDetailPage /></S>} />
            <Route path="/ecommerce/products" element={<S><ProductsPage /></S>} />
            <Route path="/ecommerce/products/add" element={<S><ProductFormPage /></S>} />
            <Route path="/ecommerce/products/:id/edit" element={<S><ProductFormPage /></S>} />
            <Route path="/ecommerce/users" element={<S><EcommerceUsersPage /></S>} />
            <Route path="/ecommerce/testimonials" element={<S><TestimonialsPage /></S>} />
          </Route>

          {/* Management module */}
          <Route element={<ManagementShell />}>
            <Route path="/management" element={<S><ManagementPage /></S>} />
            <Route path="/stock" element={<S><StockIndexPage /></S>} />
            <Route path="/stock/accounts" element={<S><AccountsPage /></S>} />
            <Route path="/stock/accounts/pos" element={<S><AccountsPosPage /></S>} />
            <Route path="/stock/accounts/sales-mobile" element={<S><AccountsSalesMobilePage /></S>} />
            <Route path="/stock/accsmarket" element={<S><AccsmarketPage /></S>} />
            <Route path="/stock/accsmarket/pos" element={<S><AccsmarketPosPage /></S>} />
            <Route path="/stock/accsmarket/sales-mobile" element={<S><AccsmarketSalesMobilePage /></S>} />
            <Route path="/finance/sales" element={<S><SalesPage /></S>} />
            <Route path="/finance/sales/:id" element={<S><SaleDetailPage /></S>} />
            <Route path="/finance/analytics" element={<S><AnalyticsPage /></S>} />
            <Route path="/master/customers" element={<S><CustomersPage /></S>} />
            <Route path="/master/sources" element={<S><SourcesPage /></S>} />
            <Route path="/upfoll/vendors" element={<S><UpfollVendorsPage /></S>} />
            <Route path="/upfoll/orders" element={<S><UpfollOrdersPage /></S>} />
            <Route path="/upfoll/orders/new" element={<S><UpfollOrderFormPage /></S>} />
          </Route>

          {/* Autoposting module */}
          <Route element={<AutopostingShell />}>
            <Route path="/autoposting" element={<S><AutopostingPage /></S>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
