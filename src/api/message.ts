import client from './client'
import type { ApiResponse, MessageItem, SendMessageRequest, QueryMessageRequest, UploadResult } from '../types'
import axios from 'axios'

export const messageApi = {
  sendMessage(data: SendMessageRequest) {
    return client.post<any, ApiResponse<MessageItem>>('/api/messages/send', data)
  },

  getSessionMessages(sessionId: number) {
    return client.get<any, ApiResponse<MessageItem[]>>(`/api/messages/session/${sessionId}`)
  },

  queryMessages(data: QueryMessageRequest) {
    return client.post<any, ApiResponse<MessageItem[]>>('/api/messages/query', data)
  },

  downloadMessages(sessionId: number, startTime?: string, endTime?: string) {
    return client.get<any, ApiResponse<string>>('/api/messages/download/' + sessionId, {
      params: { startTime, endTime },
    })
  },

  downloadMessagesAsBlob(sessionId: number, startTime?: string, endTime?: string) {
    return axios.get('/api/messages/download/' + sessionId, {
        params: { startTime, endTime },
        responseType: 'blob',
    })
  },

  uploadFile(file: File, type: 'image' | 'voice' | 'file' = 'file') {
    const formData = new FormData()
    formData.append('file', file)
    // formData.append('type', type)
    return client.post<any, ApiResponse<UploadResult>>('/api/messages/upload', formData,{
      params: { type }
    })
  },
}
