import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function InstitutionSetupPage() {
  const navigate = useNavigate()
  const { checkInstitution, refreshUser } = useAuth()
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Institution name is required'); return }
    try {
      setLoading(true); setError(null)
      await window.api.institution.upsert(form)
      await checkInstitution()
      await refreshUser()
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save institution')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">Institution Details</h2>
      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}
      <div className="space-y-2">
        <label className="text-sm font-medium">Institution Name *</label>
        <input type="text" required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Government Medical College" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Address</label>
        <textarea rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Institution address" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <input type="tel"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 XXXXX XXXXX" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <input type="email"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="admin@institution.edu" />
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {loading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}
