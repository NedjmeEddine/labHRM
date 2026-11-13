import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, Clock, DollarSign, Package } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoicesTab } from "@/features/inventory/InvoicesTab"
import { LotsTab } from "@/features/inventory/LotsTab"
import { MovementsTab } from "@/features/inventory/MovementsTab"
import { ProductsTab } from "@/features/inventory/ProductsTab"
import { SuppliersTab } from "@/features/inventory/SuppliersTab"
import { invoicesApi } from "@/lib/api/inventory"
import { settingsApi } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

export const Route = createFileRoute("/_layout/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [{ title: "Fournisseurs & Stock - EL-AMEL LAB" }],
  }),
})

function InventoryPage() {
  const { t } = useTranslation()

  const { data: company } = useQuery({
    queryKey: queryKeys.settings.company,
    queryFn: () => settingsApi.getCompany(),
  })

  const { data: metrics } = useQuery({
    queryKey: queryKeys.invoices.dashboard,
    queryFn: () => invoicesApi.dashboard(),
  })

  const inventoryTrackingEnabled = Boolean(company?.inventory_tracking_enabled)
  const manualStockOutEnabled = Boolean(company?.manual_stock_out_enabled)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("inventoryTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("inventorySubtitle")}
        </p>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("totalDebtOwed")}
              </div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {metrics ? formatDZD(Number(metrics.total_debt_owed)) : "—"}
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("invoicesDueSoon")}
              </div>
              <div className="text-xl font-bold text-foreground mt-1">
                {metrics?.invoices_due_7_days_count ?? 0} factures
              </div>
              <div className="text-[11px] text-muted-foreground">
                Total :{" "}
                {metrics
                  ? formatDZD(Number(metrics.invoices_due_7_days_total))
                  : "0 DZD"}
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {inventoryTrackingEnabled && (
          <>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Alertes Stock Minimum
                  </div>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {metrics?.low_stock_count ?? 0} articles
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    À réapprovisionner
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Lots proches péremption
                  </div>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {metrics?.expiring_lots_count ?? 0} lots
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Dans les {company?.default_expiry_alert_days ?? 60}{" "}
                    prochains jours
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="suppliers">{t("tabSuppliers")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("tabInvoices")}</TabsTrigger>
          <TabsTrigger value="products">{t("tabProducts")}</TabsTrigger>
          {inventoryTrackingEnabled && (
            <>
              <TabsTrigger value="lots">{t("tabLots")}</TabsTrigger>
              <TabsTrigger value="movements">{t("tabMovements")}</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="suppliers" className="pt-4">
          <SuppliersTab />
        </TabsContent>

        <TabsContent value="invoices" className="pt-4">
          <InvoicesTab inventoryTrackingEnabled={inventoryTrackingEnabled} />
        </TabsContent>

        <TabsContent value="products" className="pt-4">
          <ProductsTab inventoryTrackingEnabled={inventoryTrackingEnabled} />
        </TabsContent>

        {inventoryTrackingEnabled && (
          <>
            <TabsContent value="lots" className="pt-4">
              <LotsTab />
            </TabsContent>

            <TabsContent value="movements" className="pt-4">
              <MovementsTab manualStockOutEnabled={manualStockOutEnabled} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
