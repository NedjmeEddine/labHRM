# Frontend Architecture & Standards

> **Purpose:** Document front-end engineering conventions, React 19 standards, TanStack patterns, bilingual localization, and Vercel React Best Practices for EL-AMEL LAB.

---

## 1. Directory Structure & Feature Organization

The frontend codebase in `frontend/src/` is organized into feature-driven modules:

```text
frontend/src/
├── components/          # Shared atomic UI & layout primitives
│   ├── ui/              # shadcn/ui components (Radix primitives)
│   ├── Common/          # Shared compound components (DataTable, ConfirmDeleteDialog, Logo, Footer)
│   ├── Sidebar/         # Collapsible responsive sidebar (AppSidebar, Main, User)
│   └── UserSettings/    # Profile & Password management components
├── features/            # Feature-specific state, dialogs, and tables
│   ├── employees/       # EmployeeFormDialog, EmployeeDetailTabs
│   ├── attendance/      # AttendanceFilterBar, AttendanceCalendarCard, SelectedDayCard, SummaryCards, Table, AbsenceFormDialog
│   ├── vacations/       # VacationBalancesCard, VacationsTable, VacationFormDialog
│   ├── payroll/         # PayslipsTab, PerformanceTab, SingleDraftDialog, PayslipEditorDialog, PerformanceReviewDialog
│   └── settings/        # CompanySettingsTab (form + DB backup trigger)
├── hooks/               # Custom hooks (useAuth, useDebouncedValue, useCustomToast, useCopyToClipboard, useMobile)
├── lib/                 # Single sources of truth for API, query keys, date helpers, labels & i18n
│   ├── api/             # HTTP client (Axios), token interceptor, authApi, usersApi
│   ├── hr-api.ts        # Typed domain HR & Settings API methods
│   ├── query-keys.ts    # Centralized React Query key factory
│   ├── domain-labels.ts # Bilingual status badge & type label mappers
│   ├── date.ts          # Local timezone date formatting & safe interval helpers
│   ├── storage.ts       # Safe localStorage wrapper
│   └── i18n.tsx         # Bilingual context (t, lang, setLang, formatDZD)
└── routes/              # TanStack Router file-based route definitions (thin page coordinators)
```

---

## 2. Unified Manual Typed API Client (`frontend/src/lib/api/`)

The application uses a **single typed Axios client layer**:
* `src/lib/api/client.ts`: Contains the Axios instance (`api`), request interceptor injecting `Authorization: Bearer <token>`, and error message extractor (`extractApiErrorMessage`).
* `src/lib/api/auth.ts`: Defines `authApi` (`login`, `testToken`) and `usersApi` (`readMe`, `updateMe`, `updatePassword`).
* `src/lib/hr-api.ts`: Re-exports auth methods and defines domain API objects: `dashboardApi`, `employeesApi`, `absencesApi`, `vacationsApi`, `performanceApi`, `payslipsApi`, and `settingsApi`.

### Authentication & Token Invalidation Rules
1. **Single 401/403 Handler:** The response interceptor in `src/lib/api/client.ts` catches `401` and `403` responses. It clears the token, triggers the registered cache-clearing callback, and redirects to `/login` **only when the user is not already on `/login`**.
2. **Explicit Cache Invalidation:**
   * On logout: `queryClient.clear()` is called to flush cached patient and employee records from memory.
   * On profile updates: Invalidate only `queryKeys.auth.currentUser`. **Never call `queryClient.invalidateQueries()` without a key**, as that forces unnecessary network refetches across all active background queries.

---

## 3. Vercel React Best Practices Checklist

The frontend follows the Vercel React & Next.js performance guidelines:

