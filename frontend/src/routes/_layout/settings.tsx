import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"
import { settingsApi } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: "Settings - EL-AMEL LAB",
      },
    ],
  }),
})

function CompanySettingsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: settingsApi.getCompany,
  })

  const [form, setForm] = useState({
    company_name: "EL-AMEL LAB",
    address: "",
    phone: "",
    email: "",
    tax_id: "",
    currency: "DZD",
    working_days_per_month: 22,
    default_annual_vacation_days: 30,
  })

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name,
        address: data.address ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        tax_id: data.tax_id ?? "",
        currency: data.currency,
        working_days_per_month: data.working_days_per_month,
        default_annual_vacation_days: data.default_annual_vacation_days,
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateCompany({
        ...form,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        tax_id: form.tax_id || null,
      }),
    onSuccess: () => {
      toast.success("Paramètres enregistrés")
      queryClient.invalidateQueries({ queryKey: ["company-settings"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">{t("tabCompany")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
          className="grid gap-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("companyName")}</Label>
              <Input
                required
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("taxId")}</Label>
              <Input
                placeholder="NIF / RC"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("address")}</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 border-t pt-4">
            <div className="grid gap-1.5">
              <Label>{t("currency")}</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("workingDaysMonth")}</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.working_days_per_month}
                onChange={(e) =>
                  setForm({
                    ...form,
                    working_days_per_month: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("defaultVacDays")}</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={form.default_annual_vacation_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_annual_vacation_days: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <LoadingButton type="submit" loading={saveMutation.isPending}>
              {t("save")}
            </LoadingButton>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function UserSettings() {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settingsTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("settingsSubtitle")}</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{t("tabCompany")}</TabsTrigger>
          <TabsTrigger value="my-profile">{t("tabProfile")}</TabsTrigger>
          <TabsTrigger value="password">{t("tabPassword")}</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <CompanySettingsTab />
        </TabsContent>
        <TabsContent value="my-profile" className="mt-4">
          <UserInformation />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <ChangePassword />
        </TabsContent>
      </Tabs>
    </div>
  )
}
