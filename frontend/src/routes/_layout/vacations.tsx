import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Check, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { employeesApi, vacationsApi } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/vacations")({
  component: VacationsPage,
  head: () => ({
    meta: [{ title: "Vacations - EL-AMEL LAB" }],
  }),
})

function VacationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentYear = new Date().getFullYear()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [empId, setEmpId] = useState("")
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [vacType, setVacType] = useState("annual")
  const [status, setStatus] = useState("approved")
  const [notes, setNotes] = useState("")

  const { data: employeesData } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => employeesApi.list(),
  })

  const { data: vacationsData, isLoading } = useQuery({
    queryKey: ["vacations"],
    queryFn: () => vacationsApi.list(),
  })

  const { data: balances } = useQuery({
    queryKey: ["vacation-balances", currentYear],
    queryFn: () => vacationsApi.balances(currentYear),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      vacationsApi.create({
        employee_id: empId,
        start_date: startDate,
        end_date: endDate,
        vacation_type: vacType,
        status,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("Congé enregistré")
      queryClient.invalidateQueries({ queryKey: ["vacations"] })
      queryClient.invalidateQueries({ queryKey: ["vacation-balances"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setDialogOpen(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Erreur")
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string
      nextStatus: "approved" | "rejected"
    }) => vacationsApi.update(id, { status: nextStatus }),
    onSuccess: () => {
      toast.success("Statut mis à jour")
      queryClient.invalidateQueries({ queryKey: ["vacations"] })
      queryClient.invalidateQueries({ queryKey: ["vacation-balances"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vacationsApi.delete(id),
    onSuccess: () => {
      toast.success("Congé supprimé")
      queryClient.invalidateQueries({ queryKey: ["vacations"] })
      queryClient.invalidateQueries({ queryKey: ["vacation-balances"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const openAdd = () => {
    setEmpId(employeesData?.data[0]?.id ?? "")
    const today = new Date().toISOString().split("T")[0]
    setStartDate(today)
    setEndDate(today)
    setVacType("annual")
    setStatus("approved")
    setNotes("")
    setDialogOpen(true)
  }

  const getTypeLabel = (type: string) => {
    if (type === "annual") return t("vacAnnual")
    if (type === "sick") return t("vacSick")
    if (type === "unpaid") return t("vacUnpaid")
    return t("vacOther")
  }

  const getStatusBadge = (s: string) => {
    if (s === "approved") return <Badge>{t("statusApproved")}</Badge>
    if (s === "pending")
      return <Badge variant="secondary">{t("statusPending")}</Badge>
    return <Badge variant="destructive">{t("statusRejected")}</Badge>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vacTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("vacSubtitle")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addVacation")}
        </Button>
      </div>

      {/* Balances Overview */}
      {balances && balances.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("vacationBalancesTitle")} ({currentYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => {
              const pct =
                b.annual_allowance > 0
                  ? Math.min(100, (b.days_taken / b.annual_allowance) * 100)
                  : 0
              return (
                <div
                  key={b.employee_id}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {b.employee_name}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {b.days_remaining} / {b.annual_allowance} {t("days")}
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("taken")}: {b.days_taken} · {t("pending")}:{" "}
                    {b.days_pending} · {t("remaining")}: {b.days_remaining}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Vacations Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("startDate")}</TableHead>
              <TableHead>{t("endDate")}</TableHead>
              <TableHead>{t("duration")}</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("notes")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  ...
                </TableCell>
              </TableRow>
            ) : vacationsData && vacationsData.data.length > 0 ? (
              vacationsData.data.map((vac) => (
                <TableRow key={vac.id}>
                  <TableCell className="font-medium">
                    {vac.employee_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vac.start_date}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vac.end_date}
                  </TableCell>
                  <TableCell>
                    {vac.days_count} {t("days")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {getTypeLabel(vac.vacation_type)}
                  </TableCell>
                  <TableCell>{getStatusBadge(vac.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {vac.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {vac.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("approve")}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: vac.id,
                                nextStatus: "approved",
                              })
                            }
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("reject")}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: vac.id,
                                nextStatus: "rejected",
                              })
                            }
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(vac.id)}
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
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Vacation Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addVacation")}</DialogTitle>
          </DialogHeader>
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
                  {employeesData?.data.map((emp) => (
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
                <Label>Type</Label>
                <Select value={vacType} onValueChange={setVacType}>
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
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">
                      {t("statusApproved")}
                    </SelectItem>
                    <SelectItem value="pending">
                      {t("statusPending")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("notes")}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <LoadingButton type="submit" loading={createMutation.isPending}>
                {t("save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
