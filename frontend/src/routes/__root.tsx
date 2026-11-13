import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import ErrorComponent from "@/components/Common/ErrorComponent"
import NotFound from "@/components/Common/NotFound"

const DevTools = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackRouterDevtools }, { ReactQueryDevtools }] =
        await Promise.all([
          import("@tanstack/react-router-devtools"),
          import("@tanstack/react-query-devtools"),
        ])
      return {
        default: function DevToolsBundle() {
          return (
            <>
              <TanStackRouterDevtools position="bottom-right" />
              <ReactQueryDevtools initialIsOpen={false} />
            </>
          )
        },
      }
    })
  : null

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      {DevTools ? (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      ) : null}
    </>
  ),
  notFoundComponent: () => <NotFound />,
  errorComponent: () => <ErrorComponent />,
})
