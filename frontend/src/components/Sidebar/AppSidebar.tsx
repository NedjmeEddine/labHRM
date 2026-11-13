import {
  Boxes,
  CalendarDays,
  Home,
  Palmtree,
  Settings,
  Users,
  Wallet,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { useTranslation } from "@/lib/i18n"
import { type Item, Main } from "./Main"
import { User } from "./User"

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()

  const navItems: Item[] = [
    { icon: Home, title: t("navDashboard"), path: "/" },
    { icon: Users, title: t("navEmployees"), path: "/employees" },
    { icon: CalendarDays, title: t("navAttendance"), path: "/attendance" },
    { icon: Palmtree, title: t("navVacations"), path: "/vacations" },
    { icon: Wallet, title: t("navPayroll"), path: "/payroll" },
    { icon: Boxes, title: t("navInventory"), path: "/inventory" },
    { icon: Settings, title: t("navSettings"), path: "/settings" },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
