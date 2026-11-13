import { Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAbsenceTypeLabel } from "@/lib/domain-labels"
import type { Absence, AbsencesIntervalSummary } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

export function AttendanceSummaryCards({
  summary,
}: {
  summary: AbsencesIntervalSummary | undefined
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("totalAbsences")}</p>
          <p className="text-xl font-bold mt-1">{summary?.total_count ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("unpaidDays")}</p>
          <p className="text-xl font-bold text-destructive mt-1">
            {summary?.unpaid_days ?? 0} {t("day")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("paidDays")}</p>
          <p className="text-xl font-bold mt-1">
            {summary?.paid_days ?? 0} {t("day")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            {t("estimatedDeduction")}
          </p>
          <p className="text-lg font-bold text-destructive mt-1">
            {formatDZD(summary?.estimated_deduction ?? 0)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function AttendanceTable({
  absences,
  onRequestDelete,
}: {
  absences: Absence[]
  onRequestDelete: (absence: Absence) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("paid")}</TableHead>
            <TableHead>{t("reason")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {absences.length > 0 ? (
            absences.map((ab) => (
              <TableRow key={ab.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {ab.date}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {ab.employee_name}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {getAbsenceTypeLabel(ab.absence_type, t)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={ab.is_paid ? "secondary" : "destructive"}>
                    {ab.is_paid ? t("paid") : t("unpaid")}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-xs text-muted-foreground max-w-[130px] truncate"
                  title={ab.reason ?? undefined}
                >
                  {ab.reason || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRequestDelete(ab)}
                    title={t("delete")}
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
  )
}
