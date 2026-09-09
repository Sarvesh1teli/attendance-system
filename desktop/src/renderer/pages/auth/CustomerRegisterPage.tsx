import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Building2, User, Mail, Phone, Lock, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'

export default function CustomerRegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    collegeName: '',
    collegeCode: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.collegeName.trim() || !form.collegeCode.trim() || !form.password) {
      setError('Please fill in all required fields.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const api = (window as any).api
      if (api?.auth?.customerRegister) {
        const res = await api.auth.customerRegister({
          collegeName: form.collegeName.trim(),
          collegeCode: form.collegeCode.trim().toLowerCase().replaceAll(/[^a-z0-9_-]/g, ''),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPhone: form.adminPhone.trim(),
          password: form.password.trim(),
        })

        if (res.success) {
          setSuccess(true)
          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1500)
        } else {
          setError(res.error || 'Registration failed')
        }
      } else {
        setError('Registration service currently unavailable')
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            14-Day Free Cloud Trial
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Register Your Institution</h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Instant multi-tenant SaaS provisioning. Setup in under 60 seconds.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Account Created Successfully!</h2>
              <p className="text-sm text-slate-400">
                Your 14-day free trial has been activated. Redirecting you to your admin dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  College / Institution Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oxford Medical College"
                    value={form.collegeName}
                    onChange={(e) => setForm({ ...form, collegeName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Preferred College Code / ID *
                </label>
                <div className="relative">
                  <span className="text-xs text-slate-500 font-mono absolute left-3.5 top-1/2 -translate-y-1/2">#</span>
                  <input
                    type="text"
                    required
                    placeholder="oxford"
                    value={form.collegeCode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        collegeCode: e.target.value.toLowerCase().replaceAll(/[^a-z0-9_-]/g, ''),
                      })
                    }
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Used by faculty and students to log in. Examples: oxford, svhs, mit
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Administrator Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Dr. John Doe"
                      value={form.adminName}
                      onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={form.adminPhone}
                      onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="admin@college.edu"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Activating 14-Day Trial...' : '🚀 Start 14-Day Free Trial'}
              </button>

              <div className="text-center pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-400">
                  Already registered?{' '}
                  <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold underline">
                    Sign in to your College Portal
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
