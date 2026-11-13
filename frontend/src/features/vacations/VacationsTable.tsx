import { Check, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getVacationStatusDisplay,
  getVacationTypeLabel,
} from "@/lib/domain-labels"
import type { Vacation } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

interface VacationsTableProps {
  vacations: Vacation[]
  isLoading: boolean
  onUpdateStatus: (id: string, nextStatus: "approved" | "rejected") => void
  onRequestDelete: (vac: Vacation) => void
}

export function VacationsTable({
  vacations,
  isLoading,
  onUpdateStatus,
  onRequestDelete,
}: VacationsTableProps) {
  const { t } = useTranslation()

  return (
    <div className="-mx-3.5 px-3.5 sm:mx-0 sm:px-0 overflow-x-auto [webkit-overflow-scrolling:touch]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("startDate")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("endDate")}
            </TableHead>
            <TableHead>{t("duration")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("type")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("notes")}</TableHead>
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
          ) : vacations.length > 0 ? (
            vacations.map((vac) => {
              const statusDisplay = getVacationStatusDisplay(vac.status, t)
              return (
                <TableRow key={vac.id}>
                  <TableCell className="font-medium">
                    {vac.employee_name}
                    <div className="text-xs text-muted-foreground md:hidden font-normal mt-0.5">
                      {getVacationTypeLabel(vac.vacation_type, t)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vac.start_date}
                  </TableCell>
                  <TableCell className="font-mono text-xs hidden sm:table-cell">
                    {vac.end_date}
                  </TableCell>
                  <TableCell>
                    {vac.days_count} {t("days")}
                  </TableCell>
                  <TableCell className="text-xs hidden md:table-cell">
                    {getVacationTypeLabel(vac.vacation_type, t)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusDisplay.variant}>
                      {statusDisplay.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {vac.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {vac.status === "pending" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("approve")}
                            onClick={() => onUpdateStatus(vac.id, "approved")}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("reject")}
                            onClick={() => onUpdateStatus(vac.id, "rejected")}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("delete")}
                        onClick={() => onRequestDelete(vac)}
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
  )
}
