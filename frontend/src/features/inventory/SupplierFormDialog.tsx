import { useState } from "react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import { extractApiErrorMessage } from "@/lib/api/client"
import {
  type Supplier,
  type SupplierCreate,
  type SupplierUpdate,
  suppliersApi,
} from "@/lib/api/inventory"
import { useTranslation } from "@/lib/i18n"

interface SupplierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierToEdit?: Supplier | null
  onSuccess: () => void
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplierToEdit,
  onSuccess,
}: SupplierFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = Boolean(supplierToEdit)

  const [form, setForm] = useState<SupplierCreate>({
    name: supplierToEdit?.name ?? "",
    contact_person: supplierToEdit?.contact_person ?? "",
    phone: supplierToEdit?.phone ?? "",
    email: supplierToEdit?.email ?? "",
    address: supplierToEdit?.address ?? "",
    tax_id: supplierToEdit?.tax_id ?? "",
    statistical_id: supplierToEdit?.statistical_id ?? "",
    trade_registry: supplierToEdit?.trade_registry ?? "",
    payment_terms: supplierToEdit?.payment_terms ?? "",
    notes: supplierToEdit?.notes ?? "",
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (isEditing && supplierToEdit) {
        await suppliersApi.update(supplierToEdit.id, form as SupplierUpdate)
        toast.success(t("toastSupplierUpdated"))
      } else {
        await suppliersApi.create(form)
        toast.success(t("toastSupplierCreated"))
      }
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("edit") : t("newSupplier")}</DialogTitle>
          <DialogDescription>
            {t("supplierName")}, identifiants fiscaux (NIF/NIS/RC) et
            coordonnées.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="supp-name-input">{t("supplierName")} *</Label>
              <Input
                id="supp-name-input"
                data-testid="supplier-name-input"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supp-contact-input">{t("contactPerson")}</Label>
              <Input
                id="supp-contact-input"
                data-testid="contact-person-input"
                value={form.contact_person ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    contact_person: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="supp-phone-input">{t("phone")}</Label>
              <Input
                id="supp-phone-input"
                data-testid="supplier-phone-input"
                value={form.phone ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supp-email-input">{t("email")}</Label>
              <Input
                id="supp-email-input"
                type="email"
                value={form.email ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="supp-address-input">{t("address")}</Label>
            <Input
              id="supp-address-input"
              value={form.address ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
            <div className="grid gap-1.5">
              <Label htmlFor="supp-tax-id" className="text-xs">
                NIF (Identifiant Fiscal)
              </Label>
              <Input
                id="supp-tax-id"
                value={form.tax_id ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tax_id: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supp-nis" className="text-xs">
                NIS (Statistique)
              </Label>
              <Input
                id="supp-nis"
                value={form.statistical_id ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    statistical_id: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supp-rc" className="text-xs">
                RC (Registre Commerce)
              </Label>
              <Input
                id="supp-rc"
                value={form.trade_registry ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    trade_registry: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="supp-terms-input">{t("paymentTerms")}</Label>
            <Input
              id="supp-terms-input"
              data-testid="payment-terms-input"
              placeholder="Ex: 30 jours fin de mois, Virement BNA..."
              value={form.payment_terms ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, payment_terms: e.target.value }))
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
