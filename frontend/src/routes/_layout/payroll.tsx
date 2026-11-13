import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/Common/ConfirmDeleteDialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PayslipEditorDialog } from "@/features/payroll/PayslipEditorDialog"
import { PayslipsTab } from "@/features/payroll/PayslipsTab"
import { PerformanceReviewDialog } from "@/features/payroll/PerformanceReviewDialog"
import { PerformanceTab } from "@/features/payroll/PerformanceTab"
import { SingleDraftDialog } from "@/features/payroll/SingleDraftDialog"
import {
  employeesApi,
  extractApiErrorMessage,
  type Payslip,
  type PerformanceReview,
  payslipsApi,
  performanceApi,
} from "@/lib/hr-api"
import { MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

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

  const [initialNow] = useState(() => new Date())
  const [month, setMonth] = useState(() => initialNow.getMonth() + 1)
  const [year, setYear] = useState(() => initialNow.getFullYear())

  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)
  const [perfModalOpen, setPerfModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "payslip"; item: Payslip }
    | { kind: "review"; item: PerformanceReview }
    | null
  >(null)

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees.list("all"),
    queryFn: () => employeesApi.list(),
  })

  const { data: payslipsData, isLoading: loadingPayslips } = useQuery({
    queryKey: queryKeys.payslips.list({ month, year }),
    queryFn: () => payslipsApi.list({ month, year }),
  })

  const { data: reviewsData, isLoading: loadingReviews } = useQuery({
    queryKey: queryKeys.performance.list({ month, year }),
    queryFn: () =>
      performanceApi.list({ period_month: month, period_year: year }),
  })

  const batchMutation = useMutation({
    mutationFn: () => payslipsApi.generateBatch({ month, year }),
    onSuccess: (res) => {
      toast.success(`${res.count} ${t("toastPayslipsBatchGenerated")}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.payslips.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const deletePayslipMutation = useMutation({
    mutationFn: (id: string) => payslipsApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastPayslipDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.payslips.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const deletePerfMutation = useMutation({
    mutationFn: (id: string) => performanceApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastReviewDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.performance.all })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const employees = employeesData?.data ?? []

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
            <SelectTrigger className="w-36" data-testid="payroll-month-trigger">
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
        <TabsList className="max-w-full overflow-x-auto flex-nowrap sm:flex-wrap h-auto gap-1 no-scrollbar [webkit-overflow-scrolling:touch]">
          <TabsTrigger value="payslips">{t("tabPayslips")}</TabsTrigger>
          <TabsTrigger value="performance">{t("tabPerformance")}</TabsTrigger>
        </TabsList>

        <TabsContent value="payslips" className="mt-4">
          <PayslipsTab
            month={month}
            year={year}
            payslips={payslipsData?.data ?? []}
            isLoading={loadingPayslips}
            isBatchPending={batchMutation.isPending}
            onGenerateBatch={() => batchMutation.mutate()}
            onOpenSingleDraft={() => setDraftModalOpen(true)}
            onEditPayslip={setEditingPayslip}
            onRequestDelete={(item) =>
              setDeleteTarget({ kind: "payslip", item })
            }
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <PerformanceTab
            reviews={reviewsData?.data ?? []}
            isLoading={loadingReviews}
            onOpenCreate={() => setPerfModalOpen(true)}
            onRequestDelete={(item) =>
              setDeleteTarget({ kind: "review", item })
            }
          />
        </TabsContent>
      </Tabs>

      <SingleDraftDialog
        open={draftModalOpen}
        month={month}
        year={year}
        employees={employees}
        onOpenChange={setDraftModalOpen}
        onDraftReady={setEditingPayslip}
      />

      <PayslipEditorDialog
        payslip={editingPayslip}
        onClose={() => setEditingPayslip(null)}
      />

      <PerformanceReviewDialog
        open={perfModalOpen}
        month={month}
        year={year}
        employees={employees}
        onOpenChange={setPerfModalOpen}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.item.employee_name ?? undefined}
        loading={
          deletePayslipMutation.isPending || deletePerfMutation.isPending
        }
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.kind === "payslip") {
            deletePayslipMutation.mutate(deleteTarget.item.id)
          } else {
            deletePerfMutation.mutate(deleteTarget.item.id)
          }
        }}
      />
    </div>
  )
}
