import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Plus, Trash2, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { extractApiErrorMessage } from "@/lib/api/client"
import {
  type InvoiceLineCreate,
  invoicesApi,
  type PurchaseInvoiceCreate,
  productsApi,
  suppliersApi,
} from "@/lib/api/inventory"
import { formatLocalDate } from "@/lib/date"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { ProductFormDialog } from "./ProductFormDialog"

interface InvoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  inventoryTrackingEnabled: boolean
}

interface FormLineState {
  productId: string
  quantity: string
  unitPrice: string
  tvaRate: string
  discount: string
  lotNumber: string
  expirationDate: string
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  inventoryTrackingEnabled,
}: InvoiceFormDialogProps) {
  const { t } = useTranslation()

  const { data: suppliersData } = useQuery({
    queryKey: queryKeys.suppliers.list({ active_only: true }),
    queryFn: () => suppliersApi.list({ active_only: true, limit: 200 }),
    enabled: open,
  })

  const { data: productsData } = useQuery({
    queryKey: queryKeys.products.list({ active_only: true }),
    queryFn: () => productsApi.list({ active_only: true, limit: 500 }),
    enabled: open,
  })

  const [supplierId, setSupplierId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(() =>
    formatLocalDate(new Date()),
  )
  const [dueDate, setDueDate] = useState("")
  const [supplierStatedTotal, setSupplierStatedTotal] = useState("")
  const [isCreditNote, setIsCreditNote] = useState(false)
  const [notes, setNotes] = useState("")
  const [scanFile, setScanFile] = useState<File | null>(null)

  const [lines, setLines] = useState<FormLineState[]>([
    {
      productId: "",
      quantity: "1",
      unitPrice: "0",
      tvaRate: "19.00",
      discount: "0",
      lotNumber: "",
      expirationDate: "",
    },
  ])

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Calculations
  const computedTotals = lines.reduce(
    (acc, line) => {
      const qty = Number(line.quantity) || 0
      const price = Number(line.unitPrice) || 0
      const disc = Number(line.discount) || 0
      const tva = Number(line.tvaRate) || 0

      const lineExcl = Math.max(0, qty * price - disc)
      const lineTva = lineExcl * (tva / 100)
      const lineIncl = lineExcl + lineTva

      return {
        excl: acc.excl + lineExcl,
        tva: acc.tva + lineTva,
        incl: acc.incl + lineIncl,
      }
    },
    { excl: 0, tva: 0, incl: 0 },
  )

  const statedNumber = Number(supplierStatedTotal) || 0
  const hasStatedDiff =
    statedNumber > 0 && Math.abs(statedNumber - computedTotals.incl) > 0.05

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: "",
        quantity: "1",
        unitPrice: "0",
        tvaRate: "19.00",
        discount: "0",
        lotNumber: "",
        expirationDate: "",
      },
    ])
  }

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleLineChange = (
    index: number,
    field: keyof FormLineState,
    value: string,
  ) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) {
      toast.error("Veuillez sélectionner un fournisseur.")
      return
    }
    if (!invoiceNumber.trim()) {
      toast.error("Veuillez renseigner le numéro de facture.")
      return
    }
    const hasEmptyProduct = lines.some((l) => !l.productId)
    if (hasEmptyProduct) {
      toast.error("Veuillez sélectionner un produit pour chaque ligne.")
      return
    }

    setSubmitting(true)
    try {
      const apiLines: InvoiceLineCreate[] = lines.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
        unit_price_excl_tax: l.unitPrice,
        tva_rate: l.tvaRate,
        discount_amount: l.discount || "0",
        lot_number: l.lotNumber?.trim() || null,
        expiration_date: l.expirationDate || null,
      }))

      const payload: PurchaseInvoiceCreate = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        supplier_stated_total: statedNumber > 0 ? String(statedNumber) : null,
        is_credit_note: isCreditNote,
        notes: notes.trim() || null,
        lines: apiLines,
      }

      const created = await invoicesApi.create(payload)

      // Upload scan if selected
      if (scanFile) {
        try {
          await invoicesApi.uploadScan(created.id, scanFile)
          toast.success(t("toastScanUploaded"))
        } catch (_uploadErr) {
          toast.error("Facture créée, mais échec du téléversement du scan.")
        }
      }

      toast.success(t("toastInvoiceCreated"))
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("newInvoice")}</DialogTitle>
            {isCreditNote && (
              <Badge variant="destructive">Facture d'Avoir</Badge>
            )}
          </div>
          <DialogDescription>
            Saisissez les lignes avec TVA pour calculer automatiquement les
            totaux et mettre à jour le compte fournisseur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* Invoice Header Details */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("tabSuppliers")} *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir fournisseur..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliersData?.data.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("invoiceNumber")} *</Label>
              <Input
                required
                placeholder="Ex: FAC-2026-081"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("invoiceDate")} *</Label>
              <Input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("dueDate")}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("statedTotal")} (DZD)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Total affiché sur papier"
                value={supplierStatedTotal}
                onChange={(e) => setSupplierStatedTotal(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="isCreditNoteCheck"
                className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                checked={isCreditNote}
                onChange={(e) => setIsCreditNote(e.target.checked)}
              />
              <Label
                htmlFor="isCreditNoteCheck"
                className="text-sm cursor-pointer"
              >
                {t("isCreditNote")}
              </Label>
            </div>
          </div>

          {/* Stated total mismatch warning banner (Non-blocking) */}
          {hasStatedDiff && (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold">
                Écart de montant détecté (Non bloquant)
              </AlertTitle>
              <AlertDescription className="text-xs">
                Le total annoncé sur la facture ({formatDZD(statedNumber)})
                diffère du total calculé des lignes (
                {formatDZD(computedTotals.incl)}) de{" "}
                <strong>
                  {formatDZD(Math.abs(statedNumber - computedTotals.incl))}
                </strong>
                .
              </AlertDescription>
            </Alert>
          )}

          {/* Invoice Lines Table */}
          <div className="border rounded-md p-3 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-sm">
                Lignes d'articles ({lines.length})
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setProductModalOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Nouveau Produit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAddLine}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter Ligne
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="p-2 min-w-[180px]">Produit / Réactif</th>
                    <th className="p-2 w-20 text-center">Quantité</th>
                    <th className="p-2 w-28 text-right">Prix Unit. HT</th>
                    <th className="p-2 w-24 text-center">TVA</th>
                    <th className="p-2 w-24 text-right">Remise</th>
                    <th className="p-2 w-28 text-right">Total TTC</th>
                    {inventoryTrackingEnabled && (
                      <>
                        <th className="p-2 w-28">N° Lot</th>
                        <th className="p-2 w-28">Péremption</th>
                      </>
                    )}
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, idx) => {
                    const qty = Number(line.quantity) || 0
                    const price = Number(line.unitPrice) || 0
                    const disc = Number(line.discount) || 0
                    const tva = Number(line.tvaRate) || 0
                    const excl = Math.max(0, qty * price - disc)
                    const incl = excl * (1 + tva / 100)

                    return (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="p-1.5">
                          <Select
                            value={line.productId}
                            onValueChange={(val) =>
                              handleLineChange(idx, "productId", val)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Choisir un produit..." />
                            </SelectTrigger>
                            <SelectContent>
                              {productsData?.data.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="h-8 text-center text-xs"
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(idx, "quantity", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-right text-xs"
                            value={line.unitPrice}
                            onChange={(e) =>
                              handleLineChange(idx, "unitPrice", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Select
                            value={line.tvaRate}
                            onValueChange={(val) =>
                              handleLineChange(idx, "tvaRate", val)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="19.00">19%</SelectItem>
                              <SelectItem value="9.00">9%</SelectItem>
                              <SelectItem value="0.00">0% (Exonéré)</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-right text-xs"
                            value={line.discount}
                            onChange={(e) =>
                              handleLineChange(idx, "discount", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-foreground">
                          {formatDZD(incl)}
                        </td>
                        {inventoryTrackingEnabled && (
                          <>
                            <td className="p-1.5">
                              <Input
                                placeholder="N° Lot"
                                className="h-8 text-xs"
                                value={line.lotNumber}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    "lotNumber",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                className="h-8 text-xs"
                                value={line.expirationDate}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    "expirationDate",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                          </>
                        )}
                        <td className="p-1.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length <= 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Computed Summary Row */}
            <div className="flex flex-wrap items-center justify-end gap-6 pt-2 border-t text-xs">
              <div>
                <span className="text-muted-foreground mr-1.5">
                  {t("totalExclTax")} :
                </span>
                <span className="font-bold font-mono">
                  {formatDZD(computedTotals.excl)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground mr-1.5">
                  {t("totalTva")} :
                </span>
                <span className="font-bold font-mono">
                  {formatDZD(computedTotals.tva)}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-foreground mr-1.5">
                  {t("totalInclTax")} :
                </span>
                <span className="font-bold font-mono text-primary text-base">
                  {formatDZD(computedTotals.incl)}
                </span>
              </div>
            </div>
          </div>

          {/* Paper scan upload */}
          <div className="grid sm:grid-cols-2 gap-4 border-t pt-3">
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="h-4 w-4" />
                {t("uploadScan")} (PDF ou Photo)
              </Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setScanFile(file)
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("notes")}</Label>
              <Textarea
                rows={2}
                placeholder="Observations, bon de commande..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <LoadingButton type="submit" loading={submitting}>
              {t("save")}
            </LoadingButton>
          </DialogFooter>
        </form>

        {productModalOpen && (
          <ProductFormDialog
            open={productModalOpen}
            onOpenChange={setProductModalOpen}
            onSuccess={(created) => {
              if (created) {
                // Set the newly created product in the last line
                setLines((prev) => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    productId: created.id,
                  }
                  return updated
                })
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
