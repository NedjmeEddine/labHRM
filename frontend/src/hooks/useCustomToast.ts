import { toast } from "sonner"

import { useTranslation } from "@/lib/i18n"

const useCustomToast = () => {
  const { t } = useTranslation()

  const showSuccessToast = (description: string) => {
    toast.success(t("toastSuccessTitle"), {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error(t("toastErrorTitle"), {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
