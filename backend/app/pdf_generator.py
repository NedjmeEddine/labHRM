import sys
from pathlib import Path

from fpdf import FPDF

from app.models import (
    CompanySettings,
    PaymentMethod,
    Payslip,
    PayslipStatus,
    SupplierDetail,
    get_datetime_utc,
)

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    _bundle_root = Path(sys._MEIPASS)
    ASSETS_DIR = _bundle_root / "app" / "assets"
    if not ASSETS_DIR.is_dir():
        ASSETS_DIR = _bundle_root / "assets"
else:
    ASSETS_DIR = Path(__file__).resolve().parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
LOGO_PATH = ASSETS_DIR / "el-amel-lab-logo.png"

REGULAR_FONT = FONTS_DIR / "NotoSans-Regular.ttf"
BOLD_FONT = FONTS_DIR / "NotoSans-Bold.ttf"
ITALIC_FONT = FONTS_DIR / "NotoSans-Italic.ttf"
HAS_NOTO_FONTS = REGULAR_FONT.exists() and BOLD_FONT.exists()

FRENCH_MONTHS = {
    1: "Janvier",
    2: "Février",
    3: "Mars",
    4: "Avril",
    5: "Mai",
    6: "Juin",
    7: "Juillet",
    8: "Août",
    9: "Septembre",
    10: "Octobre",
    11: "Novembre",
    12: "Décembre",
}

PAYMENT_METHOD_FR = {
    PaymentMethod.BANK_TRANSFER: "Virement bancaire",
    PaymentMethod.CASH: "Espèces",
    PaymentMethod.CHECK: "Chèque",
}

STATUS_FR = {
    PayslipStatus.DRAFT: "Brouillon",
    PayslipStatus.PAID: "Payé",
}

# Brand palette & layout geometry (A4 portrait = 210mm wide)
MARGIN_X = 12
CONTENT_WIDTH = 186
BRAND_BLUE = (0, 86, 150)
BRAND_DEEP = (0, 45, 90)
MIST_BG = (230, 241, 248)
BORDER_COL = (199, 220, 236)
TEXT_DARK = (20, 35, 55)
TEXT_MUTED = (90, 110, 130)
DEDUCTION_CRIMSON = (189, 21, 58)
ROW_ALT_BG = (248, 251, 253)


def format_dzd(amount: float, currency: str = "DZD") -> str:
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} {currency}"


