import uuid
from datetime import UTC, datetime
from datetime import date as DateType
from decimal import Decimal
from enum import StrEnum

from pydantic import EmailStr
from sqlalchemy import Numeric, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# --- Domain Enums ---
class EmployeeStatus(StrEnum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"


class AbsenceType(StrEnum):
    UNJUSTIFIED = "unjustified"
    SICK = "sick"
    JUSTIFIED = "justified"
    HALF_DAY = "half_day"


class VacationType(StrEnum):
    ANNUAL = "annual"
    SICK = "sick"
    UNPAID = "unpaid"
    OTHER = "other"


class VacationStatus(StrEnum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


class PaymentMethod(StrEnum):
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHECK = "check"


class PayslipStatus(StrEnum):
    DRAFT = "draft"
    PAID = "paid"


class ProductCategory(StrEnum):
    REAGENT = "reagent"
    CONSUMABLE = "consumable"
    EQUIPMENT = "equipment"
    OTHER = "other"


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class InvoicePaymentStatus(StrEnum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class MovementType(StrEnum):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"


# --- User (Single Admin) ---
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    is_superuser: bool = True


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=get_datetime_utc)


class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


# --- Company / Payroll Settings (Singleton) ---
class CompanySettingsBase(SQLModel):
    company_name: str = Field(default="EL-AMEL LAB", max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=100)
    currency: str = Field(default="DZD", max_length=10)
    working_days_per_month: int = Field(default=22, ge=1, le=31)
    default_annual_vacation_days: int = Field(default=30, ge=0, le=365)
    inventory_tracking_enabled: bool = Field(default=False)
    manual_stock_out_enabled: bool = Field(default=False)
    default_expiry_alert_days: int = Field(default=60, ge=1, le=365)


class CompanySettings(CompanySettingsBase, table=True):
    id: int = Field(default=1, primary_key=True)
    updated_at: datetime = Field(default_factory=get_datetime_utc)


class CompanySettingsUpdate(SQLModel):
    company_name: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=100)
    currency: str | None = Field(default=None, max_length=10)
    working_days_per_month: int | None = Field(default=None, ge=1, le=31)
    default_annual_vacation_days: int | None = Field(default=None, ge=0, le=365)
    inventory_tracking_enabled: bool | None = None
    manual_stock_out_enabled: bool | None = None
    default_expiry_alert_days: int | None = None


# --- Employees ---
class EmployeeBase(SQLModel):
    employee_code: str | None = Field(default=None, max_length=32)
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    job_title: str = Field(min_length=1, max_length=150)
    department: str = Field(default="Laboratoire", max_length=150)
    hire_date: DateType
    status: EmployeeStatus = Field(default=EmployeeStatus.ACTIVE, sa_type=String(30))
    base_salary: float = Field(ge=0)
    annual_vacation_days: int = Field(default=30, ge=0)
    social_security_number: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(SQLModel):
    employee_code: str | None = Field(default=None, max_length=32)
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    job_title: str | None = Field(default=None, min_length=1, max_length=150)
    department: str | None = Field(default=None, max_length=150)
    hire_date: DateType | None = None
    status: EmployeeStatus | None = None
    base_salary: float | None = Field(default=None, ge=0)
    salary_change_reason: str | None = Field(default=None, max_length=255)
    annual_vacation_days: int | None = Field(default=None, ge=0)
    social_security_number: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)


