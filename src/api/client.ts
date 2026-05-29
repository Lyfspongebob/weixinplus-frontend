import axios from 'axios'

const client = axios.create({
  baseURL: '/',
  timeout: 30000,
})

// 请求拦截器：自动携带 token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('satoken')
  if (token) {
    config.headers['satoken'] = token
  }
  return config
})

// 响应拦截器
client.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 200) {
      console.error('API Error:', res.message)
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  (error) => {
    console.error('Request Error:', error)
    // 401 未授权，清除 token 并跳转登录页
    if (error.response?.status === 401) {
      localStorage.removeItem('satoken')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
