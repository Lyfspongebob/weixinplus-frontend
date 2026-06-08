import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { userApi } from '../api/user'
import { friendApi } from '../api/friend'
import { sessionApi } from '../api/session'
import type { SessionItem, UserInfo, FriendGroup } from '../types'
import { formatTime, getMessagePreview } from '../utils/format'
import {
  MessageCircle, Users, UserPlus, Search, LogOut, Plus, ChevronLeft,
  ChevronRight, X, UserCheck, UserX, Move, Trash2, Settings,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onSessionClick: (session: SessionItem) => void
  onStartPrivateChat: (userId: number) => void
  onCreateGroup: (name: string, memberIds: number[], notice?: string) => void
  onLogout: () => void
  onShowUserInfo: () => void
}

export default function Sidebar({
  collapsed, onToggleCollapse, onSessionClick,
  onStartPrivateChat, onCreateGroup, onLogout, onShowUserInfo,
}: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const {
    sessions, activeSession, friendGroups, friendRequests, pendingCount,
    activeTab, setActiveTab, setFriendGroups, setFriendRequests, setPendingCount,
  } = useChatStore()
  const navigate = useNavigate()

  const [searchResults, setSearchResults] = useState<UserInfo[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Group management
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupNotice, setGroupNotice] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [friendsForGroup, setFriendsForGroup] = useState<UserInfo[]>([])

  // Friend management
  const [showFriendMenu, setShowFriendMenu] = useState<{ relationshipId: number; userId: number } | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState<{ relationshipId: number; currentGroupId?: number } | null>(null)
  const [newGroupName, setNewGroupName] = useState('')

  // 点击外部关闭好友操作菜单
  useEffect(() => {
    if (!showFriendMenu) return
    const handleClickOutside = () => setShowFriendMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showFriendMenu])

  // Search users
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchKeyword.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await userApi.searchUsers(searchKeyword.trim())
        setSearchResults(res.data || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchKeyword])

  // Load friend list for group creation
  const loadFriendsForGroup = async () => {
    try {
      const res = await friendApi.getFriendList(user!.userId)
      setFriendsForGroup(res.data.map((f) => ({
        userId: f.userId, username: f.username, nickname: f.nickname,
        avatar: f.avatar, status: f.status, phone: null, email: null, createTime: '',
      })))
    } catch { setFriendsForGroup([]) }
  }

  const handleCreateGroup = () => {
    if (!groupName.trim()) return
    onCreateGroup(groupName.trim(), selectedMembers, groupNotice || undefined)
    setShowCreateGroup(false)
    setGroupName('')
    setGroupNotice('')
    setSelectedMembers([])
  }

  const toggleMember = (userId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  // Handle friend requests
  const handleFriendRequest = async (relationshipId: number, action: number) => {
    try {
      await friendApi.handleFriendRequest(relationshipId, action)
      const [pendingRes, groupsRes] = await Promise.all([
        friendApi.getPendingRequests(user!.userId),
        friendApi.getGroups(user!.userId),
      ])
      setFriendRequests(pendingRes.data)
      setPendingCount(pendingRes.data.length)
      setFriendGroups(groupsRes.data)
    } catch (err) {
      console.error('Failed to handle friend request', err)
    }
  }

  // Delete friend
  // const handleDeleteFriend = async (relationshipId: number) => {
  //   if (!user) return
  //   try {
  //     await friendApi.deleteFriend(relationshipId, user.userId)
  //     const groupsRes = await friendApi.getGroups(user.userId)
  //     setFriendGroups(groupsRes.data)
  //   } catch (err) {
  //     console.error('Failed to delete friend', err)
  //   }
  //   setShowFriendMenu(null)
  // }

  const handleDeleteFriend = async (relationshipId: number, friendUserId: number) => {
    if (!user) return
    try {
        await friendApi.deleteFriend(relationshipId, user.userId)
        
        // 从 store 中移除与该好友的会话（后端已删除双方的会话记录）
        const sessions = useChatStore.getState().sessions
        const targetSession = sessions.find(s => 
            s.sessionType === 1 && s.targetUserId === friendUserId
        )
        if (targetSession) {
            useChatStore.getState().setSessions(
                sessions.filter(s => s.sessionId !== targetSession.sessionId)
            )
            // 如果当前激活的就是这个会话，清空
            if (activeSession?.sessionId === targetSession.sessionId) {
                useChatStore.getState().setActiveSession(null)
                useChatStore.getState().setMessages([])
            }
        }
        
        const groupsRes = await friendApi.getGroups(user.userId)
        setFriendGroups(groupsRes.data)
        alert('已删除好友')
    } catch (err: any) {
        console.error('Failed to delete friend', err)
        const errorMsg = err?.response?.data?.message || err?.message || '删除好友失败'
        alert(errorMsg)
    }
    setShowFriendMenu(null)
  }

  // Move friend
  const handleMoveFriend = async (relationshipId: number, newGroupId: number) => {
    try {
      await friendApi.moveFriend(relationshipId, newGroupId)
      const groupsRes = await friendApi.getGroups(user!.userId)
      setFriendGroups(groupsRes.data)
    } catch (err) {
      console.error('Failed to move friend', err)
    }
    setShowMoveDialog(null)
  }

  // 新建分组并移动好友
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim() || !showMoveDialog) return
    try {
      const res = await friendApi.createGroup(user!.userId, newGroupName.trim())
      const newGroupId = res.data.groupId
      // 创建成功后自动将好友移动到新分组
      await handleMoveFriend(showMoveDialog.relationshipId, newGroupId)
      setNewGroupName('')
    } catch (err) {
      console.error('Failed to create group', err)
      alert('创建分组失败')
    }
  }

  if (collapsed) {
    return (
      <div className="w-16 bg-white border-r flex flex-col items-center py-3 space-y-4">
        <button onClick={onToggleCollapse} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={() => setActiveTab('sessions')} className={`p-2 rounded-lg ${activeTab === 'sessions' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>
          <MessageCircle className="w-5 h-5" />
        </button>
        <button onClick={() => setActiveTab('friends')} className={`p-2 rounded-lg ${activeTab === 'friends' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>
          <Users className="w-5 h-5" />
        </button>
        <button onClick={() => setActiveTab('requests')} className={`p-2 rounded-lg relative ${activeTab === 'requests' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>
          <UserPlus className="w-5 h-5" />
          {pendingCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{pendingCount}</span>}
        </button>
        <button onClick={() => setActiveTab('search')} className={`p-2 rounded-lg ${activeTab === 'search' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>
          <Search className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-r flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 border-b flex items-center justify-between bg-blue-50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-gray-800">WexinPlus</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onShowUserInfo} className="p-1.5 hover:bg-blue-100 rounded-lg text-gray-500" title="个人信息">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={onToggleCollapse} className="p-1.5 hover:bg-blue-100 rounded-lg text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b bg-gray-50 shrink-0">
        {[
          { key: 'sessions', label: '消息', icon: MessageCircle },
          { key: 'friends', label: '好友', icon: Users },
          { key: 'requests', label: '申请', icon: UserPlus, badge: pendingCount },
          { key: 'search', label: '搜索', icon: Search },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any)
              if (tab.key === 'friends') loadFriendsForGroup()
            }}
            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 relative transition
              ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="absolute -top-0.5 right-[15%] w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div>
            <div className="px-3 py-2">
              {sessions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>暂无会话</p>
                  <p className="text-xs mt-1">在好友列表中选择好友开始聊天</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => onSessionClick(session)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl mb-0.5 transition text-left group
                      ${activeSession?.sessionId === session.sessionId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="w-11 h-11 rounded-full shrink-0 overflow-hidden relative">
                      {session.sessionType === 2 ? (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center text-white font-bold">
                          {session.groupName?.[0] || '群'}
                        </div>
                      ) : session.targetAvatar ? (
                        <img src={session.targetAvatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">
                          {session.targetNickname?.[0] || session.targetUsername?.[0] || '?'}
                        </div>
                      )}

                      {/* 小红点 */}
                      {(session as any).unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                      )}

                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate">
                          {session.sessionType === 2 ? session.groupName : (session.targetNickname || session.targetUsername)}
                        </span>
                        {session.lastMessageTime && (
                          <span className="text-xs text-gray-400 shrink-0 ml-1">{formatTime(session.lastMessageTime)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-xs text-gray-400 truncate">
                          {session.lastMessage ? (
                            session.sessionType === 2 && session.lastMessageSenderName
                              ? `${session.lastMessageSenderName}：${session.lastMessage}`
                              : session.lastMessage
                          ) : (session.sessionType === 2 ? '群聊' : '私聊')}
                        </span>

                        {/* 未读条数 */}
                        {(session as any).unreadCount > 0 && (
                          <span className="text-xs bg-red-500 text-white rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center shrink-0 ml-1">
                            {(session as any).unreadCount}
                          </span>
                        )}

                      </div>
                    </div>

                    {/* 删除会话按钮已移除 */}

                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">好友列表</span>
              <button
                onClick={() => { setShowCreateGroup(true); loadFriendsForGroup() }}
                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"
                title="创建群聊"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {friendGroups.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>暂无好友</p>
                <p className="text-xs mt-1">在搜索中查找并添加好友</p>
              </div>
            ) : (
              friendGroups.map((group) => (
                <div key={group.groupId} className="mb-2">
                  
                  {/* <div className="flex items-center gap-1 py-1.5">
                    <div className="w-3 h-3 border border-gray-300 rounded-sm flex items-center justify-center">
                      <Users className="w-2 h-2 text-gray-400" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">{group.groupName}</span>
                    <span className="text-xs text-gray-400">({group.friends.length})</span>
                  </div> */}

                  <div className="flex items-center gap-1 py-1.5 group">
                    <div className="w-3 h-3 border border-gray-300 rounded-sm flex items-center justify-center">
                      <Users className="w-2 h-2 text-gray-400" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">{group.groupName}</span>
                    <span className="text-xs text-gray-400">({group.friends.length})</span>
                    {/* 管理分组按钮（默认分组不显示删除） */}
                    {group.groupName !== '我的好友' && (
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const newName = prompt('请输入新的分组名称：', group.groupName)
                            if (newName && newName.trim() && newName !== group.groupName) {
                              friendApi.renameGroup(group.groupId, user!.userId, newName.trim())
                                .then(() => friendApi.getGroups(user!.userId))
                                .then((res) => setFriendGroups(res.data))
                                .catch((err) => alert(err.message || '重命名失败'))
                            }
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-500"
                          title="重命名"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`确定要删除分组"${group.groupName}"吗？该分组下的好友将移动到"我的好友"`)) {
                              friendApi.deleteGroup(group.groupId, user!.userId)
                                .then(() => friendApi.getGroups(user!.userId))
                                .then((res) => setFriendGroups(res.data))
                                .catch((err) => alert(err.message || '删除失败'))
                            }
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"
                          title="删除分组"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="ml-1">
                    {group.friends.map((friend) => (
                      <div key={friend.relationshipId} className="relative group">
                        <div
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => onStartPrivateChat(friend.userId)}
                        >
                          <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden">
                            {friend.avatar ? (
                              <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white text-sm font-bold
                                ${friend.status === 1 ? 'bg-green-500' : 'bg-gray-400'}`}>
                                {friend.nickname?.[0] || friend.username[0]}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{friend.remark || friend.nickname || friend.username}</span>
                              {friend.status === 1 ? <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> : null}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowFriendMenu(friend) }}
                            className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                            <Move className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>

                        {/* Friend context menu */}
                        {showFriendMenu?.relationshipId === friend.relationshipId && (
                          <div className="absolute right-2 top-10 bg-white rounded-lg shadow-lg border z-20 py-1 w-36">
                            <div className="px-3 py-1.5 text-xs text-gray-500 border-b">操作</div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowMoveDialog({ relationshipId: friend.relationshipId, currentGroupId: friend.groupId }) }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Move className="w-3.5 h-3.5" /> 移动分组
                            </button>
                            <button
                              onClick={() => handleDeleteFriend(friend.relationshipId, friend.userId)}
                              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 删除好友
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'requests' && (
          <div className="px-3 py-2">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">好友申请</div>
            {friendRequests.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>暂无待处理的好友申请</p>
              </div>
            ) : (
              friendRequests?.map((req) => (
                <div key={req.relationshipId} className="flex items-center gap-3 p-3 rounded-xl mb-1 hover:bg-gray-50">
                  {/* <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                    {req.nickname?.[0] || req.username?.[0] || '?'}
                  </div> */}
                  <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden">
                    {req.avatar ? (
                      <img src={req.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        {req.nickname?.[0] || req.username?.[0] || '?'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{req.nickname || req.username}</div>
                    <div className="text-xs text-gray-400 truncate">{req.message || '请求添加你为好友'}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleFriendRequest(req.relationshipId, 1)}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                      title="同意"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFriendRequest(req.relationshipId, 2)}
                      className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                      title="拒绝"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="px-3 py-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索用户..."
                className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searchKeyword && (
                <button onClick={() => setSearchKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {searching ? (
              <div className="text-center text-gray-400 text-sm py-8">搜索中...</div>
            ) : searchResults.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">搜索结果</div>
                {searchResults
                  .filter((u) => u.userId !== user?.userId)
                  .map((result) => (
                    <div key={result.userId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                      <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden">
                        {result.avatar ? (
                          <img src={result.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold">
                            {result.nickname?.[0] || result.username[0]}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{result.nickname || result.username}</div>
                        <div className="text-xs text-gray-400">@{result.username}</div>
                      </div>
                      <button
                        onClick={() => {
                          friendApi.applyFriend({ userId: user!.userId, friendId: result.userId, applyMessage: '你好，加个好友' })
                            .then(() => alert('好友申请已发送'))
                            .catch((err) => alert(err.message || '发送失败'))
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shrink-0"
                      >
                        加好友
                      </button>
                    </div>
                  ))}
                {searchResults.filter((u) => u.userId !== user?.userId).length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-4">没有找到其他用户</div>
                )}
              </div>
            ) : searchKeyword ? (
              <div className="text-center text-gray-400 text-sm py-8">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>未找到相关用户</p>
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-8">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>输入用户名搜索用户</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Footer */}
      <div className="border-t p-3 flex items-center gap-2 bg-gray-50 shrink-0">
        <button onClick={onShowUserInfo} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
          <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                {user?.nickname?.[0] || user?.username[0] || '?'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium truncate">{user?.nickname || user?.username}</div>
            <div className="text-xs text-green-600">● 在线</div>
          </div>
        </button>
        <button onClick={onLogout} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition" title="退出登录">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-white rounded-2xl w-96 max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b">
              <h3 className="text-lg font-bold">创建群聊</h3>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">群名称</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="请输入群名称" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">群公告（选填）</label>
                <input type="text" value={groupNotice} onChange={(e) => setGroupNotice(e.target.value)}
                  placeholder="群公告" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择成员 ({selectedMembers.length})
                </label>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  {friendsForGroup.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-4">暂无好友可选</div>
                  ) : (
                    friendsForGroup.map((f) => (
                      <label key={f.userId} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selectedMembers.includes(f.userId)}
                          onChange={() => toggleMember(f.userId)} className="rounded text-blue-500" />
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {f.nickname?.[0] || f.username[0]}
                        </div>
                        <span className="text-sm">{f.nickname || f.username}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Friend Dialog */}
      {/* {showMoveDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowMoveDialog(null)}>
          <div className="bg-white rounded-2xl w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-sm">移动好友到分组</h3>
            </div>
            <div className="p-2">
              {friendGroups.map((g) => (
                <button
                  key={g.groupId}
                  onClick={() => handleMoveFriend(showMoveDialog.relationshipId, g.groupId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-blue-50 transition
                    ${showMoveDialog.currentGroupId === g.groupId ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                >
                  {g.groupName}
                </button>
              ))}
            </div>
            <div className="p-3 border-t flex justify-end">
              <button onClick={() => setShowMoveDialog(null)} className="text-sm text-gray-500 px-3 py-1">取消</button>
            </div>
          </div>
        </div>
      )} */}

        {/* Move Friend Dialog */}
        {showMoveDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowMoveDialog(null)}>
          <div className="bg-white rounded-2xl w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-sm">移动好友到分组</h3>
            </div>
            <div className="p-2">
              {friendGroups.map((g) => (
                <button
                  key={g.groupId}
                  onClick={() => handleMoveFriend(showMoveDialog.relationshipId, g.groupId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-blue-50 transition
                    ${showMoveDialog.currentGroupId === g.groupId ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                >
                  {g.groupName}
                </button>
              ))}
              {/* 新建分组 */}
              <div className="border-t mt-2 pt-2">
                <div className="flex items-center gap-1 px-3 py-1">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="新建分组名称"
                    className="flex-1 px-2 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={handleCreateNewGroup}
                    disabled={!newGroupName.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
            <div className="p-3 border-t flex justify-end">
              <button onClick={() => setShowMoveDialog(null)} className="text-sm text-gray-500 px-3 py-1">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
