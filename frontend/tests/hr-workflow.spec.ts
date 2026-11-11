import fs from "node:fs"
import { expect, test } from "@playwright/test"

test("complete HR workflow: employee, absence interval, vacation, performance, editable payslip & PDF download", async ({
  page,
}) => {
  // 1. Login & switch to English for readable assertions
  await page.goto("/login")
  await page.getByRole("button", { name: "FR" }).click()
  await page.getByTestId("email-input").fill("admin@example.com")
  await page.getByTestId("password-input").fill("changethis")
  await page.getByRole("button", { name: "Log In" }).click()
  await expect(page).toHaveURL("/")
  await expect(
    page.getByRole("heading", { name: "HR Dashboard" }),
  ).toBeVisible()

  // 2. Add Employee: Samira Benkaci (44000 DZD -> daily rate = 2000 DZD)
  await page.getByRole("link", { name: "Employees" }).click()
  await expect(page).toHaveURL("/employees")
  await page.getByRole("button", { name: "Add Employee" }).click()

  await page.getByTestId("emp-full-name").fill("Samira Benkaci")
  await page.getByTestId("emp-job-title").fill("Biologiste")
  await page.getByTestId("emp-base-salary").fill("44000")
  await page.getByTestId("emp-hire-date").fill("2024-05-01")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("Samira Benkaci")).toBeVisible()
  await expect(page.getByText("EMP-001")).toBeVisible()

  // Open 360 Employee Profile & check initial salary history
  await page.getByRole("link", { name: "Samira Benkaci" }).click()
  await expect(page).toHaveURL(/\/employees\//)
  await expect(page.getByText("44 000,00 DZD").first()).toBeVisible()
  await page.getByRole("tab", { name: /Salary Progression History/i }).click()
  await expect(page.getByText("Initial hire salary")).toBeVisible()

  // 3. Absences & Calendar Interval Checker
  await page.getByRole("link", { name: "Absences & Calendar" }).click()
  await expect(page).toHaveURL("/attendance")

  await page.getByRole("button", { name: "Mark Single Day" }).click()
  await page.getByTestId("absence-date").fill("2026-10-05")
  await page.getByRole("button", { name: "Save" }).click()

  // Check interval Oct 1 - Oct 31, 2026
  await page.getByTestId("interval-start").fill("2026-10-01")
  await page.getByTestId("interval-end").fill("2026-10-31")
  await expect(page.getByText("2026-10-05")).toBeVisible()
  await expect(page.getByText("1 day", { exact: true })).toBeVisible()
  await expect(page.getByText("2 000,00 DZD")).toBeVisible()

  // 4. Vacations & Balance
  await page.getByRole("link", { name: "Vacations" }).click()
  await expect(page).toHaveURL("/vacations")
  await page.getByRole("button", { name: "Add Vacation" }).click()
  await page.getByTestId("vac-start").fill("2026-10-20")
  await page.getByTestId("vac-end").fill("2026-10-22")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("3 days")).toBeVisible()
  await expect(page.getByText("27 / 30 days")).toBeVisible()

  // 5. Performance Review & Bonus for October 2026
  await page.getByRole("link", { name: "Payroll & Performance" }).click()
  await expect(page).toHaveURL("/payroll")

  // Switch payroll month selector to October (10)
  await page.getByTestId("payroll-month-trigger").click()
  await page.getByRole("option", { name: "October" }).click()

  // Add performance evaluation (+5000 DZD bonus)
  await page.getByRole("tab", { name: /Performance & Bonuses/i }).click()
  await page.getByRole("button", { name: "New Evaluation" }).click()
  await page.getByRole("button", { name: "5 ★" }).click()
  await page.getByTestId("perf-bonus-input").fill("5000")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("+5 000,00 DZD")).toBeVisible()

  // 6. Batch Generate Payslips, Edit & Download Branded PDF
  await page.getByRole("tab", { name: /Payslips & PDF/i }).click()
  await page.getByRole("button", { name: "Generate All for Month" }).click()
  // Base 44000 + Bonus 5000 - Absence 2000 = 47000
  await expect(page.getByText("47 000,00 DZD")).toBeVisible()

  // Open Editable Payslip Editor & add +1000 DZD allowance
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByTestId("edit-other-allowances").fill("1000")
  await expect(page.getByTestId("edit-live-net")).toContainText("48 000,00 DZD")

  // Click Save & Download PDF
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: /Save & Download PDF/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("bulletin_paie_EMP-001_10_2026.pdf")

  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const header = fs.readFileSync(filePath!).subarray(0, 4).toString()
  expect(header).toBe("%PDF")

  // Verify updated net salary persisted in table
  await expect(page.getByRole("cell", { name: "48 000,00 DZD" })).toBeVisible()
})
