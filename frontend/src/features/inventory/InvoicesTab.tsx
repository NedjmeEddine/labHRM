import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileText,
  Plus,
  Search,
} from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  type InvoicePaymentStatus,
  invoicesApi,
  type PurchaseInvoice,
  suppliersApi,
} from "@/lib/api/inventory"
import {
  getInvoicePaymentStatusDisplay,
  getInvoiceStatusDisplay,
} from "@/lib/domain-labels"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { InvoiceFormDialog } from "./InvoiceFormDialog"
import { PaymentDialog } from "./PaymentDialog"

export function InvoicesTab({
  inventoryTrackingEnabled,
}: {
  inventoryTrackingEnabled: boolean
}) {
  const { t } = useTranslation()

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 200)

  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<PurchaseInvoice | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: queryKeys.suppliers.list({ active_only: true }),
    queryFn: () => suppliersApi.list({ active_only: true, limit: 200 }),
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.invoices.list({
      supplier_id: supplierFilter === "all" ? undefined : supplierFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: debouncedSearch,
    }),
    queryFn: () =>
      invoicesApi.list({
        supplier_id: supplierFilter === "all" ? undefined : supplierFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch,
      }),
  })

  const columns = useMemo<ColumnDef<PurchaseInvoice>[]>(
    () => [
      {
        accessorKey: "invoice_date",
        header: t("invoiceDate"),
        cell: ({ row }) => (
          <div className="text-xs font-medium">
            {row.original.invoice_date}
            {row.original.due_date && (
              <div className="text-[10px] text-muted-foreground">
                Échéance : {row.original.due_date}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "invoice_number",
        header: t("invoiceNumber"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-foreground">
              {row.original.invoice_number}
            </span>
            {row.original.is_credit_note && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                Avoir
              </Badge>
            )}
            {row.original.warning_total_mismatch && (
              <span
                title="Écart entre total annoncé et calculé"
                className="text-amber-500"
              >
                <AlertTriangle className="h-3.5 w-3.5 inline" />
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "supplier_name",
        header: t("tabSuppliers"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-foreground">
            {row.original.supplier_name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "total_incl_tax",
        header: t("totalInclTax"),
        cell: ({ row }) => (
          <div className="text-right">
            <div className="text-xs font-bold font-mono text-foreground">
              {formatDZD(Number(row.original.total_incl_tax))}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              HT : {formatDZD(Number(row.original.total_excl_tax))}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "balance_remaining",
        header: "Reste Dû",
        cell: ({ row }) => {
          const rem = Number(row.original.balance_remaining)
          return (
            <div className="text-right">
              <span
                className={`font-mono font-bold text-xs ${
                  rem > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600"
                }`}
              >
                {formatDZD(rem)}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "payment_status",
        header: "Paiement",
        cell: ({ row }) => {
          const { label, variant } = getInvoicePaymentStatusDisplay(
            row.original.payment_status as InvoicePaymentStatus,
            t,
          )
          return (
            <Badge variant={variant} className="text-[10px]">
              {label}
            </Badge>
          )
        },
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => {
          const { label, variant } = getInvoiceStatusDisplay(
            row.original.status,
            t,
          )
          return (
            <Badge variant={variant} className="text-[10px]">
              {label}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => {
          const inv = row.original
          const canPay =
            inv.status !== "cancelled" && Number(inv.balance_remaining) > 0
          return (
            <div className="flex items-center gap-1 justify-end">
              {canPay && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setSelectedInvoiceForPayment(inv)
                    setPaymentModalOpen(true)
                  }}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Payer
                </Button>
              )}
              {inv.has_scan && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary"
                  title={t("viewScan")}
                  onClick={() =>
                    invoicesApi.downloadScan(
                      inv.id,
                      `facture_${inv.invoice_number}.pdf`,
                    )
                  }
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [t],
  )

  return (
    <div className="grid gap-4">
      {/* Top filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Fournisseur..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les fournisseurs</SelectItem>
              {suppliersData?.data.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Statut..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="confirmed">{t("invoiceConfirmed")}</SelectItem>
              <SelectItem value="draft">{t("invoiceDraft")}</SelectItem>
              <SelectItem value="cancelled">{t("invoiceCancelled")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => invoicesApi.exportCsv()}
          >
            <Download className="h-4 w-4" />
            {t("exportCsv")}
          </Button>
          <Button onClick={() => setInvoiceModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("newInvoice")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement des factures d'achats...
        </div>
      ) : (
        <DataTable columns={columns} data={data?.data ?? []} />
      )}

      {invoiceModalOpen && (
        <InvoiceFormDialog
          open={invoiceModalOpen}
          onOpenChange={setInvoiceModalOpen}
          onSuccess={() => refetch()}
          inventoryTrackingEnabled={inventoryTrackingEnabled}
        />
      )}

      {paymentModalOpen && selectedInvoiceForPayment && (
        <PaymentDialog
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          invoice={selectedInvoiceForPayment}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
