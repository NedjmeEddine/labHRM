import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { safeParseIsoDate } from "@/lib/date"
import type { Employee } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

interface AttendanceFilterBarProps {
  employees: Employee[]
  selectedEmployeeId: string
  onEmployeeChange: (id: string) => void
  startStr?: string
  endStr?: string
  onStartChange: (date: Date) => void
  onEndChange: (date: Date) => void
  onResetThisMonth: () => void
}

export function AttendanceFilterBar({
  employees,
  selectedEmployeeId,
  onEmployeeChange,
  startStr,
  endStr,
  onStartChange,
  onEndChange,
  onResetThisMonth,
}: AttendanceFilterBarProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("intervalChecker")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("intervalDesc")}</p>
      </CardHeader>
      <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="grid gap-1.5">
          <Label>{t("navEmployees")}</Label>
          <Select value={selectedEmployeeId} onValueChange={onEmployeeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allEmployees")}</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("startDate")}</Label>
          <Input
            data-testid="interval-start"
            type="date"
            value={startStr ?? ""}
            onChange={(e) => {
              if (!e.target.value) return
              const parsed = safeParseIsoDate(e.target.value)
              if (parsed) onStartChange(parsed)
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("endDate")}</Label>
          <Input
            data-testid="interval-end"
            type="date"
            value={endStr ?? ""}
            onChange={(e) => {
              if (!e.target.value) return
              const parsed = safeParseIsoDate(e.target.value)
              if (parsed) onEndChange(parsed)
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onResetThisMonth}
          >
            {t("thisMonth")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
