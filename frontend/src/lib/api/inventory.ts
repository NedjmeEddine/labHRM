import { api, downloadAuthenticatedFile } from "@/lib/api/client"

export type ProductCategory = "reagent" | "consumable" | "equipment" | "other"
export type InvoiceStatus = "draft" | "confirmed" | "cancelled"
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid"
export type MovementType = "in" | "out" | "adjustment"
export type PaymentMethod = "bank_transfer" | "cash" | "check"

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  statistical_id: string | null
  trade_registry: string | null
  payment_terms: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  total_invoiced: string
  total_paid: string
  balance_owed: string
}

export interface SupplierCreate {
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  statistical_id?: string | null
  trade_registry?: string | null
  payment_terms?: string | null
  notes?: string | null
}

export interface SupplierUpdate {
  name?: string | null
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  statistical_id?: string | null
  trade_registry?: string | null
  payment_terms?: string | null
  notes?: string | null
  is_active?: boolean | null
}

export interface Product {
  id: string
  name: string
  reference_code: string | null
  category: ProductCategory
  unit: string
  usual_supplier_id: string | null
  usual_supplier_name: string | null
  track_lots: boolean
  min_stock: string | null
  storage_location: string | null
  notes: string | null
  is_active: boolean
  current_stock: string
  created_at: string
  updated_at: string
}

export interface ProductCreate {
  name: string
  reference_code?: string | null
  category?: ProductCategory
  unit?: string
  usual_supplier_id?: string | null
  track_lots?: boolean
  min_stock?: string | null
  storage_location?: string | null
  notes?: string | null
}

export interface ProductUpdate {
  name?: string | null
  reference_code?: string | null
  category?: ProductCategory | null
  unit?: string | null
  usual_supplier_id?: string | null
  track_lots?: boolean | null
  min_stock?: string | null
  storage_location?: string | null
  notes?: string | null
  is_active?: boolean | null
}

export interface ProductPriceHistoryItem {
  invoice_id: string
  invoice_number: string
  invoice_date: string
  supplier_id: string
  supplier_name: string
  quantity: string
  unit_price_excl_tax: string
  tva_rate: string
  total_line_incl_tax: string
}

export interface InvoiceLineCreate {
  product_id: string
  quantity: string
  unit_price_excl_tax: string
  tva_rate: string
  discount_amount?: string
  lot_number?: string | null
  expiration_date?: string | null
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  product_id: string
  product_name: string | null
  product_unit: string | null
  product_reference: string | null
  quantity: string
  unit_price_excl_tax: string
  tva_rate: string
  discount_amount: string
  total_line_excl_tax: string
  total_line_tva: string
  total_line_incl_tax: string
}

