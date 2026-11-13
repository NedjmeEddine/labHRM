import { expect, test } from "@playwright/test"

test("Suppliers & Inventory workflow: create supplier, product, and check navigation", async ({
  page,
}) => {
  // 1. Login
  await page.goto("/login")
  await page.waitForLoadState("networkidle")

  await page.locator('[data-testid="email-input"]').fill("admin@example.com")
  await page.locator('[data-testid="password-input"]').fill("changethis")
  await page.getByRole("button", { name: /se connecter|log in/i }).click()

  // Ensure redirect to dashboard
  await expect(page).toHaveURL("/")
  await expect(
    page.getByRole("heading", { name: /tableau de bord|dashboard/i }),
  ).toBeVisible()

  // 2. Navigate to Inventory
  await page
    .getByRole("link", { name: /fournisseurs & stock|suppliers & stock/i })
    .click()
  await expect(page).toHaveURL("/inventory")
  await expect(
    page.getByRole("heading", {
      name: /gestion des fournisseurs & stocks|suppliers & inventory management/i,
    }),
  ).toBeVisible()

  // 3. Create a Supplier
  await page
    .getByRole("button", { name: /nouveau fournisseur|new supplier/i })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()

  await page
    .locator('[data-testid="supplier-name-input"]')
    .fill("Laboratoire Diagnostica Oran")
  await page.locator('[data-testid="contact-person-input"]').fill("Dr. Benali")
  await page.locator('[data-testid="supplier-phone-input"]').fill("041234567")
  await page.locator('[data-testid="payment-terms-input"]').fill("Virement 30j")
  await page.getByRole("button", { name: /enregistrer|save/i }).click()

  // Supplier should appear in the table
  await expect(page.getByText("Laboratoire Diagnostica Oran")).toBeVisible()
  await expect(page.getByText("Dr. Benali")).toBeVisible()

  // 4. Switch to Products Tab
  await page
    .getByRole("tab", { name: /produits & réactifs|products & reagents/i })
    .click()
  await page
    .getByRole("button", { name: /nouveau produit|new product/i })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()

  await page
    .locator('[data-testid="product-name-input"]')
    .fill("Contrôle Qualité Biochimie Niv 1")
  await page.locator('[data-testid="product-ref-input"]').fill("QC-BIO-N1")
  await page.getByRole("button", { name: /enregistrer|save/i }).click()

  // Product should appear in the catalog
  await expect(page.getByText("Contrôle Qualité Biochimie Niv 1")).toBeVisible()
  await expect(page.getByText("QC-BIO-N1")).toBeVisible()

  // 5. Switch back to Suppliers Tab and test PDF Statement download
  await page.getByRole("tab", { name: /fournisseurs|suppliers/i }).click()
  await expect(page.getByText("Laboratoire Diagnostica Oran")).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTitle("Relevé PDF").first().click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^releve_.*\.pdf$/)
})
