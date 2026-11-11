import uuid
from datetime import UTC, datetime
from datetime import date as DateType

from pydantic import EmailStr
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


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


# --- Employees ---
class EmployeeBase(SQLModel):
    employee_code: str | None = Field(default=None, max_length=32)
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    job_title: str = Field(min_length=1, max_length=150)
    department: str = Field(default="Laboratoire", max_length=150)
    hire_date: DateType
    status: str = Field(default="active", max_length=30)  # active, on_leave, terminated
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
    status: str | None = Field(default=None, max_length=30)
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
    absence_type: str = Field(
        default="unjustified", max_length=30
    )  # unjustified, sick, justified, half_day
    is_paid: bool = Field(default=False)
    reason: str | None = Field(default=None, max_length=500)


class AbsenceCreate(AbsenceBase):
    pass


class AbsenceRangeCreate(SQLModel):
    employee_id: uuid.UUID
    start_date: DateType
    end_date: DateType
    absence_type: str = Field(default="unjustified", max_length=30)
    is_paid: bool = Field(default=False)
    reason: str | None = Field(default=None, max_length=500)


class AbsenceUpdate(SQLModel):
    date: DateType | None = None
    absence_type: str | None = Field(default=None, max_length=30)
    is_paid: bool | None = None
    reason: str | None = Field(default=None, max_length=500)


class Absence(AbsenceBase, table=True):
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
    vacation_type: str = Field(
        default="annual", max_length=30
    )  # annual, sick, unpaid, other
    status: str = Field(
        default="approved", max_length=30
    )  # approved, pending, rejected
    notes: str | None = Field(default=None, max_length=500)


class VacationCreate(VacationBase):
    pass


class VacationUpdate(SQLModel):
    start_date: DateType | None = None
    end_date: DateType | None = None
    vacation_type: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, max_length=30)
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
    net_salary: float = Field(default=0.0)
    worked_days: float = Field(default=22.0, ge=0)
    vacation_days_taken: int = Field(default=0, ge=0)
    payment_method: str = Field(
        default="bank_transfer", max_length=30
    )  # cash, bank_transfer, check
    status: str = Field(default="draft", max_length=30)  # draft, paid
    notes: str | None = Field(default=None, max_length=1000)


class Payslip(PayslipBase, table=True):
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
    payment_method: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, max_length=30)
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


# --- Dashboard & Employee 360 Summary ---
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
