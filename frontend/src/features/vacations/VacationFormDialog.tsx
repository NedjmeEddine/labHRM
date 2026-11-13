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
import { formatLocalDate } from "@/lib/date"
import {
  type Employee,
  extractApiErrorMessage,
  type VacationStatus,
  type VacationType,
  vacationsApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface VacationFormDialogProps {
  open: boolean
  employees: Employee[]
  onOpenChange: (open: boolean) => void
}

function VacationFormBody({
  employees,
  onClose,
}: {
  employees: Employee[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const today = formatLocalDate()

  const [empId, setEmpId] = useState(employees[0]?.id ?? "")
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [vacType, setVacType] = useState<VacationType>("annual")
  const [status, setStatus] = useState<VacationStatus>("approved")
  const [notes, setNotes] = useState("")

  const createMutation = useMutation({
    mutationFn: () => {
      if (!empId) {
        throw new Error(t("selectEmployee"))
      }
      return vacationsApi.create({
        employee_id: empId,
        start_date: startDate,
        end_date: endDate,
        vacation_type: vacType,
        status,
        notes: notes || null,
      })
    },
    onSuccess: () => {
      toast.success(t("toastVacationSaved"))
      queryClient.invalidateQueries({ queryKey: queryKeys.vacations.all })
      queryClient.invalidateQueries({ queryKey: ["vacation-balances"] })
      queryClient.invalidateQueries({ queryKey: ["vacations-month"] })
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
          <Label>{t("startDate")} *</Label>
          <Input
            data-testid="vac-start"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("endDate")} *</Label>
          <Input
            data-testid="vac-end"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("type")}</Label>
          <Select
            value={vacType}
            onValueChange={(v: VacationType) => setVacType(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">{t("vacAnnual")}</SelectItem>
              <SelectItem value="sick">{t("vacSick")}</SelectItem>
              <SelectItem value="unpaid">{t("vacUnpaid")}</SelectItem>
              <SelectItem value="other">{t("vacOther")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("status")}</Label>
          <Select
            value={status}
            onValueChange={(v: VacationStatus) => setStatus(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">{t("statusApproved")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("notes")}</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
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

export function VacationFormDialog({
  open,
  employees,
  onOpenChange,
}: VacationFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addVacation")}</DialogTitle>
        </DialogHeader>
        {open ? (
          <VacationFormBody
            key={employees[0]?.id ?? "empty"}
            employees={employees}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
