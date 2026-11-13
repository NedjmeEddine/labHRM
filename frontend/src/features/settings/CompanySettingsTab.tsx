import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  type CompanySettings,
  extractApiErrorMessage,
  settingsApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

function CompanySettingsForm({
  initialData,
}: {
  initialData?: CompanySettings
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    company_name: initialData?.company_name ?? "EL-AMEL LAB",
    address: initialData?.address ?? "",
    phone: initialData?.phone ?? "",
    email: initialData?.email ?? "",
    tax_id: initialData?.tax_id ?? "",
    currency: initialData?.currency ?? "DZD",
    working_days_per_month: initialData?.working_days_per_month ?? 22,
    default_annual_vacation_days:
      initialData?.default_annual_vacation_days ?? 30,
    inventory_tracking_enabled:
      initialData?.inventory_tracking_enabled ?? false,
    manual_stock_out_enabled: initialData?.manual_stock_out_enabled ?? false,
    default_expiry_alert_days: initialData?.default_expiry_alert_days ?? 60,
  })

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
      toast.success(t("toastSettingsSaved"))
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.company })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        saveMutation.mutate()
      }}
      className="grid gap-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("companyName")}</Label>
          <Input
            required
            value={form.company_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, company_name: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("taxId")}</Label>
          <Input
            placeholder="NIF / RC"
            value={form.tax_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tax_id: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("address")}</Label>
        <Input
          value={form.address}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, address: e.target.value }))
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{t("phone")}</Label>
          <Input
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
        <div className="grid gap-1.5">
          <Label>{t("currency")}</Label>
          <Input
            value={form.currency}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currency: e.target.value }))
            }
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
              setForm((prev) => ({
                ...prev,
                working_days_per_month: Number(e.target.value),
              }))
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
              setForm((prev) => ({
                ...prev,
                default_annual_vacation_days: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 border-t pt-4">
        <h4 className="text-sm font-semibold text-foreground">
          {t("tabProducts")} & {t("tabSuppliers")} (Modules Optionnels)
        </h4>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-base">{t("toggleInventoryTracking")}</Label>
            <p className="text-xs text-muted-foreground">
              Affiche les onglets Lots, Dates de Péremption et Alertes de Stock.
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={form.inventory_tracking_enabled}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                inventory_tracking_enabled: e.target.checked,
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-base">{t("toggleManualStockOut")}</Label>
            <p className="text-xs text-muted-foreground">
              Permet de déclarer des sorties manuelles (consommation de
              paillasse, rebut).
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={form.manual_stock_out_enabled}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                manual_stock_out_enabled: e.target.checked,
              }))
            }
          />
        </div>

        <div className="grid gap-1.5 sm:max-w-xs">
          <Label>{t("defaultExpiryAlertDays")}</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={form.default_expiry_alert_days}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                default_expiry_alert_days: Number(e.target.value),
              }))
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
  )
}

export function CompanySettingsTab() {
  const { t } = useTranslation()
  const [downloadingBackup, setDownloadingBackup] = useState(false)

  const { data } = useQuery({
    queryKey: queryKeys.settings.company,
    queryFn: settingsApi.getCompany,
  })

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true)
    try {
      await settingsApi.downloadBackup()
      toast.success(t("toastBackupDownloaded"))
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastExportError")))
    } finally {
      setDownloadingBackup(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("tabCompany")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanySettingsForm
            key={data?.updated_at ?? "default"}
            initialData={data}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("backupTitle")}</CardTitle>
          <CardDescription>{t("backupDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={downloadingBackup}
            onClick={handleDownloadBackup}
            data-testid="download-backup-button"
          >
            <Download className="mr-2 h-4 w-4" />
            {t("downloadBackup")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
