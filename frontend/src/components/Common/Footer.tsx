export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-card/60 px-4 sm:px-6 py-3.5 text-xs sm:text-sm text-muted-foreground">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="font-medium">EL-AMEL LAB — {currentYear}</p>
        <p className="text-[11px] text-muted-foreground/80">
          Système de Gestion RH & Laboratoire
        </p>
      </div>
    </footer>
  )
}
