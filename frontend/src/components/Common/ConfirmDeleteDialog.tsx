import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslation } from "@/lib/i18n"

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
  itemLabel?: string
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  itemLabel,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmDelete")}</DialogTitle>
          <DialogDescription>
            {itemLabel ? `${itemLabel} — ` : ""}
            {t("confirmDeleteDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <LoadingButton
            type="button"
            variant="destructive"
            loading={loading}
            onClick={onConfirm}
          >
            {t("delete")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
