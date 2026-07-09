import apiClient from './client'

export const speechApi = {
  transcribeAudio(audioBlob) {
    const formData = new FormData()
    formData.append('file', audioBlob, 'voice.webm')

    return apiClient.post('/api/v1/speech/transcriptions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
