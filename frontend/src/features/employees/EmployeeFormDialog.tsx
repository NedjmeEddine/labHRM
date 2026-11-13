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
  type EmployeeCreate,
  type EmployeeStatus,
  employeesApi,
  extractApiErrorMessage,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

interface EmployeeFormDialogProps {
  open: boolean
  editing: Employee | null
  onOpenChange: (open: boolean) => void
}

type EmployeeFormState = EmployeeCreate & {
  status: EmployeeStatus
  salary_change_reason: string
}

function buildInitialForm(editing: Employee | null): EmployeeFormState {
  if (editing) {
    return {
      employee_code: editing.employee_code,
      full_name: editing.full_name,
      email: editing.email ?? "",
      phone: editing.phone ?? "",
      job_title: editing.job_title,
      department: editing.department,
      hire_date: editing.hire_date,
      status: editing.status,
      base_salary: editing.base_salary,
      annual_vacation_days: editing.annual_vacation_days,
      social_security_number: editing.social_security_number ?? "",
      notes: editing.notes ?? "",
      salary_change_reason: "",
    }
  }
  return {
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    department: "Laboratoire",
    hire_date: formatLocalDate(),
    status: "active",
    base_salary: 45000,
    annual_vacation_days: 30,
    social_security_number: "",
    notes: "",
    salary_change_reason: "",
  }
}

function EmployeeFormBody({
  editing,
  onClose,
}: {
  editing: Employee | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EmployeeFormState>(() =>
    buildInitialForm(editing),
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        employee_code: form.employee_code || undefined,
        email: form.email || null,
        phone: form.phone || null,
        social_security_number: form.social_security_number || null,
        notes: form.notes || null,
      }
      if (editing) {
        return employeesApi.update(editing.id, {
          ...payload,
          salary_change_reason: form.salary_change_reason || undefined,
        })
      }
      return employeesApi.create(payload)
    },
    onSuccess: () => {
      toast.success(
        editing ? t("toastEmployeeUpdated") : t("toastEmployeeCreated"),
      )
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
        saveMutation.mutate()
      }}
      className="grid gap-4 py-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("fullName")} *</Label>
          <Input
            data-testid="emp-full-name"
            required
            value={form.full_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, full_name: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("empCode")} (auto)</Label>
          <Input
            placeholder="EMP-001"
            value={form.employee_code ?? ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, employee_code: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("jobTitle")} *</Label>
          <Input
            data-testid="emp-job-title"
            required
            value={form.job_title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, job_title: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("department")}</Label>
          <Input
            value={form.department}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, department: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("baseSalary")} *</Label>
          <Input
            data-testid="emp-base-salary"
            required
            type="number"
            step="0.01"
            min={0}
            value={form.base_salary}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                base_salary: Number(e.target.value),
              }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("hireDate")} *</Label>
          <Input
            data-testid="emp-hire-date"
            required
            type="date"
            value={form.hire_date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hire_date: e.target.value }))
            }
          />
        </div>
      </div>

      {editing && form.base_salary !== editing.base_salary ? (
        <div className="grid gap-1.5 rounded-md border p-3 bg-muted/40">
          <Label>{t("salaryChangeReason")}</Label>
          <Input
            placeholder={t("salaryChangeReasonPlaceholder")}
            value={form.salary_change_reason}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                salary_change_reason: e.target.value,
              }))
            }
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("status")}</Label>
          <Select
            value={form.status}
            onValueChange={(v: EmployeeStatus) =>
              setForm((prev) => ({ ...prev, status: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("statusActive")}</SelectItem>
              <SelectItem value="on_leave">{t("statusOnLeave")}</SelectItem>
              <SelectItem value="terminated">
                {t("statusTerminated")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("vacationAllowance")}</Label>
          <Input
            type="number"
            min={0}
            value={form.annual_vacation_days}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                annual_vacation_days: Number(e.target.value),
              }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("cnasNumber")}</Label>
          <Input
            value={form.social_security_number ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                social_security_number: e.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email ?? ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("phone")}</Label>
          <Input
            value={form.phone ?? ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("notes")}</Label>
        <Input
          value={form.notes ?? ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, notes: e.target.value }))
          }
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <LoadingButton type="submit" loading={saveMutation.isPending}>
          {t("save")}
        </LoadingButton>
      </DialogFooter>
    </form>
  )
}

export function EmployeeFormDialog({
  open,
  editing,
  onOpenChange,
}: EmployeeFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("edit") : t("addEmployee")}</DialogTitle>
        </DialogHeader>
        {open ? (
          <EmployeeFormBody
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
