import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VacationBalance } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

export function VacationBalancesCard({
  balances,
  year,
}: {
  balances: VacationBalance[]
  year: number
}) {
  const { t } = useTranslation()

  if (balances.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t("vacationBalancesTitle")} ({year})
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
                <span className="font-medium text-sm">{b.employee_name}</span>
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
                {t("taken")}: {b.days_taken} · {t("pending")}: {b.days_pending}{" "}
                · {t("remaining")}: {b.days_remaining}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
