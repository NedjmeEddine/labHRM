import { useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
  invoicesApi,
  type PaymentCreate,
  type PaymentMethod,
  type PurchaseInvoice,
} from "@/lib/api/inventory"
import { formatLocalDate } from "@/lib/date"
import { formatDZD, useTranslation } from "@/lib/i18n"

interface PaymentDialogProps {
  invoice: PurchaseInvoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: PaymentDialogProps) {
  const { t } = useTranslation()

  const [form, setForm] = useState<PaymentCreate>({
    invoice_id: invoice?.id ?? "",
    supplier_id: invoice?.supplier_id ?? "",
    payment_date: formatLocalDate(new Date()),
    amount: invoice?.balance_remaining ?? "0.00",
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)

  if (!invoice) return null

  const remaining = Number(invoice.balance_remaining)
  const enteredAmount = Number(form.amount) || 0
  const isOverpaying = enteredAmount > remaining && remaining > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await invoicesApi.recordPayment(invoice.id, {
        ...form,
        invoice_id: invoice.id,
        supplier_id: invoice.supplier_id,
        amount: String(enteredAmount),
      })
      toast.success(t("toastPaymentRecorded"))
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Erreur lors du paiement"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recordPayment")}</DialogTitle>
          <DialogDescription>
            Paiement pour la facture{" "}
            <strong className="text-foreground">
              {invoice.invoice_number}
            </strong>{" "}
            ({invoice.supplier_name}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="bg-muted/40 p-3 rounded-lg flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Reste à payer :</span>
            <span className="font-bold text-foreground font-mono text-sm">
              {formatDZD(remaining)}
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label>Montant du Paiement (DZD) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
          </div>

          {isOverpaying && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>
                Attention : Le montant saisi ({formatDZD(enteredAmount)})
                dépasse le solde restant dû de la facture (
                {formatDZD(remaining)}).
              </AlertDescription>
            </Alert>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("date")} *</Label>
              <Input
                type="date"
                required
                value={form.payment_date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, payment_date: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("paymentMethod")} *</Label>
              <Select
                value={form.payment_method}
                onValueChange={(val: PaymentMethod) =>
                  setForm((prev) => ({ ...prev, payment_method: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">
                    {t("payBankTransfer")}
                  </SelectItem>
                  <SelectItem value="check">{t("payCheck")}</SelectItem>
                  <SelectItem value="cash">{t("payCash")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>N° de Chèque / Référence virement</Label>
            <Input
              placeholder="Ex: CHQ-104928 BNA"
              value={form.reference ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reference: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("notes")}</Label>
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
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
      </DialogContent>
    </Dialog>
  )
}
