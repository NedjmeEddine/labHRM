import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import {
  extractApiErrorMessage,
  type UserUpdateMe,
  usersApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

interface FormData {
  full_name?: string
  email: string
}

const UserInformation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()

  const formSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().max(255).optional(),
        email: z.email({ message: t("invalidEmail") }),
      }),
    [t],
  )

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    values: {
      full_name: currentUser?.full_name ?? "",
      email: currentUser?.email ?? "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) => usersApi.updateMe(data),
    onSuccess: () => {
      showSuccessToast(t("toastUserUpdated"))
      setEditMode(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser })
    },
    onError: (err) => {
      showErrorToast(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const onSubmit = (data: FormData) => {
    const updateData: UserUpdateMe = {}
    if (data.full_name !== (currentUser?.full_name ?? "")) {
      updateData.full_name = data.full_name || null
    }
    if (data.email !== currentUser?.email) {
      updateData.email = data.email
    }
    mutation.mutate(updateData)
  }

  const onCancel = () => {
    form.reset()
    setEditMode(false)
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">{t("userInformation")}</h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) =>
              editMode ? (
                <FormItem>
                  <FormLabel>{t("fullName")}</FormLabel>
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              ) : (
                <FormItem>
                  <FormLabel>{t("fullName")}</FormLabel>
                  <p
                    className={cn(
                      "py-2 truncate max-w-sm",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value || t("notAvailable")}
                  </p>
                </FormItem>
              )
            }
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) =>
              editMode ? (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              ) : (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <p className="py-2 truncate max-w-sm">{field.value}</p>
                </FormItem>
              )
            }
          />

          <div className="flex gap-3">
            {editMode ? (
              <>
                <LoadingButton
                  type="submit"
                  loading={mutation.isPending}
                  disabled={!form.formState.isDirty}
                >
                  {t("save")}
                </LoadingButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={mutation.isPending}
                >
                  {t("cancel")}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setEditMode(true)}>
                {t("edit")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

export default UserInformation
