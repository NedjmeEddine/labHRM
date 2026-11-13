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
  inventoryApi,
  type MovementType,
  productsApi,
  type StockMovementCreate,
} from "@/lib/api/inventory"
import { formatLocalDate } from "@/lib/date"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface ManualMovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ManualMovementDialog({
  open,
  onOpenChange,
  onSuccess,
}: ManualMovementDialogProps) {
  const { t } = useTranslation()

  const { data: productsData } = useQuery({
    queryKey: queryKeys.products.list({ active_only: true }),
    queryFn: () => productsApi.list({ active_only: true, limit: 500 }),
    enabled: open,
  })

  const [productId, setProductId] = useState("")
  const [movementType, setMovementType] = useState<MovementType>("out")
  const [quantity, setQuantity] = useState("1")
  const [movementDate, setMovementDate] = useState(() =>
    formatLocalDate(new Date()),
  )
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const selectedProduct = productsData?.data.find((p) => p.id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) {
      toast.error("Veuillez sélectionner un produit.")
      return
    }
    if (!reason.trim()) {
      toast.error("Un motif est obligatoire pour tout mouvement manuel.")
      return
    }
    setSubmitting(true)
    try {
      const payload: StockMovementCreate = {
        product_id: productId,
        movement_type: movementType,
        quantity: quantity,
        movement_date: movementDate,
        reason: reason.trim(),
      }
      await inventoryApi.recordMovement(payload)
      toast.success(t("toastMovementRecorded"))
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
          <DialogTitle>{t("manualStockMovement")}</DialogTitle>
          <DialogDescription>
            Déclarez une consommation de paillasse, une perte ou un ajustement
            d'inventaire physique.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>{t("productName")} *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un produit..." />
              </SelectTrigger>
              <SelectContent>
                {productsData?.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (Stock actuel :{" "}
                    {Number(p.current_stock).toFixed(2)} {p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("type")} de mouvement *</Label>
              <Select
                value={movementType}
                onValueChange={(val: MovementType) => setMovementType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">{t("movementOut")}</SelectItem>
                  <SelectItem value="in">{t("movementIn")}</SelectItem>
                  <SelectItem value="adjustment">
                    {t("movementAdjustment")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Quantité ({selectedProduct?.unit || "unités"}) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("date")} *</Label>
            <Input
              type="date"
              required
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("reason")} (Obligatoire) *</Label>
            <Textarea
              required
              rows={2}
              placeholder="Ex: Analyse de routine, Flacon cassé, Contrôle qualité..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
