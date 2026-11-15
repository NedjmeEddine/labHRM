import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Download,
  Globe,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import {
  type AppUpdateMetadata,
  checkAppUpdate,
  getCloudflareTunnelStatus,
  installAppUpdate,
  isTauri,
  startCloudflareTunnel,
  stopCloudflareTunnel,
} from "@/lib/platform"
import { queryKeys } from "@/lib/query-keys"
import { getStorageItem, setStorageItem } from "@/lib/storage"

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

      <RemoteAccessCard />
      <AppUpdatesCard />
    </div>
  )
}

function RemoteAccessCard() {
  const { t } = useTranslation()
  const inDesktop = isTauri()
  const [token, setToken] = useState(
    () => getStorageItem("elamel_tunnel_token") ?? "",
  )
  const [tunnelRunning, setTunnelRunning] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (inDesktop) {
      getCloudflareTunnelStatus().then(setTunnelRunning)
    }
  }, [inDesktop])

  const handleToggleTunnel = async () => {
    if (!token.trim()) {
      toast.error(t("tunnelTokenPlaceholder"))
      return
    }
    setLoading(true)
    try {
      setStorageItem("elamel_tunnel_token", token.trim())
      if (tunnelRunning) {
        const msg = await stopCloudflareTunnel()
        toast.info(msg)
        setTunnelRunning(false)
      } else {
        const msg = await startCloudflareTunnel(token.trim())
        toast.success(msg)
        setTunnelRunning(true)
      }
    } catch (err: unknown) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              {t("remoteAccessTitle")}
            </CardTitle>
          </div>
          {inDesktop && (
            <Badge
              variant={tunnelRunning ? "default" : "outline"}
              className={tunnelRunning ? "bg-emerald-600" : ""}
            >
              {tunnelRunning ? t("tunnelActive") : t("tunnelInactive")}
            </Badge>
          )}
        </div>
        <CardDescription>{t("remoteAccessDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {inDesktop ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>{t("tunnelToken")}</Label>
              <Input
                type="password"
                placeholder={t("tunnelTokenPlaceholder")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={tunnelRunning}
              />
            </div>
            <LoadingButton
              type="button"
              variant={tunnelRunning ? "destructive" : "default"}
              onClick={handleToggleTunnel}
              loading={loading}
            >
              {tunnelRunning ? t("stopTunnel") : t("startTunnel")}
            </LoadingButton>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-md bg-muted/50 p-3 font-mono text-xs border">
              ./scripts/setup-tunnel.sh
            </div>
            <p className="text-xs text-muted-foreground">
              {t("remoteAccessTunnelRunningHint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AppUpdatesCard() {
  const { t } = useTranslation()
  const inDesktop = isTauri()
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateMetadata | null>(null)
  const [checkedOnce, setCheckedOnce] = useState(false)

  if (!inDesktop) return null

  const handleCheckUpdate = async () => {
    setChecking(true)
    try {
      const res = await checkAppUpdate()
      setUpdateInfo(res)
      setCheckedOnce(true)
      if (!res?.available) {
        toast.info(t("appUpToDate"))
      }
    } catch (err: unknown) {
      toast.error(String(err))
    } finally {
      setChecking(false)
    }
  }

  const handleInstallUpdate = async () => {
    setInstalling(true)
    try {
      // 1. Safe SQLite snapshot first
      await settingsApi.downloadBackup()
      // 2. Download and install
      await installAppUpdate()
    } catch (err: unknown) {
      toast.error(String(err))
      setInstalling(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t("updatesTitle")}</CardTitle>
        </div>
        <CardDescription>{t("updatesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {updateInfo?.available ? (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">
                {t("updateAvailable")}: v{updateInfo.version}
              </span>
              <span className="text-xs text-muted-foreground">
                (Actuelle: v{updateInfo.current_version})
              </span>
            </div>
            {updateInfo.body && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {updateInfo.body}
              </p>
            )}
            <LoadingButton
              type="button"
              onClick={handleInstallUpdate}
              loading={installing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("installAndRestart")}
            </LoadingButton>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <LoadingButton
              type="button"
              variant="outline"
              onClick={handleCheckUpdate}
              loading={checking}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("checkUpdates")}
            </LoadingButton>
            {checkedOnce && !updateInfo?.available && (
              <span className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {t("appUpToDate")}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
