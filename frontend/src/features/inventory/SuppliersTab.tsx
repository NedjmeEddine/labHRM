import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/Common/ConfirmDeleteDialog"
import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { extractApiErrorMessage } from "@/lib/api/client"
import { type Supplier, suppliersApi } from "@/lib/api/inventory"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { SupplierDetailDialog } from "./SupplierDetailDialog"
import { SupplierFormDialog } from "./SupplierFormDialog"

export function SuppliersTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 200)

  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  )

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.suppliers.list({
      search: debouncedSearch,
      active_only: true,
    }),
    queryFn: () =>
      suppliersApi.list({ search: debouncedSearch, active_only: true }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastSupplierDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.dashboard })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Erreur lors de l'archivage"))
    },
  })

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("supplierName"),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-foreground">
              {row.original.name}
            </div>
            {row.original.contact_person && (
              <div className="text-xs text-muted-foreground">
                {row.original.contact_person}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: t("phone"),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.phone || "—"}</span>
        ),
      },
      {
        accessorKey: "tax_id",
        header: "NIF / RC",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {row.original.tax_id || row.original.trade_registry || "—"}
          </span>
        ),
      },
      {
        accessorKey: "total_invoiced",
        header: t("totalInvoiced"),
        cell: ({ row }) => (
          <span className="text-xs font-medium">
            {formatDZD(Number(row.original.total_invoiced))}
          </span>
        ),
      },
      {
        accessorKey: "balance_owed",
        header: t("balanceOwed"),
        cell: ({ row }) => {
          const owed = Number(row.original.balance_owed)
          return (
            <Badge
              variant={owed > 0 ? "destructive" : "secondary"}
              className="font-mono text-xs"
            >
              {formatDZD(owed)}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => {
          const supp = row.original
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Consulter le relevé"
                onClick={() => {
                  setSelectedSupplierId(supp.id)
                  setDetailOpen(true)
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Relevé PDF"
                onClick={() =>
                  suppliersApi.downloadStatementPdf(
                    supp.id,
                    `releve_${supp.name}.pdf`,
                  )
                }
              >
                <FileText className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingSupplier(supp)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(supp)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [t],
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          onClick={() => {
            setEditingSupplier(null)
            setFormOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {t("newSupplier")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement des fournisseurs...
        </div>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      {formOpen && (
        <SupplierFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          supplierToEdit={editingSupplier}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
            queryClient.invalidateQueries({
              queryKey: queryKeys.invoices.dashboard,
            })
          }}
        />
      )}

      {detailOpen && selectedSupplierId && (
        <SupplierDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          supplierId={selectedSupplierId}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          itemLabel={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
