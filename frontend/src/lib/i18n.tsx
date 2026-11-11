import { createContext, type ReactNode, useContext, useState } from "react"

export type Lang = "fr" | "en"

const translations = {
  fr: {
    // Nav & Layout
    navDashboard: "Tableau de bord",
    navEmployees: "Employés",
    navAttendance: "Absences & Calendrier",
    navVacations: "Congés",
    navPayroll: "Paie & Performance",
    navSettings: "Paramètres",
    adminPortal: "Portail Administrateur",
    loginSubtitle: "Connectez-vous pour gérer EL-AMEL LAB",
    email: "Email administrateur",
    password: "Mot de passe",
    loginButton: "Se connecter",
    logout: "Déconnexion",
    appearance: "Apparence",
    thisMonth: "Ce mois",

    // Common
    search: "Rechercher...",
    add: "Ajouter",
    edit: "Modifier",
    delete: "Supprimer",
    cancel: "Annuler",
    save: "Enregistrer",
    saving: "Enregistrement...",
    actions: "Actions",
    status: "Statut",
    notes: "Notes / Observations",
    reason: "Motif",
    date: "Date",
    startDate: "Date de début",
    endDate: "Date de fin",
    month: "Mois",
    year: "Année",
    allEmployees: "Tous les employés",
    selectEmployee: "Sélectionner un employé",
    exportCsv: "Exporter CSV",
    downloadPdf: "Télécharger PDF",
    previewPdf: "Aperçu PDF",
    noData: "Aucune donnée disponible",
    confirmDelete: "Confirmer la suppression ?",
    confirmDeleteDesc: "Cette action est irréversible.",
    days: "jours",
    day: "jour",
    currency: "DZD",

    // Status labels
    statusActive: "Actif",
    statusOnLeave: "En congé",
    statusTerminated: "Inactif / Parti",
    statusApproved: "Approuvé",
    statusPending: "En attente",
    statusRejected: "Refusé",
    statusDraft: "Brouillon",
    statusPaid: "Payé",

    // Absence types
    absUnjustified: "Absence non justifiée",
    absSick: "Maladie",
    absJustified: "Absence justifiée",
    absHalfDay: "Demi-journée",
    paid: "Payée",
    unpaid: "Non payée",

    // Vacation types
    vacAnnual: "Congé annuel",
    vacSick: "Congé maladie",
    vacUnpaid: "Congé sans solde",
    vacOther: "Autre congé",

    // Payment methods
    payBankTransfer: "Virement bancaire",
    payCash: "Espèces",
    payCheck: "Chèque",

    // Dashboard
    dashTitle: "Tableau de bord RH",
    dashSubtitle: "Vue d'ensemble en temps réel — EL-AMEL LAB",
    activeEmployees: "Employés actifs",
    totalStaff: "effectif total",
    absentToday: "Absents aujourd'hui",
    onVacationToday: "En congé aujourd'hui",
    everyonePresent: "Tout le personnel est présent",
    noneOnLeave: "Aucun congé en cours",
    monthlyPayroll: "Masse salariale du mois",
    paidCount: "payés",
    draftCount: "brouillons",
    estimatedFromBase: "Estimation sur salaires de base",
    quickActions: "Actions rapides",
    addEmployee: "Ajouter un employé",
    markAbsence: "Marquer une absence",
    managePayroll: "Générer la paie",
    upcomingVacations: "Congés à venir (30 jours)",

    // Employees
    empTitle: "Gestion des employés",
    empSubtitle: "Ajoutez, modifiez et consultez les dossiers du personnel",
    empCode: "Matricule",
    fullName: "Nom complet",
    phone: "Téléphone",
    jobTitle: "Poste / Fonction",
    department: "Département",
    hireDate: "Date d'embauche",
    baseSalary: "Salaire de base (DZD)",
    vacationAllowance: "Jours de congé / an",
    cnasNumber: "N° Sécurité Sociale (CNAS)",
    salaryChangeReason: "Motif de modification du salaire",
    viewProfile: "Voir le dossier",
    salaryProgression: "Historique des salaires",
    previousSalary: "Ancien salaire",
    newSalary: "Nouveau salaire",
    vacationBalance: "Solde de congés",
    taken: "Pris",
    pending: "En attente",
    remaining: "Restants",
    allowance: "Droit annuel",

    // Attendance & Calendar
    attTitle: "Absences & Calendrier",
    attSubtitle:
      "Marquez les absences et vérifiez les absences sur n'importe quel intervalle",
    markRange: "Marquer un intervalle",
    markSingle: "Marquer une journée",
    intervalChecker: "Vérificateur d'intervalle",
    intervalDesc:
      "Sélectionnez un employé et une plage de dates pour analyser ses absences",
    totalAbsences: "Total absences",
    unpaidDays: "Jours non payés",
    paidDays: "Jours payés",
    halfDays: "Demi-journées",
    estimatedDeduction: "Retenue estimée",
    calendarLegendAbsence: "Absence non payée",
    calendarLegendPaid: "Absence payée / Maladie",
    calendarLegendVacation: "Congé approuvé",
    calendarLegendRange: "Intervalle sélectionné",
    dayEvents: "Événements du",
    noEventsDay: "Aucune absence ni congé enregistré pour cette date.",
    clickDayHint:
      "Cliquez sur une date du calendrier pour voir ou marquer une absence.",

    // Vacations
    vacTitle: "Gestion des congés",
    vacSubtitle:
      "Planifiez les congés et suivez les soldes annuels par employé",
    addVacation: "Ajouter un congé",
    vacationBalancesTitle: "Soldes des congés annuels",
    duration: "Durée",
    approve: "Approuver",
    reject: "Refuser",

    // Payroll & Performance
    payrollTitle: "Paie, Performance & Bulletins PDF",
    payrollSubtitle:
      "Évaluez les performances, ajustez les salaires et générez les fiches de paie PDF",
    tabPayslips: "Bulletins de paie & PDF",
    tabPerformance: "Performance & Primes",
    addReview: "Nouvelle évaluation",
    score: "Note (1 à 5)",
    bonusAmount: "Prime de performance (DZD)",
    updateBaseSalaryOpt: "Nouveau salaire de base permanent (optionnel)",
    generateBatch: "Générer tout le mois",
    generateSingle: "Générer un bulletin",
    overwriteDraft: "Recalculer depuis les absences/primes",
    editPayslip: "Modifier le bulletin",
    payslipEditorTitle: "Éditeur de Bulletin de Paie",
    payslipEditorDesc:
      "Les montants sont pré-remplis depuis la base de données. Modifiez librement avant de télécharger le PDF.",
    otherAllowances: "Autres indemnités (Transport, Panier...)",
    overtimePay: "Heures supplémentaires (DZD)",
    absenceDays: "Jours d'absence non payés",
    absenceDeduction: "Retenue pour absences (DZD)",
    otherDeductions: "Autres retenues (Acomptes, CNAS...)",
    grossSalary: "Salaire Brut",
    netSalary: "Net à Payer",
    workedDays: "Jours travaillés",
    vacDaysTaken: "Jours de congé pris",
    paymentMethod: "Mode de paiement",
    markAsPaid: "Marquer comme Payé",

    // Settings
    settingsTitle: "Paramètres",
    settingsSubtitle:
      "Configurez l'entreprise, les règles de paie et votre compte administrateur",
    tabCompany: "Entreprise & Paie",
    tabProfile: "Mon profil",
    tabPassword: "Mot de passe",
    companyName: "Nom de l'entreprise",
    address: "Adresse",
    taxId: "NIF / RC / Identifiant fiscal",
    workingDaysMonth: "Jours ouvrables / mois (calcul retenues)",
    defaultVacDays: "Congé annuel par défaut (jours)",
  },
  en: {
    // Nav & Layout
    navDashboard: "Dashboard",
    navEmployees: "Employees",
    navAttendance: "Absences & Calendar",
    navVacations: "Vacations",
    navPayroll: "Payroll & Performance",
    navSettings: "Settings",
    adminPortal: "Admin Portal",
    loginSubtitle: "Sign in to manage EL-AMEL LAB",
    email: "Admin Email",
    password: "Password",
    loginButton: "Log In",
    logout: "Log Out",
    appearance: "Appearance",
    thisMonth: "This Month",

    // Common
    search: "Search...",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    actions: "Actions",
    status: "Status",
    notes: "Notes",
    reason: "Reason",
    date: "Date",
    startDate: "Start Date",
    endDate: "End Date",
    month: "Month",
    year: "Year",
    allEmployees: "All Employees",
    selectEmployee: "Select employee",
    exportCsv: "Export CSV",
    downloadPdf: "Download PDF",
    previewPdf: "Preview PDF",
    noData: "No data available",
    confirmDelete: "Confirm deletion?",
    confirmDeleteDesc: "This action cannot be undone.",
    days: "days",
    day: "day",
    currency: "DZD",

    // Status labels
    statusActive: "Active",
    statusOnLeave: "On Leave",
    statusTerminated: "Terminated",
    statusApproved: "Approved",
    statusPending: "Pending",
    statusRejected: "Rejected",
    statusDraft: "Draft",
    statusPaid: "Paid",

    // Absence types
    absUnjustified: "Unjustified Absence",
    absSick: "Sick Leave",
    absJustified: "Justified Absence",
    absHalfDay: "Half Day",
    paid: "Paid",
    unpaid: "Unpaid",

    // Vacation types
    vacAnnual: "Annual Leave",
    vacSick: "Sick Leave",
    vacUnpaid: "Unpaid Leave",
    vacOther: "Other",

    // Payment methods
    payBankTransfer: "Bank Transfer",
    payCash: "Cash",
    payCheck: "Check",

    // Dashboard
    dashTitle: "HR Dashboard",
    dashSubtitle: "Real-time overview — EL-AMEL LAB",
    activeEmployees: "Active Employees",
    totalStaff: "total staff",
    absentToday: "Absent Today",
    onVacationToday: "On Vacation Today",
    everyonePresent: "All staff members present",
    noneOnLeave: "No active vacations today",
    monthlyPayroll: "Current Month Payroll",
    paidCount: "paid",
    draftCount: "drafts",
    estimatedFromBase: "Estimated from base salaries",
    quickActions: "Quick Actions",
    addEmployee: "Add Employee",
    markAbsence: "Mark Absence",
    managePayroll: "Generate Payroll",
    upcomingVacations: "Upcoming Vacations (30 days)",

    // Employees
    empTitle: "Employee Management",
    empSubtitle: "Add, edit, and view personnel records",
    empCode: "Employee Code",
    fullName: "Full Name",
    phone: "Phone",
    jobTitle: "Job Title",
    department: "Department",
    hireDate: "Hire Date",
    baseSalary: "Base Salary (DZD)",
    vacationAllowance: "Annual Vacation Days",
    cnasNumber: "Social Security (CNAS)",
    salaryChangeReason: "Salary Change Reason",
    viewProfile: "View Profile",
    salaryProgression: "Salary Progression History",
    previousSalary: "Previous Salary",
    newSalary: "New Salary",
    vacationBalance: "Vacation Balance",
    taken: "Taken",
    pending: "Pending",
    remaining: "Remaining",
    allowance: "Annual Allowance",

    // Attendance & Calendar
    attTitle: "Absences & Calendar",
    attSubtitle:
      "Mark absences and check employee absence intervals on the calendar",
    markRange: "Mark Date Range",
    markSingle: "Mark Single Day",
    intervalChecker: "Interval Checker",
    intervalDesc: "Select an employee and date interval to inspect absences",
    totalAbsences: "Total Absences",
    unpaidDays: "Unpaid Days",
    paidDays: "Paid Days",
    halfDays: "Half Days",
    estimatedDeduction: "Estimated Deduction",
    calendarLegendAbsence: "Unpaid Absence",
    calendarLegendPaid: "Paid / Sick Absence",
    calendarLegendVacation: "Approved Vacation",
    calendarLegendRange: "Selected Interval",
    dayEvents: "Events on",
    noEventsDay: "No absences or vacations recorded on this date.",
    clickDayHint:
      "Click any date on the calendar to inspect or mark an absence.",

    // Vacations
    vacTitle: "Vacation Management",
    vacSubtitle: "Schedule leaves and monitor remaining annual balances",
    addVacation: "Add Vacation",
    vacationBalancesTitle: "Annual Vacation Balances",
    duration: "Duration",
    approve: "Approve",
    reject: "Reject",

    // Payroll & Performance
    payrollTitle: "Payroll, Performance & PDF Payslips",
    payrollSubtitle:
      "Evaluate performance, adjust salaries, and generate editable PDF payslips",
    tabPayslips: "Payslips & PDF",
    tabPerformance: "Performance & Bonuses",
    addReview: "New Evaluation",
    score: "Score (1 to 5)",
    bonusAmount: "Performance Bonus (DZD)",
    updateBaseSalaryOpt: "New permanent base salary (optional)",
    generateBatch: "Generate All for Month",
    generateSingle: "Generate Single Draft",
    overwriteDraft: "Recalculate from DB",
    editPayslip: "Edit Payslip",
    payslipEditorTitle: "Payslip Editor",
    payslipEditorDesc:
      "Pre-filled from attendance & performance records. Modify any field before generating PDF.",
    otherAllowances: "Other Allowances (Transport, Meals...)",
    overtimePay: "Overtime Pay (DZD)",
    absenceDays: "Unpaid Absence Days",
    absenceDeduction: "Absence Deduction (DZD)",
    otherDeductions: "Other Deductions (Advances, CNAS...)",
    grossSalary: "Gross Salary",
    netSalary: "Net Pay",
    workedDays: "Worked Days",
    vacDaysTaken: "Vacation Days Taken",
    paymentMethod: "Payment Method",
    markAsPaid: "Mark as Paid",

    // Settings
    settingsTitle: "Settings",
    settingsSubtitle:
      "Configure company details, payroll rules, and administrator account",
    tabCompany: "Company & Payroll",
    tabProfile: "My Profile",
    tabPassword: "Password",
    companyName: "Company Name",
    address: "Address",
    taxId: "Tax ID / NIF / RC",
    workingDaysMonth: "Working Days / Month (for absence rate)",
    defaultVacDays: "Default Annual Vacation (days)",
  },
} as const

export type TranslationKey = keyof typeof translations.fr

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("elamel_lang")
    return saved === "en" || saved === "fr" ? saved : "fr"
  })

  const setLang = (next: Lang) => {
    localStorage.setItem("elamel_lang", next)
    setLangState(next)
  }

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.en[key] ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider")
  }
  return ctx
}

export function formatDZD(amount: number): string {
  return `${amount.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`
}

export const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
]

export const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
