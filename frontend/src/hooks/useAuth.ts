import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  authApi,
  extractApiErrorMessage,
  type LoginCredentials,
  type UserPublic,
  usersApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import {
  getStorageItem,
  removeStorageItem,
  STORAGE_KEYS,
  setStorageItem,
} from "@/lib/storage"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return getStorageItem(STORAGE_KEYS.accessToken) !== null
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const { t } = useTranslation()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: queryKeys.auth.currentUser,
    queryFn: usersApi.readMe,
    enabled: isLoggedIn(),
  })

  const loginMutation = useMutation({
    mutationFn: async (data: LoginCredentials) => {
      const response = await authApi.login(data)
      setStorageItem(STORAGE_KEYS.accessToken, response.access_token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser })
      navigate({ to: "/" })
    },
    onError: (err) => {
      showErrorToast(extractApiErrorMessage(err, t("somethingWentWrong")))
    },
  })

  const logout = () => {
    removeStorageItem(STORAGE_KEYS.accessToken)
    queryClient.clear()
    navigate({ to: "/login" })
  }

  return {
    loginMutation,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