### 1. Eliminating Unnecessary Re-Renders (`rerender-*`)
* **Isolate Modal Form State:** Complex modal dialogs (`EmployeeFormDialog`, `PayslipEditorDialog`, `AbsenceFormDialog`, `VacationFormDialog`) keep their input state inside the dialog component body. Keystrokes re-render only the dialog, leaving background tables and calendars untouched.
* **Keyed Forms for Derived State:** Do not sync server query data into local state via `useEffect`. Instead, use keyed component instances:
  ```tsx
  // Correct: Form re-initializes cleanly when updated_at changes; zero useEffect needed
  <CompanySettingsForm key={data?.updated_at ?? "default"} initialData={data} />
  ```
* **Memoize Context Values:** `I18nProvider` and `ThemeProvider` wrap translation and setter functions in `useCallback` and provide memoized value objects (`useMemo`) to prevent unnecessary re-renders of consuming components.
* **Debounce High-Frequency Inputs:** Search inputs on tables are debounced with `useDebouncedValue(search, 200)` to prevent firing network queries on every keystroke.

### 2. Eliminating Waterfalls & Redundant Requests (`async-*`)
* **Deduplicate Overlapping Queries:** When the selected interval matches the currently displayed calendar month in `attendance.tsx`, reuse `intervalSummary` instead of firing a second identical `absencesApi.list` query.
* **Render Settings Immediately:** Do not block entire settings tabs behind `currentUser` loading if independent settings (like `CompanySettingsTab`) are ready to display.

### 3. Bundle Size Optimization (`bundle-*`)
* **DevTools Excluded in Production:** `ReactQueryDevtools` and `TanStackRouterDevtools` are dynamically imported only in development via `import.meta.env.DEV`:
  ```tsx
  // frontend/src/routes/__root.tsx
  const DevTools = import.meta.env.DEV
    ? lazy(async () => {
        const [{ TanStackRouterDevtools }, { ReactQueryDevtools }] = await Promise.all([
          import("@tanstack/react-router-devtools"),
          import("@tanstack/react-query-devtools"),
        ])
        return {
          default: () => (
            <>
              <TanStackRouterDevtools position="bottom-right" />
              <ReactQueryDevtools initialIsOpen={false} />
            </>
          ),
        }
      })
    : null
  ```
* **Tree-Shaking & Dead Dependencies:** Unused packages (e.g. `@hey-api/openapi-ts`, `react-icons`, `form-data`) have been removed from `package.json`.

### 4. React 19 Patterns (`react19-*`)
* **No `forwardRef`:** In React 19, `ref` is a standard prop. Custom components (e.g., `PasswordInput`) accept `ref?: React.Ref<HTMLInputElement>` directly without the `React.forwardRef` wrapper.

---

## 4. Date Handling & Timezone Convention

* **Never use `.toISOString().split("T")[0]` for form defaults.** `toISOString()` returns UTC time. In Algeria (UTC+1), between 00:00 and 00:59 local time, UTC represents the previous calendar day, resulting in an off-by-one date bug.
* **Always use `formatLocalDate()` from `src/lib/date.ts`**, which uses `date-fns` to format dates in local timezone time (`yyyy-MM-dd`).
* **Safe Interval Expansion:** Always expand calendar days through `safeEachDayOfInterval(start, end)`: it validates that `start <= end` and guards against uncaught `RangeError` crashes on invalid date ranges.

---

## 5. Bilingual Localization (`src/lib/i18n.tsx`)

* All user-facing strings must use the `t("key")` translation helper.
* Keys are strictly typed via `TranslationKey = keyof typeof translations.fr`.
* Status badges and absence/vacation type labels are centralized in `src/lib/domain-labels.ts`:
  * `getEmployeeStatusDisplay(status, t)`
  * `getAbsenceTypeLabel(type, t)`
  * `getVacationTypeLabel(type, t)`
  * `getVacationStatusDisplay(status, t)`
  * `getPayslipStatusDisplay(status, t)`
  * `getPaymentMethodLabel(method, t)`
* All delete actions use the shared `<ConfirmDeleteDialog>` component with localized confirmation copy.
