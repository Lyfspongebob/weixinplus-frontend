import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { userApi } from '../api/user'
import { friendApi } from '../api/friend'
import { groupApi } from '../api/group'
import { sessionApi } from '../api/session'
import { messageApi } from '../api/message'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import type { SessionItem, FriendGroup, FriendRequest, MessageItem } from '../types'

export default function ChatPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const {
    activeSession, setActiveSession, setSessions, setMessages, addMessage,
    setFriendGroups, setFriendRequests, setPendingCount, setActiveTab,
  } = useChatStore()

  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [showUserInfo, setShowUserInfo] = useState(false)

  const [showEditUserInfo, setShowEditUserInfo] = useState(false)
  const [editForm, setEditForm] = useState({ nickname: '', phone: '', email: '', avatar: '' })

  // Polling interval for new messages
  const POLL_INTERVAL = 3000

  // ---- Data Loading ----
  const loadAllData = useCallback(async () => {
    if (!user) return
    try {
      const [sessionsRes, groupsRes, pendingRes] = await Promise.all([
        sessionApi.getUserSessions(user.userId),
        friendApi.getGroups(user.userId),
        friendApi.getPendingRequests(user.userId),
      ])
      setSessions(sessionsRes.data)
      setFriendGroups(groupsRes.data)
      setFriendRequests(pendingRes.data || [])
      setPendingCount((pendingRes.data || []).length)
    } catch (err) {
      console.error('Failed to load data', err)
    }
  }, [user, setSessions, setFriendGroups, setFriendRequests, setPendingCount])

  useEffect(() => {
    if (user) {
      setLoading(true)
      loadAllData().finally(() => setLoading(false))
    }
  }, [user, loadAllData])

  // ---- Polling for sessions (新消息/未读) ----
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const res = await sessionApi.getUserSessions(user.userId)
        setSessions(res.data)
      } catch { /* ignore */ }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user, setSessions])

  // ---- Polling for pending requests ----
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const res = await friendApi.getPendingRequests(user.userId)
        setFriendRequests(res.data)
        setPendingCount(res.data.length)
      } catch { /* ignore */ }
    }, POLL_INTERVAL * 2)
    return () => clearInterval(interval)
  }, [user, setFriendRequests, setPendingCount])

  // ---- Session click ----
  // const handleSessionClick = async (session: SessionItem) => {
  //   setActiveSession(session)
  //   setActiveTab('sessions')
  //   try {
  //     const res = await messageApi.getSessionMessages(session.sessionId)
  //     setMessages(res.data)
  //     // Mark as read
  //     sessionApi.updateReadTime(user!.userId, session.sessionId).catch(() => {})
  //   } catch (err) {
  //     console.error('Failed to load messages', err)
  //     setMessages([])
  //   }
  // }
  
  // ---- Session click ----
  const handleSessionClick = async (session: SessionItem) => {
    setActiveSession(session)
    setActiveTab('sessions')
    try {
      const res = await messageApi.getSessionMessages(session.sessionId)
      setMessages(res.data)
      // Mark as read
      await sessionApi.updateReadTime(user!.userId, session.sessionId)
      // 立即更新该会话的未读数为0，红点马上消失
      useChatStore.getState().setSessions(
        useChatStore.getState().sessions.map(s => 
          s.sessionId === session.sessionId ? { ...s, unreadCount: 0 } : s
        )
      )
    } catch (err) {
      console.error('Failed to load messages', err)
      setMessages([])
    }
  }
  

  // ---- Polling messages for active session ----
  // useEffect(() => {
  //   if (!activeSession || !user) return
  //   const interval = setInterval(async () => {
  //     try {
  //       const res = await messageApi.getSessionMessages(activeSession.sessionId)
  //       setMessages(res.data)
  //     } catch { /* ignore */ }
  //   }, POLL_INTERVAL)
  //   return () => clearInterval(interval)
  // }, [activeSession, user, setMessages])

  useEffect(() => {
    if (!activeSession || !user) return
    const interval = setInterval(async () => {
      try {
        const res = await messageApi.getSessionMessages(activeSession.sessionId)
        const currentMessages = useChatStore.getState().messages
        // 只添加不在当前列表中的新消息
        const newMessages = res.data.filter(
          (msg) => !currentMessages.some((m) => m.messageId === msg.messageId)
        )
        if (newMessages.length > 0) {
          useChatStore.getState().setMessages(res.data)
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [activeSession, user, setMessages])

  // ---- Send message ----
  const handleSendMessage = async (content: string, messageType: number, filePath?: string) => {
    if (!activeSession || !user) return

    try {
      const res = await messageApi.sendMessage({
        sessionId: activeSession.sessionId,
        senderId: user.userId,
        content,
        messageType,
        filePath,
      })
      const newMsg = {
        ...res.data,
        senderId: user.userId,
        senderName: user.nickname || user.username,
        senderAvatar: user.avatar,
      }
      // addMessage(res.data)
      addMessage(newMsg)
      // Refresh sessions for last message preview
      const sessionsRes = await sessionApi.getUserSessions(user.userId)
      setSessions(sessionsRes.data)
    } catch (err) {
      console.error('Failed to send message', err)
    }
  }

  // ---- File upload ----
  const handleFileUpload = async (file: File, type: 'image' | 'voice' | 'file') => {
    try {
      const res = await messageApi.uploadFile(file, type)
      return res.data
    } catch (err) {
      console.error('Failed to upload file', err)
      return null
    }
  }

  // ---- Logout ----
  const handleLogout = async () => {
    try {
      await userApi.logout()
    } catch { /* ignore */ }
    logout()
    navigate('/login', { replace: true })
  }

  // ---- Start private chat ----
  const handleStartPrivateChat = async (targetUserId: number) => {
    if (!user) return
    try {
      const res = await sessionApi.createPrivateSession(user.userId, targetUserId)
      handleSessionClick(res.data)
      setActiveTab('sessions')
    } catch (err) {
      console.error('Failed to create session', err)
    }
  }

  // ---- Create group ----
  const handleCreateGroup = async (groupName: string, memberIds: number[], notice?: string) => {
    if (!user) return
    try {
      await groupApi.createGroup({ ownerId: user.userId, groupName, notice, memberIds })
      await loadAllData()
    } catch (err) {
      console.error('Failed to create group', err)
    }
  }

  // ---- Download chat records ----
  const handleDownloadRecords = async () => {
    if (!activeSession) return
    try {
        const response = await messageApi.downloadMessagesAsBlob(activeSession.sessionId)
        const blob = response.data //response 是 AxiosResponse, .data 才是 Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `聊天记录_${activeSession.sessionId}_${new Date().toLocaleDateString('zh-CN')}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    } catch (err) {
        console.error('Failed to download records', err)
    }
  }

  //-------UPDATE USER INFORMATION---------
  const handleUpdateUserInformation = async () => {
    if (!user) return
    setEditForm({
      nickname: user.nickname || '',
      phone: user.phone || '',
      email: user.email || '',
      avatar: user.avatar || '',
    })
    setShowEditUserInfo(true)
  }

  //-------submit new userinformation---------
  const handleSubmitUpdate = async () => {
    if (!user) return
    try {
      const res = await userApi.updateUser({
        userId: user.userId,
        nickname: editForm.nickname,
        phone: editForm.phone,
        email: editForm.email,
        avatar: editForm.avatar || undefined,
      })
      useAuthStore.getState().setUser(res.data)
      setShowEditUserInfo(false)
    } catch (err) {
      console.error('Failed to update user', err)
    }
  }
  

  if (!user) return null

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onSessionClick={handleSessionClick}
        onStartPrivateChat={handleStartPrivateChat}
        onCreateGroup={handleCreateGroup}
        onLogout={handleLogout}
        onShowUserInfo={() => setShowUserInfo(!showUserInfo)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeSession ? (
          <ChatArea
            session={activeSession}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            onDownloadRecords={handleDownloadRecords}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-4">
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-600">选择一个会话开始聊天</h2>
              <p className="text-gray-400 mt-2">从左侧选择一个好友或群聊</p>
            </div>
          </div>
        )}
      </div>

      {/* User Info Modal */}
      {showUserInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUserInfo(false)}>
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full mx-auto mb-3 overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} className="w-full h-full object-cover" alt="头像" />
                    ) : (
                      <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                        {user.nickname?.[0] || user.username[0]}
                      </div>
                    )}
                </div>

              <h3 className="text-xl font-bold">{user.nickname || user.username}</h3>
              <p className="text-gray-500 text-sm">@{user.username}</p>
            </div>
            <div className="space-y-3 text-sm">
              {user.phone && <div className="flex justify-between"><span className="text-gray-500">手机</span><span>{user.phone}</span></div>}
              {user.email && <div className="flex justify-between"><span className="text-gray-500">邮箱</span><span>{user.email}</span></div>}
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span className={user.status === 1 ? 'text-green-600' : 'text-gray-400'}>
                  {user.status === 1 ? '在线' : '离线'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">注册时间</span>
                <span>{new Date(user.createTime).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <button
              onClick={handleUpdateUserInformation}
              className="w-full mt-6 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
            >
              个人信息
            </button>
            <button
              onClick={handleLogout}
              className="w-full mt-6 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
            >
              退出登录
            </button>
          </div>
        </div>
      )}

      {/* Edit User Info Modal */}
      {showEditUserInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowEditUserInfo(false)}>
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-center mb-6">编辑个人信息</h3>

            {/* 头像区域 */}
            <div className="flex flex-col items-center mb-4">
              <div className="relative">
                {editForm.avatar ? (
                  <img src={editForm.avatar} className="w-20 h-20 rounded-full object-cover" alt="头像" />
                ) : (
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {editForm.nickname?.[0] || user.username[0]}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1.5 cursor-pointer hover:bg-blue-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const res = await messageApi.uploadFile(file, 'image')
                        setEditForm({ ...editForm, avatar: res.data.filePath })
                      } catch (err) {
                        console.error('头像上传失败', err)
                      }
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-2">点击图标更换头像</p>
            </div>

            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">昵称</label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">手机</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">邮箱</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditUserInfo(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSubmitUpdate}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
