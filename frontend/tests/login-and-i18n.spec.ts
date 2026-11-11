import { expect, test } from "@playwright/test"

test("unauthenticated redirect, bilingual FR/EN switcher, and admin login", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)

  // Default language is French
  await expect(
    page.getByRole("heading", { name: "Portail Administrateur" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible()

  // Toggle FR -> EN
  await page.getByRole("button", { name: "FR" }).click()
  await expect(
    page.getByRole("heading", { name: "Admin Portal" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()

  // Invalid login shows error
  await page.getByTestId("email-input").fill("admin@example.com")
  await page.getByTestId("password-input").fill("wrongpassword")
  await page.getByRole("button", { name: "Log In" }).click()
  await expect(page).toHaveURL(/\/login/)

  // Valid login redirects to dashboard
  await page.getByTestId("password-input").fill("changethis")
  await page.getByRole("button", { name: "Log In" }).click()
  await expect(page).toHaveURL("/")
  await expect(
    page.getByRole("heading", { name: "HR Dashboard" }),
  ).toBeVisible()
})
