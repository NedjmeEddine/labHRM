import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/Common/ConfirmDeleteDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmployeeFormDialog } from "@/features/employees/EmployeeFormDialog"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { getEmployeeStatusDisplay } from "@/lib/domain-labels"
import {
  type Employee,
  employeesApi,
  extractApiErrorMessage,
} from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

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
  const debouncedSearch = useDebouncedValue(search, 200)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.employees.list(debouncedSearch),
    queryFn: () => employeesApi.list({ search: debouncedSearch || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastEmployeeDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setDialogOpen(true)
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
              data.data.map((emp) => {
                const statusDisplay = getEmployeeStatusDisplay(emp.status, t)
                return (
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
                    <TableCell>
                      <Badge variant={statusDisplay.variant}>
                        {statusDisplay.label}
                      </Badge>
                    </TableCell>
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
                          onClick={() => setDeleteTarget(emp)}
                          title={t("delete")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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

      <EmployeeFormDialog
        open={dialogOpen}
        editing={editing}
        onOpenChange={setDialogOpen}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.full_name}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />
    </div>
  )
}
