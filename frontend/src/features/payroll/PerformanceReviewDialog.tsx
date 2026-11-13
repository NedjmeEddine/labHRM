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
  type Employee,
  extractApiErrorMessage,
  performanceApi,
} from "@/lib/hr-api"
import { formatDZD, MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface PerformanceReviewDialogProps {
  open: boolean
  month: number
  year: number
  employees: Employee[]
  onOpenChange: (open: boolean) => void
}

function getSuggestedBonus(
  employees: Employee[],
  empId: string,
  score: number,
): number {
  const emp = employees.find((e) => e.id === empId)
  if (!emp) return 0
  const ratio = score === 5 ? 0.15 : score === 4 ? 0.1 : score === 3 ? 0.05 : 0
  return Math.round(emp.base_salary * ratio)
}

function PerformanceReviewBody({
  month,
  year,
  employees,
  onClose,
}: {
  month: number
  year: number
  employees: Employee[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const firstEmpId = employees[0]?.id ?? ""

  const [empId, setEmpId] = useState(firstEmpId)
  const [score, setScore] = useState(4)
  const [bonus, setBonus] = useState(() =>
    getSuggestedBonus(employees, firstEmpId, 4),
  )
  const [newSalary, setNewSalary] = useState("")
  const [notes, setNotes] = useState("")

  const createMutation = useMutation({
    mutationFn: () => {
      if (!empId) {
        throw new Error(t("selectEmployee"))
      }
      return performanceApi.create({
        employee_id: empId,
        period_month: month,
        period_year: year,
        score,
        bonus_amount: bonus,
        new_base_salary: newSalary ? Number(newSalary) : null,
        notes: notes || null,
      })
    },
    onSuccess: () => {
      toast.success(t("toastReviewSaved"))
      queryClient.invalidateQueries({ queryKey: queryKeys.performance.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
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
        <Select
          value={empId}
          onValueChange={(v) => {
            setEmpId(v)
            setBonus(getSuggestedBonus(employees, v, score))
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("selectEmployee")} />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.employee_code} — {emp.full_name} (
                {formatDZD(emp.base_salary)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("score")}</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={score === s ? "default" : "outline"}
              onClick={() => {
                setScore(s)
                setBonus(getSuggestedBonus(employees, empId, s))
              }}
            >
              {s} ★
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("bonusAmount")}</Label>
        <Input
          data-testid="perf-bonus-input"
          type="number"
          step="0.01"
          min={0}
          value={bonus}
          onChange={(e) => setBonus(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>{t("updateBaseSalaryOpt")}</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          placeholder={t("updateBaseSalaryPlaceholder")}
          value={newSalary}
          onChange={(e) => setNewSalary(e.target.value)}
        />
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

export function PerformanceReviewDialog({
  open,
  month,
  year,
  employees,
  onOpenChange,
}: PerformanceReviewDialogProps) {
  const { t, lang } = useTranslation()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("addReview")} ({months[month - 1]} {year})
          </DialogTitle>
        </DialogHeader>
        {open ? (
          <PerformanceReviewBody
            key={`${employees[0]?.id ?? "empty"}-${month}-${year}`}
            month={month}
            year={year}
            employees={employees}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
