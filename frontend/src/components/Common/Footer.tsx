export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-brand-deep px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-white/85">EL-AMEL LAB - {currentYear}</p>
      </div>
    </footer>
  )
}