class Employee(EmployeeBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_code: str = Field(unique=True, index=True, max_length=32)
    created_at: datetime = Field(default_factory=get_datetime_utc)

    absences: list["Absence"] = Relationship(
        back_populates="employee", cascade_delete=True
    )
    vacations: list["Vacation"] = Relationship(
        back_populates="employee", cascade_delete=True
    )
    reviews: list["PerformanceReview"] = Relationship(
        back_populates="employee", cascade_delete=True
    )
    salary_history: list["SalaryHistory"] = Relationship(
        back_populates="employee", cascade_delete=True
    )
    payslips: list["Payslip"] = Relationship(
        back_populates="employee", cascade_delete=True
    )


class EmployeePublic(EmployeeBase):
    id: uuid.UUID
    employee_code: str
    created_at: datetime


class EmployeesPublic(SQLModel):
    data: list[EmployeePublic]
    count: int


# --- Absences ---
class AbsenceBase(SQLModel):
    employee_id: uuid.UUID = Field(foreign_key="employee.id", ondelete="CASCADE")
    date: DateType = Field(index=True)
    absence_type: AbsenceType = Field(
        default=AbsenceType.UNJUSTIFIED, sa_type=String(30)
    )
    is_paid: bool = Field(default=False)
    reason: str | None = Field(default=None, max_length=500)


class AbsenceCreate(AbsenceBase):
    pass


class AbsenceRangeCreate(SQLModel):
    employee_id: uuid.UUID
    start_date: DateType
    end_date: DateType
    absence_type: AbsenceType = Field(default=AbsenceType.UNJUSTIFIED)
    is_paid: bool = Field(default=False)
    reason: str | None = Field(default=None, max_length=500)


class AbsenceUpdate(SQLModel):
    date: DateType | None = None
    absence_type: AbsenceType | None = None
    is_paid: bool | None = None
    reason: str | None = Field(default=None, max_length=500)


class Absence(AbsenceBase, table=True):
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_absence_employee_date"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    employee: Employee | None = Relationship(back_populates="absences")


class AbsencePublic(AbsenceBase):
    id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    created_at: datetime


class AbsencesIntervalSummary(SQLModel):
    data: list[AbsencePublic]
    total_count: int
    unpaid_days: float
    paid_days: float
    half_days: int
    estimated_deduction: float = 0.0


# --- Vacations ---
class VacationBase(SQLModel):
    employee_id: uuid.UUID = Field(foreign_key="employee.id", ondelete="CASCADE")
    start_date: DateType
    end_date: DateType
    vacation_type: VacationType = Field(default=VacationType.ANNUAL, sa_type=String(30))
    status: VacationStatus = Field(default=VacationStatus.APPROVED, sa_type=String(30))
    notes: str | None = Field(default=None, max_length=500)


class VacationCreate(VacationBase):
    pass


class VacationUpdate(SQLModel):
    start_date: DateType | None = None
    end_date: DateType | None = None
    vacation_type: VacationType | None = None
    status: VacationStatus | None = None
    notes: str | None = Field(default=None, max_length=500)


class Vacation(VacationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    days_count: int = Field(ge=1)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    employee: Employee | None = Relationship(back_populates="vacations")


class VacationPublic(VacationBase):
    id: uuid.UUID
    days_count: int
    employee_name: str | None = None
    employee_code: str | None = None
    created_at: datetime


class VacationsPublic(SQLModel):
    data: list[VacationPublic]
    count: int


class VacationBalance(SQLModel):
    employee_id: uuid.UUID
    employee_name: str
    employee_code: str
    year: int
    annual_allowance: int
    days_taken: int
    days_pending: int
    days_remaining: int


# --- Performance Reviews & Salary Progression History ---
class PerformanceReviewBase(SQLModel):
    employee_id: uuid.UUID = Field(foreign_key="employee.id", ondelete="CASCADE")
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    score: int = Field(ge=1, le=5)
    bonus_amount: float = Field(default=0.0, ge=0)
    new_base_salary: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)


class PerformanceReviewCreate(PerformanceReviewBase):
    pass


class PerformanceReviewUpdate(SQLModel):
    score: int | None = Field(default=None, ge=1, le=5)
    bonus_amount: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)


