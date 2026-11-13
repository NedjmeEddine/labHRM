import { FileText } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDisplayDate } from "@/lib/date"
import {
  getAbsenceTypeLabel,
  getPayslipStatusDisplay,
  getVacationStatusDisplay,
  getVacationTypeLabel,
} from "@/lib/domain-labels"
import {
  type Absence,
  extractApiErrorMessage,
  type Payslip,
  type PerformanceReview,
  payslipsApi,
  type SalaryHistory,
  type Vacation,
} from "@/lib/hr-api"
import { formatDZD, MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"

export function EmployeeAbsencesTab({ absences }: { absences: Absence[] }) {
  const { t } = useTranslation()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("type")}</TableHead>
          <TableHead>{t("paid")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("reason")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {absences.length > 0 ? (
          absences.map((ab) => (
            <TableRow key={ab.id}>
              <TableCell>{ab.date}</TableCell>
              <TableCell>{getAbsenceTypeLabel(ab.absence_type, t)}</TableCell>
              <TableCell>
                <Badge variant={ab.is_paid ? "secondary" : "destructive"}>
                  {ab.is_paid ? t("paid") : t("unpaid")}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {ab.reason || "—"}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={4}
              className="text-center py-6 text-muted-foreground"
            >
              {t("noData")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function EmployeeVacationsTab({ vacations }: { vacations: Vacation[] }) {
  const { t } = useTranslation()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("startDate")}</TableHead>
          <TableHead>{t("endDate")}</TableHead>
          <TableHead className="hidden sm:table-cell">
            {t("duration")}
          </TableHead>
          <TableHead className="hidden md:table-cell">{t("type")}</TableHead>
          <TableHead>{t("status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vacations.length > 0 ? (
          vacations.map((v) => {
            const statusDisplay = getVacationStatusDisplay(v.status, t)
            return (
              <TableRow key={v.id}>
                <TableCell>{v.start_date}</TableCell>
                <TableCell>{v.end_date}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {v.days_count} {t("days")}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {getVacationTypeLabel(v.vacation_type, t)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusDisplay.variant}>
                    {statusDisplay.label}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center py-6 text-muted-foreground"
            >
              {t("noData")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function EmployeeSalaryTab({
  salaryHistory,
  reviews,
}: {
  salaryHistory: SalaryHistory[]
  reviews: PerformanceReview[]
}) {
  const { t, lang } = useTranslation()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("previousSalary")}
            </TableHead>
            <TableHead>{t("newSalary")}</TableHead>
            <TableHead>{t("reason")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {salaryHistory.length > 0 ? (
            salaryHistory.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{formatDisplayDate(h.changed_at, lang)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDZD(h.previous_salary)}
                </TableCell>
                <TableCell className="font-semibold text-brand">
                  {formatDZD(h.new_salary)}
                </TableCell>
                <TableCell>{h.reason}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center py-6 text-muted-foreground"
              >
                {t("noData")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {reviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tabPerformance")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b pb-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {months[r.period_month - 1]} {r.period_year} ·{" "}
                    {"★".repeat(r.score)}
                    {"☆".repeat(5 - r.score)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.notes || "—"}
                  </p>
                </div>
                <Badge>{formatDZD(r.bonus_amount)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function EmployeePayslipsTab({ payslips }: { payslips: Payslip[] }) {
  const { t, lang } = useTranslation()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  const handleDownloadPdf = async (p: Payslip) => {
    try {
      await payslipsApi.downloadPdf(p, false)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastExportError")))
    }
  }

  return (
    <div className="-mx-3.5 px-3.5 sm:mx-0 sm:px-0 overflow-x-auto [webkit-overflow-scrolling:touch]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t("month")} / {t("year")}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("grossSalary")}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {t("absenceDeduction")}
            </TableHead>
            <TableHead>{t("netSalary")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payslips.length > 0 ? (
            payslips.map((p) => {
              const statusDisplay = getPayslipStatusDisplay(p.status, t)
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {months[p.month - 1]} {p.year}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatDZD(p.gross_salary)}
                  </TableCell>
                  <TableCell className="text-destructive hidden md:table-cell">
                    {formatDZD(p.absence_deduction)}
                  </TableCell>
                  <TableCell className="font-bold">
                    {formatDZD(p.net_salary)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusDisplay.variant}>
                      {statusDisplay.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPdf(p)}
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center py-6 text-muted-foreground"
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
