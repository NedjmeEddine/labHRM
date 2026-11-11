from pathlib import Path

from fpdf import FPDF

from app.models import CompanySettings, Payslip

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
LOGO_PATH = ASSETS_DIR / "el-amel-lab-logo.png"

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
    "bank_transfer": "Virement bancaire",
    "cash": "Espèces",
    "check": "Chèque",
}

STATUS_FR = {
    "draft": "Brouillon",
    "paid": "Payé",
}


def format_dzd(amount: float, currency: str = "DZD") -> str:
    formatted = f"{amount:,.2f}".replace(",", " ")
    return f"{formatted} {currency}"


def generate_payslip_pdf(payslip: Payslip, company: CompanySettings) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Load UTF-8 NotoSans fonts
    regular_font = FONTS_DIR / "NotoSans-Regular.ttf"
    bold_font = FONTS_DIR / "NotoSans-Bold.ttf"
    italic_font = FONTS_DIR / "NotoSans-Italic.ttf"

    use_noto = regular_font.exists() and bold_font.exists()
    if use_noto:
        pdf.add_font("Noto", "", str(regular_font))
        pdf.add_font("Noto", "B", str(bold_font))
        if italic_font.exists():
            pdf.add_font("Noto", "I", str(italic_font))
        font_family = "Noto"
    else:
        font_family = "Helvetica"

    currency = company.currency or "DZD"
    month_name = FRENCH_MONTHS.get(payslip.month, str(payslip.month))
    period_label = f"{month_name} {payslip.year}"

    # Brand colors (#005696 primary blue, #002d5a deep navy, #e6f1f8 mist)
    brand_blue = (0, 86, 150)
    brand_deep = (0, 45, 90)
    mist_bg = (230, 241, 248)
    border_col = (199, 220, 236)
    text_dark = (20, 35, 55)
    text_muted = (90, 110, 130)

    # --- Header Banner ---
    if LOGO_PATH.exists():
        pdf.image(str(LOGO_PATH), x=12, y=10, w=20)
        text_x = 36
    else:
        text_x = 12

    pdf.set_xy(text_x, 11)
    pdf.set_font(font_family, "B", 15)
    pdf.set_text_color(*brand_deep)
    pdf.cell(90, 7, company.company_name, new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(text_x)
    pdf.set_font(font_family, "", 8.5)
    pdf.set_text_color(*text_muted)
    company_lines = []
    if company.address:
        company_lines.append(company.address)
    contact_parts = []
    if company.phone:
        contact_parts.append(f"Tél: {company.phone}")
    if company.email:
        contact_parts.append(f"Email: {company.email}")
    if contact_parts:
        company_lines.append(" | ".join(contact_parts))
    if company.tax_id:
        company_lines.append(f"NIF / RC: {company.tax_id}")

    for line in company_lines:
        pdf.set_x(text_x)
        pdf.cell(95, 4.2, line, new_x="LMARGIN", new_y="NEXT")

    # Right side: Document Title Box
    pdf.set_xy(128, 10)
    pdf.set_fill_color(*brand_deep)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_family, "B", 13)
    pdf.cell(
        70, 10, "BULLETIN DE PAIE", align="C", fill=True, new_x="LMARGIN", new_y="NEXT"
    )

    pdf.set_xy(128, 21)
    pdf.set_fill_color(*mist_bg)
    pdf.set_text_color(*brand_deep)
    pdf.set_font(font_family, "B", 10)
    pdf.cell(
        70,
        7,
        f"Période : {period_label}",
        align="C",
        fill=True,
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.set_xy(128, 29)
    pdf.set_font(font_family, "", 8.5)
    pdf.set_text_color(*text_muted)
    status_label = STATUS_FR.get(payslip.status, payslip.status)
    pdf.cell(70, 5, f"Statut : {status_label}", align="C")

    # Divider line
    pdf.set_draw_color(*brand_blue)
    pdf.set_line_width(0.6)
    pdf.line(12, 38, 198, 38)

    # --- Employee Information Section ---
    pdf.set_y(43)
    pdf.set_fill_color(*mist_bg)
    pdf.set_draw_color(*border_col)
    pdf.set_line_width(0.3)
    pdf.rect(12, 43, 186, 30, style="DF")

    pdf.set_xy(15, 45)
    pdf.set_font(font_family, "B", 9.5)
    pdf.set_text_color(*brand_blue)
    pdf.cell(90, 5, "INFORMATIONS DE L'EMPLOYÉ(E)")
    pdf.set_xy(110, 45)
    pdf.cell(85, 5, "SUIVI DU TEMPS DE TRAVAIL")

    pdf.set_font(font_family, "", 9)
    pdf.set_text_color(*text_dark)

    # Left column
    pdf.set_xy(15, 51.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(28, 5, "Nom complet :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(62, 5, payslip.employee_name)

    pdf.set_xy(15, 56.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(28, 5, "Matricule :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(62, 5, payslip.employee_code)

    pdf.set_xy(15, 61.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(28, 5, "Poste :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(62, 5, f"{payslip.job_title} ({payslip.department})")

    if payslip.social_security_number:
        pdf.set_xy(15, 66.5)
        pdf.set_font(font_family, "B", 9)
        pdf.cell(28, 5, "N° CNAS :")
        pdf.set_font(font_family, "", 9)
        pdf.cell(62, 5, payslip.social_security_number)

    # Right column
    pdf.set_xy(110, 51.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(45, 5, "Jours travaillés :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(35, 5, f"{payslip.worked_days:g} j / {company.working_days_per_month} j")

    pdf.set_xy(110, 56.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(45, 5, "Absences non payées :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(35, 5, f"{payslip.absence_days:g} j")

    pdf.set_xy(110, 61.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(45, 5, "Jours de congé pris :")
    pdf.set_font(font_family, "", 9)
    pdf.cell(35, 5, f"{payslip.vacation_days_taken} j")

    pdf.set_xy(110, 66.5)
    pdf.set_font(font_family, "B", 9)
    pdf.cell(45, 5, "Mode de paiement :")
    pdf.set_font(font_family, "", 9)
    pay_label = PAYMENT_METHOD_FR.get(payslip.payment_method, payslip.payment_method)
    pdf.cell(35, 5, pay_label)

    # --- Earnings & Deductions Table ---
    pdf.set_y(81)
    col_widths = [86, 26, 37, 37]  # sum = 186mm

    # Table Header
    pdf.set_x(12)
    pdf.set_fill_color(*brand_blue)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_family, "B", 9)
    headers = ["Désignation des rubriques", "Base / Qté", "Gains", "Retenues"]
    aligns = ["L", "C", "R", "R"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8.5, h, border=1, align=aligns[i], fill=True)
    pdf.ln()

    rows = [
        (
            "Salaire de base mensuel",
            f"{company.working_days_per_month} j",
            format_dzd(payslip.base_salary, currency),
            "—",
        ),
        (
            "Prime de performance",
            "—",
            format_dzd(payslip.performance_bonus, currency)
            if payslip.performance_bonus > 0
            else "—",
            "—",
        ),
        (
            "Autres indemnités & primes",
            "—",
            format_dzd(payslip.other_allowances, currency)
            if payslip.other_allowances > 0
            else "—",
            "—",
        ),
        (
            "Heures supplémentaires",
            "—",
            format_dzd(payslip.overtime_pay, currency)
            if payslip.overtime_pay > 0
            else "—",
            "—",
        ),
        (
            "Retenue pour absences non payées",
            f"{payslip.absence_days:g} j",
            "—",
            format_dzd(payslip.absence_deduction, currency)
            if payslip.absence_deduction > 0
            else "—",
        ),
        (
            "Autres retenues (Acomptes / Cotisations)",
            "—",
            "—",
            format_dzd(payslip.other_deductions, currency)
            if payslip.other_deductions > 0
            else "—",
        ),
    ]

    pdf.set_font(font_family, "", 9)
    pdf.set_draw_color(*border_col)
    for idx, (label, qty, gain, ded) in enumerate(rows):
        pdf.set_x(12)
        if idx % 2 == 1:
            pdf.set_fill_color(248, 251, 253)
            fill = True
        else:
            pdf.set_fill_color(255, 255, 255)
            fill = True
        pdf.set_text_color(*text_dark)
        pdf.cell(col_widths[0], 8, f"  {label}", border=1, align="L", fill=fill)
        pdf.set_text_color(*text_muted)
        pdf.cell(col_widths[1], 8, qty, border=1, align="C", fill=fill)
        pdf.set_text_color(*text_dark)
        pdf.cell(col_widths[2], 8, f"{gain}  ", border=1, align="R", fill=fill)
        if ded != "—":
            pdf.set_text_color(189, 21, 58)  # Brand CTA crimson for deductions
        else:
            pdf.set_text_color(*text_muted)
        pdf.cell(col_widths[3], 8, f"{ded}  ", border=1, align="R", fill=fill)
        pdf.ln()

    # Summary Totals Row
    total_deductions = round(payslip.absence_deduction + payslip.other_deductions, 2)
    pdf.set_x(12)
    pdf.set_fill_color(*mist_bg)
    pdf.set_text_color(*brand_deep)
    pdf.set_font(font_family, "B", 9.5)
    pdf.cell(
        col_widths[0] + col_widths[1],
        9,
        "  TOTAUX (Salaire Brut / Total Retenues)",
        border=1,
        align="L",
        fill=True,
    )
    pdf.cell(
        col_widths[2],
        9,
        f"{format_dzd(payslip.gross_salary, currency)}  ",
        border=1,
        align="R",
        fill=True,
    )
    pdf.set_text_color(189, 21, 58)
    pdf.cell(
        col_widths[3],
        9,
        f"{format_dzd(total_deductions, currency)}  ",
        border=1,
        align="R",
        fill=True,
    )
    pdf.ln(14)

    # --- Net Pay Box ---
    pdf.set_x(12)
    pdf.set_fill_color(*brand_deep)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_family, "B", 12)
    pdf.cell(100, 12, "   NET À PAYER", align="L", fill=True)
    pdf.set_font(font_family, "B", 13)
    pdf.cell(
        86, 12, f"{format_dzd(payslip.net_salary, currency)}   ", align="R", fill=True
    )
    pdf.ln(18)

    # --- Notes ---
    if payslip.notes:
        pdf.set_x(12)
        pdf.set_font(font_family, "B", 9)
        pdf.set_text_color(*brand_blue)
        pdf.cell(186, 5, "Observations / Notes :", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(12)
        pdf.set_font(font_family, "", 8.5)
        pdf.set_text_color(*text_dark)
        pdf.multi_cell(186, 5, payslip.notes, border=1)
        pdf.ln(8)

    # --- Signatures ---
    y_sig = max(pdf.get_y() + 8, 225)
    pdf.set_y(y_sig)
    pdf.set_font(font_family, "B", 9)
    pdf.set_text_color(*text_dark)
    pdf.set_xy(20, y_sig)
    pdf.cell(70, 6, "Cachet et Signature de l'Employeur", align="C")
    pdf.set_xy(120, y_sig)
    pdf.cell(70, 6, "Signature de l'Employé(e)", align="C")

    pdf.set_draw_color(*border_col)
    pdf.rect(20, y_sig + 7, 70, 25)
    pdf.rect(120, y_sig + 7, 70, 25)

    # Footer
    pdf.set_y(-20)
    pdf.set_font(font_family, "", 7.5)
    pdf.set_text_color(*text_muted)
    pdf.cell(
        0,
        5,
        f"{company.company_name} — Document généré le {payslip.updated_at.strftime('%d/%m/%Y')}",
        align="C",
    )

    return bytes(pdf.output())