class PerformanceReview(PerformanceReviewBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    employee: Employee | None = Relationship(back_populates="reviews")


class PerformanceReviewPublic(PerformanceReviewBase):
    id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    created_at: datetime


class PerformanceReviewsPublic(SQLModel):
    data: list[PerformanceReviewPublic]
    count: int


class SalaryHistory(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key="employee.id", ondelete="CASCADE")
    previous_salary: float
    new_salary: float
    reason: str = Field(max_length=255)
    changed_at: datetime = Field(default_factory=get_datetime_utc)
    employee: Employee | None = Relationship(back_populates="salary_history")


class SalaryHistoryPublic(SQLModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    previous_salary: float
    new_salary: float
    reason: str
    changed_at: datetime


# --- Payslips ---
class PayslipBase(SQLModel):
    employee_id: uuid.UUID = Field(foreign_key="employee.id", ondelete="CASCADE")
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    base_salary: float = Field(ge=0)
    performance_bonus: float = Field(default=0.0, ge=0)
    other_allowances: float = Field(default=0.0, ge=0)
    overtime_pay: float = Field(default=0.0, ge=0)
    absence_days: float = Field(default=0.0, ge=0)
    absence_deduction: float = Field(default=0.0, ge=0)
    other_deductions: float = Field(default=0.0, ge=0)
    gross_salary: float = Field(default=0.0, ge=0)
    net_salary: float = Field(default=0.0, ge=0)
    worked_days: float = Field(default=22.0, ge=0)
    vacation_days_taken: int = Field(default=0, ge=0)
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.BANK_TRANSFER, sa_type=String(30)
    )
    status: PayslipStatus = Field(default=PayslipStatus.DRAFT, sa_type=String(30))
    notes: str | None = Field(default=None, max_length=1000)


class Payslip(PayslipBase, table=True):
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "month", "year", name="uq_payslip_employee_period"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_name: str
    employee_code: str
    job_title: str
    department: str
    social_security_number: str | None = None
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)
    employee: Employee | None = Relationship(back_populates="payslips")


class PayslipGenerateRequest(SQLModel):
    employee_id: uuid.UUID
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    overwrite: bool = False


class PayslipBatchGenerateRequest(SQLModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class PayslipUpdate(SQLModel):
    base_salary: float | None = Field(default=None, ge=0)
    performance_bonus: float | None = Field(default=None, ge=0)
    other_allowances: float | None = Field(default=None, ge=0)
    overtime_pay: float | None = Field(default=None, ge=0)
    absence_days: float | None = Field(default=None, ge=0)
    absence_deduction: float | None = Field(default=None, ge=0)
    other_deductions: float | None = Field(default=None, ge=0)
    worked_days: float | None = Field(default=None, ge=0)
    vacation_days_taken: int | None = Field(default=None, ge=0)
    payment_method: PaymentMethod | None = None
    status: PayslipStatus | None = None
    notes: str | None = Field(default=None, max_length=1000)


class PayslipPublic(PayslipBase):
    id: uuid.UUID
    employee_name: str
    employee_code: str
    job_title: str
    department: str
    social_security_number: str | None = None
    created_at: datetime
    updated_at: datetime


class PayslipsPublic(SQLModel):
    data: list[PayslipPublic]
    count: int


# --- Dashboard ---
class DashboardSummary(SQLModel):
    total_employees: int
    active_employees: int
    absent_today_count: int
    on_vacation_today_count: int
    absent_today_names: list[str]
    on_vacation_today_names: list[str]
    current_month_payroll_total: float
    current_month_paid_count: int
    current_month_draft_count: int
    upcoming_vacations: list[VacationPublic]
    currency: str = "DZD"


# --- Suppliers & Inventory Models ---


# 1. Supplier
class SupplierBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, index=True)
    contact_person: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    tax_id: str | None = Field(default=None, max_length=100)  # NIF
    statistical_id: str | None = Field(default=None, max_length=100)  # NIS
    trade_registry: str | None = Field(default=None, max_length=100)  # RC
    payment_terms: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool = Field(default=True)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_person: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    tax_id: str | None = Field(default=None, max_length=100)
    statistical_id: str | None = Field(default=None, max_length=100)
    trade_registry: str | None = Field(default=None, max_length=100)
    payment_terms: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class Supplier(SupplierBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)

    products: list["Product"] = Relationship(back_populates="usual_supplier")
    invoices: list["PurchaseInvoice"] = Relationship(back_populates="supplier")
    payments: list["Payment"] = Relationship(back_populates="supplier")


