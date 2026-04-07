import api from './client'

export const authApi = {
  login: (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
}

export const candidatesApi = {
  list: () => api.get('/candidates'),
  get: (id) => api.get(`/candidates/${id}`),
  create: (formData) =>
    api.post('/candidates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, formData) =>
    api.patch(`/candidates/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  rounds: (candidateId) => api.get(`/candidates/${candidateId}/rounds`),
}

export const templatesApi = {
  list: () => api.get('/templates'),
  get: (id) => api.get(`/templates/${id}`),
  create: (body) => api.post('/templates', body),
  remove: (id) => api.delete(`/templates/${id}`),
}

export const roundsApi = {
  create: (body) => api.post('/rounds', body),
  myRounds: () => api.get('/rounds/my-rounds'),
  patch: (id, body) => api.patch(`/rounds/${id}`, body),
  feedback: (roundId) => api.get(`/rounds/${roundId}/feedback`),
}

export const feedbackApi = {
  submit: (body) => api.post('/feedback', body),
}

export const usersApi = {
  interviewers: () => api.get('/users/interviewers'),
}
