import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { userApi } from './api/user'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'

function AppInit({ children }: { children: React.ReactNode }) {
  const [init, setInit] = useState(false)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) {
      setInit(true)
      return
    }
    // 有 token，验证是否有效
    userApi.getCurrentUser()
      .then(res => {
        // token 有效，恢复登录状态
        login(res.data, token)
      })
      .catch(() => {
        // token 无效，清除登录状态
        logout()
      })
      .finally(() => setInit(true))
  }, [])

  if (!init) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppInit>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
                <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AppInit>
  )
}
