import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { 
  ShieldCheck, 
  HardHat, 
  Building2, 
  ArrowRight, 
  KeyRound, 
  UserCheck, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  CheckCircle2,
  Lock,
  LogOut
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, role, login, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab: 'contractor' | 'admin'
  const initialTab = searchParams.get('tab') === 'admin' ? 'admin' : 'contractor'
  const [activeTab, setActiveTab] = useState<'contractor' | 'admin'>(initialTab)

  // Separate, clean form state with NO pre-filled credentials
  const [contractorId, setContractorId] = useState<string>('')
  const [contractorPassword, setContractorPassword] = useState<string>('')
  const [showContractorPassword, setShowContractorPassword] = useState<boolean>(false)

  const [adminId, setAdminId] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState<string>('')
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false)

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleTabChange = (tab: 'contractor' | 'admin') => {
    setActiveTab(tab)
    setError(null)
    setSearchParams({ tab })
  }

  const handleContractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contractorId.trim()) {
      setError('Please enter your Contractor ID')
      return
    }
    if (!contractorPassword) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await login('contractor', contractorId.trim(), contractorPassword)
      navigate('/contractor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify your Contractor ID and password.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminId.trim()) {
      setError('Please enter your Admin username or ID')
      return
    }
    if (!adminPassword) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await login('admin', adminId.trim(), adminPassword)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-6 px-4 animate-in fade-in duration-300">
      {/* Top back navigation link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-orange dark:hover:text-amber-400 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to National Dashboard</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
          MoSPI NirmanAI
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 overflow-hidden">
        {/* Portal Header */}
        <div className="px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-b from-slate-50 via-white to-transparent dark:from-ink-950/60 dark:via-ink-900 dark:to-transparent border-b border-slate-100 dark:border-ink-800/80">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-colors ${
              activeTab === 'contractor'
                ? 'bg-gradient-to-br from-amber-500 to-brand-orange text-white shadow-amber-500/20'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20'
            }`}>
              {activeTab === 'contractor' ? <HardHat size={24} /> : <ShieldCheck size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300">
                  Secure Access
                </span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {activeTab === 'contractor' ? 'Contractor Portal' : 'Oversight Admin'}
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {activeTab === 'contractor'
              ? 'Authorized portal for registered contractors to upload on-site verified evidence, telemetry, and progress reports.'
              : 'Ministerial administrative console for project governance, package assignments, and geofence perimeter management.'}
          </p>
        </div>

        {/* Existing Active Session Alert (if user is already authenticated) */}
        {role !== 'guest' && user && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                Signed in as: <span className="text-brand-orange dark:text-amber-400">{user.name}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                Role: {user.role} ({user.company || user.agency || user.id})
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/contractor')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Workspace →
              </button>
              <button
                onClick={() => logout()}
                title="Sign out of current account"
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-ink-800 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Segmented Tab Switcher */}
        <div className="px-6 sm:px-8 pt-4">
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-ink-950 border border-slate-200/80 dark:border-ink-800">
            <button
              type="button"
              onClick={() => handleTabChange('contractor')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'contractor'
                  ? 'bg-white dark:bg-ink-800 text-brand-orange dark:text-amber-400 shadow-sm border border-slate-200/60 dark:border-ink-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardHat size={15} />
              <span>Contractor Login</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-ink-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/60 dark:border-ink-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 size={15} />
              <span>Admin Login</span>
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 shrink-0 font-bold text-[10px]">
                !
              </span>
              <span className="mt-0.5 leading-relaxed">{error}</span>
            </div>
          )}

          {activeTab === 'contractor' ? (
            <form onSubmit={handleContractorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contractor ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <UserCheck size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter Contractor ID (e.g. CNT-LT-01)"
                    value={contractorId}
                    onChange={(e) => setContractorId(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange font-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type={showContractorPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={contractorPassword}
                    onChange={(e) => setContractorPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowContractorPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showContractorPassword ? 'Hide password' : 'Show password'}
                  >
                    {showContractorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-brand-orange to-brand-orangeDark hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Authenticating Contractor...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Contractor</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Username / ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Building2 size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter Admin ID (e.g. admin)"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-cyan-700 to-blue-700 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Verifying Admin Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Oversight Administrator</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security footnote */}
          <div className="pt-4 border-t border-slate-100 dark:border-ink-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Lock size={12} className="text-slate-400" />
            <span>End-to-End Encrypted Session • MoSPI Secured Architecture</span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="px-6 py-3.5 bg-slate-50/80 dark:bg-ink-950 border-t border-slate-100 dark:border-ink-800/80 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
          <span>Public national project data and intelligence remain open without login.</span>
        </div>
      </div>
    </div>
  )
}
