import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileDown } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  extractApiErrorMessage,
  type PaymentMethod,
  type Payslip,
  type PayslipStatus,
  payslipsApi,
} from "@/lib/hr-api"
import { formatDZD, MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface PayslipEditorDialogProps {
  payslip: Payslip | null
  onClose: () => void
}

function PayslipEditorBody({
  payslip,
  onClose,
}: {
  payslip: Payslip
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    base_salary: payslip.base_salary,
    performance_bonus: payslip.performance_bonus,
    other_allowances: payslip.other_allowances,
    overtime_pay: payslip.overtime_pay,
    absence_days: payslip.absence_days,
    absence_deduction: payslip.absence_deduction,
    other_deductions: payslip.other_deductions,
    worked_days: payslip.worked_days,
    vacation_days_taken: payslip.vacation_days_taken,
    payment_method: payslip.payment_method,
    status: payslip.status,
    notes: payslip.notes ?? "",
  })

  const updateMutation = useMutation({
    mutationFn: async (andDownloadPdf: boolean) => {
      const updated = await payslipsApi.update(payslip.id, {
        ...form,
        notes: form.notes || null,
      })
      if (andDownloadPdf) {
        await payslipsApi.downloadPdf(updated, false)
      }
      return updated
    },
    onSuccess: () => {
      toast.success(t("toastPayslipSaved"))
      queryClient.invalidateQueries({ queryKey: queryKeys.payslips.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      onClose()
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const liveGross =
    Number(form.base_salary) +
    Number(form.performance_bonus) +
    Number(form.other_allowances) +
    Number(form.overtime_pay)

  const liveDeductions =
    Number(form.absence_deduction) + Number(form.other_deductions)

  const liveNet = Math.max(0, liveGross - liveDeductions)

  return (
    <>
      <div className="grid gap-6 md:grid-cols-12 py-2">
        {/* Editable Inputs */}
        <div className="md:col-span-7 grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("baseSalary")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.base_salary}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    base_salary: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("bonusAmount")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.performance_bonus}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    performance_bonus: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("otherAllowances")}</Label>
              <Input
                data-testid="edit-other-allowances"
                type="number"
                step="0.01"
                value={form.other_allowances}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    other_allowances: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("overtimePay")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.overtime_pay}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    overtime_pay: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("absenceDays")}</Label>
              <Input
                type="number"
                step="0.5"
                value={form.absence_days}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    absence_days: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("absenceDeduction")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.absence_deduction}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    absence_deduction: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("otherDeductions")}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.other_deductions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    other_deductions: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("workedDays")}</Label>
              <Input
                type="number"
                step="0.5"
                value={form.worked_days}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    worked_days: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t("paymentMethod")}</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v: PaymentMethod) =>
                  setForm((prev) => ({ ...prev, payment_method: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">
                    {t("payBankTransfer")}
                  </SelectItem>
                  <SelectItem value="cash">{t("payCash")}</SelectItem>
                  <SelectItem value="check">{t("payCheck")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t("status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v: PayslipStatus) =>
                  setForm((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("statusDraft")}</SelectItem>
                  <SelectItem value="paid">{t("statusPaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{t("notes")}</Label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Live Calculation Preview */}
        <Card className="md:col-span-5 bg-muted/40 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-brand">
              {t("payslipPreviewTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("payslipPreviewBase")}
              </span>
              <span className="whitespace-nowrap">
                {formatDZD(form.base_salary)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("payslipPreviewBonus")}
              </span>
              <span className="text-green-600 whitespace-nowrap">
                +{formatDZD(form.performance_bonus)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {t("payslipPreviewAllowances")}
              </span>
              <span className="whitespace-nowrap">
                +{formatDZD(form.other_allowances + form.overtime_pay)}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t pt-2 font-medium">
              <span>{t("grossSalary")}</span>
              <span className="whitespace-nowrap">{formatDZD(liveGross)}</span>
            </div>
            <div className="flex justify-between gap-3 text-destructive">
              <span>{t("payslipPreviewDeductions")}</span>
              <span className="whitespace-nowrap">
                -{formatDZD(liveDeductions)}
              </span>
            </div>
            <div className="mt-4 rounded-md bg-brand-deep p-3.5 text-white flex items-center justify-between gap-3">
              <span className="font-semibold whitespace-nowrap">
                {t("netSalary")}
              </span>
              <span
                className="text-lg font-bold whitespace-nowrap"
                data-testid="edit-live-net"
              >
                {formatDZD(liveNet)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <LoadingButton
          variant="secondary"
          loading={updateMutation.isPending}
          onClick={() => updateMutation.mutate(false)}
        >
          {t("save")}
        </LoadingButton>
        <LoadingButton
          loading={updateMutation.isPending}
          onClick={() => updateMutation.mutate(true)}
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          {t("save")} & {t("downloadPdf")}
        </LoadingButton>
      </DialogFooter>
    </>
  )
}

export function PayslipEditorDialog({
  payslip,
  onClose,
}: PayslipEditorDialogProps) {
  const { t, lang } = useTranslation()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  return (
    <Dialog open={payslip !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("payslipEditorTitle")} — {payslip?.employee_name} (
            {payslip ? months[payslip.month - 1] : ""} {payslip?.year})
          </DialogTitle>
          <DialogDescription>{t("payslipEditorDesc")}</DialogDescription>
        </DialogHeader>
        {payslip ? (
          <PayslipEditorBody
            key={`${payslip.id}-${payslip.updated_at}`}
            payslip={payslip}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
