import client from './client'
import type { ApiResponse, UserInfo, LoginResponse, LoginRequest, RegisterRequest, UpdateUserRequest } from '../types'

export const userApi = {
  register(data: RegisterRequest) {
    return client.post<any, ApiResponse<UserInfo>>('/api/users/register', data)
  },

  login(data: LoginRequest) {
    return client.post<any, ApiResponse<LoginResponse>>('/api/users/login', data)
  },

  logout() {
    return client.post<any, ApiResponse<null>>('/api/users/logout')
  },

  getCurrentUser() {
    return client.get<any, ApiResponse<UserInfo>>('/api/users/me')
  },

  getUserInfo(userId: number) {
    return client.get<any, ApiResponse<UserInfo>>(`/api/users/${userId}`)
  },

  searchUsers(username: string) {
    return client.get<any, ApiResponse<UserInfo[]>>('/api/users/search', { params: { username } })
  },

  updateUser(data: UpdateUserRequest) {
    return client.put<any, ApiResponse<UserInfo>>('/api/users/update', data)
  },
}
