import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type Employee, type EmployeeCreate, employeesApi } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/employees/")({
  component: EmployeesPage,
  head: () => ({
    meta: [{ title: "Employees - EL-AMEL LAB" }],
  }),
})

function EmployeesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const [form, setForm] = useState<
    EmployeeCreate & { salary_change_reason?: string }
  >({
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    department: "Laboratoire",
    hire_date: new Date().toISOString().split("T")[0],
    status: "active",
    base_salary: 45000,
    annual_vacation_days: 30,
    social_security_number: "",
    notes: "",
    salary_change_reason: "",
  })

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: () => employeesApi.list({ search: search || undefined }),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return employeesApi.update(editing.id, {
          ...form,
          employee_code: form.employee_code || undefined,
          email: form.email || null,
          phone: form.phone || null,
          social_security_number: form.social_security_number || null,
          notes: form.notes || null,
          salary_change_reason: form.salary_change_reason || undefined,
        })
      }
      return employeesApi.create({
        ...form,
        employee_code: form.employee_code || undefined,
        email: form.email || null,
        phone: form.phone || null,
        social_security_number: form.social_security_number || null,
        notes: form.notes || null,
      })
    },
    onSuccess: () => {
      toast.success(editing ? "Employé mis à jour" : "Employé ajouté")
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setDialogOpen(false)
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail || "Erreur lors de l'enregistrement",
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      toast.success("Employé supprimé")
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      employee_code: "",
      full_name: "",
      email: "",
      phone: "",
      job_title: "",
      department: "Laboratoire",
      hire_date: new Date().toISOString().split("T")[0],
      status: "active",
      base_salary: 45000,
      annual_vacation_days: 30,
      social_security_number: "",
      notes: "",
      salary_change_reason: "",
    })
    setDialogOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setForm({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      job_title: emp.job_title,
      department: emp.department,
      hire_date: emp.hire_date,
      status: emp.status,
      base_salary: emp.base_salary,
      annual_vacation_days: emp.annual_vacation_days,
      social_security_number: emp.social_security_number ?? "",
      notes: emp.notes ?? "",
      salary_change_reason: "",
    })
    setDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge>{t("statusActive")}</Badge>
    if (status === "on_leave")
      return <Badge variant="secondary">{t("statusOnLeave")}</Badge>
    return <Badge variant="destructive">{t("statusTerminated")}</Badge>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("empTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("empSubtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addEmployee")}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-2.5 h-4 w-4" />
        <Input
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("empCode")}</TableHead>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("jobTitle")}</TableHead>
              <TableHead>{t("department")}</TableHead>
              <TableHead>{t("baseSalary")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  ...
                </TableCell>
              </TableRow>
            ) : data && data.data.length > 0 ? (
              data.data.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {emp.employee_code}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to="/employees/$employeeId"
                      params={{ employeeId: emp.id }}
                      className="text-brand hover:underline"
                    >
                      {emp.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{emp.job_title}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell className="font-medium">
                    {formatDZD(emp.base_salary)}
                  </TableCell>
                  <TableCell>{getStatusBadge(emp.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title={t("viewProfile")}
                      >
                        <Link
                          to="/employees/$employeeId"
                          params={{ employeeId: emp.id }}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(emp)}
                        title={t("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(t("confirmDelete"))) {
                            deleteMutation.mutate(emp.id)
                          }
                        }}
                        title={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("addEmployee")}</DialogTitle>
          </DialogHeader>

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
                  required
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("empCode")} (auto)</Label>
                <Input
                  placeholder="EMP-001"
                  value={form.employee_code ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, employee_code: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("jobTitle")} *</Label>
                <Input
                  required
                  value={form.job_title}
                  onChange={(e) =>
                    setForm({ ...form, job_title: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("department")}</Label>
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("baseSalary")} *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.base_salary}
                  onChange={(e) =>
                    setForm({ ...form, base_salary: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("hireDate")} *</Label>
                <Input
                  required
                  type="date"
                  value={form.hire_date}
                  onChange={(e) =>
                    setForm({ ...form, hire_date: e.target.value })
                  }
                />
              </div>
            </div>

            {editing && form.base_salary !== editing.base_salary && (
              <div className="grid gap-1.5 rounded-md border p-3 bg-muted/40">
                <Label>{t("salaryChangeReason")}</Label>
                <Input
                  placeholder="Ex: Augmentation annuelle / Promotion"
                  value={form.salary_change_reason ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, salary_change_reason: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("statusActive")}</SelectItem>
                    <SelectItem value="on_leave">
                      {t("statusOnLeave")}
                    </SelectItem>
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
                    setForm({
                      ...form,
                      annual_vacation_days: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cnasNumber")}</Label>
                <Input
                  value={form.social_security_number ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      social_security_number: e.target.value,
                    })
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
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("phone")}</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("notes")}</Label>
              <Input
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <LoadingButton type="submit" loading={saveMutation.isPending}>
                {t("save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
