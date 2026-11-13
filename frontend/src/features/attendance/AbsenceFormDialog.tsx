import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
  type AbsenceType,
  absencesApi,
  type Employee,
  extractApiErrorMessage,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface AbsenceFormDialogProps {
  mode: "single" | "range" | null
  defaultEmployeeId: string
  defaultDate: string
  employees: Employee[]
  onClose: () => void
}

function AbsenceFormBody({
  mode,
  defaultEmployeeId,
  defaultDate,
  employees,
  onClose,
}: {
  mode: "single" | "range"
  defaultEmployeeId: string
  defaultDate: string
  employees: Employee[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [empId, setEmpId] = useState(defaultEmployeeId)
  const [date, setDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState(defaultDate)
  const [absenceType, setAbsenceType] = useState<AbsenceType>("unjustified")
  const [isPaid, setIsPaid] = useState(false)
  const [reason, setReason] = useState("")

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!empId) {
        throw new Error(t("selectEmployee"))
      }
      if (mode === "range") {
        return absencesApi.createRange({
          employee_id: empId,
          start_date: date,
          end_date: endDate,
          absence_type: absenceType,
          is_paid: isPaid,
          reason: reason || null,
        })
      }
      return absencesApi.create({
        employee_id: empId,
        date,
        absence_type: absenceType,
        is_paid: isPaid,
        reason: reason || null,
      })
    },
    onSuccess: () => {
      toast.success(t("toastAbsenceSaved"))
      queryClient.invalidateQueries({ queryKey: queryKeys.absences.all })
      queryClient.invalidateQueries({ queryKey: ["absences-month"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      onClose()
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createMutation.mutate()
      }}
      className="grid gap-4 py-2"
    >
      <div className="grid gap-1.5">
        <Label>{t("selectEmployee")} *</Label>
        <Select value={empId} onValueChange={setEmpId}>
          <SelectTrigger>
            <SelectValue placeholder={t("selectEmployee")} />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.employee_code} — {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{mode === "range" ? t("startDate") : t("date")}</Label>
          <Input
            data-testid="absence-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {mode === "range" ? (
          <div className="grid gap-1.5">
            <Label>{t("endDate")}</Label>
            <Input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("type")}</Label>
          <Select
            value={absenceType}
            onValueChange={(v: AbsenceType) => {
              setAbsenceType(v)
              setIsPaid(v === "justified" || v === "sick")
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unjustified">{t("absUnjustified")}</SelectItem>
              <SelectItem value="sick">{t("absSick")}</SelectItem>
              <SelectItem value="justified">{t("absJustified")}</SelectItem>
              <SelectItem value="half_day">{t("absHalfDay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("paid")} ?</Label>
          <Select
            value={isPaid ? "yes" : "no"}
            onValueChange={(v) => setIsPaid(v === "yes")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">{t("unpaidWithDeduction")}</SelectItem>
              <SelectItem value="yes">{t("paid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("reason")}</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <LoadingButton type="submit" loading={createMutation.isPending}>
          {t("save")}
        </LoadingButton>
      </DialogFooter>
    </form>
  )
}

export function AbsenceFormDialog({
  mode,
  defaultEmployeeId,
  defaultDate,
  employees,
  onClose,
}: AbsenceFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "range" ? t("markRange") : t("markSingle")}
          </DialogTitle>
        </DialogHeader>
        {mode !== null ? (
          <AbsenceFormBody
            key={`${mode}-${defaultEmployeeId}-${defaultDate}`}
            mode={mode}
            defaultEmployeeId={defaultEmployeeId}
            defaultDate={defaultDate}
            employees={employees}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
