import { Appearance } from "@/components/Common/Appearance"
import { LanguageSwitcher } from "@/components/Common/LanguageSwitcher"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-muted/40 dark:bg-card relative hidden lg:flex lg:items-center lg:justify-center border-r border-border">
        <Logo variant="icon" asLink={false} className="size-32 sm:size-40" />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-6 md:p-10">
        <div className="flex justify-end gap-2">
          <LanguageSwitcher />
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center py-4">
          <div className="w-full max-w-sm">
            <div className="flex justify-center mb-6 lg:hidden">
              <Logo variant="icon" asLink={false} className="size-16" />
            </div>
            {children}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