class SupplierPublic(SupplierBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    total_invoiced: Decimal = Field(default=Decimal("0.00"))
    total_paid: Decimal = Field(default=Decimal("0.00"))
    balance_owed: Decimal = Field(default=Decimal("0.00"))


class SuppliersPublic(SQLModel):
    data: list[SupplierPublic]
    count: int


# 2. Product
class ProductBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, index=True)
    reference_code: str | None = Field(default=None, max_length=64, index=True)
    category: ProductCategory = Field(
        default=ProductCategory.REAGENT, sa_type=String(30)
    )
    unit: str = Field(default="boîte", max_length=50)
    usual_supplier_id: uuid.UUID | None = Field(
        default=None, foreign_key="supplier.id", ondelete="SET NULL"
    )
    track_lots: bool = Field(default=True)
    min_stock: Decimal | None = Field(
        default=None, sa_type=Numeric(12, 2, asdecimal=True)
    )
    storage_location: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool = Field(default=True)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    reference_code: str | None = Field(default=None, max_length=64)
    category: ProductCategory | None = None
    unit: str | None = Field(default=None, max_length=50)
    usual_supplier_id: uuid.UUID | None = None
    track_lots: bool | None = None
    min_stock: Decimal | None = Field(
        default=None, sa_type=Numeric(12, 2, asdecimal=True)
    )
    storage_location: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class Product(ProductBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)

    usual_supplier: Supplier | None = Relationship(back_populates="products")
    invoice_lines: list["InvoiceLine"] = Relationship(back_populates="product")
    lots: list["Lot"] = Relationship(back_populates="product")
    movements: list["StockMovement"] = Relationship(back_populates="product")


class ProductPublic(ProductBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    usual_supplier_name: str | None = None
    current_stock: Decimal = Field(default=Decimal("0.00"))


class ProductsPublic(SQLModel):
    data: list[ProductPublic]
    count: int


class ProductPriceHistoryItem(SQLModel):
    invoice_id: uuid.UUID
    invoice_number: str
    invoice_date: DateType
    supplier_id: uuid.UUID
    supplier_name: str
    quantity: Decimal
    unit_price_excl_tax: Decimal
    tva_rate: Decimal
    total_line_incl_tax: Decimal


# 3. Purchase Invoice & Invoice Line
class InvoiceLineBase(SQLModel):
    product_id: uuid.UUID = Field(foreign_key="product.id", ondelete="RESTRICT")
    quantity: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True), gt=0)
    unit_price_excl_tax: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True), ge=0)
    tva_rate: Decimal = Field(
        default=Decimal("19.00"), sa_type=Numeric(5, 2, asdecimal=True), ge=0
    )
    discount_amount: Decimal = Field(
        default=Decimal("0.00"), sa_type=Numeric(12, 2, asdecimal=True), ge=0
    )


class InvoiceLineCreate(InvoiceLineBase):
    # Optional receiving parameters for Phase B
    lot_number: str | None = None
    expiration_date: DateType | None = None


class InvoiceLine(InvoiceLineBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    invoice_id: uuid.UUID = Field(foreign_key="purchaseinvoice.id", ondelete="CASCADE")
    total_line_excl_tax: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True))
    total_line_tva: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True))
    total_line_incl_tax: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True))

    invoice: "PurchaseInvoice" = Relationship(back_populates="lines")
    product: Product = Relationship(back_populates="invoice_lines")


class InvoiceLinePublic(InvoiceLineBase):
    id: uuid.UUID
    invoice_id: uuid.UUID
    product_name: str | None = None
    product_unit: str | None = None
    product_reference: str | None = None
    total_line_excl_tax: Decimal
    total_line_tva: Decimal
    total_line_incl_tax: Decimal


