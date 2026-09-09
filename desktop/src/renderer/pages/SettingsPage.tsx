import { useState, useEffect } from 'react'
import {
  Save,
  Building2,
  Settings2,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Clock,
  Key,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  UploadCloud,
  DownloadCloud,
  RefreshCw
} from 'lucide-react'
import type {
  Institution,
  GoogleOAuthConfig,
  GoogleAccount,
  BackupSettings,
  LastBackupRecord
} from '@main/ipc/types'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'INSTITUTE' | 'CLOUD_SYNC' | 'BACKUP'>('INSTITUTE')
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [cloudUrl, setCloudUrl] = useState('')
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [savingCloud, setSavingCloud] = useState(false)
  const [msg, setMsg] = useState('')
  const [cloudMsg, setCloudMsg] = useState('')
  const [isBackupConnected, setIsBackupConnected] = useState(false)

  // Cloud sync operational state
  const [syncingPush, setSyncingPush] = useState(false)
  const [syncingPull, setSyncingPull] = useState(false)
  const [testingConn, setTestingConn] = useState(false)
  const [syncActionMsg, setSyncActionMsg] = useState<{ text: string; success: boolean } | null>(null)

  useEffect(() => {
    Promise.all([
      window.api?.institution?.get?.() ?? Promise.resolve(null),
      window.api?.config?.get?.('cloud_sync_url') ?? Promise.resolve(null),
      window.api?.backup?.getAccount ? window.api.backup.getAccount().catch(() => null) : Promise.resolve(null),
    ]).then(([inst, url, acc]) => {
      if (inst) {
        setInstitution(inst)
        setForm({ name: inst.name, address: inst.address ?? '', phone: inst.phone ?? '', email: inst.email ?? '' })
      }
      setCloudUrl(url ?? 'http://localhost:8086/api/v1/sync/desktop')
      if (acc && acc.connected) {
        setIsBackupConnected(true)
      }
    })
  }, [])

  const handleSaveInstitution = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setMsg('')
    try {
      await window.api.institution.upsert({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      })
      setMsg('Institution settings saved.')
      const updated = await window.api.institution.get()
      if (updated) setInstitution(updated)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCloud = async () => {
    if (!cloudUrl.trim()) return
    setSavingCloud(true)
    setCloudMsg('')
    try {
      await window.api.config.set('cloud_sync_url', cloudUrl.trim(), 'Cloud Sync API URL')
      setCloudMsg('Cloud URL saved.')
    } catch (e: unknown) {
      setCloudMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingCloud(false)
    }
  }

  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) return
    setTestingConn(true)
    setSyncActionMsg(null)
    try {
      const res = await window.api.sync.testConnection(cloudUrl.trim())
      setSyncActionMsg({
        text: res.message,
        success: res.success
      })
    } catch (e: any) {
      setSyncActionMsg({ text: `Cannot reach Cloud backend: ${e.message || 'Network error'}`, success: false })
    } finally {
      setTestingConn(false)
    }
  }

  const handlePushMaster = async () => {
    setSyncingPush(true)
    setSyncActionMsg(null)
    try {
      const res = await window.api.sync.pushMasterData()
      setSyncActionMsg({
        text: res.success ? (res.message || 'Master data successfully pushed to Cloud!') : (res.message || 'Push failed'),
        success: res.success
      })
    } catch (e: any) {
      setSyncActionMsg({ text: e.message || 'Failed to push data', success: false })
    } finally {
      setSyncingPush(false)
    }
  }

  const handlePullSessions = async () => {
    setSyncingPull(true)
    setSyncActionMsg(null)
    try {
      const res = await window.api.sync.pullCompletedSessions()
      setSyncActionMsg({
        text: res.success
          ? `Pulled ${res.sessionsCount ?? 0} session(s) and ${res.recordsCount ?? 0} attendance record(s) from Cloud!`
          : (res.message || 'Pull failed'),
        success: res.success
      })
    } catch (e: any) {
      setSyncActionMsg({ text: e.message || 'Failed to pull sessions', success: false })
    } finally {
      setSyncingPull(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* ─── TOP TABS MENU (LEFT ALIGNED) ─────────────────────────────────── */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 border rounded-xl w-fit shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('INSTITUTE')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'INSTITUTE'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Building2 className={`h-4 w-4 ${activeTab === 'INSTITUTE' ? 'text-primary' : ''}`} />
            <span>1. Institute Setup</span>
            {institution?.name && (
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLOUD_SYNC')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'CLOUD_SYNC'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Cloud className={`h-4 w-4 ${activeTab === 'CLOUD_SYNC' ? 'text-primary' : ''}`} />
            <span>2. Cloud Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BACKUP')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'BACKUP'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <HardDrive className={`h-4 w-4 ${activeTab === 'BACKUP' ? 'text-primary' : ''}`} />
            <span>3. Backup Setup</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isBackupConnected
                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-600 border border-amber-500/20'
              }`}
            >
              {isBackupConnected ? 'Connected' : 'Setup Required'}
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: INSTITUTE SETUP
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'INSTITUTE' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* 1. Institution Details */}
          <div className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3 mb-1">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base text-foreground">Institution Details</h2>
                <p className="text-xs text-muted-foreground">General campus identity, contact credentials, and official branding.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Institution Name *
                </label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Teli Medical College & Hospital"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Campus Address
                </label>
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:ring-2 focus:ring-primary focus:outline-none"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, City, State, ZIP"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Official Phone
                </label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Official Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="admin@institution.edu"
                />
              </div>
            </div>

            {msg && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  msg.includes('failed') || msg.includes('error')
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                }`}
              >
                {msg}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveInstitution}
                disabled={saving}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-60 transition-colors shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Institution'}
              </button>
            </div>
          </div>

          {/* 2. Application System Details */}
          <div className="bg-card border rounded-xl p-6 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3 mb-1">
              <Settings2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base text-foreground">System & Environment</h2>
                <p className="text-xs text-muted-foreground">Technical identifiers and application version.</p>
              </div>
            </div>

            <div className="text-sm space-y-2 pt-1">
              <div className="flex justify-between py-1 border-b border-muted/60">
                <span className="text-muted-foreground">Application Version</span>
                <AppVersion />
              </div>
              <div className="flex justify-between py-1 border-b border-muted/60">
                <span className="text-muted-foreground">Institution UUID</span>
                <span className="font-mono text-xs text-foreground">{institution?.id ?? '—'}</span>
              </div>
              {institution && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-xs">{new Date(institution.updated_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CLOUD SYNC
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'CLOUD_SYNC' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Cloud Synchronization Endpoint */}
          <div className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3 mb-1">
              <Cloud className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base text-foreground">Cloud Synchronization Endpoint</h2>
                <p className="text-xs text-muted-foreground">The Spring Boot Cloud Sync API endpoint for PWA and mobile synchronization.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cloud Sync API URL
              </label>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                value={cloudUrl}
                onChange={(e) => setCloudUrl(e.target.value)}
                placeholder="http://localhost:8086/api/v1/sync/desktop"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Desktop uses this endpoint to push master timetables, student enrollments, and pull completed offline attendance logs.
              </p>
            </div>

            {cloudMsg && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  cloudMsg.includes('failed')
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                }`}
              >
                {cloudMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConn || !cloudUrl.trim()}
                className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-60 transition-colors border"
              >
                {testingConn ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <RefreshCw className="h-4 w-4 text-primary" />}
                <span>{testingConn ? 'Testing…' : 'Test Connection'}</span>
              </button>

              <button
                onClick={handleSaveCloud}
                disabled={savingCloud}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-60 transition-colors shadow-sm"
              >
                <Save className="h-4 w-4" />
                {savingCloud ? 'Saving…' : 'Save Cloud URL'}
              </button>
            </div>
          </div>

          {/* Manual Operations Card */}
          <div className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3 mb-1">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base text-foreground">Sync Operations</h2>
                <p className="text-xs text-muted-foreground">Trigger on-demand master catalog uploads or pull completed attendance logs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Push Master Data */}
              <div className="border rounded-xl p-4 bg-muted/20 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <UploadCloud className="h-4 w-4 text-primary" />
                    <span>Push Master Data</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload active students, face descriptors, course subjects, batches, and timetable to the cloud server so Teacher App can pull them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushMaster}
                  disabled={syncingPush}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                >
                  {syncingPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  <span>{syncingPush ? 'Pushing Data…' : 'Push Data to Cloud'}</span>
                </button>
              </div>

              {/* Pull Attendance Records */}
              <div className="border rounded-xl p-4 bg-muted/20 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <DownloadCloud className="h-4 w-4 text-emerald-600" />
                    <span>Pull Attendance Records</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Download and ingest submitted attendance sessions and recognized student verification logs marked by teachers in Teacher App.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePullSessions}
                  disabled={syncingPull}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                >
                  {syncingPull ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
                  <span>{syncingPull ? 'Pulling Attendance…' : 'Pull Attendance Records'}</span>
                </button>
              </div>
            </div>

            {syncActionMsg && (
              <div
                className={`p-3 rounded-lg text-xs border animate-in fade-in ${
                  syncActionMsg.success
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {syncActionMsg.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span>{syncActionMsg.text}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: BACKUP SETUP
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'BACKUP' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <GoogleDriveBackupSection onAccountChange={(connected) => setIsBackupConnected(connected)} />
        </div>
      )}
    </div>
  )
}

