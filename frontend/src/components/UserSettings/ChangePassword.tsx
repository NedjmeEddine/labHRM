import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import {
  extractApiErrorMessage,
  type UpdatePassword,
  usersApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

interface FormData {
  current_password: string
  new_password: string
  confirm_password: string
}

const ChangePassword = () => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { t } = useTranslation()

  const formSchema = useMemo(
    () =>
      z
        .object({
          current_password: z
            .string()
            .min(1, { message: t("passwordRequired") })
            .min(8, { message: t("passwordMinLength") }),
          new_password: z
            .string()
            .min(1, { message: t("passwordRequired") })
            .min(8, { message: t("passwordMinLength") }),
          confirm_password: z
            .string()
            .min(1, { message: t("confirmPasswordRequired") }),
        })
        .refine((data) => data.new_password === data.confirm_password, {
          message: t("passwordsMismatch"),
          path: ["confirm_password"],
        }),
    [t],
  )

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    criteriaMode: "all",
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UpdatePassword) => usersApi.updatePassword(data),
    onSuccess: () => {
      showSuccessToast(t("toastPasswordUpdated"))
      form.reset()
    },
    onError: (err) => {
      showErrorToast(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const onSubmit = async (data: FormData) => {
    mutation.mutate({
      current_password: data.current_password,
      new_password: data.new_password,
    })
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">{t("changePassword")}</h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="current_password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("currentPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    data-testid="current-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="new_password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("newPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    data-testid="new-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("confirmPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    data-testid="confirm-password-input"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton
            type="submit"
            loading={mutation.isPending}
            className="self-start"
          >
            {t("updatePassword")}
          </LoadingButton>
        </form>
      </Form>
    </div>
  )
}

export default ChangePassword
