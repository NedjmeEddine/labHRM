import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Appearance } from "@/components/Common/Appearance"
import { Footer } from "@/components/Common/Footer"
import { LanguageSwitcher } from "@/components/Common/LanguageSwitcher"
import { Logo } from "@/components/Common/Logo"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 sm:px-6 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2 min-w-0 md:hidden">
              <Logo variant="icon" className="size-6 shrink-0" />
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                EL-AMEL LAB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageSwitcher />
            <Appearance />
          </div>
        </header>
        <main className="flex-1 p-3.5 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
