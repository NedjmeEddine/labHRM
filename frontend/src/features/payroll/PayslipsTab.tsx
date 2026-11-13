import {
  Download,
  Eye,
  FileDown,
  FilePlus,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPayslipStatusDisplay } from "@/lib/domain-labels"
import { extractApiErrorMessage, type Payslip, payslipsApi } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

interface PayslipsTabProps {
  month: number
  year: number
  payslips: Payslip[]
  isLoading: boolean
  isBatchPending: boolean
  onGenerateBatch: () => void
  onOpenSingleDraft: () => void
  onEditPayslip: (ps: Payslip) => void
  onRequestDelete: (ps: Payslip) => void
}

export function PayslipsTab({
  month,
  year,
  payslips,
  isLoading,
  isBatchPending,
  onGenerateBatch,
  onOpenSingleDraft,
  onEditPayslip,
  onRequestDelete,
}: PayslipsTabProps) {
  const { t } = useTranslation()

  const handleDownloadPdf = async (ps: Payslip, inline: boolean) => {
    try {
      await payslipsApi.downloadPdf(ps, inline)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastExportError")))
    }
  }

  const handleExportCsv = async () => {
    try {
      await payslipsApi.exportCsv({ month, year })
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastExportError")))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <LoadingButton onClick={onGenerateBatch} loading={isBatchPending}>
            <Layers className="mr-1.5 h-4 w-4" />
            {t("generateBatch")}
          </LoadingButton>
          <Button variant="outline" onClick={onOpenSingleDraft}>
            <FilePlus className="mr-1.5 h-4 w-4" />
            {t("generateSingle")}
          </Button>
        </div>
        <Button variant="outline" onClick={handleExportCsv}>
          <Download className="mr-1.5 h-4 w-4" />
          {t("exportCsv")}
        </Button>
      </div>

      <div className="-mx-3.5 px-3.5 sm:mx-0 sm:px-0 overflow-x-auto [webkit-overflow-scrolling:touch]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead className="whitespace-normal hidden md:table-cell">
                {t("baseSalary")}
              </TableHead>
              <TableHead className="whitespace-normal hidden lg:table-cell">
                {t("bonusAmount")}
              </TableHead>
              <TableHead className="whitespace-normal hidden lg:table-cell">
                {t("absenceDeduction")}
              </TableHead>
              <TableHead className="whitespace-normal">
                {t("netSalary")}
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("status")}
              </TableHead>
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
            ) : payslips.length > 0 ? (
              payslips.map((ps) => {
                const statusDisplay = getPayslipStatusDisplay(ps.status, t)
                return (
                  <TableRow key={ps.id}>
                    <TableCell>
                      <div className="font-medium">{ps.employee_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ps.employee_code} · {ps.job_title}
                      </div>
                      <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                        Base: {formatDZD(ps.base_salary)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDZD(ps.base_salary)}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium hidden lg:table-cell">
                      +{formatDZD(ps.performance_bonus)}
                    </TableCell>
                    <TableCell className="text-destructive hidden lg:table-cell">
                      -{formatDZD(ps.absence_deduction + ps.other_deductions)}
                    </TableCell>
                    <TableCell className="font-bold text-brand">
                      {formatDZD(ps.net_salary)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={statusDisplay.variant}>
                        {statusDisplay.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditPayslip(ps)}
                          title={t("editPayslip")}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          {t("edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPdf(ps, true)}
                          title={t("previewPdf")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownloadPdf(ps, false)}
                          title={t("downloadPdf")}
                        >
                          <FileDown className="mr-1 h-3.5 w-3.5" />
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRequestDelete(ps)}
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
    </div>
  )
}
