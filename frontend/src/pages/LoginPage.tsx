import React, { useState, useEffect } from 'react'
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
  LogOut,
  Clock,
  AlertTriangle,
  UserPlus,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authRegister, getContractors } from '../services/api'
import type { Contractor } from '../types'

export default function LoginPage() {
  const { user, role, login, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Mode: 'signin' | 'register'
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>(initialMode)

  // Sign In Tab: 'contractor' | 'admin'
  const initialTab = searchParams.get('tab') === 'admin' ? 'admin' : 'contractor'
  const [activeTab, setActiveTab] = useState<'contractor' | 'admin'>(initialTab)

  // Registration Type: 'contractor' | 'subadmin'
  const [regType, setRegType] = useState<'contractor' | 'subadmin'>('contractor')

  // Sign in state
  const [contractorId, setContractorId] = useState<string>('')
  const [contractorPassword, setContractorPassword] = useState<string>('')
  const [showContractorPassword, setShowContractorPassword] = useState<boolean>(false)

  const [adminId, setAdminId] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState<string>('')
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false)

  // Registration state - Contractor
  const [regContractorId, setRegContractorId] = useState<string>('')
  const [regCompanyName, setRegCompanyName] = useState<string>('')
  const [regContactPerson, setRegContactPerson] = useState<string>('')
  const [regContractorEmail, setRegContractorEmail] = useState<string>('')
  const [regContractorPhone, setRegContractorPhone] = useState<string>('')
  const [regContractorPassword, setRegContractorPassword] = useState<string>('')
  const [regContractorConfirmPassword, setRegContractorConfirmPassword] = useState<string>('')

  // Registration state - Sub-Admin
  const [regSubAdminUsername, setRegSubAdminUsername] = useState<string>('')
  const [regSubAdminFullName, setRegSubAdminFullName] = useState<string>('')
  const [regSubAdminEmail, setRegSubAdminEmail] = useState<string>('')
  const [regSubAdminPhone, setRegSubAdminPhone] = useState<string>('')
  const [regSubAdminAgency, setRegSubAdminAgency] = useState<string>('MoSPI Oversight Cell')
  const [regSubAdminTitle, setRegSubAdminTitle] = useState<string>('Field Quality Auditor')
  const [regSubAdminContractorId, setRegSubAdminContractorId] = useState<string>('')
  const [regSubAdminPassword, setRegSubAdminPassword] = useState<string>('')
  const [regSubAdminConfirmPassword, setRegSubAdminConfirmPassword] = useState<string>('')

  // Auxiliary data
  const [contractorList, setContractorList] = useState<Contractor[]>([])

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null)

  useEffect(() => {
    getContractors()
      .then((data) => {
        if (data && data.length > 0) {
          setContractorList(data)
          if (!regSubAdminContractorId) {
            setRegSubAdminContractorId(data[0].contractor_id)
          }
        }
      })
      .catch((e) => console.warn('Failed to load contractors', e))
  }, [])

  const handleTabChange = (tab: 'contractor' | 'admin') => {
    setActiveTab(tab)
    setError(null)
    setSearchParams({ tab, mode: authMode })
  }

  const handleModeChange = (mode: 'signin' | 'register') => {
    setAuthMode(mode)
    setError(null)
    setRegistrationSuccess(null)
    setSearchParams({ tab: activeTab, mode })
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setRegistrationSuccess(null)

    if (regType === 'contractor') {
      if (!regContractorId.trim()) {
        setError('Contractor ID is required (e.g. CNT-NEW-01)')
        return
      }
      if (!regCompanyName.trim()) {
        setError('Company name is required')
        return
      }
      if (!regContactPerson.trim()) {
        setError('Authorized contact person is required')
        return
      }
      if (!regContractorEmail.trim()) {
        setError('Email address is required')
        return
      }
      if (!regContractorPassword) {
        setError('Password is required (min 4 characters)')
        return
      }
      if (regContractorPassword !== regContractorConfirmPassword) {
        setError('Passwords do not match')
        return
      }

      setLoading(true)
      try {
        const res = await authRegister({
          account_type: 'contractor',
          contractor_id: regContractorId.trim().toUpperCase(),
          company_name: regCompanyName.trim(),
          contact_person: regContactPerson.trim(),
          email: regContractorEmail.trim(),
          phone: regContractorPhone.trim(),
          password: regContractorPassword,
        })
        setRegistrationSuccess(
          res.message || 'Contractor registration submitted! Your account is pending Main Administrator approval.'
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to register contractor')
      } finally {
        setLoading(false)
      }
    } else {
      // Sub-Admin Registration
      if (!regSubAdminUsername.trim()) {
        setError('Username is required')
        return
      }
      if (!regSubAdminFullName.trim()) {
        setError('Full officer name is required')
        return
      }
      if (!regSubAdminEmail.trim()) {
        setError('Official email is required')
        return
      }
      if (!regSubAdminContractorId.trim()) {
        setError('Target monitored contractor assignment is required')
        return
      }
      if (!regSubAdminPassword) {
        setError('Password is required (min 4 characters)')
        return
      }
      if (regSubAdminPassword !== regSubAdminConfirmPassword) {
        setError('Passwords do not match')
        return
      }

      setLoading(true)
      try {
        const res = await authRegister({
          account_type: 'subadmin',
          username: regSubAdminUsername.trim().toLowerCase(),
          full_name: regSubAdminFullName.trim(),
          email: regSubAdminEmail.trim(),
          phone: regSubAdminPhone.trim(),
          agency: regSubAdminAgency.trim(),
          title: regSubAdminTitle.trim(),
          target_contractor_id: regSubAdminContractorId.trim().toUpperCase(),
          password: regSubAdminPassword,
        })
        setRegistrationSuccess(
          res.message || 'Sub-Admin application submitted! Your account is pending Main Administrator verification.'
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to register sub-admin')
      } finally {
        setLoading(false)
      }
    }
  }

  // Check if error is pending approval
  const isPendingError = error && error.toLowerCase().includes('pending approval')
  const isRejectedError = error && error.toLowerCase().includes('rejected')

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8 px-4 animate-in fade-in duration-300">
      {/* Top back navigation link */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-orange dark:hover:text-amber-400 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to National Dashboard</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
          MoSPI NirmanAI Security Gateway
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 overflow-hidden">
        {/* Portal Header */}
        <div className="px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-b from-slate-50 via-white to-transparent dark:from-ink-950/60 dark:via-ink-900 dark:to-transparent border-b border-slate-100 dark:border-ink-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-colors ${
                authMode === 'register'
                  ? regType === 'contractor'
                    ? 'bg-gradient-to-br from-amber-500 to-brand-orange text-white shadow-amber-500/20'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/20'
                  : activeTab === 'contractor'
                  ? 'bg-gradient-to-br from-amber-500 to-brand-orange text-white shadow-amber-500/20'
                  : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20'
              }`}>
                {authMode === 'register' ? (
                  regType === 'contractor' ? <HardHat size={24} /> : <UserPlus size={24} />
                ) : activeTab === 'contractor' ? (
                  <HardHat size={24} />
                ) : (
                  <ShieldCheck size={24} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300">
                    {authMode === 'register' ? 'Account Registration' : 'Secure Access'}
                  </span>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {authMode === 'register'
                    ? regType === 'contractor'
                      ? 'Contractor Onboarding'
                      : 'Sub-Admin Registration'
                    : activeTab === 'contractor'
                    ? 'Contractor Portal'
                    : 'Oversight Admin Console'}
                </h1>
              </div>
            </div>

            {/* Mode Switch Pills: Sign In vs Sign Up */}
            <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-ink-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleModeChange('signin')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white dark:bg-ink-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('register')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-ink-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {authMode === 'register'
              ? 'New contractor companies and sub-admin inspectors must submit applications. All accounts require Main Administrator (Director General) approval before login access is activated.'
              : activeTab === 'contractor'
              ? 'Authorized portal for registered contractors to upload on-site verified evidence, telemetry, and progress reports.'
              : 'Ministerial administrative console for project governance, package assignments, and geofence perimeter management (Director General & Sub-Admins).'}
          </p>
        </div>

        {/* Existing Active Session Alert */}
        {role !== 'guest' && user && authMode === 'signin' && (
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
                onClick={() => navigate(user.role === 'admin' || user.role === 'subadmin' ? '/admin' : '/contractor')}
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

        {/* Segmented Tab Switcher for Sign In Mode */}
        {authMode === 'signin' && (
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
        )}

        {/* Segmented Type Switcher for Registration Mode */}
        {authMode === 'register' && (
          <div className="px-6 sm:px-8 pt-4">
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-ink-950 border border-slate-200/80 dark:border-ink-800">
              <button
                type="button"
                onClick={() => {
                  setRegType('contractor')
                  setError(null)
                  setRegistrationSuccess(null)
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  regType === 'contractor'
                    ? 'bg-white dark:bg-ink-800 text-brand-orange dark:text-amber-400 shadow-sm border border-slate-200/60 dark:border-ink-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HardHat size={15} />
                <span>Contractor Signup</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegType('subadmin')
                  setError(null)
                  setRegistrationSuccess(null)
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  regType === 'subadmin'
                    ? 'bg-white dark:bg-ink-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-ink-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 size={15} />
                <span>Sub-Admin Signup</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Success Banner */}
          {registrationSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Application Submitted for Review</h4>
                  <p className="mt-1 leading-relaxed">{registrationSuccess}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Status: <strong>Pending Main Admin Approval</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleModeChange('signin')}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Return to Sign In →
                </button>
              </div>
            </div>
          )}

          {/* Pending Approval Error Banner */}
          {isPendingError && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="font-bold text-amber-950 dark:text-amber-100">Account Pending Verification</h4>
                  <p className="mt-1 leading-relaxed">
                    This account is registered and awaiting approval by the Oversight Director General (Main Admin). As per NirmanAI governance rules, accounts cannot log in until verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rejected Account Error Banner */}
          {isRejectedError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-950 dark:text-rose-100">Registration Not Approved</h4>
                  <p className="mt-0.5 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Standard Error Banner */}
          {error && !isPendingError && !isRejectedError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 shrink-0 font-bold text-[10px]">
                !
              </span>
              <span className="mt-0.5 leading-relaxed">{error}</span>
            </div>
          )}

          {/* SIGN IN: CONTRACTOR */}
          {authMode === 'signin' && activeTab === 'contractor' && (
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

              <div className="text-center pt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  New contractor company?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      handleModeChange('register')
                      setRegType('contractor')
                    }}
                    className="font-bold text-brand-orange hover:underline cursor-pointer"
                  >
                    Register here for Admin Approval
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* SIGN IN: ADMIN (MAIN ADMIN & SUB-ADMIN) */}
          {authMode === 'signin' && activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin / Sub-Admin Username or ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Building2 size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter Username or ID (e.g. admin or subadmin_user)"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Supports both Directorate Main Admin and assigned Sub-Admin accounts.
                </p>
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
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter password"
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
                      <span>Sign In to Oversight Workspace</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you a field inspector?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      handleModeChange('register')
                      setRegType('subadmin')
                    }}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Register as Sub-Admin
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* SIGN UP: CONTRACTOR */}
          {authMode === 'register' && regType === 'contractor' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contractor ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CNT-HCC-03"
                    value={regContractorId}
                    onChange={(e) => setRegContractorId(e.target.value.toUpperCase())}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-mono text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hindustan Construction Corp"
                    value={regCompanyName}
                    onChange={(e) => setRegCompanyName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person Name *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <UserCheck size={14} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Singhania"
                      value={regContactPerson}
                      onChange={(e) => setRegContactPerson(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="contracts@company.com"
                      value={regContractorEmail}
                      onChange={(e) => setRegContractorEmail(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone / Mobile
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Phone size={14} />
                  </span>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={regContractorPhone}
                    onChange={(e) => setRegContractorPhone(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Set Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 4 characters"
                    value={regContractorPassword}
                    onChange={(e) => setRegContractorPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={regContractorConfirmPassword}
                    onChange={(e) => setRegContractorConfirmPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <Clock size={15} className="shrink-0 mt-0.5" />
                <span>
                  After registering, your account will enter the <strong>Pending Approval</strong> state. The Main Administrator will review and authorize your credentials before you can log in.
                </span>
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
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Contractor Application</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* SIGN UP: SUB-ADMIN */}
          {authMode === 'register' && regType === 'subadmin' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username / Login ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. subadmin_lt"
                    value={regSubAdminUsername}
                    onChange={(e) => setRegSubAdminUsername(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Officer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Er. Rajiv Sharma"
                    value={regSubAdminFullName}
                    onChange={(e) => setRegSubAdminFullName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="r.sharma@morth.gov.in"
                      value={regSubAdminEmail}
                      onChange={(e) => setRegSubAdminEmail(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Agency
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NHAI Regional Quality Cell"
                    value={regSubAdminAgency}
                    onChange={(e) => setRegSubAdminAgency(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Designation / Title
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Briefcase size={14} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Senior Project Quality Auditor"
                      value={regSubAdminTitle}
                      onChange={(e) => setRegSubAdminTitle(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Monitored Contractor *
                  </label>
                  <select
                    required
                    value={regSubAdminContractorId}
                    onChange={(e) => setRegSubAdminContractorId(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
                  >
                    {contractorList.map((c) => (
                      <option key={c.contractor_id} value={c.contractor_id}>
                        {c.contractor_id} — {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Set Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 4 characters"
                    value={regSubAdminPassword}
                    onChange={(e) => setRegSubAdminPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={regSubAdminConfirmPassword}
                    onChange={(e) => setRegSubAdminConfirmPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-[11px] text-indigo-900 dark:text-indigo-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  Sub-Admin Audit Scope & Protocol:
                </p>
                <p>
                  Sub-Admins are assigned to audit reports of <strong>one specific contractor</strong>. The Main Admin retains supreme authority to recheck and override any sub-admin audit decision with specific written justification.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Submitting Sub-Admin Application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Sub-Admin Application</span>
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