class PurchaseInvoiceBase(SQLModel):
    supplier_id: uuid.UUID = Field(foreign_key="supplier.id", ondelete="RESTRICT")
    invoice_number: str = Field(min_length=1, max_length=100, index=True)
    invoice_date: DateType = Field(index=True)
    due_date: DateType | None = Field(default=None, index=True)
    supplier_stated_total: Decimal | None = Field(
        default=None, sa_type=Numeric(12, 2, asdecimal=True), ge=0
    )
    status: InvoiceStatus = Field(default=InvoiceStatus.CONFIRMED, sa_type=String(30))
    is_credit_note: bool = Field(default=False)
    parent_invoice_id: uuid.UUID | None = Field(
        default=None, foreign_key="purchaseinvoice.id", ondelete="SET NULL"
    )
    notes: str | None = Field(default=None, max_length=1000)


class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    lines: list[InvoiceLineCreate] = Field(min_length=1)


class PurchaseInvoiceUpdate(SQLModel):
    invoice_number: str | None = Field(default=None, min_length=1, max_length=100)
    invoice_date: DateType | None = None
    due_date: DateType | None = None
    supplier_stated_total: Decimal | None = Field(
        default=None, sa_type=Numeric(12, 2, asdecimal=True), ge=0
    )
    status: InvoiceStatus | None = None
    notes: str | None = Field(default=None, max_length=1000)


class PurchaseInvoice(PurchaseInvoiceBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    total_excl_tax: Decimal = Field(
        default=Decimal("0.00"), sa_type=Numeric(12, 2, asdecimal=True)
    )
    total_tva: Decimal = Field(
        default=Decimal("0.00"), sa_type=Numeric(12, 2, asdecimal=True)
    )
    total_incl_tax: Decimal = Field(
        default=Decimal("0.00"), sa_type=Numeric(12, 2, asdecimal=True)
    )
    scan_file_path: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)

    supplier: Supplier = Relationship(back_populates="invoices")
    lines: list[InvoiceLine] = Relationship(
        back_populates="invoice", cascade_delete=True
    )
    payments: list["Payment"] = Relationship(
        back_populates="invoice", cascade_delete=True
    )


class PurchaseInvoicePublic(PurchaseInvoiceBase):
    id: uuid.UUID
    supplier_name: str | None = None
    total_excl_tax: Decimal
    total_tva: Decimal
    total_incl_tax: Decimal
    amount_paid: Decimal = Field(default=Decimal("0.00"))
    balance_remaining: Decimal = Field(default=Decimal("0.00"))
    payment_status: InvoicePaymentStatus = InvoicePaymentStatus.UNPAID
    has_scan: bool = False
    warning_total_mismatch: bool = False
    stated_difference: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class PurchaseInvoiceDetail(PurchaseInvoicePublic):
    lines: list[InvoiceLinePublic] = []
    payments: list["PaymentPublic"] = []


class PurchaseInvoicesPublic(SQLModel):
    data: list[PurchaseInvoicePublic]
    count: int


# 4. Payment
class PaymentBase(SQLModel):
    invoice_id: uuid.UUID = Field(foreign_key="purchaseinvoice.id", ondelete="CASCADE")
    supplier_id: uuid.UUID = Field(foreign_key="supplier.id", ondelete="RESTRICT")
    payment_date: DateType = Field(index=True)
    amount: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True), gt=0)
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.BANK_TRANSFER, sa_type=String(30)
    )
    reference: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=500)


class PaymentCreate(PaymentBase):
    pass


class Payment(PaymentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)

    invoice: PurchaseInvoice = Relationship(back_populates="payments")
    supplier: Supplier = Relationship(back_populates="payments")


class PaymentPublic(PaymentBase):
    id: uuid.UUID
    invoice_number: str | None = None
    supplier_name: str | None = None
    created_at: datetime


class PaymentsPublic(SQLModel):
    data: list[PaymentPublic]
    count: int


