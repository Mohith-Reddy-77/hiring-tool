import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { candidatesApi } from '../api/hiringApi'
import './Page.css'

const STATUSES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'HIRED']

export function CandidateNew() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleApplied, setRoleApplied] = useState('')
  const [status, setStatus] = useState('APPLIED')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('email', email)
      fd.append('roleApplied', roleApplied)
      fd.append('status', status)
      if (file) fd.append('resume', file)
      const { data } = await candidatesApi.create(fd)
      navigate(`/candidates/${data._id}`)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1>New candidate profile</h1>
      <p className="muted intro">Creates a profile you can track through screening, interviews, offer, and hire.</p>
      <form className="card form-card" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Role applied
          <input value={roleApplied} onChange={(e) => setRoleApplied(e.target.value)} required />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resume (PDF or Word)
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Saving…' : 'Create'}
        </button>
      </form>
    </div>
  )
}
