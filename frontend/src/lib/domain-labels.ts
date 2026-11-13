import type {
  AbsenceType,
  EmployeeStatus,
  PaymentMethod,
  PayslipStatus,
  VacationStatus,
  VacationType,
} from "@/lib/hr-api"
import type { TranslateFn } from "@/lib/i18n"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export function getEmployeeStatusDisplay(
  status: EmployeeStatus | string,
  t: TranslateFn,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "active":
      return { label: t("statusActive"), variant: "default" }
    case "on_leave":
      return { label: t("statusOnLeave"), variant: "secondary" }
    case "terminated":
      return { label: t("statusTerminated"), variant: "destructive" }
    default:
      return { label: status, variant: "outline" }
  }
}

export function getAbsenceTypeLabel(
  type: AbsenceType | string,
  t: TranslateFn,
): string {
  switch (type) {
    case "unjustified":
      return t("absUnjustified")
    case "sick":
      return t("absSick")
    case "justified":
      return t("absJustified")
    case "half_day":
      return t("absHalfDay")
    default:
      return type
  }
}

export function getVacationTypeLabel(
  type: VacationType | string,
  t: TranslateFn,
): string {
  switch (type) {
    case "annual":
      return t("vacAnnual")
    case "sick":
      return t("vacSick")
    case "unpaid":
      return t("vacUnpaid")
    case "other":
      return t("vacOther")
    default:
      return type
  }
}

export function getVacationStatusDisplay(
  status: VacationStatus | string,
  t: TranslateFn,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "approved":
      return { label: t("statusApproved"), variant: "default" }
    case "pending":
      return { label: t("statusPending"), variant: "secondary" }
    case "rejected":
      return { label: t("statusRejected"), variant: "destructive" }
    default:
      return { label: status, variant: "outline" }
  }
}

export function getPayslipStatusDisplay(
  status: PayslipStatus | string,
  t: TranslateFn,
): { label: string; variant: BadgeVariant } {
  return status === "paid"
    ? { label: t("statusPaid"), variant: "default" }
    : { label: t("statusDraft"), variant: "secondary" }
}

export function getPaymentMethodLabel(
  method: PaymentMethod | string,
  t: TranslateFn,
): string {
  switch (method) {
    case "bank_transfer":
      return t("payBankTransfer")
    case "cash":
      return t("payCash")
    case "check":
      return t("payCheck")
    default:
      return method
  }
}

export function getProductCategoryLabel(
  category: string,
  t: TranslateFn,
): string {
  switch (category) {
    case "reagent":
      return t("catReagent")
    case "consumable":
      return t("catConsumable")
    case "equipment":
      return t("catEquipment")
    case "other":
      return t("catOther")
    default:
      return category
  }
}

export function getInvoiceStatusDisplay(
  status: string,
  t: TranslateFn,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "confirmed":
      return { label: t("invoiceConfirmed"), variant: "default" }
    case "draft":
      return { label: t("invoiceDraft"), variant: "secondary" }
    case "cancelled":
      return { label: t("invoiceCancelled"), variant: "destructive" }
    default:
      return { label: status, variant: "outline" }
  }
}

export function getInvoicePaymentStatusDisplay(
  status: string,
  t: TranslateFn,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "paid":
      return { label: t("payStatusPaid"), variant: "default" }
    case "partial":
      return { label: t("payStatusPartial"), variant: "secondary" }
    case "unpaid":
      return { label: t("payStatusUnpaid"), variant: "destructive" }
    default:
      return { label: status, variant: "outline" }
  }
}

export function getMovementTypeLabel(type: string, t: TranslateFn): string {
  switch (type) {
    case "in":
      return t("movementIn")
    case "out":
      return t("movementOut")
    case "adjustment":
      return t("movementAdjustment")
    default:
      return type
  }
}
