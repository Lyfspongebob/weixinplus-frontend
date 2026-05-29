import { create } from 'zustand'
import type { UserInfo } from '../types'

interface AuthState {
  user: UserInfo | null
  token: string | null
  isLoggedIn: boolean
  setUser: (user: UserInfo) => void
  setToken: (token: string) => void
  login: (user: UserInfo, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')!) : null,
  token: localStorage.getItem('satoken'),
  isLoggedIn: !!localStorage.getItem('satoken'),
  setUser: (user) => {
    localStorage.setItem('userInfo', JSON.stringify(user))
    set({ user })
  },
  setToken: (token) => {
    localStorage.setItem('satoken', token)
    set({ token })
  },
  login: (user, token) => {
    localStorage.setItem('satoken', token)
    localStorage.setItem('userInfo', JSON.stringify(user))
    set({ user, token, isLoggedIn: true })
  },
  logout: () => {
    localStorage.removeItem('satoken')
    localStorage.removeItem('userInfo')
    set({ user: null, token: null, isLoggedIn: false })
  },
}))
