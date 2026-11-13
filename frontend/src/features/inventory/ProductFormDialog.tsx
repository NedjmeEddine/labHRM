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
import { Textarea } from "@/components/ui/textarea"
import { extractApiErrorMessage } from "@/lib/api/client"
import {
  type Product,
  type ProductCategory,
  type ProductCreate,
  type ProductUpdate,
  productsApi,
  suppliersApi,
} from "@/lib/api/inventory"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productToEdit?: Product | null
  onSuccess: (createdProduct?: Product) => void
}

export function ProductFormDialog({
  open,
  onOpenChange,
  productToEdit,
  onSuccess,
}: ProductFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = Boolean(productToEdit)

  const { data: suppliersData } = useQuery({
    queryKey: queryKeys.suppliers.list({ active_only: true }),
    queryFn: () => suppliersApi.list({ active_only: true, limit: 200 }),
    enabled: open,
  })

  const [form, setForm] = useState<ProductCreate>({
    name: productToEdit?.name ?? "",
    reference_code: productToEdit?.reference_code ?? "",
    category: productToEdit?.category ?? "reagent",
    unit: productToEdit?.unit ?? "boîte",
    usual_supplier_id: productToEdit?.usual_supplier_id ?? null,
    track_lots: productToEdit?.track_lots ?? true,
    min_stock: productToEdit?.min_stock ?? "",
    storage_location: productToEdit?.storage_location ?? "",
    notes: productToEdit?.notes ?? "",
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload: ProductCreate = {
        ...form,
        reference_code: form.reference_code?.trim() || null,
        min_stock: form.min_stock ? String(form.min_stock) : null,
        usual_supplier_id: form.usual_supplier_id || null,
      }
      if (isEditing && productToEdit) {
        const updated = await productsApi.update(
          productToEdit.id,
          payload as ProductUpdate,
        )
        toast.success(t("toastProductUpdated"))
        onSuccess(updated)
      } else {
        const created = await productsApi.create(payload)
        toast.success(t("toastProductCreated"))
        onSuccess(created)
      }
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
          <DialogTitle>{isEditing ? t("edit") : t("newProduct")}</DialogTitle>
          <DialogDescription>
            {t("productName")}, conditionnement, seuil minimum et fournisseur
            habituel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-name-input">{t("productName")} *</Label>
              <Input
                id="prod-name-input"
                data-testid="product-name-input"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-ref-input">{t("referenceCode")}</Label>
              <Input
                id="prod-ref-input"
                data-testid="product-ref-input"
                placeholder="Ex: REAC-GLU-01"
                value={form.reference_code ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    reference_code: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("type")} / Catégorie</Label>
              <Select
                value={form.category}
                onValueChange={(val: ProductCategory) =>
                  setForm((prev) => ({
                    ...prev,
                    category: val,
                    track_lots: val === "reagent",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reagent">{t("catReagent")}</SelectItem>
                  <SelectItem value="consumable">
                    {t("catConsumable")}
                  </SelectItem>
                  <SelectItem value="equipment">{t("catEquipment")}</SelectItem>
                  <SelectItem value="other">{t("catOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("unit")}</Label>
              <Input
                placeholder="Ex: boîte, flacon, kit, pièce..."
                value={form.unit}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unit: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("usualSupplier")}</Label>
            <Select
              value={form.usual_supplier_id ?? "none"}
              onValueChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  usual_supplier_id: val === "none" ? null : val,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un fournisseur..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun / Non spécifié</SelectItem>
                {suppliersData?.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
            <div className="grid gap-1.5">
              <Label>{t("minStock")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 5"
                value={form.min_stock ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, min_stock: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("storageLocation")}</Label>
              <Input
                placeholder="Ex: Frigo 4°C, Étagère B3..."
                value={form.storage_location ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    storage_location: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="trackLotsCheck"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={form.track_lots}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, track_lots: e.target.checked }))
              }
            />
            <Label htmlFor="trackLotsCheck" className="text-sm cursor-pointer">
              {t("trackLots")} (recommandé pour les réactifs et contrôles)
            </Label>
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