function GoogleDriveBackupSection({ onAccountChange }: { onAccountChange?: (connected: boolean) => void }) {
  const [oauthConfig, setOauthConfig] = useState<GoogleOAuthConfig>({
    clientId: '',
    clientSecretSet: false,
    redirectUri: '',
    configured: false,
  })
  const [account, setAccount] = useState<GoogleAccount>({ userEmail: '', connected: false })
  const [settings, setSettings] = useState<BackupSettings>({ autoBackupEnabled: false, scheduleTime: '23:00' })
  const [lastBackup, setLastBackup] = useState<LastBackupRecord | null>(null)

  // OAuth edit inputs
  const [clientIdInput, setClientIdInput] = useState('')
  const [clientSecretInput, setClientSecretInput] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [showOAuthConfig, setShowOAuthConfig] = useState(false)
  const [savingOAuth, setSavingOAuth] = useState(false)
  const [oauthMsg, setOauthMsg] = useState('')

  // Connection & Backup actions
  const [connecting, setConnecting] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)

  const loadData = async () => {
    try {
      if (!window.api?.backup) return
      const [cfg, acc, sett, last] = await Promise.all([
        window.api.backup.getOAuthConfig?.() ?? Promise.resolve({ configured: false, clientId: '' }),
        window.api.backup.getAccount?.() ?? Promise.resolve({ connected: false }),
        window.api.backup.getSettings?.() ?? Promise.resolve({ schedule: 'DAILY' }),
        window.api.backup.getLastBackup?.() ?? Promise.resolve(null),
      ])
      setOauthConfig(cfg)
      setClientIdInput(cfg.clientId)
      setAccount(acc)
      setSettings(sett)
      setLastBackup(last)
      onAccountChange?.(acc.connected)
      if (!cfg.configured) {
        setShowOAuthConfig(true)
      }
    } catch (e) {
      console.error('Failed to load backup data', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveOAuth = async () => {
    if (!clientIdInput.trim()) {
      setOauthMsg('Client ID is required.')
      return
    }
    setSavingOAuth(true)
    setOauthMsg('')
    try {
      const updated = await window.api.backup.saveOAuthConfig(
        clientIdInput.trim(),
        clientSecretInput.trim() || undefined
      )
      setOauthConfig(updated)
      setClientSecretInput('')
      setOauthMsg('OAuth credentials saved successfully.')
    } catch (err: any) {
      setOauthMsg(err.message || 'Failed to save OAuth credentials.')
    } finally {
      setSavingOAuth(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setBackupMsg('')
    try {
      const res = await window.api.backup.connectAccount()
      if (res.success) {
        setBackupMsg(`Connected successfully as ${res.email}`)
        await loadData()
        onAccountChange?.(true)
      }
    } catch (err: any) {
      setBackupMsg(err.message || 'Google authentication failed or timed out.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Google Drive account? Automated backups will pause.')) {
      return
    }
    try {
      await window.api.backup.disconnectAccount()
      setBackupMsg('Google account disconnected.')
      await loadData()
      onAccountChange?.(false)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleRunBackupNow = async () => {
    setRunningBackup(true)
    setBackupMsg('')
    try {
      const res = await window.api.backup.runBackupNow()
      if (res.success) {
        setBackupMsg(
          `Backup successful! Saved ${res.name} (${((res.size || 0) / (1024 * 1024)).toFixed(2)} MB) to Google Drive.`
        )
        await loadData()
      }
    } catch (err: any) {
      setBackupMsg(`Backup failed: ${err.message}`)
    } finally {
      setRunningBackup(false)
    }
  }

  const handleToggleAutoBackup = async () => {
    const newEnabled = !settings.autoBackupEnabled
    setSavingSchedule(true)
    try {
      const updated = await window.api.backup.saveSettings({
        autoBackupEnabled: newEnabled,
        scheduleTime: settings.scheduleTime,
      })
      setSettings(updated)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setSettings((s) => ({ ...s, scheduleTime: newTime }))
    try {
      await window.api.backup.saveSettings({
        autoBackupEnabled: settings.autoBackupEnabled,
        scheduleTime: newTime,
      })
    } catch (err: any) {
      console.error('Failed to save schedule time', err)
    }
  }

  return (
    <div className="bg-card border rounded-lg p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-base text-foreground">Google Drive Cloud Backup</h2>
            <p className="text-xs text-muted-foreground">
              Automated and on-demand database snapshots uploaded to your institution's Google Drive.
            </p>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
            account.connected
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
          }`}
        >
          {account.connected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      {/* Account Connection Status */}
      <div className="p-4 rounded-lg bg-muted/40 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Connected Google Account
          </div>
          {account.connected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-semibold text-foreground">{account.userEmail}</span>
              {account.connectedAt && (
                <span className="text-xs text-muted-foreground">
                  (Connected on {new Date(account.connectedAt).toLocaleDateString()})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>No Google Drive account connected.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {account.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              disabled={connecting || !oauthConfig.configured}
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              title={!oauthConfig.configured ? 'Please configure Google OAuth credentials below first' : undefined}
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              {connecting ? 'Authenticating…' : 'Connect Google Drive'}
            </button>
          )}
        </div>
      </div>

      {/* Backup Controls: Run Now & Auto Backup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Run Now Backup */}
        <div className="p-4 rounded-lg border bg-card space-y-2 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4 text-primary" />
              Run Now Backup
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Creates an immediate SQLite database snapshot and uploads it to the <code>Teli-Attendance-Backups</code>{' '}
              folder on Google Drive.
            </p>
          </div>
          <button
            type="button"
            disabled={runningBackup || !account.connected}
            onClick={handleRunBackupNow}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {runningBackup ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Uploading Snapshot…</span>
              </>
            ) : (
              <>
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                <span>Run Backup Now</span>
              </>
            )}
          </button>
        </div>

        {/* Automatic Daily Backup Schedule */}
        <div className="p-4 rounded-lg border bg-card space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Automatic Daily Backup
              </h4>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoBackupEnabled}
                disabled={savingSchedule || !account.connected}
                onClick={handleToggleAutoBackup}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  settings.autoBackupEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoBackupEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Runs automatically in the background at the specified daily time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Daily Time (24h):</label>
            <input
              type="time"
              value={settings.scheduleTime}
              onChange={handleTimeChange}
              disabled={!settings.autoBackupEnabled || !account.connected}
              className="px-2 py-1 text-xs border rounded-md bg-background disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
        </div>
      </div>

      {backupMsg && (
        <div
          className={`p-3 rounded-md text-xs border ${
            backupMsg.includes('failed') || backupMsg.includes('error')
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
          }`}
        >
          {backupMsg}
        </div>
      )}

      {/* Last Backup Summary Banner */}
      {lastBackup && (
        <div className="p-3.5 rounded-lg bg-muted/20 border text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Last Backup Status:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                lastBackup.status === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {lastBackup.status === 'success' ? 'SUCCESS' : 'FAILED'}
            </span>
          </div>
          <div className="text-muted-foreground">
            Timestamp: <strong>{new Date(lastBackup.time).toLocaleString()}</strong>
          </div>
          {lastBackup.name && (
            <div className="text-muted-foreground font-mono">
              File: {lastBackup.name} ({((lastBackup.size || 0) / (1024 * 1024)).toFixed(2)} MB)
            </div>
          )}
          {lastBackup.error && <div className="text-destructive font-medium">Error: {lastBackup.error}</div>}
        </div>
      )}

      {/* Collapsible Admin OAuth Credentials Setup */}
      <div className="border-t pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowOAuthConfig(!showOAuthConfig)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Google Cloud OAuth Credentials (Setup / Installation)</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              {showOAuthConfig ? '(Click to hide)' : '(Click to configure)'}
            </span>
          </button>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              oauthConfig.configured ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {oauthConfig.configured ? 'Configured' : 'Credentials Missing'}
          </span>
        </div>

        {showOAuthConfig && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-3 animate-in fade-in-50">
            <p className="text-xs text-muted-foreground">
              Enter your Google Cloud Project OAuth Client ID and Secret (from Google Cloud Console $\rightarrow$ APIs &
              Services $\rightarrow$ Credentials). Ensure redirect URI is set to{' '}
              <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded">{oauthConfig.redirectUri}</code>.
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">Google Client ID *</label>
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="e.g. 123456789-xxxxxx.apps.googleusercontent.com"
                  className="mt-1 w-full border rounded-md px-3 py-1.5 text-xs bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Google Client Secret *</label>
                <div className="relative mt-1">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecretInput}
                    onChange={(e) => setClientSecretInput(e.target.value)}
                    placeholder={oauthConfig.clientSecretSet ? '•••••••••••• (Configured — leave blank to keep)' : 'Enter Client Secret'}
                    className="w-full border rounded-md pl-3 pr-9 py-1.5 text-xs bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {oauthMsg && (
              <p
                className={`text-xs ${
                  oauthMsg.includes('required') || oauthMsg.includes('fail') ? 'text-destructive' : 'text-green-600'
                }`}
              >
                {oauthMsg}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={savingOAuth}
                onClick={handleSaveOAuth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingOAuth ? 'Saving…' : 'Save OAuth Credentials'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AppVersion() {
  const [ver, setVer] = useState('…')
  useEffect(() => {
    window.api.app.getVersion().then(setVer)
  }, [])
  return <span className="font-medium">{ver}</span>
}
