export const queryKeys = {
  auth: {
    currentUser: ["currentUser"] as const,
  },
  dashboard: {
    summary: ["dashboard"] as const,
  },
  employees: {
    all: ["employees"] as const,
    list: (search: string) => ["employees", search] as const,
    detail: (id: string) => ["employee", id] as const,
    balance: (id: string) => ["employee-balance", id] as const,
    salaryHistory: (id: string) => ["employee-salary-history", id] as const,
  },
  absences: {
    all: ["absences"] as const,
    list: (filters: {
      employeeId?: string
      startDate?: string
      endDate?: string
    }) => ["absences", filters] as const,
    month: (filters: {
      employeeId?: string
      startDate: string
      endDate: string
    }) => ["absences-month", filters] as const,
  },
  vacations: {
    all: ["vacations"] as const,
    list: (filters?: {
      employeeId?: string
      status?: string
      startDate?: string
      endDate?: string
    }) => ["vacations", filters ?? "all"] as const,
    month: (filters: {
      employeeId?: string
      startDate: string
      endDate: string
    }) => ["vacations-month", filters] as const,
    balances: (year: number) => ["vacation-balances", year] as const,
  },
  performance: {
    all: ["performance"] as const,
    list: (filters: { employeeId?: string; month?: number; year?: number }) =>
      ["performance", filters] as const,
  },
  payslips: {
    all: ["payslips"] as const,
    list: (filters: { employeeId?: string; month?: number; year?: number }) =>
      ["payslips", filters] as const,
  },
  settings: {
    company: ["company-settings"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (filters?: { search?: string; active_only?: boolean }) =>
      ["suppliers", filters ?? "all"] as const,
    detail: (id: string) => ["supplier", id] as const,
  },
  products: {
    all: ["products"] as const,
    list: (filters?: {
      category?: string
      search?: string
      active_only?: boolean
    }) => ["products", filters ?? "all"] as const,
    detail: (id: string) => ["product", id] as const,
    priceHistory: (id: string) => ["product-price-history", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (filters?: object) => ["invoices", filters ?? "all"] as const,
    detail: (id: string) => ["invoice", id] as const,
    dashboard: ["inventory-dashboard"] as const,
    tvaSummary: (year?: number) =>
      ["invoices-tva-summary", year ?? "current"] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    lots: (filters?: object) => ["inventory-lots", filters ?? "all"] as const,
    movements: (filters?: object) =>
      ["inventory-movements", filters ?? "all"] as const,
    lowStockAlerts: ["inventory-alerts-low-stock"] as const,
    expiringLots: (days?: number) =>
      ["inventory-alerts-expiring-lots", days ?? 60] as const,
  },
} as const
