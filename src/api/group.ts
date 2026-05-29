import client from './client'
import type { ApiResponse, GroupInfo, CreateGroupRequest } from '../types'

export const groupApi = {
  createGroup(data: CreateGroupRequest) {
    return client.post<any, ApiResponse<GroupInfo>>('/api/groups/create', data)
  },

  addMembers(groupId: number, operatorId: number, memberIds: number[]) {
    return client.post<any, ApiResponse<null>>('/api/groups/addMembers', { groupId, operatorId, memberIds })
  },

  removeMember(groupId: number, memberId: number, operatorId: number) {
    return client.delete<any, ApiResponse<null>>(`/api/groups/removeMember/${groupId}/${memberId}`, {
      params: { operatorId },
    })
  },

  leaveGroup(groupId: number, userId: number) {
    return client.post<any, ApiResponse<null>>(`/api/groups/leave/${groupId}`, null, {
      params: { userId },
    })
  },

  disbandGroup(groupId: number, ownerId: number) {
    return client.delete<any, ApiResponse<null>>(`/api/groups/disband/${groupId}`, {
      params: { ownerId },
    })
  },

  getGroupInfo(groupId: number) {
    return client.get<any, ApiResponse<GroupInfo>>(`/api/groups/info/${groupId}`)
  },

  searchGroups(keyword: string) {
    return client.get<any, ApiResponse<GroupInfo[]>>('/api/groups/search', { params: { keyword } })
  },

  getUserGroups(userId: number) {
    return client.get<any, ApiResponse<GroupInfo[]>>(`/api/groups/user/${userId}`)
  },

  updateNotice(groupId: number, operatorId: number, notice: string) {
    return client.put<any, ApiResponse<null>>(`/api/groups/notice/${groupId}`, null, {
      params: { operatorId, notice },
    })
  },
}
