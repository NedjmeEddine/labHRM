import { Plus, Star, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PerformanceReview } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

interface PerformanceTabProps {
  reviews: PerformanceReview[]
  isLoading: boolean
  onOpenCreate: () => void
  onRequestDelete: (review: PerformanceReview) => void
}

export function PerformanceTab({
  reviews,
  isLoading,
  onOpenCreate,
  onRequestDelete,
}: PerformanceTabProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onOpenCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addReview")}
        </Button>
      </div>

      <div className="-mx-3.5 px-3.5 sm:mx-0 sm:px-0 overflow-x-auto [webkit-overflow-scrolling:touch]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fullName")}</TableHead>
              <TableHead>{t("score")}</TableHead>
              <TableHead>{t("bonusAmount")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("newSalary")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("notes")}
              </TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  ...
                </TableCell>
              </TableRow>
            ) : reviews.length > 0 ? (
              reviews.map((r) => (
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
                  <TableCell className="hidden sm:table-cell">
                    {r.new_base_salary ? formatDZD(r.new_base_salary) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                    {r.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRequestDelete(r)}
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
    </div>
  )
}
