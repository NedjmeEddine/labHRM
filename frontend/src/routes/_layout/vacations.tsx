import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/Common/ConfirmDeleteDialog"
import { Button } from "@/components/ui/button"
import { VacationBalancesCard } from "@/features/vacations/VacationBalancesCard"
import { VacationFormDialog } from "@/features/vacations/VacationFormDialog"
import { VacationsTable } from "@/features/vacations/VacationsTable"
import {
  employeesApi,
  extractApiErrorMessage,
  type Vacation,
  vacationsApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

export const Route = createFileRoute("/_layout/vacations")({
  component: VacationsPage,
  head: () => ({
    meta: [{ title: "Vacations - EL-AMEL LAB" }],
  }),
})

function VacationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentYear] = useState(() => new Date().getFullYear())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Vacation | null>(null)

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees.list("all"),
    queryFn: () => employeesApi.list(),
  })

  const { data: vacationsData, isLoading } = useQuery({
    queryKey: queryKeys.vacations.list(),
    queryFn: () => vacationsApi.list(),
  })

  const { data: balances } = useQuery({
    queryKey: queryKeys.vacations.balances(currentYear),
    queryFn: () => vacationsApi.balances(currentYear),
  })

  const invalidateVacationRelated = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vacations.all })
    queryClient.invalidateQueries({ queryKey: ["vacation-balances"] })
    queryClient.invalidateQueries({ queryKey: ["vacations-month"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
  }

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string
      nextStatus: "approved" | "rejected"
    }) => vacationsApi.update(id, { status: nextStatus }),
    onSuccess: () => {
      toast.success(t("toastVacationUpdated"))
      invalidateVacationRelated()
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vacationsApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastVacationDeleted"))
      invalidateVacationRelated()
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vacTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("vacSubtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addVacation")}
        </Button>
      </div>

      <VacationBalancesCard balances={balances ?? []} year={currentYear} />

      <VacationsTable
        vacations={vacationsData?.data ?? []}
        isLoading={isLoading}
        onUpdateStatus={(id, nextStatus) =>
          updateStatusMutation.mutate({ id, nextStatus })
        }
        onRequestDelete={setDeleteTarget}
      />

      <VacationFormDialog
        open={dialogOpen}
        employees={employeesData?.data ?? []}
        onOpenChange={setDialogOpen}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={
          deleteTarget
            ? `${deleteTarget.employee_name ?? ""} (${deleteTarget.start_date} → ${deleteTarget.end_date})`
            : undefined
        }
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
