import { useQuery } from "@tanstack/react-query"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { extractApiErrorMessage } from "@/lib/api/client"
import {
  inventoryApi,
  type LotCreate,
  productsApi,
  suppliersApi,
} from "@/lib/api/inventory"
import { formatLocalDate } from "@/lib/date"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface LotFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function LotFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: LotFormDialogProps) {
  const { t } = useTranslation()

  const { data: productsData } = useQuery({
    queryKey: queryKeys.products.list({ active_only: true }),
    queryFn: () => productsApi.list({ active_only: true, limit: 500 }),
    enabled: open,
  })

  const { data: suppliersData } = useQuery({
    queryKey: queryKeys.suppliers.list({ active_only: true }),
    queryFn: () => suppliersApi.list({ active_only: true, limit: 200 }),
    enabled: open,
  })

  const [form, setForm] = useState<LotCreate>({
    product_id: "",
    supplier_id: null,
    lot_number: "",
    expiration_date: "",
    received_date: formatLocalDate(new Date()),
    initial_quantity: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product_id) {
      toast.error("Veuillez choisir un produit.")
      return
    }
    setSubmitting(true)
    try {
      await inventoryApi.createLot({
        ...form,
        supplier_id: form.supplier_id || null,
        initial_quantity: form.initial_quantity || null,
      })
      toast.success(t("toastLotCreated"))
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un Lot de Réactif</DialogTitle>
          <DialogDescription>
            Associez un numéro de lot et une date de péremption pour le suivi
            qualité.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>{t("productName")} *</Label>
            <Select
              value={form.product_id}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, product_id: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un réactif..." />
              </SelectTrigger>
              <SelectContent>
                {productsData?.data
                  .filter((p) => p.track_lots)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("lotNumber")} *</Label>
            <Input
              required
              placeholder="Ex: LOT-2026-X81"
              value={form.lot_number}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, lot_number: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("receivedDate")} *</Label>
              <Input
                type="date"
                required
                value={form.received_date}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    received_date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("expirationDate")} *</Label>
              <Input
                type="date"
                required
                value={form.expiration_date}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    expiration_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Quantité Reçue (Optionnel)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 10"
                value={form.initial_quantity ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    initial_quantity: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("tabSuppliers")}</Label>
              <Select
                value={form.supplier_id ?? "none"}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    supplier_id: val === "none" ? null : val,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fournisseur..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non spécifié</SelectItem>
                  {suppliersData?.data.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      </DialogContent>
    </Dialog>
  )
}
