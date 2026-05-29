import { create } from 'zustand'
import type { SessionItem, MessageItem, FriendGroup, FriendRequest } from '../types'

type ActiveTab = 'sessions' | 'friends' | 'requests' | 'search'

interface ChatState {
  // 会话
  sessions: SessionItem[]
  activeSession: SessionItem | null
  messages: MessageItem[]
  // 好友
  friendGroups: FriendGroup[]
  friendRequests: FriendRequest[]
  pendingCount: number
  activeTab: ActiveTab
  // 搜索
  searchKeyword: string
  // Actions
  setSessions: (sessions: SessionItem[]) => void
  setActiveSession: (session: SessionItem | null) => void
  setMessages: (messages: MessageItem[]) => void
  addMessage: (message: MessageItem) => void
  setFriendGroups: (groups: FriendGroup[]) => void
  setFriendRequests: (requests: FriendRequest[]) => void
  setPendingCount: (count: number) => void
  setActiveTab: (tab: ActiveTab) => void
  setSearchKeyword: (keyword: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSession: null,
  messages: [],
  friendGroups: [],
  friendRequests: [],
  pendingCount: 0,
  activeTab: 'sessions',
  searchKeyword: '',

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({ activeSession: session }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setFriendGroups: (groups) => set({ friendGroups: groups }),
  setFriendRequests: (requests) => set({ friendRequests: requests }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
}))
