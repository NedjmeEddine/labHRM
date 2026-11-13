import { api, downloadAuthenticatedFile } from "@/lib/api/client"
import { formatLocalDate } from "@/lib/date"

export {
  authApi,
  type LoginCredentials,
  type TokenResponse,
  type UpdatePassword,
  type UserPublic,
  type UserUpdateMe,
  usersApi,
} from "@/lib/api/auth"
export {
  api,
  downloadAuthenticatedFile,
  extractApiErrorMessage,
  setUnauthorizedHandler,
} from "@/lib/api/client"

// --- HR & Settings Domain Types ---
export interface CompanySettings {
  id: number
  company_name: string
  address: string | null
  phone: string | null
  email: string | null
  tax_id: string | null
  currency: string
  working_days_per_month: number
  default_annual_vacation_days: number
  inventory_tracking_enabled?: boolean
  manual_stock_out_enabled?: boolean
  default_expiry_alert_days?: number
  updated_at: string
}

export type EmployeeStatus = "active" | "on_leave" | "terminated"
export type AbsenceType = "unjustified" | "sick" | "justified" | "half_day"
export type VacationType = "annual" | "sick" | "unpaid" | "other"
export type VacationStatus = "approved" | "pending" | "rejected"
export type PaymentMethod = "bank_transfer" | "cash" | "check"
export type PayslipStatus = "draft" | "paid"

export interface Employee {
  id: string
  employee_code: string
  full_name: string
  email: string | null
  phone: string | null
  job_title: string
  department: string
  hire_date: string
  status: EmployeeStatus
  base_salary: number
  annual_vacation_days: number
  social_security_number: string | null
  notes: string | null
  created_at: string
}

export interface EmployeeCreate {
  employee_code?: string | null
  full_name: string
  email?: string | null
  phone?: string | null
  job_title: string
  department: string
  hire_date: string
  status?: EmployeeStatus
  base_salary: number
  annual_vacation_days: number
  social_security_number?: string | null
  notes?: string | null
}

export interface EmployeeUpdate extends Partial<EmployeeCreate> {
  salary_change_reason?: string | null
}

export interface SalaryHistory {
  id: string
  employee_id: string
  previous_salary: number
  new_salary: number
  reason: string
  changed_at: string
}

export interface Absence {
  id: string
  employee_id: string
  date: string
  absence_type: AbsenceType
  is_paid: boolean
  reason: string | null
  employee_name: string | null
  employee_code: string | null
  created_at: string
}

export interface AbsencesIntervalSummary {
  data: Absence[]
  total_count: number
  unpaid_days: number
  paid_days: number
  half_days: number
  estimated_deduction: number
}

export interface Vacation {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  days_count: number
  vacation_type: VacationType
  status: VacationStatus
  notes: string | null
  employee_name: string | null
  employee_code: string | null
  created_at: string
}

export interface VacationBalance {
  employee_id: string
  employee_name: string
  employee_code: string
  year: number
  annual_allowance: number
  days_taken: number
  days_pending: number
  days_remaining: number
}

export interface PerformanceReview {
  id: string
  employee_id: string
  period_month: number
  period_year: number
  score: number
  bonus_amount: number
  new_base_salary: number | null
  notes: string | null
  employee_name: string | null
  employee_code: string | null
  created_at: string
}

export interface Payslip {
  id: string
  employee_id: string
  month: number
  year: number
  base_salary: number
  performance_bonus: number
  other_allowances: number
  overtime_pay: number
  absence_days: number
  absence_deduction: number
  other_deductions: number
  gross_salary: number
  net_salary: number
  worked_days: number
  vacation_days_taken: number
  payment_method: PaymentMethod
  status: PayslipStatus
  notes: string | null
  employee_name: string
  employee_code: string
  job_title: string
  department: string
  social_security_number: string | null
  created_at: string
  updated_at: string
}

export interface DashboardSummary {
  total_employees: number
  active_employees: number
  absent_today_count: number
  on_vacation_today_count: number
  absent_today_names: string[]
  on_vacation_today_names: string[]
  current_month_payroll_total: number
  current_month_paid_count: number
  current_month_draft_count: number
  upcoming_vacations: Vacation[]
  currency: string
}

export const dashboardApi = {
  getSummary: () =>
    api.get<DashboardSummary>("/api/v1/dashboard/").then((r) => r.data),
}

export const employeesApi = {
  list: (params?: { status?: EmployeeStatus; search?: string }) =>
    api
      .get<{ data: Employee[]; count: number }>("/api/v1/employees/", {
        params,
      })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<Employee>(`/api/v1/employees/${id}`).then((r) => r.data),
  create: (data: EmployeeCreate) =>
    api.post<Employee>("/api/v1/employees/", data).then((r) => r.data),
  update: (id: string, data: EmployeeUpdate) =>
    api.patch<Employee>(`/api/v1/employees/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/v1/employees/${id}`).then((r) => r.data),
  getSalaryHistory: (id: string) =>
    api
      .get<SalaryHistory[]>(`/api/v1/employees/${id}/salary-history`)
      .then((r) => r.data),
  getVacationBalance: (id: string, year?: number) =>
    api
      .get<VacationBalance>(`/api/v1/employees/${id}/vacation-balance`, {
        params: { year },
      })
      .then((r) => r.data),
}

