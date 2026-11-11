import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import logoMark from "/assets/images/el-ame-lab-logo.png"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  if (variant === "icon") {
    return (
      <LogoLink asLink={asLink}>
        <img
          src={logoMark}
          alt="EL-AMEL LAB"
          className={cn("size-8 rounded-full object-cover", className)}
        />
      </LogoLink>
    )
  }

  return (
    <LogoLink asLink={asLink}>
      <span className={cn("flex items-center gap-2.5", className)}>
        <img
          src={logoMark}
          alt="EL-AMEL LAB"
          className={cn(
            "rounded-full object-cover",
            variant === "full" ? "size-12" : "size-8",
          )}
        />
        <span
          className={cn(
            "font-bold tracking-tight",
            variant === "full"
              ? "text-2xl"
              : "text-lg group-data-[collapsible=icon]:hidden",
          )}
        >
          EL-AMEL LAB
        </span>
      </span>
    </LogoLink>
  )
}

function LogoLink({
  asLink,
  children,
}: {
  asLink: boolean
  children: React.ReactNode
}) {
  if (!asLink) {
    return <>{children}</>
  }

  return <Link to="/">{children}</Link>
}
