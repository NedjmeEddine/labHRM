import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      className="gap-1.5 font-medium"
      title={lang === "fr" ? "Switch to English" : "Passer en Français"}
    >
      <Languages className="h-4 w-4" />
      <span>{lang.toUpperCase()}</span>
    </Button>
  )
}
