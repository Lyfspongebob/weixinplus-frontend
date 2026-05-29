export function formatTime(timeStr: string): string {
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const oneDay = 24 * 60 * 60 * 1000

  const pad = (n: number) => n.toString().padStart(2, '0')
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return hhmm
  }

  if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
    return `昨天 ${hhmm}`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${hhmm}`
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${hhmm}`
}

export function formatDate(timeStr: string): string {
  const date = new Date(timeStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function getMessagePreview(msg: { messageType: number; content: string }): string {
  switch (msg.messageType) {
    case 1: return msg.content
    case 2: return '[图片]'
    case 3: return '[语音]'
    case 4: return '[文件]'
    default: return msg.content
  }
}

export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return '🖼️'
  if (['mp3', 'wav', 'ogg'].includes(ext || '')) return '🎵'
  if (['zip', 'rar', '7z'].includes(ext || '')) return '📦'
  if (['doc', 'docx'].includes(ext || '')) return '📄'
  if (['pdf'].includes(ext || '')) return '📕'
  return '📎'
}
