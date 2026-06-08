import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { sessionApi } from '../api/session'
import { groupApi } from '../api/group'
import { messageApi } from '../api/message'
import { friendApi } from '../api/friend'
import type { SessionItem, UserInfo, MessageItem, UploadResult, GroupInfo } from '../types'
import { formatTime, getFileIcon } from '../utils/format'
import {
  Send, Paperclip, Mic, Square, Download, Image, FileText, ChevronDown,
  X, Info, Users, Smile,
} from 'lucide-react'

interface ChatAreaProps {
  session: SessionItem
  currentUser: UserInfo
  onSendMessage: (content: string, messageType: number, filePath?: string) => void
  onFileUpload: (file: File, type: 'image' | 'voice' | 'file') => Promise<UploadResult | null>
  onDownloadRecords: () => void
}

export default function ChatArea({ session, currentUser, onSendMessage, onFileUpload, onDownloadRecords }: ChatAreaProps) {
  const messages = useChatStore((s) => s.messages)
  const [inputText, setInputText] = useState('')
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filteredMessages, setFilteredMessages] = useState<MessageItem[] | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const isGroupChat = session.sessionType === 2
  
  // 添加一个 ref 指向消息容器
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // 判断是否在底部（容差 50px）
const isNearBottom = () => {
  const container = messagesContainerRef.current
  if (!container) return true
  const threshold = 50
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
}

  // // Auto scroll to bottom on new messages
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  // }, [messages, filteredMessages])

  // ====== 新增：检查对方是否还是好友 ======
  const [notFriend, setNotFriend] = useState(false)

  useEffect(() => {
      if (!isGroupChat && session.targetUserId && currentUser) {
          // 导入 friendApi
          friendApi.checkFriendship(currentUser.userId, session.targetUserId)
              .then(res => setNotFriend(!res.data.isFriend))
              .catch(() => setNotFriend(false))
      } else {
          setNotFriend(false)
      }
  }, [session.sessionId, session.targetUserId, currentUser, isGroupChat])

  // 切换会话时强制滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [session.sessionId,messages])

  // 只在用户位于底部时自动滚动
  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, filteredMessages])


  // Load group info
  const loadGroupInfo = async () => {
    if (!isGroupChat || !session.groupId) return
    try {
      const res = await groupApi.getGroupInfo(session.groupId)
      setGroupInfo(res.data)
    } catch { /* ignore */ }
  }

  // Send text message
  const handleSend = () => {
    if (!inputText.trim()) return
    onSendMessage(inputText.trim(), 1)
    setInputText('')
  }

  // Send on Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await onFileUpload(file, type)
    if (result) {
      if (type === 'image') {
        onSendMessage('[图片]', 2, result.filePath)
      } else {
        onSendMessage(file.name, 4, result.filePath)
      }
    }
    e.target.value = ''
    setShowFileMenu(false)
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        const result = await onFileUpload(file, 'voice')
        if (result) {
          onSendMessage('[语音消息]', 3, result.filePath)
        }
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    } catch {
      alert('无法访问麦克风，请检查权限')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setIsRecording(false)
  }

  // Date filter for messages
  const applyDateFilter = async () => {
    if (!dateRange.start && !dateRange.end) {
      setFilteredMessages(null)
      return
    }
    try {
      const res = await messageApi.queryMessages({
        sessionId: session.sessionId,
        startTime: dateRange.start ? `${dateRange.start}T00:00:00` : undefined,
        endTime: dateRange.end ? `${dateRange.end}T23:59:59` : undefined,
      })
      setFilteredMessages(res.data)
    } catch { /* ignore */ }
    setShowDateFilter(false)
  }

  const displayMessages = filteredMessages || messages

  // Render message content
  const renderMessage = (msg: MessageItem) => {
    const isMine = msg.senderId === currentUser.userId
    switch (msg.messageType) {
      case 1:
        return <p className="whitespace-pre-wrap break-words">{msg.content}</p>
      case 2:
        return (
          <div className="max-w-[240px]">
            <img
              src={msg.filePath || ''}
              alt="图片"
              className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
              onClick={() => msg.filePath && window.open(msg.filePath, '_blank')}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )
      case 3:
        return (
          <div className="flex items-center gap-2">
          <audio
            controls
            src={msg.filePath || ''}
            className="h-8 max-w-[200px]"
            preload="none"
          />
          </div>
        )
      case 4:
        return (
          <div
            onClick={() => { if (msg.filePath) window.open(msg.filePath, '_blank') }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
          >
            <span className="text-lg">{getFileIcon(msg.content)}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{msg.content}</p>
              <p className="text-xs text-blue-500">点击下载</p>
            </div>
          </div>
        )
      default:
        return <p>{msg.content}</p>
    }
  }

  const formatRecordTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ====== Emoji 选择器 ======
  // 常用 Emoji 列表
  const emojiList = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
    '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗',
    '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
    '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝',
    '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁',
    '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
    '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡',
    '😠', '🤬', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌',
    '👐', '🤲', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👋',
    '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '💪', '🦵', '🦶',
    '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄',
    '💋', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
    '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    '🎉', '🎊', '🎈', '🎁', '🎀', '🪄', '✨', '🌟', '⭐', '🌙',
    '☀️', '🌈', '☁️', '⛅', '⚡', '🔥', '💥', '💫', '💦', '💨',
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
    '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
    '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎',
    '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
    '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
    '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔',
    '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩',
    '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥗',
    '🍿', '🧈', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝',
    '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪',
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
    '🚜', '🏍️', '🛵', '🚲', '🛴', '🚨', '🚔', '🚍', '🚘', '🚖',
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🎂', '🍰', '🧁', '🥧', '🍦', '🍨', '🍩', '🍪', '🍫', '🍬',
    '☕', '🍵', '🧃', '🥤', '🧊', '🍶', '🍺', '🍻', '🥂', '🍷',
  ]

  // 点击外部关闭 Emoji 选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 插入表情到输入框
  const handleEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Chat Header */}
      <div className="h-14 px-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden">
              {isGroupChat ? (
                <div className="w-full h-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                  {session.groupName?.[0] || '群'}
                </div>
              ) : session.targetAvatar ? (
                <img src={session.targetAvatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {session.targetNickname?.[0] || session.targetUsername?.[0] || '?'}
                </div>
              )}
            </div>

          <div>
            <h2 className="text-sm font-semibold">
              {isGroupChat ? session.groupName : (session.targetNickname || session.targetUsername)}
            </h2>
            <p className="text-xs text-gray-400">
              {isGroupChat ? '群聊' : '私聊'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowDateFilter(true) }}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="按日期筛选消息"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {isGroupChat && (
            <button
              onClick={() => { setShowGroupInfo(true); loadGroupInfo() }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
              title="群聊信息"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDownloadRecords}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="下载聊天记录"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 非好友提示 */}
      {notFriend && (
          <div className="px-4 py-2 bg-yellow-50 border-b flex items-center justify-center">
              <span className="text-sm text-yellow-700">
                  ⚠️ 对方已不是你好友，请重新添加好友后再聊天
              </span>
          </div>
      )}

      {/* Date filter indicator */}
      {filteredMessages && (
        <div className="px-4 py-1.5 bg-yellow-50 border-b flex items-center justify-between">
          <span className="text-xs text-yellow-700">已按日期筛选消息</span>
          <button onClick={() => setFilteredMessages(null)} className="text-xs text-yellow-600 hover:underline">清除筛选</button>
        </div>
      )}

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#f5f5f5]">
        {displayMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            暂无消息，发送第一条消息吧
          </div>
        ) : (
          displayMessages.map((msg, idx) => {
            // const isMine = msg.senderId === currentUser.userId
            const isMine = Number(msg.senderId) === Number(currentUser.userId)
            const showAvatar = idx === 0 || displayMessages[idx - 1].senderId !== msg.senderId
            const showTime = idx === 0 ||
              new Date(msg.sendTime).getTime() - new Date(displayMessages[idx - 1].sendTime).getTime() > 300000

            return (
              <div key={msg.messageId}>
                {showTime && (
                  <div className="text-center my-3">
                    <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded-full">{formatTime(msg.sendTime)}</span>
                  </div>
                )}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} message-enter`}>
                  {!isMine && showAvatar && (
                    <div className="w-9 h-9 rounded-full shrink-0 mr-2 mt-1 overflow-hidden">
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                          {msg.senderName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                  )}
                  {!isMine && !showAvatar && <div className="w-9 mr-2 shrink-0" />}
                  {/* <div className={`max-w-[70%] ${isMine ? 'order-1' : ''}`}> */}
                  <div className="max-w-[70%]">
                    {!isMine && showAvatar && (
                      <div className="text-xs text-gray-400 mb-0.5 ml-1">{msg.senderName}</div>
                    )}
                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                    }`}>
                      {renderMessage(msg)}
                    </div>
                  </div>
                  {isMine && showAvatar && (
                    <div className="w-9 h-9 rounded-full shrink-0 ml-2 mt-1 overflow-hidden">
                      {currentUser.avatar ? (
                        <img src={currentUser.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                          {currentUser.nickname?.[0] || currentUser.username[0]}
                        </div>
                      )}
                    </div>
                  )}
                  {isMine && !showAvatar && <div className="w-9 ml-2 shrink-0" />}
                </div>
              </div>
            )
          }
        )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              placeholder="输入消息..."
              rows={1}
              className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none max-h-32"
              style={{ minHeight: '40px' }}
            />
          </div>

          <div className="flex items-center gap-1">
            {/* Emoji picker */}
            <div className="relative" ref={emojiPickerRef}>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="表情"
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border p-2 z-10 w-[320px]">
                  <div className="max-h-[200px] overflow-y-auto grid grid-cols-10 gap-1">
                    {emojiList.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* File menu */}
            <div className="relative">
              <button
                onClick={() => setShowFileMenu(!showFileMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="附件"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {showFileMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border p-2 flex gap-2 z-10">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <Image className="w-5 h-5 text-purple-500" />
                    <span className="text-xs text-gray-500">图片</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="text-xs text-gray-500">文件</span>
                  </button>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />
            </div>

            {/* Voice recording */}
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="p-2 bg-red-500 text-white rounded-lg animate-pulse flex items-center gap-1.5"
              >
                <Square className="w-4 h-4" />
                <span className="text-xs font-medium">{formatRecordTime(recordingTime)}</span>
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="语音"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Group Info Modal */}
      {showGroupInfo && groupInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGroupInfo(false)}>
          <div className="bg-white rounded-2xl w-96 max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">{groupInfo.groupName}</h3>
              <button onClick={() => setShowGroupInfo(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {groupInfo.notice && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">群公告</div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-sm text-gray-600">{groupInfo.notice}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" /> 群成员 ({groupInfo.memberCount})
                </div>
                <div className="space-y-1">
                  {groupInfo.members.map((m) => (
                    <div key={m.memberId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                        {m.nickname?.[0] || m.username[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{m.nickname || m.username}</div>
                        <div className="text-xs text-gray-400">
                          {m.role === 1 ? '群主' : m.role === 2 ? '管理员' : '成员'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter Modal */}
      {showDateFilter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDateFilter(false)}>
          <div className="bg-white rounded-2xl w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold">按日期筛选消息</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                <input type="date" value={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">结束日期</label>
                <input type="date" value={dateRange.end} onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowDateFilter(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={applyDateFilter} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">筛选</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
