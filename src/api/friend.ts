import client from './client'
import type { ApiResponse, FriendGroup, Friend, FriendRequest, ApplyFriendRequest } from '../types'

export const friendApi = {
  // 好友分组
  createGroup(userId: number, groupName: string) {
    return client.post<any, ApiResponse<any>>('/api/friends/groups/create', { userId, groupName })
  },

  getGroups(userId: number) {
    return client.get<any, ApiResponse<FriendGroup[]>>(`/api/friends/groups/${userId}`)
  },

  deleteGroup(groupId: number, userId: number) {
    return client.delete<any, ApiResponse<null>>(`/api/friends/groups/delete/${groupId}`, {
      params: { userId },
    })
  },

  renameGroup(groupId: number, userId: number, newName: string) {
    return client.put<any, ApiResponse<null>>(`/api/friends/groups/rename/${groupId}`, null, {
      params: { userId, newName },
    })
  },

  // 好友申请
  applyFriend(data: ApplyFriendRequest) {
    return client.post<any, ApiResponse<any>>('/api/friends/apply', data)
  },

  handleFriendRequest(relationshipId: number, action: number, remark?: string) {
    return client.post<any, ApiResponse<any>>('/api/friends/handle', { relationshipId, action, remark })
  },

  resendRequest(relationshipId: number, applyMessage: string) {
    return client.post<any, ApiResponse<any>>(`/api/friends/resend/${relationshipId}`, null, {
      params: { applyMessage },
    })
  },

  getPendingRequests(userId: number) {
    return client.get<any, ApiResponse<FriendRequest[]>>(`/api/friends/pending/${userId}`)
  },

  // 好友关系
  getFriendList(userId: number) {
    return client.get<any, ApiResponse<Friend[]>>(`/api/friends/list/${userId}`)
  },

  deleteFriend(relationshipId: number, userId: number) {
    return client.delete<any, ApiResponse<null>>(`/api/friends/delete/${relationshipId}`, {
      params: { userId },
    })
  },

  moveFriend(relationshipId: number, newGroupId: number) {
    return client.put<any, ApiResponse<null>>('/api/friends/move', { relationshipId, newGroupId })
  },

  checkFriendship(userId: number, friendId: number) {
    return client.get<any, ApiResponse<{ isFriend: boolean }>>(`/api/friends/check/${userId}/${friendId}`)
  },
}
