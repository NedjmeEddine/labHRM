import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Download,
  Eye,
  FileDown,
  FilePlus,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  employeesApi,
  type Payslip,
  payslipsApi,
  performanceApi,
} from "@/lib/hr-api"
import { formatDZD, MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/payroll")({
  component: PayrollPage,
  head: () => ({
    meta: [{ title: "Payroll & Performance - EL-AMEL LAB" }],
  }),
})

function PayrollPage() {
  const { t, lang } = useTranslation()
  const queryClient = useQueryClient()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Single draft dialog
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [draftEmpId, setDraftEmpId] = useState("")
  const [draftOverwrite, setDraftOverwrite] = useState(true)

  // Editable payslip dialog
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)
  const [editForm, setEditForm] = useState({
    base_salary: 0,
    performance_bonus: 0,
    other_allowances: 0,
    overtime_pay: 0,
    absence_days: 0,
    absence_deduction: 0,
    other_deductions: 0,
    worked_days: 22,
    vacation_days_taken: 0,
    payment_method: "bank_transfer" as "bank_transfer" | "cash" | "check",
    status: "draft" as "draft" | "paid",
    notes: "",
  })

  // Performance modal
  const [perfModalOpen, setPerfModalOpen] = useState(false)
  const [perfEmpId, setPerfEmpId] = useState("")
  const [perfScore, setPerfScore] = useState(4)
  const [perfBonus, setPerfBonus] = useState(0)
  const [perfNewSalary, setPerfNewSalary] = useState("")
  const [perfNotes, setPerfNotes] = useState("")

  const { data: employeesData } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => employeesApi.list(),
  })

  const { data: payslipsData, isLoading: loadingPayslips } = useQuery({
    queryKey: ["payslips", month, year],
    queryFn: () => payslipsApi.list({ month, year }),
  })

  const { data: reviewsData, isLoading: loadingReviews } = useQuery({
    queryKey: ["performance", month, year],
    queryFn: () =>
      performanceApi.list({ period_month: month, period_year: year }),
  })

  // --- Mutations ---
  const batchMutation = useMutation({
    mutationFn: () => payslipsApi.generateBatch({ month, year }),
    onSuccess: (res) => {
      toast.success(`${res.count} bulletins générés / mis à jour`)
      queryClient.invalidateQueries({ queryKey: ["payslips"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const singleDraftMutation = useMutation({
    mutationFn: () =>
      payslipsApi.generateDraft({
        employee_id: draftEmpId,
        month,
        year,
        overwrite: draftOverwrite,
      }),
    onSuccess: (ps) => {
      toast.success(`Bulletin prêt pour ${ps.employee_name}`)
      queryClient.invalidateQueries({ queryKey: ["payslips"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setDraftModalOpen(false)
      openPayslipEditor(ps)
    },
  })

  const updatePayslipMutation = useMutation({
    mutationFn: async (andDownloadPdf: boolean) => {
      if (!editingPayslip) return null
      const updated = await payslipsApi.update(editingPayslip.id, {
        ...editForm,
        notes: editForm.notes || null,
      })
      if (andDownloadPdf) {
        await payslipsApi.downloadPdf(updated, false)
      }
      return updated
    },
    onSuccess: () => {
      toast.success("Bulletin enregistré")
      queryClient.invalidateQueries({ queryKey: ["payslips"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setEditingPayslip(null)
    },
  })

  const deletePayslipMutation = useMutation({
    mutationFn: (id: string) => payslipsApi.delete(id),
    onSuccess: () => {
      toast.success("Bulletin supprimé")
      queryClient.invalidateQueries({ queryKey: ["payslips"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const createPerfMutation = useMutation({
    mutationFn: () =>
      performanceApi.create({
        employee_id: perfEmpId,
        period_month: month,
        period_year: year,
        score: perfScore,
        bonus_amount: perfBonus,
        new_base_salary: perfNewSalary ? Number(perfNewSalary) : null,
        notes: perfNotes || null,
      }),
    onSuccess: () => {
      toast.success("Évaluation enregistrée")
      queryClient.invalidateQueries({ queryKey: ["performance"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setPerfModalOpen(false)
    },
  })

  const deletePerfMutation = useMutation({
    mutationFn: (id: string) => performanceApi.delete(id),
    onSuccess: () => {
      toast.success("Évaluation supprimée")
      queryClient.invalidateQueries({ queryKey: ["performance"] })
    },
  })

  const openPayslipEditor = (ps: Payslip) => {
    setEditingPayslip(ps)
    setEditForm({
      base_salary: ps.base_salary,
      performance_bonus: ps.performance_bonus,
      other_allowances: ps.other_allowances,
      overtime_pay: ps.overtime_pay,
      absence_days: ps.absence_days,
      absence_deduction: ps.absence_deduction,
      other_deductions: ps.other_deductions,
      worked_days: ps.worked_days,
      vacation_days_taken: ps.vacation_days_taken,
      payment_method: ps.payment_method,
      status: ps.status,
      notes: ps.notes ?? "",
    })
  }

  const openPerfModal = () => {
    const firstEmp = employeesData?.data[0]
    setPerfEmpId(firstEmp?.id ?? "")
    setPerfScore(4)
    setPerfBonus(firstEmp ? Math.round(firstEmp.base_salary * 0.1) : 0)
    setPerfNewSalary("")
    setPerfNotes("")
    setPerfModalOpen(true)
  }

  const suggestBonusForScore = (empId: string, score: number) => {
    const emp = employeesData?.data.find((e) => e.id === empId)
    if (!emp) return
    const ratio =
      score === 5 ? 0.15 : score === 4 ? 0.1 : score === 3 ? 0.05 : 0
    setPerfBonus(Math.round(emp.base_salary * ratio))
  }

  const liveGross =
    Number(editForm.base_salary) +
    Number(editForm.performance_bonus) +
    Number(editForm.other_allowances) +
    Number(editForm.overtime_pay)

  const liveDeductions =
    Number(editForm.absence_deduction) + Number(editForm.other_deductions)

  const liveNet = Math.max(0, liveGross - liveDeductions)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("payrollTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("payrollSubtitle")}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((label, idx) => (
                <SelectItem key={label} value={String(idx + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            className="w-24"
            value={year}
            min={2020}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
      </div>

      <Tabs defaultValue="payslips">
        <TabsList>
          <TabsTrigger value="payslips">{t("tabPayslips")}</TabsTrigger>
          <TabsTrigger value="performance">{t("tabPerformance")}</TabsTrigger>
        </TabsList>

        {/* TAB 1: PAYSLIPS & PDF */}
        <TabsContent value="payslips" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                onClick={() => batchMutation.mutate()}
                loading={batchMutation.isPending}
              >
                <Layers className="mr-1.5 h-4 w-4" />
                {t("generateBatch")}
              </LoadingButton>
              <Button
                variant="outline"
                onClick={() => {
                  setDraftEmpId(employeesData?.data[0]?.id ?? "")
                  setDraftModalOpen(true)
                }}
              >
                <FilePlus className="mr-1.5 h-4 w-4" />
                {t("generateSingle")}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => payslipsApi.exportCsv({ month, year })}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {t("exportCsv")}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fullName")}</TableHead>
                  <TableHead>{t("baseSalary")}</TableHead>
                  <TableHead>{t("bonusAmount")}</TableHead>
                  <TableHead>{t("absenceDeduction")}</TableHead>
                  <TableHead>{t("netSalary")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayslips ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      ...
                    </TableCell>
                  </TableRow>
                ) : payslipsData && payslipsData.data.length > 0 ? (
                  payslipsData.data.map((ps) => (
                    <TableRow key={ps.id}>
                      <TableCell>
                        <div className="font-medium">{ps.employee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {ps.employee_code} · {ps.job_title}
                        </div>
                      </TableCell>
                      <TableCell>{formatDZD(ps.base_salary)}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        +{formatDZD(ps.performance_bonus)}
                      </TableCell>
                      <TableCell className="text-destructive">
                        -{formatDZD(ps.absence_deduction + ps.other_deductions)}
                      </TableCell>
                      <TableCell className="font-bold text-brand">
                        {formatDZD(ps.net_salary)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ps.status === "paid" ? "default" : "secondary"
                          }
                        >
                          {ps.status === "paid"
                            ? t("statusPaid")
                            : t("statusDraft")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPayslipEditor(ps)}
                            title={t("editPayslip")}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            {t("edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => payslipsApi.downloadPdf(ps, true)}
                            title={t("previewPdf")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => payslipsApi.downloadPdf(ps, false)}
                            title={t("downloadPdf")}
                          >
                            <FileDown className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePayslipMutation.mutate(ps.id)}
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
        </TabsContent>

        {/* TAB 2: PERFORMANCE & BONUSES */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openPerfModal}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("addReview")}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fullName")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                  <TableHead>{t("bonusAmount")}</TableHead>
                  <TableHead>{t("newSalary")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReviews ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      ...
                    </TableCell>
                  </TableRow>
                ) : reviewsData && reviewsData.data.length > 0 ? (
                  reviewsData.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.employee_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < r.score ? "fill-amber-500" : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        +{formatDZD(r.bonus_amount)}
                      </TableCell>
                      <TableCell>
                        {r.new_base_salary ? formatDZD(r.new_base_salary) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePerfMutation.mutate(r.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Generate Single Draft Modal */}
      <Dialog open={draftModalOpen} onOpenChange={setDraftModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generateSingle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              singleDraftMutation.mutate()
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid gap-1.5">
              <Label>{t("selectEmployee")} *</Label>
              <Select value={draftEmpId} onValueChange={setDraftEmpId}>
                <SelectTrigger>
                  <SelectValue />
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draftOverwrite}
                onChange={(e) => setDraftOverwrite(e.target.checked)}
              />
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t("overwriteDraft")}</span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraftModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <LoadingButton
                type="submit"
                loading={singleDraftMutation.isPending}
              >
                {t("generateSingle")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Interactive Editable Payslip Dialog */}
      <Dialog
        open={editingPayslip !== null}
        onOpenChange={(o) => !o && setEditingPayslip(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("payslipEditorTitle")} — {editingPayslip?.employee_name} (
              {editingPayslip ? months[editingPayslip.month - 1] : ""}{" "}
              {editingPayslip?.year})
            </DialogTitle>
            <DialogDescription>{t("payslipEditorDesc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-12 py-2">
            {/* Editable Inputs */}
            <div className="md:col-span-7 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("baseSalary")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.base_salary}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        base_salary: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("bonusAmount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.performance_bonus}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        performance_bonus: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("otherAllowances")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.other_allowances}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        other_allowances: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("overtimePay")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.overtime_pay}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        overtime_pay: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("absenceDays")}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.absence_days}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        absence_days: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("absenceDeduction")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.absence_deduction}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        absence_deduction: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("otherDeductions")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.other_deductions}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        other_deductions: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("workedDays")}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.worked_days}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        worked_days: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">{t("paymentMethod")}</Label>
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(v: "bank_transfer" | "cash" | "check") =>
                      setEditForm({ ...editForm, payment_method: v })
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
                    value={editForm.status}
                    onValueChange={(v: "draft" | "paid") =>
                      setEditForm({ ...editForm, status: v })
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
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            <Card className="md:col-span-5 bg-muted/40 h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wider text-brand">
                  Bulletin de Paie (Aperçu)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salaire de base</span>
                  <span>{formatDZD(editForm.base_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prime perf.</span>
                  <span className="text-green-600">
                    +{formatDZD(editForm.performance_bonus)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Indemnités + HS</span>
                  <span>
                    +
                    {formatDZD(
                      editForm.other_allowances + editForm.overtime_pay,
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 font-medium">
                  <span>{t("grossSalary")}</span>
                  <span>{formatDZD(liveGross)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Retenues (absences + autres)</span>
                  <span>-{formatDZD(liveDeductions)}</span>
                </div>
                <div className="mt-4 rounded-md bg-brand-deep p-3 text-white flex items-center justify-between">
                  <span className="font-semibold">{t("netSalary")}</span>
                  <span className="text-lg font-bold">
                    {formatDZD(liveNet)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingPayslip(null)}
            >
              {t("cancel")}
            </Button>
            <LoadingButton
              variant="secondary"
              loading={updatePayslipMutation.isPending}
              onClick={() => updatePayslipMutation.mutate(false)}
            >
              {t("save")}
            </LoadingButton>
            <LoadingButton
              loading={updatePayslipMutation.isPending}
              onClick={() => updatePayslipMutation.mutate(true)}
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              {t("save")} & {t("downloadPdf")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Review Modal */}
      <Dialog open={perfModalOpen} onOpenChange={setPerfModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("addReview")} ({months[month - 1]} {year})
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createPerfMutation.mutate()
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid gap-1.5">
              <Label>{t("selectEmployee")} *</Label>
              <Select
                value={perfEmpId}
                onValueChange={(v) => {
                  setPerfEmpId(v)
                  suggestBonusForScore(v, perfScore)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.data.map((emp) => (
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
                    variant={perfScore === s ? "default" : "outline"}
                    onClick={() => {
                      setPerfScore(s)
                      suggestBonusForScore(perfEmpId, s)
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
                type="number"
                step="0.01"
                min={0}
                value={perfBonus}
                onChange={(e) => setPerfBonus(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("updateBaseSalaryOpt")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="Laisser vide pour ne pas modifier le salaire de base"
                value={perfNewSalary}
                onChange={(e) => setPerfNewSalary(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("notes")}</Label>
              <Input
                value={perfNotes}
                onChange={(e) => setPerfNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPerfModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <LoadingButton
                type="submit"
                loading={createPerfMutation.isPending}
              >
                {t("save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
