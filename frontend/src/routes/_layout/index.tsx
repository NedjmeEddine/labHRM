import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  CalendarCheck,
  CalendarDays,
  Palmtree,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardApi } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - EL-AMEL LAB",
      },
    ],
  }),
})

function Dashboard() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.getSummary,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("dashTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("dashSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/attendance">
              <CalendarCheck className="mr-1.5 h-4 w-4" />
              {t("markAbsence")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/employees">
              <UserPlus className="mr-1.5 h-4 w-4" />
              {t("addEmployee")}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("activeEmployees")}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {data?.active_employees ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.total_employees ?? 0} {t("totalStaff")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("absentToday")}
            </CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {data?.absent_today_count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {data && data.absent_today_names.length > 0
                    ? data.absent_today_names.join(", ")
                    : t("everyonePresent")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("onVacationToday")}
            </CardTitle>
            <Palmtree className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {data?.on_vacation_today_count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {data && data.on_vacation_today_names.length > 0
                    ? data.on_vacation_today_names.join(", ")
                    : t("noneOnLeave")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("monthlyPayroll")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatDZD(data?.current_month_payroll_total ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data &&
                  (data.current_month_paid_count > 0 ||
                    data.current_month_draft_count > 0)
                    ? `${data.current_month_paid_count} ${t("paidCount")} · ${data.current_month_draft_count} ${t("draftCount")}`
                    : t("estimatedFromBase")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Panels */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button
              asChild
              variant="outline"
              className="justify-start h-auto py-3"
            >
              <Link to="/employees">
                <UserPlus className="mr-2 h-4 w-4 text-brand" />
                <span>{t("addEmployee")}</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-start h-auto py-3"
            >
              <Link to="/attendance">
                <CalendarDays className="mr-2 h-4 w-4 text-destructive" />
                <span>{t("markAbsence")}</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-start h-auto py-3"
            >
              <Link to="/vacations">
                <Palmtree className="mr-2 h-4 w-4 text-brand" />
                <span>{t("addVacation")}</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-start h-auto py-3"
            >
              <Link to="/payroll">
                <Wallet className="mr-2 h-4 w-4 text-brand" />
                <span>{t("managePayroll")}</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t("upcomingVacations")}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/vacations">{t("navVacations")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : data && data.upcoming_vacations.length > 0 ? (
              <div className="space-y-3">
                {data.upcoming_vacations.map((vac) => (
                  <div
                    key={vac.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{vac.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vac.start_date} → {vac.end_date} ({vac.days_count}{" "}
                        {t("days")})
                      </p>
                    </div>
                    <Badge
                      variant={
                        vac.status === "approved" ? "default" : "secondary"
                      }
                    >
                      {vac.status === "approved"
                        ? t("statusApproved")
                        : t("statusPending")}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
