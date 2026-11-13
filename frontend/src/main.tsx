import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"

import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import { setUnauthorizedHandler } from "./lib/hr-api"
import { I18nProvider } from "./lib/i18n"
import "./index.css"
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient()
setUnauthorizedHandler(() => queryClient.clear())

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