export const absencesApi = {
  list: (params?: {
    employee_id?: string
    start_date?: string
    end_date?: string
    absence_type?: AbsenceType
  }) =>
    api
      .get<AbsencesIntervalSummary>("/api/v1/absences/", { params })
      .then((r) => r.data),
  create: (data: {
    employee_id: string
    date: string
    absence_type: AbsenceType
    is_paid: boolean
    reason?: string | null
  }) => api.post<Absence>("/api/v1/absences/", data).then((r) => r.data),
  createRange: (data: {
    employee_id: string
    start_date: string
    end_date: string
    absence_type: AbsenceType
    is_paid: boolean
    reason?: string | null
  }) => api.post<Absence[]>("/api/v1/absences/range", data).then((r) => r.data),
  update: (id: string, data: Partial<Absence>) =>
    api.patch<Absence>(`/api/v1/absences/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/v1/absences/${id}`).then((r) => r.data),
  exportCsv: (params?: {
    employee_id?: string
    start_date?: string
    end_date?: string
    absence_type?: AbsenceType
  }) => {
    const query = new URLSearchParams()
    if (params?.employee_id) query.set("employee_id", params.employee_id)
    if (params?.start_date) query.set("start_date", params.start_date)
    if (params?.end_date) query.set("end_date", params.end_date)
    if (params?.absence_type) query.set("absence_type", params.absence_type)
    const qs = query.toString()
    return downloadAuthenticatedFile(
      `/api/v1/absences/export/csv${qs ? `?${qs}` : ""}`,
      "absences_el_amel_lab.csv",
    )
  },
}

export const vacationsApi = {
  list: (params?: {
    employee_id?: string
    status?: VacationStatus
    start_date?: string
    end_date?: string
  }) =>
    api
      .get<{ data: Vacation[]; count: number }>("/api/v1/vacations/", {
        params,
      })
      .then((r) => r.data),
  balances: (year?: number) =>
    api
      .get<VacationBalance[]>("/api/v1/vacations/balances", {
        params: { year },
      })
      .then((r) => r.data),
  create: (data: {
    employee_id: string
    start_date: string
    end_date: string
    vacation_type: VacationType
    status: VacationStatus
    notes?: string | null
  }) => api.post<Vacation>("/api/v1/vacations/", data).then((r) => r.data),
  update: (id: string, data: Partial<Vacation>) =>
    api.patch<Vacation>(`/api/v1/vacations/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/v1/vacations/${id}`).then((r) => r.data),
}

export const performanceApi = {
  list: (params?: {
    employee_id?: string
    period_month?: number
    period_year?: number
  }) =>
    api
      .get<{ data: PerformanceReview[]; count: number }>(
        "/api/v1/performance/",
        { params },
      )
      .then((r) => r.data),
  create: (data: {
    employee_id: string
    period_month: number
    period_year: number
    score: number
    bonus_amount: number
    new_base_salary?: number | null
    notes?: string | null
  }) =>
    api
      .post<PerformanceReview>("/api/v1/performance/", data)
      .then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/v1/performance/${id}`).then((r) => r.data),
}

export const payslipsApi = {
  list: (params?: {
    employee_id?: string
    month?: number
    year?: number
    status?: PayslipStatus
  }) =>
    api
      .get<{ data: Payslip[]; count: number }>("/api/v1/payslips/", { params })
      .then((r) => r.data),
  generateDraft: (data: {
    employee_id: string
    month: number
    year: number
    overwrite?: boolean
  }) =>
    api
      .post<Payslip>("/api/v1/payslips/generate-draft", data)
      .then((r) => r.data),
  generateBatch: (data: { month: number; year: number }) =>
    api
      .post<{ data: Payslip[]; count: number }>(
        "/api/v1/payslips/generate-batch",
        data,
      )
      .then((r) => r.data),
  update: (id: string, data: Partial<Payslip>) =>
    api.put<Payslip>(`/api/v1/payslips/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/v1/payslips/${id}`).then((r) => r.data),
  downloadPdf: (payslip: Payslip, inline = false) =>
    downloadAuthenticatedFile(
      `/api/v1/payslips/${payslip.id}/pdf?inline=${inline}`,
      `bulletin_paie_${payslip.employee_code}_${String(payslip.month).padStart(2, "0")}_${payslip.year}.pdf`,
      inline,
    ),
  exportCsv: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams()
    if (params?.month) query.set("month", String(params.month))
    if (params?.year) query.set("year", String(params.year))
    const qs = query.toString()
    return downloadAuthenticatedFile(
      `/api/v1/payslips/export/csv${qs ? `?${qs}` : ""}`,
      `paie_${params?.year ?? "all"}_${params?.month ?? "all"}.csv`,
    )
  },
}

export const settingsApi = {
  getCompany: () =>
    api.get<CompanySettings>("/api/v1/settings/company").then((r) => r.data),
  updateCompany: (data: Partial<CompanySettings>) =>
    api
      .patch<CompanySettings>("/api/v1/settings/company", data)
      .then((r) => r.data),
  downloadBackup: () =>
    downloadAuthenticatedFile(
      "/api/v1/settings/backup",
      `el_amel_lab_backup_${formatLocalDate()}.db`,
    ),
}
