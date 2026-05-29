import client from './client'
import type { ApiResponse, SessionItem } from '../types'

export const sessionApi = {
  createPrivateSession(userId1: number, userId2: number) {
    return client.post<any, ApiResponse<SessionItem>>('/api/sessions/createPrivate', null, {
      params: { userId1, userId2 },
    })
  },

  getUserSessions(userId: number) {
    return client.get<any, ApiResponse<SessionItem[]>>(`/api/sessions/user/${userId}`)
  },

  getParticipants(sessionId: number) {
    return client.get<any, ApiResponse<any[]>>(`/api/sessions/participants/${sessionId}`)
  },

  updateReadTime(userId: number, sessionId: number) {
    return client.post<any, ApiResponse<null>>('/api/sessions/read', null, {
      params: { userId, sessionId },
    })
  },

  deleteSession(sessionId: number, userId: number) {
    return client.delete<any, ApiResponse<null>>(`/api/sessions/delete/${sessionId}`, {
        params: { userId },
    })
  },
}