class SupplierDetail(SupplierPublic):
    invoices: list[PurchaseInvoicePublic] = []
    payments: list[PaymentPublic] = []


# 5. Lots & Stock Movements (Phase B & C)
class LotBase(SQLModel):
    product_id: uuid.UUID = Field(foreign_key="product.id", ondelete="CASCADE")
    supplier_id: uuid.UUID | None = Field(
        default=None, foreign_key="supplier.id", ondelete="SET NULL"
    )
    lot_number: str = Field(min_length=1, max_length=64, index=True)
    expiration_date: DateType = Field(index=True)
    received_date: DateType = Field(index=True)
    source_invoice_line_id: uuid.UUID | None = Field(
        default=None, foreign_key="invoiceline.id", ondelete="SET NULL"
    )
    is_active: bool = Field(default=True)


class LotCreate(LotBase):
    initial_quantity: Decimal | None = Field(
        default=None, sa_type=Numeric(12, 2, asdecimal=True), gt=0
    )


class Lot(LotBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)

    product: Product = Relationship(back_populates="lots")
    supplier: Supplier | None = Relationship()
    movements: list["StockMovement"] = Relationship(back_populates="lot")


class LotPublic(LotBase):
    id: uuid.UUID
    product_name: str | None = None
    product_unit: str | None = None
    supplier_name: str | None = None
    current_quantity: Decimal = Field(default=Decimal("0.00"))
    is_expired: bool = False
    days_until_expiry: int = 0
    created_at: datetime


class LotsPublic(SQLModel):
    data: list[LotPublic]
    count: int


class StockMovementBase(SQLModel):
    product_id: uuid.UUID = Field(foreign_key="product.id", ondelete="CASCADE")
    lot_id: uuid.UUID | None = Field(
        default=None, foreign_key="lot.id", ondelete="SET NULL"
    )
    movement_type: MovementType = Field(sa_type=String(30))
    quantity: Decimal = Field(sa_type=Numeric(12, 2, asdecimal=True))
    movement_date: DateType = Field(index=True)
    reason: str | None = Field(default=None, max_length=255)
    source_reference: str | None = Field(default=None, max_length=255)


class StockMovementCreate(SQLModel):
    product_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    movement_type: MovementType
    quantity: Decimal = Field(gt=0)
    movement_date: DateType
    reason: str = Field(min_length=1, max_length=255)


class StockMovement(StockMovementBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)

    product: Product = Relationship(back_populates="movements")
    lot: Lot | None = Relationship(back_populates="movements")


class StockMovementPublic(StockMovementBase):
    id: uuid.UUID
    product_name: str | None = None
    lot_number: str | None = None
    created_at: datetime


class StockMovementsPublic(SQLModel):
    data: list[StockMovementPublic]
    count: int


# 6. Audit Trail
class AuditLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_type: str = Field(max_length=50, index=True)
    entity_id: str = Field(max_length=64, index=True)
    action: str = Field(max_length=50)
    old_values: str | None = Field(default=None)
    new_values: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=get_datetime_utc)


class AuditLogPublic(SQLModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    action: str
    old_values: str | None
    new_values: str | None
    created_at: datetime


class AuditLogsPublic(SQLModel):
    data: list[AuditLogPublic]
    count: int


# 7. Dashboard Metrics
class MonthlySpendingItem(SQLModel):
    month: int
    year: int
    total_spending: Decimal


class SupplierSpendingItem(SQLModel):
    supplier_id: uuid.UUID
    supplier_name: str
    total_spending: Decimal


class InventoryDashboardMetrics(SQLModel):
    total_debt_owed: Decimal
    invoices_due_7_days_count: int
    invoices_due_7_days_total: Decimal
    monthly_spending: list[MonthlySpendingItem] = []
    top_suppliers_spending: list[SupplierSpendingItem] = []
    low_stock_count: int = 0
    expiring_lots_count: int = 0
    currency: str = "DZD"
