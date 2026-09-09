import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Building2,
  Clock,
  Shield,
  CreditCard,
  Ban,
  Settings,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  Key,
  CheckCircle,
  AlertTriangle,
  LogOut,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface CustomerItem {
  id: string
  name: string
  phone: string
  email: string
  adminName: string
  adminEmail: string
  adminUsername: string
  plan: string
  status: string
  createdAt?: string
}

export default function SuperAdminDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeNav, setActiveNav] = useState<
    'OVERVIEW' | 'CUSTOMERS' | 'PENDING' | 'TRIALS' | 'PAID' | 'SUSPENDED' | 'SETTINGS'
  >('OVERVIEW')

  const [overview, setOverview] = useState({
    totalCustomers: 0,
    pendingApprovals: 0,
    activeTrials: 0,
    paidSubscriptions: 0,
    suspended: 0,
  })

  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [loading, setLoading] = useState(true)

  // Onboard modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCust, setNewCust] = useState({
    name: '',
    id: '',
    phone: '',
    email: '',
    adminName: '',
    adminEmail: '',
    adminUsername: 'admin',
    adminPassword: '',
    plan: 'ANNUAL_ENTERPRISE',
  })
  const [submitting, setSubmitting] = useState(false)
  const [modalSuccess, setModalSuccess] = useState<any>(null)
  const [modalError, setModalError] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  // Action feedback alert
  const [actionAlert, setActionAlert] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null)

  const api = (window as any).api

  const loadData = async () => {
    setLoading(true)
    try {
      if (api?.superadmin) {
        const [ov, list] = await Promise.all([
          api.superadmin.getOverview(),
          api.superadmin.listInstitutions(),
        ])
        setOverview(ov)
        setCustomers(list)
      }
    } catch (e) {
      console.error('Error loading superadmin data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const triggerAlert = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setActionAlert({ msg, type })
    setTimeout(() => setActionAlert(null), 4000)
  }

  const handleApproveAnnual = async (id: string, name: string) => {
    try {
      const res = await api.superadmin.approveAnnual(id)
      if (res.success) {
        triggerAlert(`Approved Annual Enterprise subscription for "${name}".`, 'success')
        loadData()
      } else {
        triggerAlert(res.error || 'Failed to approve', 'error')
      }
    } catch (e: any) {
      triggerAlert(e.message, 'error')
    }
  }

  const handleExtendTrial = async (id: string, name: string) => {
    try {
      const res = await api.superadmin.extendTrial(id)
      if (res.success) {
        triggerAlert(`Extended 14-Day Free Trial for "${name}".`, 'info')
        loadData()
      } else {
        triggerAlert(res.error || 'Failed to extend trial', 'error')
      }
    } catch (e: any) {
      triggerAlert(e.message, 'error')
    }
  }

  const handleToggleSuspend = async (id: string, name: string, currentStatus: string) => {
    const isSuspending = currentStatus !== 'SUSPENDED'
    if (!confirm(`Are you sure you want to ${isSuspending ? 'SUSPEND' : 'ACTIVATE'} "${name}"?`)) return
    try {
      const res = await api.superadmin.toggleSuspend(id)
      if (res.success) {
        triggerAlert(`Account "${name}" is now ${res.status}.`, 'info')
        loadData()
      }
    } catch (e: any) {
      triggerAlert(e.message, 'error')
    }
  }

  const handleGenerateTempPassword = async (id: string, name: string) => {
    try {
      const res = await api.superadmin.generateTempPassword(id)
      if (res.success) {
        prompt(`Temporary Password for "${name}" (admin):`, res.tempPassword)
        triggerAlert(`Generated temporary password: ${res.tempPassword} for ${name}`, 'success')
      }
    } catch (e: any) {
      triggerAlert(e.message, 'error')
    }
  }

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError('')
    if (!newCust.name.trim() || !newCust.id.trim()) {
      setModalError('Company Name and Code are required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.superadmin.createInstitution({
        id: newCust.id.trim().toLowerCase(),
        name: newCust.name.trim(),
        phone: newCust.phone.trim() || '+91 81976 41303',
        email: newCust.email.trim() || `${newCust.id.trim()}.telicampus.in`,
        adminName: newCust.adminName.trim() || 'Administrator',
        adminEmail: newCust.adminEmail.trim() || `admin@${newCust.id.trim()}.com`,
        adminUsername: newCust.adminUsername.trim() || 'admin',
        adminPassword: newCust.adminPassword.trim() || 'admin123',
        plan: newCust.plan,
      })

      if (res.success) {
        setModalSuccess(res.institution)
        setNewCust({
          name: '',
          id: '',
          phone: '',
          email: '',
          adminName: '',
          adminEmail: '',
          adminUsername: 'admin',
          adminPassword: '',
          plan: 'ANNUAL_ENTERPRISE',
        })
        loadData()
      } else {
        setModalError(res.error || 'Onboarding failed')
      }
    } catch (err: any) {
      setModalError(err.message || 'Error creating account')
    } finally {
      setSubmitting(false)
    }
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  // Filter customers based on active left sidebar tab
  const displayedCustomers = customers.filter((c) => {
    if (activeNav === 'PENDING') return c.status === 'PENDING' || c.plan === 'PENDING_APPROVAL'
    if (activeNav === 'TRIALS') return c.plan?.includes('TRIAL') && c.status !== 'SUSPENDED'
    if (activeNav === 'PAID') return c.plan?.includes('ANNUAL') && c.status !== 'SUSPENDED'
    if (activeNav === 'SUSPENDED') return c.status === 'SUSPENDED'
    return true
  })

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans">
      {/* ─── LEFT SIDEBAR (Matching Screenshot) ─────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen">
        {/* Brand */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
            TC
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-none">TELICAMPUS</div>
            <div className="text-[11px] font-semibold text-emerald-600 tracking-wide mt-1">SUPER ADMIN PORTAL</div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1 flex-1">
          <button
            onClick={() => setActiveNav('OVERVIEW')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'OVERVIEW'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-600" />
            <span>Platform Overview</span>
          </button>

          <button
            onClick={() => setActiveNav('CUSTOMERS')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'CUSTOMERS'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>Customer Accounts</span>
          </button>

          <button
            onClick={() => setActiveNav('PENDING')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'PENDING'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>Pending Approvals</span>
            </div>
            {overview.pendingApprovals > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-700 font-bold">
                {overview.pendingApprovals}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('TRIALS')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'TRIALS'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-purple-500" />
              <span>Active Trials</span>
            </div>
            {overview.activeTrials > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                {overview.activeTrials}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('PAID')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'PAID'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Paid Subscriptions</span>
            </div>
            {overview.paidSubscriptions > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">
                {overview.paidSubscriptions}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('SUSPENDED')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'SUSPENDED'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Ban className="w-4 h-4 text-rose-500" />
              <span>Suspended Accounts</span>
            </div>
            {overview.suspended > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                {overview.suspended}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('SETTINGS')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeNav === 'SETTINGS'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Platform Settings</span>
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 text-xs">
          <div className="text-slate-500">Logged in as</div>
          <div className="font-bold text-slate-800 truncate">{user?.username || 'superadmin'}</div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────────────── */}
      <main className="flex-1 p-8 max-w-7xl overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Customer onboarding, trials, subscriptions and account health.
            </p>
          </div>

          <button
            onClick={() => {
              setModalSuccess(null)
              setModalError('')
              setShowAddModal(true)
            }}
            className="bg-[#055c3a] hover:bg-[#044c30] text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Customer Onboarding
          </button>
        </div>

        {/* Action Alert Banner */}
        {actionAlert && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
              actionAlert.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : actionAlert.type === 'info'
                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}
          >
            <span>{actionAlert.msg}</span>
            <button onClick={() => setActionAlert(null)} className="opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ─── 5 COLOR CARDS (Exact match to screenshot) ─────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
          {/* 1. TOTAL CUSTOMERS (Blue) */}
          <div className="bg-[#1e60db] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase opacity-95">
              <Building2 className="w-3.5 h-3.5" />
              TOTAL CUSTOMERS
            </div>
            <div className="text-3xl font-extrabold">{overview.totalCustomers}</div>
            <div className="text-[11px] opacity-80 leading-none">Registered customer accounts</div>
          </div>

          {/* 2. PENDING APPROVALS (Orange) */}
          <div className="bg-[#f97316] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase opacity-95">
              <Clock className="w-3.5 h-3.5" />
              PENDING APPROVALS
            </div>
            <div className="text-3xl font-extrabold">{overview.pendingApprovals}</div>
            <div className="text-[11px] opacity-80 leading-none">Requires Super Admin action</div>
          </div>

          {/* 3. ACTIVE TRIALS (Purple) */}
          <div className="bg-[#8b5cf6] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase opacity-95">
              <Shield className="w-3.5 h-3.5" />
              ACTIVE TRIALS
            </div>
            <div className="text-3xl font-extrabold">{overview.activeTrials}</div>
            <div className="text-[11px] opacity-80 leading-none">14-Day trial period active</div>
          </div>

          {/* 4. PAID SUBSCRIPTIONS (Green) */}
          <div className="bg-[#10b981] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase opacity-95">
              <CreditCard className="w-3.5 h-3.5" />
              PAID SUBSCRIPTIONS
            </div>
            <div className="text-3xl font-extrabold">{overview.paidSubscriptions}</div>
            <div className="text-[11px] opacity-80 leading-none">Active recurring plans</div>
          </div>

          {/* 5. SUSPENDED (Red) */}
          <div className="bg-[#ef4444] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase opacity-95">
              <Ban className="w-3.5 h-3.5" />
              SUSPENDED
            </div>
            <div className="text-3xl font-extrabold">{overview.suspended}</div>
            <div className="text-[11px] opacity-80 leading-none">Access disabled</div>
          </div>
        </div>

        {/* ─── CUSTOMER ACCOUNT MANIFEST TABLE (Matching Screenshot) ─────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
          {/* Table Header Row */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-slate-800">Customer Account Manifest</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {displayedCustomers.length}
              </span>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh List
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sage Green Header */}
              <thead className="bg-[#eaf5ef] text-[#13683a] font-bold uppercase tracking-wider border-b border-emerald-100">
                <tr>
                  <th className="px-6 py-3.5">COMPANY / INSTITUTION & CODE</th>
                  <th className="px-6 py-3.5">LOCATION & CONTACT</th>
                  <th className="px-6 py-3.5">ADMINISTRATOR</th>
                  <th className="px-6 py-3.5">PLAN & STATUS</th>
                  <th className="px-6 py-3.5">REGISTERED DATE</th>
                  <th className="px-6 py-3.5 text-center">SUPER ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No customer accounts matching this filter.
                    </td>
                  </tr>
                ) : (
                  displayedCustomers.map((c) => {
                    const isTrial = c.plan?.toUpperCase().includes('TRIAL')
                    const isAnnual = c.plan?.toUpperCase().includes('ANNUAL')
                    const isSuspended = c.status === 'SUSPENDED'

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        {/* Company & Code */}
                        <td className="px-6 py-4 align-top">
                          <div className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: <span className="text-slate-600">{c.id}</span>
                          </div>
                        </td>

                        {/* Location & Contact */}
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone || '+91 80 2345 6789'}</span>
                          </div>
                          <div className="text-[11px] text-blue-600 hover:underline mt-0.5 truncate max-w-[180px]">
                            {c.email || `${c.id}.telicampus.in`}
                          </div>
                        </td>

                        {/* Administrator */}
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900 uppercase">
                            {c.adminName || 'RAHUL TELI'}
                          </div>
                          <a
                            href={`mailto:${c.adminEmail}`}
                            className="text-[11px] text-blue-600 hover:underline block mt-0.5"
                          >
                            {c.adminEmail || `admin@${c.id}.com`}
                          </a>
                        </td>

                        {/* Plan & Status (Badges) */}
                        <td className="px-6 py-4 align-top">
                          {isAnnual && !isSuspended && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#d1f4e0] text-[#0f6c38] border border-[#a3e8be]">
                              <span className="w-2 h-2 rounded-full bg-[#0f6c38]"></span>
                              ANNUAL ENTERPRISE
                            </span>
                          )}

                          {isTrial && !isSuspended && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                              <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                              14-DAY TRIAL
                            </span>
                          )}

                          {isSuspended && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                              SUSPENDED
                            </span>
                          )}
                        </td>

                        {/* Registered Date */}
                        <td className="px-6 py-4 align-top font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {c.createdAt || '2026-09-04T11:48:32.165Z'}
                        </td>

                        {/* Super Admin Actions */}
                        <td className="px-6 py-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Approve Annual */}
                            <button
                              onClick={() => handleApproveAnnual(c.id, c.name)}
                              className="px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-[#e8f8ee] hover:bg-[#d4f2de] text-[#0f6c38] border border-[#a2e6be] flex items-center gap-1.5 transition"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0f6c38]"></span>
                              Approve Annual
                            </button>

                            {/* +14 Days Trial */}
                            <button
                              onClick={() => handleExtendTrial(c.id, c.name)}
                              className="px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-[#fef9c3] hover:bg-[#fef08a] text-[#854d0e] border border-[#fde047] flex items-center gap-1.5 transition"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ca8a04]"></span>
                              +14 Days Trial
                            </button>

                            {/* Suspend / Activate */}
                            <button
                              onClick={() => handleToggleSuspend(c.id, c.name, c.status)}
                              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border flex items-center gap-1.5 transition ${
                                isSuspended
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSuspended ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              ></span>
                              {isSuspended ? 'Activate' : 'Suspend'}
                            </button>

                            {/* Temp Password */}
                            <button
                              onClick={() => handleGenerateTempPassword(c.id, c.name)}
                              className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 transition"
                              title="Generate temporary password"
                            >
                              <Key className="w-3 h-3 text-slate-500" />
                              Temp Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── MODAL: NEW CUSTOMER ONBOARDING ────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  New Customer Onboarding
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Provision a new multi-tenant customer account</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {modalSuccess ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950">Customer Onboarded Successfully!</h4>
                    <p className="mt-1 text-emerald-800">
                      Share the following login credentials with the customer administrator:
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 font-mono text-xs text-slate-700">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Customer Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{modalSuccess.id}</span>
                      <button onClick={() => copyText(modalSuccess.id, 'id')}>
                        {copiedKey === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Admin Username:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{modalSuccess.adminUsername}</span>
                      <button onClick={() => copyText(modalSuccess.adminUsername, 'user')}>
                        {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Admin Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{modalSuccess.adminPassword}</span>
                      <button onClick={() => copyText(modalSuccess.adminPassword, 'pass')}>
                        {copiedKey === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Assigned Plan:</span>
                    <span className="font-bold text-emerald-700">{modalSuccess.plan}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setModalSuccess(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Onboard Another
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="p-6 space-y-3.5 text-xs">
                {modalError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company / College Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Teli Apparels or Oxford Medical College"
                    value={newCust.name}
                    onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Customer Code / ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. teliapparels"
                      value={newCust.id}
                      onChange={(e) =>
                        setNewCust({
                          ...newCust,
                          id: e.target.value.toLowerCase().replaceAll(/[^a-z0-9_-]/g, ''),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Subscription Plan</label>
                    <select
                      value={newCust.plan}
                      onChange={(e) => setNewCust({ ...newCust, plan: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="ANNUAL_ENTERPRISE">ANNUAL ENTERPRISE</option>
                      <option value="TRIAL_14_DAYS">14-DAY TRIAL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="+91 81976 41303"
                      value={newCust.phone}
                      onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Teli"
                      value={newCust.adminName}
                      onChange={(e) => setNewCust({ ...newCust, adminName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admin Username</label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={newCust.adminUsername}
                      onChange={(e) => setNewCust({ ...newCust, adminUsername: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Initial Password</label>
                    <input
                      type="text"
                      placeholder="admin123"
                      value={newCust.adminPassword}
                      onChange={(e) => setNewCust({ ...newCust, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {submitting ? 'Onboarding...' : 'Onboard Customer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