export interface PurchaseInvoice {
  id: string
  supplier_id: string
  supplier_name: string | null
  invoice_number: string
  invoice_date: string
  due_date: string | null
  supplier_stated_total: string | null
  status: InvoiceStatus
  is_credit_note: boolean
  parent_invoice_id: string | null
  notes: string | null
  total_excl_tax: string
  total_tva: string
  total_incl_tax: string
  amount_paid: string
  balance_remaining: string
  payment_status: InvoicePaymentStatus
  has_scan: boolean
  warning_total_mismatch: boolean
  stated_difference: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseInvoiceCreate {
  supplier_id: string
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  supplier_stated_total?: string | null
  status?: InvoiceStatus
  is_credit_note?: boolean
  parent_invoice_id?: string | null
  notes?: string | null
  lines: InvoiceLineCreate[]
}

export interface PurchaseInvoiceDetail extends PurchaseInvoice {
  lines: InvoiceLine[]
  payments: Payment[]
}

export interface Payment {
  id: string
  invoice_id: string
  invoice_number?: string | null
  supplier_id: string
  supplier_name?: string | null
  payment_date: string
  amount: string
  payment_method: PaymentMethod
  reference: string | null
  notes: string | null
  created_at: string
}

export interface PaymentCreate {
  invoice_id: string
  supplier_id: string
  payment_date: string
  amount: string
  payment_method: PaymentMethod
  reference?: string | null
  notes?: string | null
}

export interface Lot {
  id: string
  product_id: string
  product_name: string | null
  product_unit: string | null
  supplier_id: string | null
  supplier_name: string | null
  lot_number: string
  expiration_date: string
  received_date: string
  source_invoice_line_id: string | null
  is_active: boolean
  current_quantity: string
  is_expired: boolean
  days_until_expiry: number
  created_at: string
}

export interface LotCreate {
  product_id: string
  supplier_id?: string | null
  lot_number: string
  expiration_date: string
  received_date: string
  initial_quantity?: string | null
}

export interface StockMovement {
  id: string
  product_id: string
  product_name: string | null
  lot_id: string | null
  lot_number: string | null
  movement_type: MovementType
  quantity: string
  movement_date: string
  reason: string | null
  source_reference: string | null
  created_at: string
}

export interface StockMovementCreate {
  product_id: string
  lot_id?: string | null
  movement_type: MovementType
  quantity: string
  movement_date: string
  reason: string
}

export interface InventoryDashboardMetrics {
  total_debt_owed: string
  invoices_due_7_days_count: number
  invoices_due_7_days_total: string
  monthly_spending: Array<{
    month: number
    year: number
    total_spending: string
  }>
  top_suppliers_spending: Array<{
    supplier_id: string
    supplier_name: string
    total_spending: string
  }>
  low_stock_count: number
  expiring_lots_count: number
  currency: string
}

export interface SupplierDetail extends Supplier {
  invoices: PurchaseInvoice[]
  payments: Payment[]
}

export const suppliersApi = {
  list: (params?: {
    search?: string
    active_only?: boolean
    skip?: number
    limit?: number
  }) =>
    api
      .get<{ data: Supplier[]; count: number }>("/api/v1/suppliers/", {
        params,
      })
      .then((r) => r.data),
  create: (data: SupplierCreate) =>
    api.post<Supplier>("/api/v1/suppliers/", data).then((r) => r.data),
  get: (id: string) =>
    api.get<SupplierDetail>(`/api/v1/suppliers/${id}`).then((r) => r.data),
  update: (id: string, data: SupplierUpdate) =>
    api.patch<Supplier>(`/api/v1/suppliers/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api
      .delete<{ message: string }>(`/api/v1/suppliers/${id}`)
      .then((r) => r.data),
  downloadStatementPdf: (id: string, filename: string) =>
    downloadAuthenticatedFile(
      `/api/v1/suppliers/${id}/statement/pdf`,
      filename,
    ),
  downloadStatementCsv: (id: string, filename: string) =>
    downloadAuthenticatedFile(
      `/api/v1/suppliers/${id}/statement/csv`,
      filename,
    ),
}

export const productsApi = {
  list: (params?: {
    category?: string
    search?: string
    active_only?: boolean
    skip?: number
    limit?: number
  }) =>
    api
      .get<{ data: Product[]; count: number }>("/api/v1/products/", { params })
      .then((r) => r.data),
  create: (data: ProductCreate) =>
    api.post<Product>("/api/v1/products/", data).then((r) => r.data),
  get: (id: string) =>
    api.get<Product>(`/api/v1/products/${id}`).then((r) => r.data),
  update: (id: string, data: ProductUpdate) =>
    api.patch<Product>(`/api/v1/products/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api
      .delete<{ message: string }>(`/api/v1/products/${id}`)
      .then((r) => r.data),
  priceHistory: (id: string) =>
    api
      .get<ProductPriceHistoryItem[]>(`/api/v1/products/${id}/price-history`)
      .then((r) => r.data),
}

export const invoicesApi = {
  dashboard: () =>
    api
      .get<InventoryDashboardMetrics>("/api/v1/invoices/dashboard")
      .then((r) => r.data),
  list: (params?: {
    supplier_id?: string
    status?: string
    start_date?: string
    end_date?: string
    search?: string
    skip?: number
    limit?: number
  }) =>
    api
      .get<{ data: PurchaseInvoice[]; count: number }>("/api/v1/invoices/", {
        params,
      })
      .then((r) => r.data),
  create: (data: PurchaseInvoiceCreate) =>
    api
      .post<PurchaseInvoiceDetail>("/api/v1/invoices/", data)
      .then((r) => r.data),
  get: (id: string) =>
    api
      .get<PurchaseInvoiceDetail>(`/api/v1/invoices/${id}`)
      .then((r) => r.data),
  update: (id: string, data: Partial<PurchaseInvoiceCreate>) =>
    api
      .patch<PurchaseInvoiceDetail>(`/api/v1/invoices/${id}`, data)
      .then((r) => r.data),
  recordPayment: (invoiceId: string, data: PaymentCreate) =>
    api
      .post<Payment>(`/api/v1/invoices/${invoiceId}/payments`, data)
      .then((r) => r.data),
  uploadScan: (invoiceId: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return api
      .post<{ filename: string; message: string }>(
        `/api/v1/invoices/${invoiceId}/scan`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      .then((r) => r.data)
  },
  downloadScan: (invoiceId: string, filename: string) =>
    downloadAuthenticatedFile(
      `/api/v1/invoices/${invoiceId}/scan`,
      filename,
      true,
    ),
  exportCsv: (params?: {
    supplier_id?: string
    start_date?: string
    end_date?: string
  }) =>
    downloadAuthenticatedFile(
      `/api/v1/invoices/export/csv${params?.supplier_id ? `?supplier_id=${params.supplier_id}` : ""}`,
      "factures_achats.csv",
    ),
  tvaSummary: (year?: number) =>
    api
      .get<
        Array<{
          month: number
          year: number
          total_excl_tax: string
          total_tva: string
          total_incl_tax: string
        }>
      >("/api/v1/invoices/tva-summary", { params: { year } })
      .then((r) => r.data),
}

export const inventoryApi = {
  listLots: (params?: {
    product_id?: string
    is_active?: boolean
    skip?: number
    limit?: number
  }) =>
    api
      .get<{ data: Lot[]; count: number }>("/api/v1/inventory/lots", { params })
      .then((r) => r.data),
  createLot: (data: LotCreate) =>
    api.post<Lot>("/api/v1/inventory/lots", data).then((r) => r.data),
  listMovements: (params?: {
    product_id?: string
    skip?: number
    limit?: number
  }) =>
    api
      .get<{ data: StockMovement[]; count: number }>(
        "/api/v1/inventory/movements",
        { params },
      )
      .then((r) => r.data),
  recordMovement: (data: StockMovementCreate) =>
    api
      .post<StockMovement>("/api/v1/inventory/movements", data)
      .then((r) => r.data),
  lowStockAlerts: () =>
    api
      .get<
        Array<{
          product_id: string
          product_name: string
          reference_code: string | null
          unit: string
          current_stock: number
          min_stock: number
          deficit: number
        }>
      >("/api/v1/inventory/alerts/low-stock")
      .then((r) => r.data),
  expiringLots: (days?: number) =>
    api
      .get<Lot[]>("/api/v1/inventory/alerts/expiring-lots", {
        params: { days },
      })
      .then((r) => r.data),
  exportStockCsv: () =>
    downloadAuthenticatedFile(
      "/api/v1/inventory/export/stock-csv",
      "etat_stocks.csv",
    ),
}
