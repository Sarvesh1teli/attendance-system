import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GraduationCap, Lock, User, Building2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [roleMode, setRoleMode] = useState<'COLLEGE' | 'SUPER_ADMIN'>('COLLEGE')
  const [institutionId, setInstitutionId] = useState(() => localStorage.getItem('saas_institute_id') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Please enter both username and password')
      return
    }
    if (roleMode === 'COLLEGE' && !institutionId.trim()) {
      setError('Please enter your College / Institution ID')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const activeInst = roleMode === 'SUPER_ADMIN' ? 'PLATFORM' : institutionId.trim()
      const res = await login(username.trim(), password, activeInst)
      if (res.success) {
        const storedUser = localStorage.getItem('saas_admin_user')
        const parsed = storedUser ? JSON.parse(storedUser) : null
        if (parsed?.role === 'SUPER_ADMIN' || username.trim().toLowerCase() === 'superadmin') {
          navigate('/superadmin', { replace: true })
        } else {
          navigate(from, { replace: true })
        }
      } else {
        setError(res.error || 'Invalid credentials')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white relative">
      {/* Subtle background ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[390px] relative z-10">
        {/* Compact Header */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Teli Attendance</h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PORTAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Face Biometric Management System</p>
          </div>
        </div>

        {/* Compact Glass Card */}
        <div className="bg-slate-900/85 backdrop-blur-xl rounded-2xl border border-slate-700/60 p-5 shadow-2xl shadow-black/60">
          {/* Segmented Control Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/70 rounded-xl border border-slate-800 mb-3">
            <button
              type="button"
              onClick={() => {
                setRoleMode('COLLEGE')
                setError(null)
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                roleMode === 'COLLEGE'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              College Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleMode('SUPER_ADMIN')
                setUsername((prev) => prev || 'superadmin')
                setError(null)
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                roleMode === 'SUPER_ADMIN'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Super Admin
            </button>
          </div>

          <div className="mb-3 text-center">
            <h2 className="text-sm font-semibold text-slate-200">
              {roleMode === 'SUPER_ADMIN' ? 'Platform Super Admin Access' : 'College Administrator Login'}
            </h2>
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg text-xs animate-shake">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {roleMode === 'COLLEGE' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Institute / College Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    placeholder="e.g. sgjm"
                    className="w-full bg-slate-950/70 border border-slate-700/80 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950/70 border border-slate-700/80 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/70 border border-slate-700/80 text-white rounded-lg pl-9 pr-9 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400">
              Default credentials: <span className="font-mono text-slate-300">admin / admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
