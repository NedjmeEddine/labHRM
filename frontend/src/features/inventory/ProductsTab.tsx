import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Check,
  Copy,
  History,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { extractApiErrorMessage } from "@/lib/api/client"
import {
  type Product,
  type ProductCategory,
  productsApi,
} from "@/lib/api/inventory"
import { getProductCategoryLabel } from "@/lib/domain-labels"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { ProductFormDialog } from "./ProductFormDialog"
import { ProductPriceHistoryDialog } from "./ProductPriceHistoryDialog"

export function ProductsTab({
  inventoryTrackingEnabled,
}: {
  inventoryTrackingEnabled: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [copiedCode, copyToClipboard] = useCopyToClipboard()

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 200)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.products.list({
      category: categoryFilter === "all" ? undefined : categoryFilter,
      search: debouncedSearch,
      active_only: true,
    }),
    queryFn: () =>
      productsApi.list({
        category:
          categoryFilter === "all"
            ? undefined
            : (categoryFilter as ProductCategory),
        search: debouncedSearch,
        active_only: true,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastProductDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Erreur lors de l'archivage"))
    },
  })

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("productName"),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-foreground">
              {row.original.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{row.original.unit}</span>
              {row.original.storage_location && (
                <span>• {row.original.storage_location}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "reference_code",
        header: t("referenceCode"),
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => {
          const code = row.original.reference_code
          if (!code)
            return <span className="text-muted-foreground text-xs">—</span>
          const isCopied = copiedCode === code
          return (
            <div className="flex items-center gap-1 font-mono text-xs">
              <span>{code}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Copier le code"
                onClick={() => copyToClipboard(code)}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          )
        },
      },
      {
        accessorKey: "category",
        header: t("type"),
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs capitalize">
            {getProductCategoryLabel(row.original.category, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "usual_supplier_name",
        header: t("usualSupplier"),
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.usual_supplier_name || "—"}
          </span>
        ),
      },
      ...(inventoryTrackingEnabled
        ? [
            {
              accessorKey: "current_stock",
              header: t("currentStock"),
              cell: ({ row }: { row: { original: Product } }) => {
                const stock = Number(row.original.current_stock)
                const min = row.original.min_stock
                  ? Number(row.original.min_stock)
                  : null
                const isLow = min !== null && stock <= min
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs">
                      {stock.toFixed(2)} {row.original.unit}
                    </span>
                    {isLow && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1 py-0"
                      >
                        Bas (≤{min})
                      </Badge>
                    )}
                  </div>
                )
              },
            },
          ]
        : []),
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => {
          const prod = row.original
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t("priceHistory")}
                onClick={() => {
                  setHistoryProduct(prod)
                  setHistoryOpen(true)
                }}
              >
                <History className="h-4 w-4" />
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
                      setEditingProduct(prod)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(prod)}
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
    [t, copiedCode, copyToClipboard, inventoryTrackingEnabled],
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Catégorie..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              <SelectItem value="reagent">{t("catReagent")}</SelectItem>
              <SelectItem value="consumable">{t("catConsumable")}</SelectItem>
              <SelectItem value="equipment">{t("catEquipment")}</SelectItem>
              <SelectItem value="other">{t("catOther")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null)
            setFormOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {t("newProduct")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement du catalogue produits...
        </div>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      {formOpen && (
        <ProductFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          productToEdit={editingProduct}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
          }}
        />
      )}

      {historyOpen && historyProduct && (
        <ProductPriceHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          product={historyProduct}
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