class PayslipPdfBuilder:
    def __init__(self, payslip: Payslip, company: CompanySettings) -> None:
        self.payslip = payslip
        self.company = company
        self.currency = company.currency or "DZD"
        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=15)
        self.pdf.add_page()
        self.font_family = self._configure_fonts()

    def _configure_fonts(self) -> str:
        if HAS_NOTO_FONTS:
            self.pdf.add_font("Noto", "", str(REGULAR_FONT))
            self.pdf.add_font("Noto", "B", str(BOLD_FONT))
            if ITALIC_FONT.exists():
                self.pdf.add_font("Noto", "I", str(ITALIC_FONT))
            return "Noto"
        return "Helvetica"

    def _fit_text(self, text: str, max_width: float) -> str:
        """Truncate single-line cell values cleanly with ellipsis if wider than cell."""
        if self.pdf.get_string_width(text) <= max_width:
            return text
        ellipsis = "…"
        trimmed = text
        while trimmed and self.pdf.get_string_width(trimmed + ellipsis) > max_width:
            trimmed = trimmed[:-1]
        return f"{trimmed}{ellipsis}" if trimmed else ellipsis

    def _draw_header(self) -> None:
        if LOGO_PATH.exists():
            self.pdf.image(str(LOGO_PATH), x=MARGIN_X, y=10, w=20)
            text_x = 36
        else:
            text_x = MARGIN_X

        self.pdf.set_xy(text_x, 11)
        self.pdf.set_font(self.font_family, "B", 15)
        self.pdf.set_text_color(*BRAND_DEEP)
        self.pdf.cell(
            90,
            7,
            self._fit_text(self.company.company_name, 88),
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.pdf.set_font(self.font_family, "", 8.5)
        self.pdf.set_text_color(*TEXT_MUTED)
        company_lines: list[str] = []
        if self.company.address:
            company_lines.append(self.company.address)
        contact_parts: list[str] = []
        if self.company.phone:
            contact_parts.append(f"Tél: {self.company.phone}")
        if self.company.email:
            contact_parts.append(f"Email: {self.company.email}")
        if contact_parts:
            company_lines.append(" | ".join(contact_parts))
        if self.company.tax_id:
            company_lines.append(f"NIF / RC: {self.company.tax_id}")

        for line in company_lines:
            self.pdf.set_x(text_x)
            self.pdf.cell(
                90, 4.2, self._fit_text(line, 88), new_x="LMARGIN", new_y="NEXT"
            )

        month_name = FRENCH_MONTHS.get(self.payslip.month, str(self.payslip.month))
        period_label = f"{month_name} {self.payslip.year}"

        self.pdf.set_xy(128, 10)
        self.pdf.set_fill_color(*BRAND_DEEP)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font(self.font_family, "B", 13)
        self.pdf.cell(
            70,
            10,
            "BULLETIN DE PAIE",
            align="C",
            fill=True,
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.pdf.set_xy(128, 21)
        self.pdf.set_fill_color(*MIST_BG)
        self.pdf.set_text_color(*BRAND_DEEP)
        self.pdf.set_font(self.font_family, "B", 10)
        self.pdf.cell(
            70,
            7,
            f"Période : {period_label}",
            align="C",
            fill=True,
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.pdf.set_xy(128, 29)
        self.pdf.set_font(self.font_family, "", 8.5)
        self.pdf.set_text_color(*TEXT_MUTED)
        status_label = STATUS_FR.get(str(self.payslip.status), str(self.payslip.status))
        self.pdf.cell(70, 5, f"Statut : {status_label}", align="C")

        self.pdf.set_draw_color(*BRAND_BLUE)
        self.pdf.set_line_width(0.6)
        self.pdf.line(MARGIN_X, 38, MARGIN_X + CONTENT_WIDTH, 38)

    def _draw_employee_section(self) -> None:
        self.pdf.set_y(43)
        self.pdf.set_fill_color(*MIST_BG)
        self.pdf.set_draw_color(*BORDER_COL)
        self.pdf.set_line_width(0.3)
        self.pdf.rect(MARGIN_X, 43, CONTENT_WIDTH, 30, style="DF")

        self.pdf.set_xy(15, 45)
        self.pdf.set_font(self.font_family, "B", 9.5)
        self.pdf.set_text_color(*BRAND_BLUE)
        self.pdf.cell(90, 5, "INFORMATIONS DE L'EMPLOYÉ(E)")
        self.pdf.set_xy(110, 45)
        self.pdf.cell(85, 5, "SUIVI DU TEMPS DE TRAVAIL")

        self.pdf.set_text_color(*TEXT_DARK)
        left_rows = [
            ("Nom complet :", self.payslip.employee_name),
            ("Matricule :", self.payslip.employee_code),
            ("Poste :", f"{self.payslip.job_title} ({self.payslip.department})"),
        ]
        if self.payslip.social_security_number:
            left_rows.append(("N° CNAS :", self.payslip.social_security_number))

        for idx, (label, value) in enumerate(left_rows):
            y = 51.5 + idx * 5.0
            self.pdf.set_xy(15, y)
            self.pdf.set_font(self.font_family, "B", 9)
            self.pdf.cell(28, 5, label)
            self.pdf.set_font(self.font_family, "", 9)
            self.pdf.cell(62, 5, self._fit_text(value, 60))

        pay_label = PAYMENT_METHOD_FR.get(
            str(self.payslip.payment_method), str(self.payslip.payment_method)
        )
        right_rows = [
            (
                "Jours travaillés :",
                f"{self.payslip.worked_days:g} j / {self.company.working_days_per_month} j",
            ),
            ("Absences non payées :", f"{self.payslip.absence_days:g} j"),
            ("Jours de congé pris :", f"{self.payslip.vacation_days_taken} j"),
            ("Mode de paiement :", pay_label),
        ]
        for idx, (label, value) in enumerate(right_rows):
            y = 51.5 + idx * 5.0
            self.pdf.set_xy(110, y)
            self.pdf.set_font(self.font_family, "B", 9)
            self.pdf.cell(45, 5, label)
            self.pdf.set_font(self.font_family, "", 9)
            self.pdf.cell(35, 5, self._fit_text(value, 34))

    def _draw_earnings_table(self) -> None:
        self.pdf.set_y(81)
        col_widths = [86, 26, 37, 37]  # sum = 186mm

        self.pdf.set_x(MARGIN_X)
        self.pdf.set_fill_color(*BRAND_BLUE)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font(self.font_family, "B", 9)
        headers = ["Désignation des rubriques", "Base / Qté", "Gains", "Retenues"]
        aligns = ["L", "C", "R", "R"]
        for width, title, align in zip(col_widths, headers, aligns, strict=True):
            self.pdf.cell(width, 8.5, title, border=1, align=align, fill=True)
        self.pdf.ln()

        p = self.payslip
        cur = self.currency
        rows = [
            (
                "Salaire de base mensuel",
                f"{self.company.working_days_per_month} j",
                format_dzd(p.base_salary, cur),
                "—",
            ),
            (
                "Prime de performance",
                "—",
                format_dzd(p.performance_bonus, cur)
                if p.performance_bonus > 0
                else "—",
                "—",
            ),
            (
                "Autres indemnités & primes",
                "—",
                format_dzd(p.other_allowances, cur) if p.other_allowances > 0 else "—",
                "—",
            ),
            (
                "Heures supplémentaires",
                "—",
                format_dzd(p.overtime_pay, cur) if p.overtime_pay > 0 else "—",
                "—",
            ),
            (
                "Retenue pour absences non payées",
                f"{p.absence_days:g} j",
                "—",
                format_dzd(p.absence_deduction, cur)
                if p.absence_deduction > 0
                else "—",
            ),
            (
                "Autres retenues (Acomptes / Cotisations)",
                "—",
                "—",
                format_dzd(p.other_deductions, cur) if p.other_deductions > 0 else "—",
            ),
        ]

        self.pdf.set_font(self.font_family, "", 9)
        self.pdf.set_draw_color(*BORDER_COL)
        for idx, (label, qty, gain, ded) in enumerate(rows):
            self.pdf.set_x(MARGIN_X)
            bg = ROW_ALT_BG if idx % 2 == 1 else (255, 255, 255)
            self.pdf.set_fill_color(*bg)

            self.pdf.set_text_color(*TEXT_DARK)
            self.pdf.cell(
                col_widths[0], 8, f"  {label}", border=1, align="L", fill=True
            )
            self.pdf.set_text_color(*TEXT_MUTED)
            self.pdf.cell(col_widths[1], 8, qty, border=1, align="C", fill=True)
            self.pdf.set_text_color(*TEXT_DARK)
            self.pdf.cell(col_widths[2], 8, f"{gain}  ", border=1, align="R", fill=True)
            self.pdf.set_text_color(*(DEDUCTION_CRIMSON if ded != "—" else TEXT_MUTED))
            self.pdf.cell(col_widths[3], 8, f"{ded}  ", border=1, align="R", fill=True)
            self.pdf.ln()

        total_deductions = round(p.absence_deduction + p.other_deductions, 2)
        self.pdf.set_x(MARGIN_X)
        self.pdf.set_fill_color(*MIST_BG)
        self.pdf.set_text_color(*BRAND_DEEP)
        self.pdf.set_font(self.font_family, "B", 9.5)
        self.pdf.cell(
            col_widths[0] + col_widths[1],
            9,
            "  TOTAUX (Salaire Brut / Total Retenues)",
            border=1,
            align="L",
            fill=True,
        )
        self.pdf.cell(
            col_widths[2],
            9,
            f"{format_dzd(p.gross_salary, cur)}  ",
            border=1,
            align="R",
            fill=True,
        )
        self.pdf.set_text_color(*DEDUCTION_CRIMSON)
        self.pdf.cell(
            col_widths[3],
            9,
            f"{format_dzd(total_deductions, cur)}  ",
            border=1,
            align="R",
            fill=True,
        )
        self.pdf.ln(14)

    def _draw_net_pay_box(self) -> None:
        self.pdf.set_x(MARGIN_X)
        self.pdf.set_fill_color(*BRAND_DEEP)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font(self.font_family, "B", 12)
        self.pdf.cell(100, 12, "   NET À PAYER", align="L", fill=True)
        self.pdf.set_font(self.font_family, "B", 13)
        self.pdf.cell(
            86,
            12,
            f"{format_dzd(self.payslip.net_salary, self.currency)}   ",
            align="R",
            fill=True,
        )
        self.pdf.ln(18)

    def _draw_notes(self) -> None:
        if not self.payslip.notes:
            return
        self.pdf.set_x(MARGIN_X)
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*BRAND_BLUE)
        self.pdf.cell(
            CONTENT_WIDTH,
            5,
            "Observations / Notes :",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.pdf.set_x(MARGIN_X)
        self.pdf.set_font(self.font_family, "", 8.5)
        self.pdf.set_text_color(*TEXT_DARK)
        self.pdf.multi_cell(CONTENT_WIDTH, 5, self.payslip.notes, border=1)
        self.pdf.ln(8)

    def _draw_signatures(self) -> None:
        if self.pdf.get_y() > 230:
            self.pdf.add_page()
        y_sig = max(self.pdf.get_y() + 8, 225)
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*TEXT_DARK)
        self.pdf.set_xy(20, y_sig)
        self.pdf.cell(70, 6, "Cachet et Signature de l'Employeur", align="C")
        self.pdf.set_xy(120, y_sig)
        self.pdf.cell(70, 6, "Signature de l'Employé(e)", align="C")

        self.pdf.set_draw_color(*BORDER_COL)
        self.pdf.rect(20, y_sig + 7, 70, 25)
        self.pdf.rect(120, y_sig + 7, 70, 25)

    def _draw_footer(self) -> None:
        self.pdf.set_y(-20)
        self.pdf.set_font(self.font_family, "", 7.5)
        self.pdf.set_text_color(*TEXT_MUTED)
        self.pdf.cell(
            0,
            5,
            f"{self.company.company_name} — Document généré le {self.payslip.updated_at.strftime('%d/%m/%Y')}",
            align="C",
        )

    def build(self) -> bytes:
        self._draw_header()
        self._draw_employee_section()
        self._draw_earnings_table()
        self._draw_net_pay_box()
        self._draw_notes()
        self._draw_signatures()
        self._draw_footer()
        return bytes(self.pdf.output())


def generate_payslip_pdf(payslip: Payslip, company: CompanySettings) -> bytes:
    return PayslipPdfBuilder(payslip=payslip, company=company).build()


class SupplierStatementPdfBuilder:
    def __init__(self, detail: SupplierDetail, company: CompanySettings) -> None:
        self.detail = detail
        self.company = company
        self.currency = company.currency or "DZD"
        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=15)
        self.pdf.add_page()
        self.font_family = self._configure_fonts()

    def _configure_fonts(self) -> str:
        if HAS_NOTO_FONTS:
            self.pdf.add_font("NotoSans", "", str(REGULAR_FONT))
            self.pdf.add_font("NotoSans", "B", str(BOLD_FONT))
            if ITALIC_FONT.exists():
                self.pdf.add_font("NotoSans", "I", str(ITALIC_FONT))
            return "NotoSans"
        return "Helvetica"

    def _draw_header(self) -> None:
        if LOGO_PATH.exists():
            self.pdf.image(str(LOGO_PATH), x=MARGIN_X, y=10, w=22)

        self.pdf.set_xy(MARGIN_X + 26, 10)
        self.pdf.set_font(self.font_family, "B", 14)
        self.pdf.set_text_color(*BRAND_BLUE)
        self.pdf.cell(100, 7, self.company.company_name, align="L")

        self.pdf.set_xy(MARGIN_X + 26, 17)
        self.pdf.set_font(self.font_family, "", 8)
        self.pdf.set_text_color(*TEXT_MUTED)
        company_meta = "Laboratoire d'Analyses Médicales"
        if self.company.phone:
            company_meta += f" | Tél : {self.company.phone}"
        self.pdf.cell(100, 5, company_meta, align="L")

        self.pdf.set_xy(110, 10)
        self.pdf.set_fill_color(*BRAND_DEEP)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font(self.font_family, "B", 11)
        self.pdf.cell(88, 12, "  RELEVÉ DE COMPTE FOURNISSEUR", align="C", fill=True)

        self.pdf.set_draw_color(*BORDER_COL)
        self.pdf.line(MARGIN_X, 28, MARGIN_X + CONTENT_WIDTH, 28)

    def _draw_supplier_section(self) -> None:
        self.pdf.set_y(32)
        self.pdf.set_fill_color(*MIST_BG)
        self.pdf.rect(MARGIN_X, 32, CONTENT_WIDTH, 26, style="F")
        self.pdf.set_draw_color(*BORDER_COL)
        self.pdf.rect(MARGIN_X, 32, CONTENT_WIDTH, 26, style="D")

        # Left: Supplier info
        self.pdf.set_xy(MARGIN_X + 4, 34)
        self.pdf.set_font(self.font_family, "B", 11)
        self.pdf.set_text_color(*BRAND_DEEP)
        self.pdf.cell(90, 6, self.detail.name, align="L")

        self.pdf.set_xy(MARGIN_X + 4, 40)
        self.pdf.set_font(self.font_family, "", 8.5)
        self.pdf.set_text_color(*TEXT_DARK)
        contact = (
            f"Contact : {self.detail.contact_person}"
            if self.detail.contact_person
            else "Fournisseur Officiel"
        )
        if self.detail.phone:
            contact += f" | Tél : {self.detail.phone}"
        self.pdf.cell(90, 5, contact, align="L")

        self.pdf.set_xy(MARGIN_X + 4, 46)
        fiscal = []
        if self.detail.tax_id:
            fiscal.append(f"NIF : {self.detail.tax_id}")
        if self.detail.trade_registry:
            fiscal.append(f"RC : {self.detail.trade_registry}")
        self.pdf.cell(
            90,
            5,
            " | ".join(fiscal) if fiscal else "Identifiants fiscaux non renseignés",
            align="L",
        )

        # Right: Debt summary box
        self.pdf.set_xy(115, 34)
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*TEXT_MUTED)
        self.pdf.cell(40, 5, "Total Facturé :", align="L")
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*TEXT_DARK)
        self.pdf.cell(
            38, 5, f"{self.detail.total_invoiced:,.2f} {self.currency}", align="R"
        )

        self.pdf.set_xy(115, 40)
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*TEXT_MUTED)
        self.pdf.cell(40, 5, "Total Payé :", align="L")
        self.pdf.set_font(self.font_family, "B", 9)
        self.pdf.set_text_color(*TEXT_DARK)
        self.pdf.cell(
            38, 5, f"{self.detail.total_paid:,.2f} {self.currency}", align="R"
        )

        self.pdf.set_xy(115, 47)
        self.pdf.set_font(self.font_family, "B", 10)
        self.pdf.set_text_color(
            *DEDUCTION_CRIMSON if self.detail.balance_owed > 0 else BRAND_BLUE
        )
        self.pdf.cell(40, 6, "Solde Dû :", align="L")
        self.pdf.cell(
            38, 6, f"{self.detail.balance_owed:,.2f} {self.currency}", align="R"
        )

    def _draw_ledger_table(self) -> None:
        self.pdf.set_y(64)
        col_widths = [24, 24, 38, 34, 34, 32]
        headers = [
            "Date",
            "Type",
            "Réf. / N°",
            "Débit (Facturé)",
            "Crédit (Payé)",
            "Statut",
        ]

        self.pdf.set_fill_color(*BRAND_BLUE)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font(self.font_family, "B", 8.5)

        self.pdf.set_x(MARGIN_X)
        for idx, (header, width) in enumerate(zip(headers, col_widths)):
            align = "C" if idx in (0, 1, 5) else ("R" if idx in (3, 4) else "L")
            self.pdf.cell(width, 8, f"  {header}  ", border=1, align=align, fill=True)
        self.pdf.ln()

        # Combine transactions
        transactions = []
        for inv in self.detail.invoices:
            inv_type = "Avoir" if inv.is_credit_note else "Facture"
            transactions.append(
                {
                    "date": inv.invoice_date,
                    "type": inv_type,
                    "ref": inv.invoice_number,
                    "debit": inv.total_incl_tax,
                    "credit": None,
                    "status": inv.status.value,
                }
            )
        for p in self.detail.payments:
            transactions.append(
                {
                    "date": p.payment_date,
                    "type": "Paiement",
                    "ref": p.invoice_number or (p.reference or "—"),
                    "debit": None,
                    "credit": p.amount,
                    "status": p.payment_method.value,
                }
            )

        transactions.sort(key=lambda t: t["date"])

        self.pdf.set_font(self.font_family, "", 8)
        self.pdf.set_draw_color(*BORDER_COL)

        for idx, t in enumerate(transactions):
            bg = ROW_ALT_BG if idx % 2 == 1 else (255, 255, 255)
            self.pdf.set_fill_color(*bg)
            self.pdf.set_x(MARGIN_X)

            self.pdf.set_text_color(*TEXT_DARK)
            self.pdf.cell(
                col_widths[0],
                7,
                t["date"].strftime("%d/%m/%Y"),
                border=1,
                align="C",
                fill=True,
            )
            self.pdf.cell(col_widths[1], 7, t["type"], border=1, align="C", fill=True)
            self.pdf.cell(
                col_widths[2], 7, f"  {t['ref']}", border=1, align="L", fill=True
            )

            debit_str = f"{t['debit']:,.2f}  " if t["debit"] is not None else "—  "
            credit_str = f"{t['credit']:,.2f}  " if t["credit"] is not None else "—  "

            self.pdf.cell(col_widths[3], 7, debit_str, border=1, align="R", fill=True)
            self.pdf.set_text_color(
                *(BRAND_BLUE if t["credit"] is not None else TEXT_MUTED)
            )
            self.pdf.cell(col_widths[4], 7, credit_str, border=1, align="R", fill=True)
            self.pdf.set_text_color(*TEXT_DARK)
            self.pdf.cell(col_widths[5], 7, t["status"], border=1, align="C", fill=True)
            self.pdf.ln()

        # Balance row
        self.pdf.set_x(MARGIN_X)
        self.pdf.set_fill_color(*MIST_BG)
        self.pdf.set_font(self.font_family, "B", 8.5)
        self.pdf.set_text_color(*BRAND_DEEP)
        self.pdf.cell(
            col_widths[0] + col_widths[1] + col_widths[2],
            8,
            "  TOTAL / SOLDE DÛ",
            border=1,
            align="L",
            fill=True,
        )
        self.pdf.cell(
            col_widths[3],
            8,
            f"{self.detail.total_invoiced:,.2f}  ",
            border=1,
            align="R",
            fill=True,
        )
        self.pdf.cell(
            col_widths[4],
            8,
            f"{self.detail.total_paid:,.2f}  ",
            border=1,
            align="R",
            fill=True,
        )
        self.pdf.set_text_color(
            *DEDUCTION_CRIMSON if self.detail.balance_owed > 0 else BRAND_DEEP
        )
        self.pdf.cell(
            col_widths[5],
            8,
            f"{self.detail.balance_owed:,.2f} {self.currency}",
            border=1,
            align="C",
            fill=True,
        )
        self.pdf.ln(12)

    def _draw_footer(self) -> None:
        self.pdf.set_y(-15)
        self.pdf.set_font(self.font_family, "", 7.5)
        self.pdf.set_text_color(*TEXT_MUTED)
        self.pdf.cell(
            0,
            5,
            f"{self.company.company_name} — Relevé de compte fournisseur généré le {get_datetime_utc().strftime('%d/%m/%Y')}",
            align="C",
        )

    def build(self) -> bytes:
        self._draw_header()
        self._draw_supplier_section()
        self._draw_ledger_table()
        self._draw_footer()
        return bytes(self.pdf.output())


def generate_supplier_statement_pdf(
    detail: SupplierDetail, company: CompanySettings
) -> bytes:
    return SupplierStatementPdfBuilder(detail=detail, company=company).build()
