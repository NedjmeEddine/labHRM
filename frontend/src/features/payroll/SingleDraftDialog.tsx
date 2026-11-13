import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
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
  type Employee,
  extractApiErrorMessage,
  type Payslip,
  payslipsApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface SingleDraftDialogProps {
  open: boolean
  month: number
  year: number
  employees: Employee[]
  onOpenChange: (open: boolean) => void
  onDraftReady: (ps: Payslip) => void
}

function SingleDraftBody({
  month,
  year,
  employees,
  onClose,
  onDraftReady,
}: {
  month: number
  year: number
  employees: Employee[]
  onClose: () => void
  onDraftReady: (ps: Payslip) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [empId, setEmpId] = useState(employees[0]?.id ?? "")
  const [overwrite, setOverwrite] = useState(true)

  const mutation = useMutation({
    mutationFn: () => {
      if (!empId) {
        throw new Error(t("selectEmployee"))
      }
      return payslipsApi.generateDraft({
        employee_id: empId,
        month,
        year,
        overwrite,
      })
    },
    onSuccess: (ps) => {
      toast.success(`${t("toastPayslipReadyFor")} ${ps.employee_name}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.payslips.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      onClose()
      onDraftReady(ps)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
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
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
        />
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{t("overwriteDraft")}</span>
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <LoadingButton type="submit" loading={mutation.isPending}>
          {t("generateSingle")}
        </LoadingButton>
      </DialogFooter>
    </form>
  )
}

export function SingleDraftDialog({
  open,
  month,
  year,
  employees,
  onOpenChange,
  onDraftReady,
}: SingleDraftDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateSingle")}</DialogTitle>
        </DialogHeader>
        {open ? (
          <SingleDraftBody
            key={employees[0]?.id ?? "empty"}
            month={month}
            year={year}
            employees={employees}
            onClose={() => onOpenChange(false)}
            onDraftReady={onDraftReady}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
