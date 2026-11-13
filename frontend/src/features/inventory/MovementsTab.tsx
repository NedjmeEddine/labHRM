import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Download, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { inventoryApi, type StockMovement } from "@/lib/api/inventory"
import { getMovementTypeLabel } from "@/lib/domain-labels"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { ManualMovementDialog } from "./ManualMovementDialog"

export function MovementsTab({
  manualStockOutEnabled,
}: {
  manualStockOutEnabled: boolean
}) {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.inventory.movements(),
    queryFn: () => inventoryApi.listMovements({ limit: 500 }),
  })

  const columns = useMemo<ColumnDef<StockMovement>[]>(
    () => [
      {
        accessorKey: "movement_date",
        header: t("date"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.movement_date}
          </span>
        ),
      },
      {
        accessorKey: "movement_type",
        header: t("type"),
        cell: ({ row }) => {
          const type = row.original.movement_type
          return (
            <Badge
              variant={
                type === "in"
                  ? "default"
                  : type === "out"
                    ? "destructive"
                    : "secondary"
              }
              className="text-[10px]"
            >
              {getMovementTypeLabel(type, t)}
            </Badge>
          )
        },
      },
      {
        accessorKey: "product_name",
        header: t("productName"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs text-foreground">
              {row.original.product_name}
            </div>
            {row.original.lot_number && (
              <div className="text-[10px] text-muted-foreground font-mono">
                Lot : {row.original.lot_number}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Quantité",
        cell: ({ row }) => {
          const qty = Number(row.original.quantity)
          return (
            <span
              className={`font-mono font-bold text-xs ${
                qty > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {qty > 0 ? `+${qty.toFixed(2)}` : qty.toFixed(2)}
            </span>
          )
        },
      },
      {
        accessorKey: "reason",
        header: t("reason"),
        cell: ({ row }) => (
          <div className="text-xs">
            <div>{row.original.reason || "—"}</div>
            {row.original.source_reference && (
              <div className="text-[10px] text-muted-foreground">
                Réf : {row.original.source_reference}
              </div>
            )}
          </div>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Journal d'Audit des Mouvements de Stock
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => inventoryApi.exportStockCsv()}
          >
            <Download className="h-4 w-4" />
            {t("exportCsv")}
          </Button>
          {manualStockOutEnabled && (
            <Button
              size="sm"
              onClick={() => setModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Nouveau Mouvement
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement des mouvements...
        </div>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      {modalOpen && (
        <ManualMovementDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
