import { createFileRoute } from "@tanstack/react-router"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CompanySettingsTab } from "@/features/settings/CompanySettingsTab"
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

function UserSettings() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settingsTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("settingsSubtitle")}</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="max-w-full overflow-x-auto flex-nowrap sm:flex-wrap h-auto gap-1 no-scrollbar [webkit-overflow-scrolling:touch]">
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
