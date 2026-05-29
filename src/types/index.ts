// ============ 统一响应格式 ============
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// ============ 用户模块 ============
export interface UserInfo {
  userId: number
  username: string
  nickname: string
  avatar: string | null
  phone: string | null
  email: string | null
  status: number // 0=离线, 1=在线
  createTime: string
}

export interface LoginResponse {
  token: string
  user: UserInfo
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  nickname?: string
  phone?: string
  email?: string
}

export interface UpdateUserRequest {
  userId: number
  nickname?: string
  phone?: string
  email?: string
  avatar?: string
}

// ============ 好友模块 ============
export interface Friend {
  relationshipId: number
  userId: number
  username: string
  nickname: string
  avatar: string | null
  status: number
  remark: string | null
  groupId?: number
  groupName?: string
}

export interface FriendGroup {
  groupId: number
  groupName: string
  friends: Friend[]
}

export interface FriendRequest {
  relationshipId: number
  userId: number
  username: string
  nickname: string
  avatar: string | null
  message: string
  status: number // 0=待验证, 1=已通过, 2=已拒绝, 3=已删除
  createTime: string
}

export interface ApplyFriendRequest {
  userId: number
  friendId: number
  groupId?: number
  applyMessage?: string
  remark?: string
}

// ============ 群聊模块 ============
export interface GroupMember {
  memberId: number
  userId: number
  username: string
  nickname: string
  avatar: string | null
  groupNickname: string | null
  role: number // 1=群主, 2=管理员, 3=普通成员
  joinTime: string
}

export interface GroupInfo {
  groupId: number
  groupName: string
  notice: string | null
  createTime: string
  ownerId: number
  ownerName: string
  sessionId: number
  members: GroupMember[]
  memberCount: number
}

export interface CreateGroupRequest {
  ownerId: number
  groupName: string
  notice?: string
  memberIds: number[]
}

// ============ 会话模块 ============
export interface SessionItem {
  sessionId: number
  sessionType: number // 1=私聊, 2=群聊
  createTime: string
  lastReadTime: string | null
  // 私聊相关
  targetUserId?: number
  targetUsername?: string
  targetNickname?: string
  targetAvatar?: string | null
  // 群聊相关
  groupId?: number
  groupName?: string
  // 最新消息预览
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
  //最后一条消息的发送者名称
  lastMessageSenderName?: string
}

// ============ 消息模块 ============
export interface MessageItem {
  messageId: number
  sessionId: number
  senderId: number
  senderName: string
  senderAvatar: string | null
  content: string
  messageType: number // 1=文本, 2=图片, 3=语音, 4=文件
  filePath: string | null
  sendTime: string
  status: number // 1=已发送, 2=已接收, 3=已读
}

export interface SendMessageRequest {
  sessionId: number
  senderId: number
  content: string
  messageType: number
  filePath?: string | null
}

export interface QueryMessageRequest {
  sessionId: number
  startTime?: string
  endTime?: string
  messageType?: number
}

// ============ 文件上传 ============
export interface UploadResult {
  filePath: string
  fileName: string
  fileSize: string
}
