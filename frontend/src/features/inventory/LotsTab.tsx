import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { inventoryApi, type Lot } from "@/lib/api/inventory"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { LotFormDialog } from "./LotFormDialog"

export function LotsTab() {
  const { t } = useTranslation()
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.inventory.lots({ is_active: true }),
    queryFn: () => inventoryApi.listLots({ is_active: true, limit: 300 }),
  })

  const columns = useMemo<ColumnDef<Lot>[]>(
    () => [
      {
        accessorKey: "lot_number",
        header: t("lotNumber"),
        cell: ({ row }) => (
          <span className="font-mono font-bold text-xs text-foreground">
            {row.original.lot_number}
          </span>
        ),
      },
      {
        accessorKey: "product_name",
        header: t("productName"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs text-foreground">
              {row.original.product_name}
            </div>
            {row.original.supplier_name && (
              <div className="text-[10px] text-muted-foreground">
                Fournisseur : {row.original.supplier_name}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "current_quantity",
        header: "Quantité Restante",
        cell: ({ row }) => (
          <span className="font-mono font-bold text-xs text-foreground">
            {Number(row.original.current_quantity).toFixed(2)}{" "}
            {row.original.product_unit || ""}
          </span>
        ),
      },
      {
        accessorKey: "expiration_date",
        header: t("expirationDate"),
        cell: ({ row }) => {
          const lot = row.original
          const days = lot.days_until_expiry
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs">{lot.expiration_date}</span>
              {lot.is_expired ? (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  {t("expired")}
                </Badge>
              ) : days <= 60 ? (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1 py-0"
                >
                  {days} j restants
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  ({days} j)
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "received_date",
        header: t("receivedDate"),
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.received_date}
          </span>
        ),
      },
    ],
    [t],
  )

  const expiringCount =
    data?.data.filter((l) => l.days_until_expiry <= 60 && !l.is_expired)
      .length ?? 0
  const expiredCount = data?.data.filter((l) => l.is_expired).length ?? 0

  return (
    <div className="grid gap-4">
      {/* Expiry overview banner if any */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>
              Suivi qualité : <strong>{expiringCount}</strong> lots expirent
              dans moins de 60 jours
              {expiredCount > 0 && (
                <>
                  {" "}
                  et{" "}
                  <strong className="text-destructive">{expiredCount}</strong>{" "}
                  lots sont périmés
                </>
              )}
              .
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Catalogue des Lots et Péremptions
        </h3>
        <Button onClick={() => setFormOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau Lot
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement des lots...
        </div>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      {formOpen && (
        <LotFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
