import { useQuery } from "@tanstack/react-query"
import { Download, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { suppliersApi } from "@/lib/api/inventory"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface SupplierDetailDialogProps {
  supplierId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupplierDetailDialog({
  supplierId,
  open,
  onOpenChange,
}: SupplierDetailDialogProps) {
  const { t } = useTranslation()

  const { data: supplier, isLoading } = useQuery({
    queryKey: queryKeys.suppliers.detail(supplierId ?? ""),
    queryFn: () => suppliersApi.get(supplierId!),
    enabled: Boolean(supplierId && open),
  })

  if (!supplierId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-xl font-bold">
              {supplier?.name ?? "Fournisseur"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  supplier &&
                  suppliersApi.downloadStatementPdf(
                    supplier.id,
                    `releve_${supplier.name}.pdf`,
                  )
                }
              >
                <FileText className="h-4 w-4" />
                {t("downloadStatementPdf")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  supplier &&
                  suppliersApi.downloadStatementCsv(
                    supplier.id,
                    `releve_${supplier.name}.csv`,
                  )
                }
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
          <DialogDescription>
            {supplier?.contact_person
              ? `Contact: ${supplier.contact_person}`
              : "Compte fournisseur et relevé d'opérations"}
            {supplier?.phone && ` • Tél: ${supplier.phone}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chargement du relevé...
          </div>
        ) : supplier ? (
          <div className="grid gap-4 py-2">
            {/* Balance Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    {t("totalInvoiced")}
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {formatDZD(Number(supplier.total_invoiced))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    {t("totalPaid")}
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatDZD(Number(supplier.total_paid))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border-primary/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    {t("balanceOwed")}
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      Number(supplier.balance_owed) > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-foreground"
                    }`}
                  >
                    {formatDZD(Number(supplier.balance_owed))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices and Payments Tabs */}
            <Tabs defaultValue="invoices" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoices">
                  Factures ({supplier.invoices.length})
                </TabsTrigger>
                <TabsTrigger value="payments">
                  Paiements ({supplier.payments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="invoices" className="pt-2">
                {supplier.invoices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Aucune facture enregistrée pour ce fournisseur.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">N° Facture</th>
                          <th className="p-2 text-right">Total TTC</th>
                          <th className="p-2 text-right">Payé</th>
                          <th className="p-2 text-right">Reste Dû</th>
                          <th className="p-2 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {supplier.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-muted/20">
                            <td className="p-2">{inv.invoice_date}</td>
                            <td className="p-2 font-medium">
                              {inv.is_credit_note && (
                                <span className="text-rose-600 mr-1">
                                  [Avoir]
                                </span>
                              )}
                              {inv.invoice_number}
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatDZD(Number(inv.total_incl_tax))}
                            </td>
                            <td className="p-2 text-right text-emerald-600">
                              {formatDZD(Number(inv.amount_paid))}
                            </td>
                            <td className="p-2 text-right font-medium text-rose-600">
                              {formatDZD(Number(inv.balance_remaining))}
                            </td>
                            <td className="p-2 text-center">
                              <Badge
                                variant={
                                  inv.payment_status === "paid"
                                    ? "default"
                                    : inv.payment_status === "partial"
                                      ? "secondary"
                                      : "destructive"
                                }
                                className="text-[10px]"
                              >
                                {inv.payment_status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="pt-2">
                {supplier.payments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Aucun paiement enregistré pour ce fournisseur.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">N° Facture liée</th>
                          <th className="p-2">Mode</th>
                          <th className="p-2">Réf / Chèque</th>
                          <th className="p-2 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {supplier.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/20">
                            <td className="p-2">{p.payment_date}</td>
                            <td className="p-2 font-medium">
                              {p.invoice_number ?? "—"}
                            </td>
                            <td className="p-2 capitalize">
                              {p.payment_method.replace("_", " ")}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {p.reference || p.notes || "—"}
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-600">
                              {formatDZD(Number(p.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
