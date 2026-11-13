import { api } from "@/lib/api/client"

export interface UserPublic {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string | null
}

export interface UserUpdateMe {
  full_name?: string | null
  email?: string | null
}

export interface UpdatePassword {
  current_password: string
  new_password: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  login: ({ username, password }: LoginCredentials) => {
    const form = new URLSearchParams()
    form.set("username", username)
    form.set("password", password)
    return api
      .post<TokenResponse>("/api/v1/login/access-token", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .then((r) => r.data)
  },
  testToken: () =>
    api.post<UserPublic>("/api/v1/login/test-token").then((r) => r.data),
}

export const usersApi = {
  readMe: () => api.get<UserPublic>("/api/v1/users/me").then((r) => r.data),
  updateMe: (data: UserUpdateMe) =>
    api.patch<UserPublic>("/api/v1/users/me", data).then((r) => r.data),
  updatePassword: (data: UpdatePassword) =>
    api
      .patch<{ message: string }>("/api/v1/users/me/password", data)
      .then((r) => r.data),
}
