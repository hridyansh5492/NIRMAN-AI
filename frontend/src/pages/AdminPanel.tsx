import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  Building2,
  MapPin,
  FileCheck2,
  Layers,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  HardHat,
  Filter,
  Eye,
  X,
  Compass,
  UserCheck,
  UserPlus,
  Users,
  Clock,
  RotateCcw,
  MessageSquare,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getProjects,
  getContractors,
  assignContractor,
  registerProject,
  getAdminAudits,
  reviewAdminAudit,
  setAdminGeofence,
  getPendingApprovals,
  approveAccount,
  getSubAdmins,
  assignSubAdminContractor,
  generateClientLamina,
} from '../services/api'
import { stateCentroids } from '../data/stateCentroids'
import { stateDistrictHubs } from '../data/stateDistrictHubs'
import { GeofenceMap } from '../components/GeofenceMap'
import type { Project, Contractor, Sector, PendingAccount, SubAdminItem } from '../types'

const sectors: Sector[] = [
  'Roads & Highways',
  'Railways',
  'Urban Transport',
  'Power & RE',
  'Oil & Gas',
  'Aviation & Aviation Infrastructure',
  'Water Resources',
  'Urban Development',
]

const statesList = [
  'Andaman & Nicobar',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra & Nagar Haveli',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

export default function AdminPanel() {
  const navigate = useNavigate()
  const { role, user } = useAuth()

  // Role detection: Sub-Admin vs Main Admin (Director General)
  const isSubAdmin = role === 'subadmin' || user?.admin_level === 'sub'
  const assignedContractorId = user?.assigned_contractor_id || null

  // Tabs: Sub-Admins are strictly locked to 'audits'
  const [activeTab, setActiveTab] = useState<'states' | 'add-project' | 'audits' | 'approvals'>(
    isSubAdmin ? 'audits' : 'states'
  )

  // State Assignments Tab state
  const [selectedState, setSelectedState] = useState<string>('Maharashtra')
  const [stateProjects, setStateProjects] = useState<Project[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false)
  const [assignModalProject, setAssignModalProject] = useState<Project | null>(null)
  const [selectedContractorId, setSelectedContractorId] = useState<string>('CNT-LT-01')
  const [packageName, setPackageName] = useState<string>('')
  const [contractValue, setContractValue] = useState<string>('')
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState<boolean>(false)

  // Add Project Tab state
  const [projectName, setProjectName] = useState<string>('')
  const [projectSector, setProjectSector] = useState<Sector>('Roads & Highways')
  const [projectState, setProjectState] = useState<string>('Maharashtra')
  const [sanctionedCost, setSanctionedCost] = useState<string>('1500')
  const [durationMonths, setDurationMonths] = useState<string>('36')
  const [physicalProgress, setPhysicalProgress] = useState<string>('20')
  const [financialProgress, setFinancialProgress] = useState<string>('18')
  const [centerLat, setCenterLat] = useState<number>(19.076)
  const [centerLng, setCenterLng] = useState<number>(72.878)
  const [radiusKm, setRadiusKm] = useState<number>(3.5)
  const [projectContractorId, setProjectContractorId] = useState<string>('CNT-LT-01')
  const [isSubmittingProject, setIsSubmittingProject] = useState<boolean>(false)
  const [newProjectResult, setNewProjectResult] = useState<any | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)

  // Audits Tab state
  const [audits, setAudits] = useState<any[]>([])
  const [loadingAudits, setLoadingAudits] = useState<boolean>(false)
  const [auditFilter, setAuditFilter] = useState<'all' | 'auto_approved' | 'approved' | 'rejected'>('all')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  // Main Admin Override Modal state
  const [overrideModalAudit, setOverrideModalAudit] = useState<any | null>(null)
  const [overrideVerdict, setOverrideVerdict] = useState<'approved' | 'rejected'>('approved')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [overrideNotes, setOverrideNotes] = useState<string>('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false)

  // Account Approvals & Delegation Tab state
  const [pendingContractors, setPendingContractors] = useState<PendingAccount[]>([])
  const [pendingSubAdmins, setPendingSubAdmins] = useState<PendingAccount[]>([])
  const [subAdminList, setSubAdminList] = useState<SubAdminItem[]>([])
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false)
  const [approvalActionId, setApprovalActionId] = useState<string | number | null>(null)
  const [pendingContractorSelections, setPendingContractorSelections] = useState<Record<string, string>>({})
  const [subAdminContractorSelections, setSubAdminContractorSelections] = useState<Record<string, string>>({})
  const [approvalSuccessMsg, setApprovalSuccessMsg] = useState<string | null>(null)

  // Ensure sub-admin stays on audits tab
  useEffect(() => {
    if (isSubAdmin && activeTab !== 'audits') {
      setActiveTab('audits')
    }
  }, [isSubAdmin, activeTab])

  // Load contractors and initial state projects
  useEffect(() => {
    getContractors()
      .then((data) => {
        if (data && data.length > 0) setContractors(data)
      })
      .catch((err) => console.warn('Failed to load contractors', err))
  }, [])

  const loadStateProjects = (state: string) => {
    setLoadingProjects(true)
    getProjects({ state })
      .then((data) => {
        setStateProjects(data || [])
      })
      .catch((err) => console.warn('Failed to load state projects', err))
      .finally(() => setLoadingProjects(false))
  }

  useEffect(() => {
    if (!isSubAdmin && activeTab === 'states') {
      loadStateProjects(selectedState)
    }
  }, [selectedState, activeTab, isSubAdmin])

  const loadAudits = () => {
    setLoadingAudits(true)
    const contractorParam = isSubAdmin && assignedContractorId ? assignedContractorId : undefined
    getAdminAudits(100, contractorParam)
      .then((data) => {
        setAudits(data || [])
      })
      .catch((err) => console.warn('Failed to load audits', err))
      .finally(() => setLoadingAudits(false))
  }

  useEffect(() => {
    if (activeTab === 'audits') {
      loadAudits()
    }
  }, [activeTab, isSubAdmin, assignedContractorId])

  // Load approvals data for Main Admin
  const loadApprovalsData = async () => {
    if (isSubAdmin) return
    setLoadingApprovals(true)
    try {
      const [pendingRes, subadminsRes] = await Promise.all([
        getPendingApprovals(),
        getSubAdmins(),
      ])
      setPendingContractors(pendingRes.pending_contractors || [])
      setPendingSubAdmins(pendingRes.pending_subadmins || [])
      setSubAdminList(subadminsRes || [])

      // Initialize pending contractor selections
      const pendingMap: Record<string, string> = {}
      ;(pendingRes.pending_subadmins || []).forEach((sa: any) => {
        pendingMap[String(sa.id)] = sa.details?.assigned_contractor_id || (contractors[0]?.contractor_id || 'CNT-LT-01')
      })
      setPendingContractorSelections(pendingMap)

      // Initialize active subadmin selections
      const rosterMap: Record<string, string> = {}
      ;(subadminsRes || []).forEach((sa: any) => {
        rosterMap[String(sa.id)] = sa.assigned_contractor_id || ''
      })
      setSubAdminContractorSelections(rosterMap)
    } catch (err) {
      console.warn('Failed to load pending approvals', err)
    } finally {
      setLoadingApprovals(false)
    }
  }

  useEffect(() => {
    if (!isSubAdmin && activeTab === 'approvals') {
      loadApprovalsData()
    }
  }, [activeTab, isSubAdmin])

  // Handle Geofence Lamina drag/radius change
  const handleGeofenceChange = (lat: number, lng: number, radius: number) => {
    setCenterLat(Number(lat.toFixed(5)))
    setCenterLng(Number(lng.toFixed(5)))
    setRadiusKm(Number(radius.toFixed(2)))
  }

  // Handle State change in Add Project tab
  const handleProjectStateChange = (st: string) => {
    setProjectState(st)
    const hubs = stateDistrictHubs[st]
    if (hubs && hubs.length > 0) {
      setCenterLat(hubs[0][1])
      setCenterLng(hubs[0][2])
    } else {
      const c = stateCentroids[st]
      if (c) {
        setCenterLat(c[0])
        setCenterLng(c[1])
      }
    }
  }

  // Open Contractor Assignment Modal for State Project
  const handleOpenAssignModal = (p: Project) => {
    setAssignModalProject(p)
    setSelectedContractorId(p.contractor?.contractor_id || p.contractor_id || 'CNT-LT-01')
    setPackageName(`Package-${p.id.replace('PRJ-', '')}-EPC`)
    setContractValue(p.sanctioned_cost ? String(p.sanctioned_cost) : p.cost_cr ? String(p.cost_cr) : '1500')
    setAssignSuccessMsg(null)
  }

  // Submit Contractor Assignment
  const handleAssignContractor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignModalProject) return
    setIsAssigning(true)
    try {
      const valNum = parseFloat(contractValue) || 1500
      await assignContractor(assignModalProject.id, selectedContractorId, packageName, valNum)
      setAssignSuccessMsg(`Successfully assigned ${selectedContractorId} to ${assignModalProject.id} with package ${packageName}.`)
      loadStateProjects(selectedState)
      setTimeout(() => {
        setAssignModalProject(null)
        setAssignSuccessMsg(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to assign contractor', err)
      alert(err instanceof Error ? err.message : 'Failed to assign contractor')
    } finally {
      setIsAssigning(false)
    }
  }

  // Add Project Submission
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectError(null)
    setNewProjectResult(null)
    setIsSubmittingProject(true)

    try {
      const payload = {
        name: projectName,
        sector: projectSector,
        state: projectState,
        sanctioned_cost: parseFloat(sanctionedCost) || 1500,
        duration_months: parseInt(durationMonths) || 36,
        physical_progress_pct: parseFloat(physicalProgress) || 20,
        financial_progress_pct: parseFloat(financialProgress) || 18,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_km: radiusKm,
        contractor_id: projectContractorId,
      }
      const res = await registerProject(payload)
      setNewProjectResult(res)
      setProjectName('')
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Failed to register project')
    } finally {
      setIsSubmittingProject(false)
    }
  }

  // Helper to detect if audit has sub-admin review
  const getSubAdminReviewInfo = (audit: any) => {
    let details: any = null
    try {
      if (audit.details_json) {
        details = typeof audit.details_json === 'string' ? JSON.parse(audit.details_json) : audit.details_json
      }
    } catch {}
    if (details?.subadmin_review) {
      return details.subadmin_review
    }
    if (String(audit.verification_status || '').startsWith('subadmin_')) {
      const st = String(audit.verification_status).replace('subadmin_', '')
      return {
        reviewed_by: 'Sub-Admin Inspector',
        status: st,
        notes: audit.notes || 'Sub-Admin verified on site',
      }
    }
    return null
  }

  // Helper to detect main admin review info
  const getMainAdminReviewInfo = (audit: any) => {
    let details: any = null
    try {
      if (audit.details_json) {
        details = typeof audit.details_json === 'string' ? JSON.parse(audit.details_json) : audit.details_json
      }
    } catch {}
    return details?.main_admin_review || null
  }

  // Sub-Admin Review Handler
  const handleSubAdminReview = async (submissionId: string, newStatus: 'approved' | 'rejected') => {
    setReviewingId(submissionId)
    setReviewMessage(null)
    try {
      await reviewAdminAudit(
        submissionId,
        newStatus,
        `Sub-Admin verified on-site as ${newStatus}`,
        'sub_admin',
        user?.name || 'Sub-Admin Inspector',
        user?.id
      )
      setAudits((prev) =>
        prev.map((item) => {
          if (item.submission_id === submissionId) {
            return {
              ...item,
              verification_status: `subadmin_${newStatus}`,
              counts_towards_progress: newStatus === 'approved' ? 1 : 0,
              details_json: JSON.stringify({
                subadmin_review: {
                  reviewed_by: user?.name || 'Sub-Admin Inspector',
                  reviewer_id: user?.id || 'SUBADMIN',
                  status: newStatus,
                  notes: `Sub-Admin verified on-site as ${newStatus}`,
                  reviewed_at: new Date().toISOString(),
                },
              }),
            }
          }
          return item
        })
      )
      setReviewMessage(`Audit #${submissionId} marked as ${newStatus.toUpperCase()} by Sub-Admin.`)
      setTimeout(() => setReviewMessage(null), 4000)
    } catch (err) {
      console.error('Sub-Admin review failed', err)
      alert(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setReviewingId(null)
    }
  }

  // Main Admin Review Handler (Standard or opening Override Modal)
  const handleAdminReviewClick = (audit: any, targetStatus: 'approved' | 'rejected') => {
    const subReview = getSubAdminReviewInfo(audit)
    if (subReview) {
      // Sub-Admin already reviewed: Mandatory Override Reason Required!
      setOverrideModalAudit(audit)
      setOverrideVerdict(targetStatus)
      setOverrideReason('')
      setOverrideNotes('')
      setOverrideError(null)
    } else {
      // Direct Main Admin review
      executeMainAdminReview(audit.submission_id, targetStatus, undefined, undefined)
    }
  }

  // Execute Main Admin Review
  const executeMainAdminReview = async (
    submissionId: string,
    status: 'approved' | 'rejected',
    reason?: string,
    notes?: string
  ) => {
    setReviewingId(submissionId)
    setReviewMessage(null)
    try {
      await reviewAdminAudit(
        submissionId,
        status,
        notes || `Director General marked as ${status}`,
        'main_admin',
        user?.name || 'Director General (Admin)',
        user?.id,
        reason
      )
      setAudits((prev) =>
        prev.map((item) => {
          if (item.submission_id === submissionId) {
            return {
              ...item,
              verification_status: `manually_${status}`,
              counts_towards_progress: status === 'approved' ? 1 : 0,
              inside_geofence: status === 'approved' ? 1 : 0,
              details_json: JSON.stringify({
                main_admin_review: {
                  reviewed_by: user?.name || 'Director General (Admin)',
                  status,
                  notes: notes || `Final verdict ${status} by Main Admin`,
                  override_reason: reason || '',
                  overrode_subadmin: Boolean(getSubAdminReviewInfo(item)),
                  reviewed_at: new Date().toISOString(),
                },
              }),
            }
          }
          return item
        })
      )
      setReviewMessage(
        reason
          ? `Report #${submissionId} successfully overridden as ${status.toUpperCase()} with noted justification.`
          : `Report #${submissionId} successfully marked as ${status.toUpperCase()} by Director General.`
      )
      setTimeout(() => setReviewMessage(null), 4500)
    } catch (err) {
      console.error('Main admin review failed', err)
      alert(err instanceof Error ? err.message : 'Failed to update review status')
    } finally {
      setReviewingId(null)
    }
  }

  // Submit Override Modal with Mandatory Reason
  const handleSubmitOverrideModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overrideModalAudit) return
    if (!overrideReason.trim()) {
      setOverrideError('Mandatory requirement: A specific reason for overriding the Sub-Admin verdict must be noted down.')
      return
    }

    setIsSubmittingOverride(true)
    setOverrideError(null)
    try {
      await executeMainAdminReview(
        overrideModalAudit.submission_id,
        overrideVerdict,
        overrideReason.trim(),
        overrideNotes.trim()
      )
      setOverrideModalAudit(null)
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Override review failed')
    } finally {
      setIsSubmittingOverride(false)
    }
  }

  // Approve or Reject Pending Account
  const handleAccountApproval = async (
    accountType: 'contractor' | 'subadmin',
    id: string | number,
    action: 'approve' | 'reject'
  ) => {
    setApprovalActionId(id)
    setApprovalSuccessMsg(null)
    try {
      const assignedCid = accountType === 'subadmin' ? pendingContractorSelections[String(id)] : undefined
      await approveAccount({
        account_type: accountType,
        id,
        action,
        assigned_contractor_id: assignedCid,
        admin_id: user?.id,
      })
      setApprovalSuccessMsg(
        `Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${accountType} account #${id}.`
      )
      loadApprovalsData()
      setTimeout(() => setApprovalSuccessMsg(null), 4000)
    } catch (err) {
      console.error('Account approval action failed', err)
      alert(err instanceof Error ? err.message : 'Failed to process account approval')
    } finally {
      setApprovalActionId(null)
    }
  }

  // Reassign Sub-Admin Monitored Contractor
  const handleReassignSubAdmin = async (subadminId: number) => {
    const targetCid = subAdminContractorSelections[String(subadminId)]
    if (!targetCid) {
      alert('Please select a contractor to assign')
      return
    }
    setApprovalActionId(subadminId)
    try {
      await assignSubAdminContractor(subadminId, targetCid)
      setApprovalSuccessMsg(`Successfully reassigned Sub-Admin #${subadminId} to monitor ${targetCid}.`)
      loadApprovalsData()
      setTimeout(() => setApprovalSuccessMsg(null), 4000)
    } catch (err) {
      console.error('Reassignment failed', err)
      alert(err instanceof Error ? err.message : 'Failed to reassign contractor')
    } finally {
      setApprovalActionId(null)
    }
  }

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      const isInside = a.inside_geofence === 1
      const vStat = a.verification_status || (isInside ? 'accepted' : 'rejected')
      const isManuallyApproved = vStat === 'manually_approved'
      const isManuallyRejected = vStat === 'manually_rejected'
      const isSubAdminApproved = vStat === 'subadmin_approved'
      const isSubAdminRejected = vStat === 'subadmin_rejected'
      const isAutoApproved = (vStat === 'accepted' || vStat === 'auto_approved' || isInside) && !isManuallyApproved && !isManuallyRejected && !isSubAdminApproved && !isSubAdminRejected

      if (auditFilter === 'auto_approved') return isAutoApproved
      if (auditFilter === 'approved') return isManuallyApproved || isSubAdminApproved || isAutoApproved
      if (auditFilter === 'rejected') return isManuallyRejected || isSubAdminRejected || (!isInside && !isManuallyApproved && !isSubAdminApproved)
      return true
    })
  }, [audits, auditFilter])

  // Non-admin guard banner
  if (role !== 'admin' && role !== 'subadmin' && user?.admin_level !== 'sub') {
    return (
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
        <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <ShieldCheck size={28} />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Director General / Sub-Admin Access Required
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Project registration, location geofencing configuration, quality inspections, and state contractor package assignments are restricted to authorized Oversight Administrators.
          </p>
          <button
            onClick={() => navigate('/login?tab=admin')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Building2 size={15} />
            <span>Sign In with Admin ID & Password</span>
          </button>
        </div>
      </div>
    )
  }

  const totalPendingAccounts = pendingContractors.length + pendingSubAdmins.length

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-sm transition-all ${
        isSubAdmin
          ? 'border-purple-200 dark:border-purple-900/60 bg-gradient-to-br from-indigo-500/10 via-white to-purple-500/10 dark:from-indigo-950/30 dark:via-ink-900 dark:to-purple-950/20'
          : 'border-slate-200 dark:border-ink-800 bg-gradient-to-br from-cyan-500/10 via-white to-blue-500/10 dark:from-cyan-950/30 dark:via-ink-900 dark:to-blue-950/20'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
              isSubAdmin
                ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30'
                : 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/20'
            }`}>
              <ShieldCheck size={14} />
              <span>{isSubAdmin ? 'Sub-Admin Quality Inspector Desk' : 'Oversight Directorate (Admin Panel)'}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {isSubAdmin ? 'Regional Quality Audit Desk' : 'National Infrastructure Workspace'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              {isSubAdmin
                ? `Authorized quality inspection console scoped strictly to contractor: ${assignedContractorId || 'Assigned Contractor'}. Verify on-site evidence and telemetry submissions.`
                : 'Configure designated construction area lamina geofencing, assign contractors to projects under state packages, manage sub-admin delegations, and inspect audits.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-white/80 dark:bg-ink-800/80 border border-slate-200 dark:border-ink-700 shadow-sm text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                {isSubAdmin ? 'Inspector Scope' : 'Admin Authority'}
              </p>
              <p className={`text-xs font-bold ${isSubAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                {isSubAdmin ? `Monitors: ${assignedContractorId || 'Assigned'}` : 'Director General (MoSPI)'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200/80 dark:border-ink-700/80 pb-3">
          {!isSubAdmin && (
            <>
              <button
                onClick={() => setActiveTab('states')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'states'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
                }`}
              >
                <Layers size={15} />
                <span>Assign Projects Under States</span>
              </button>
              <button
                onClick={() => setActiveTab('add-project')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'add-project'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
                }`}
              >
                <Plus size={15} />
                <span>Add Project & Geofence Lamina</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('audits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audits'
                ? isSubAdmin
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                  : 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
            }`}
          >
            <FileCheck2 size={15} />
            <span>{isSubAdmin ? 'Audits (Assigned Contractor)' : 'Verification Audits & Submissions'}</span>
          </button>

          {!isSubAdmin && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
              }`}
            >
              <Users size={15} />
              <span>Account Approvals & Delegation</span>
              {totalPendingAccounts > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {totalPendingAccounts}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ASSIGN PROJECTS UNDER STATES (MAIN ADMIN ONLY) */}
      {!isSubAdmin && activeTab === 'states' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-ink-900 p-4 rounded-2xl border border-slate-200 dark:border-ink-800 shadow-sm">
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-cyan-500" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter State Infrastructure Portfolio:
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-bold text-slate-900 dark:text-white outline-none focus:border-cyan-500 cursor-pointer"
              >
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{stateProjects.length}</span> projects in {selectedState}
            </div>
          </div>

          {loadingProjects ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <span>Loading projects in {selectedState}...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stateProjects.map((p) => {
                const assignedC = p.contractor
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 font-bold">
                          {p.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.status === 'On Track'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : p.status === 'Watch'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2" title={p.name}>
                        {p.name}
                      </h3>

                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="truncate">Sector: <span className="text-slate-800 dark:text-slate-200 font-medium">{p.sector}</span></p>
                        <p>Cost: <span className="text-slate-800 dark:text-slate-200 font-bold">₹{p.sanctioned_cost ?? p.cost_cr ?? 1500} Cr</span></p>
                        <p>Physical Progress: <span className="text-brand-orange font-bold">{p.physicalProgress}%</span></p>
                      </div>

                      {/* Current Contractor Assignment */}
                      <div className="pt-2 border-t border-slate-100 dark:border-ink-800/80">
                        {assignedC ? (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200/60 dark:border-ink-800/60 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                              <HardHat size={14} className="text-brand-orange" />
                              <span className="truncate">{assignedC.company_name}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {assignedC.contractor_id}</p>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
                            No contractor package assigned yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenAssignModal(p)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck size={14} className="text-cyan-600" />
                      <span>{assignedC ? 'Reassign Contractor' : 'Assign Contractor'}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Assign Contractor Modal */}
          {assignModalProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="relative max-w-lg w-full bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 shadow-2xl p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
                      <HardHat size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Assign Contractor Package</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{assignModalProject.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setAssignModalProject(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                {assignSuccessMsg ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>{assignSuccessMsg}</span>
                  </div>
                ) : (
                  <form onSubmit={handleAssignContractor} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Project Name
                      </label>
                      <p className="text-xs font-bold text-slate-900 dark:text-white p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800">
                        {assignModalProject.name}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Authorized Contractor *
                      </label>
                      <select
                        value={selectedContractorId}
                        onChange={(e) => setSelectedContractorId(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium"
                      >
                        {contractors.map((c) => (
                          <option key={c.contractor_id} value={c.contractor_id}>
                            {c.contractor_id} - {c.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Package Name
                        </label>
                        <input
                          type="text"
                          required
                          value={packageName}
                          onChange={(e) => setPackageName(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Sanctioned Cost (₹ Cr)
                        </label>
                        <input
                          type="number"
                          required
                          value={contractValue}
                          onChange={(e) => setContractValue(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignModalProject(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isAssigning}
                        className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD PROJECT & GEOFENCE LAMINA (MAIN ADMIN ONLY) */}
      {!isSubAdmin && activeTab === 'add-project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Register New National Project
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Register a capital project, define baseline capex parameters, and assign an EPC contractor.
              </p>
            </div>

            {projectError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {projectError}
              </div>
            )}

            {newProjectResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Project Created: {newProjectResult.project_id}</span>
                </div>
                <p>Geofence polygon perimeter successfully synthesized with radius {newProjectResult.geofence?.radius_km} km.</p>
              </div>
            )}

            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune - Nashik Semi High Speed Rail Corridor"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sector *
                  </label>
                  <select
                    value={projectSector}
                    onChange={(e) => setProjectSector(e.target.value as Sector)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  >
                    {sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State *
                  </label>
                  <select
                    value={projectState}
                    onChange={(e) => handleProjectStateChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  >
                    {statesList.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sanctioned Cost (₹ Cr) *
                  </label>
                  <input
                    type="number"
                    required
                    value={sanctionedCost}
                    onChange={(e) => setSanctionedCost(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Planned Duration (Months)
                  </label>
                  <input
                    type="number"
                    required
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Physical Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={physicalProgress}
                    onChange={(e) => setPhysicalProgress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Financial Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={financialProgress}
                    onChange={(e) => setFinancialProgress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign EPC Contractor
                </label>
                <select
                  value={projectContractorId}
                  onChange={(e) => setProjectContractorId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium"
                >
                  {contractors.map((c) => (
                    <option key={c.contractor_id} value={c.contractor_id}>
                      {c.contractor_id} - {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingProject}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingProject ? (
                    <span>Registering & Generating Lamina...</span>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Register Project & Synthesize Geofence</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 p-6 sm:p-8 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass size={16} className="text-cyan-500" />
                  <span>Geofence Lamina Boundary Editor</span>
                </h3>
                <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                  R = {radiusKm} km
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Drag the circular marker on the map to place the project centroid or adjust radius. All contractor uploads outside this perimeter trigger an automated geofence breach.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-ink-700 h-[380px]">
              <GeofenceMap
                centerLat={centerLat}
                centerLng={centerLng}
                boundaryLamina={generateClientLamina(centerLat, centerLng, radiusKm)}
                radiusKm={radiusKm}
                onCoordinateChange={(lat, lng) => handleGeofenceChange(lat, lng, radiusKm)}
                interactive={true}
                pickerMode={true}
                height={380}
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-300">
              <span>Lat: {centerLat.toFixed(4)}</span>
              <span>Lng: {centerLng.toFixed(4)}</span>
              <span>Radius: {radiusKm} km</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VERIFICATION AUDITS & SUBMISSIONS */}
      {activeTab === 'audits' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-ink-900 p-4 rounded-2xl border border-slate-200 dark:border-ink-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter Audits:
              </span>
              {(['all', 'auto_approved', 'approved', 'rejected'] as const).map((filter) => {
                const labels = {
                  all: 'All Audits',
                  auto_approved: 'Auto-Approved Only',
                  approved: 'Approved',
                  rejected: 'Rejected',
                }
                return (
                  <button
                    key={filter}
                    onClick={() => setAuditFilter(filter)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                      auditFilter === filter
                        ? isSubAdmin ? 'bg-purple-600 text-white shadow-sm' : 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-700'
                    }`}
                  >
                    {labels[filter]}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAudits}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw size={13} className={loadingAudits ? 'animate-spin' : ''} />
                <span>Refresh Feed</span>
              </button>
              <span className="text-xs text-slate-400">Total: {filteredAudits.length} records</span>
            </div>
          </div>

          {/* Action Notification Banner */}
          {reviewMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{reviewMessage}</span>
              </div>
              <button onClick={() => setReviewMessage(null)} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer p-1">
                <X size={14} />
              </button>
            </div>
          )}

          {loadingAudits ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <span>Querying on-site submission records...</span>
            </div>
          ) : filteredAudits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800">
              {isSubAdmin
                ? `No submissions found for monitored contractor (${assignedContractorId}).`
                : 'No audit records matching criteria.'}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-ink-850 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-ink-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Photo</th>
                      <th className="px-4 py-3 font-semibold">Submission ID</th>
                      <th className="px-4 py-3 font-semibold">Project & Contractor</th>
                      <th className="px-4 py-3 font-semibold">Claimed Progress</th>
                      <th className="px-4 py-3 font-semibold">Status & Reviews</th>
                      <th className="px-4 py-3 font-semibold">AI Intelligence Brief</th>
                      <th className="px-4 py-3 font-semibold">Submitted At</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        {isSubAdmin ? 'Sub-Admin Actions' : 'Director General Oversight'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                    {filteredAudits.map((a) => {
                      const isInside = a.inside_geofence === 1
                      const vStat = a.verification_status || (isInside ? 'accepted' : 'rejected')
                      const isManuallyApproved = vStat === 'manually_approved'
                      const isManuallyRejected = vStat === 'manually_rejected'
                      const isSubAdminApproved = vStat === 'subadmin_approved'
                      const isSubAdminRejected = vStat === 'subadmin_rejected'
                      const isAutoApproved = (vStat === 'accepted' || vStat === 'auto_approved' || isInside) && !isManuallyApproved && !isManuallyRejected && !isSubAdminApproved && !isSubAdminRejected

                      const subReview = getSubAdminReviewInfo(a)
                      const mainReview = getMainAdminReviewInfo(a)

                      let aiIntel: any = null
                      try {
                        if (a.ai_intelligence_json) {
                          aiIntel = typeof a.ai_intelligence_json === 'string' ? JSON.parse(a.ai_intelligence_json) : a.ai_intelligence_json
                        }
                      } catch {}

                      return (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-ink-850/50 transition-colors">
                          <td className="px-4 py-3">
                            {a.photo_url ? (
                              <button
                                onClick={() => setPreviewPhoto(a.photo_url)}
                                className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-ink-700 group relative block cursor-pointer"
                              >
                                <img src={a.photo_url} alt="Site" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Eye size={14} />
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No Photo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {a.submission_id}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 dark:text-white">{a.project_id}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.company_name || a.contractor_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-brand-orange text-sm">
                              {a.physical_progress_pct ? `${a.physical_progress_pct}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            {isManuallyApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 size={12} />
                                DG APPROVED {mainReview?.overrode_subadmin ? '(OVERRODE SUB-ADMIN)' : ''}
                              </span>
                            ) : isManuallyRejected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                <AlertTriangle size={12} />
                                DG REJECTED {mainReview?.overrode_subadmin ? '(OVERRODE SUB-ADMIN)' : ''}
                              </span>
                            ) : isSubAdminApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                <CheckCircle2 size={12} />
                                SUB-ADMIN APPROVED
                              </span>
                            ) : isSubAdminRejected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <AlertTriangle size={12} />
                                SUB-ADMIN REJECTED
                              </span>
                            ) : isAutoApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                                <CheckCircle2 size={12} />
                                AUTO-APPROVED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                <AlertTriangle size={12} />
                                GEOFENCE BREACH
                              </span>
                            )}

                            {/* Sub-Admin Review metadata pill */}
                            {subReview && (
                              <div className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
                                <p className="font-semibold">
                                  Sub-Admin ({subReview.reviewed_by}): {subReview.status?.toUpperCase()}
                                </p>
                                {subReview.notes && <p className="italic text-slate-500 dark:text-slate-400 truncate max-w-xs">"{subReview.notes}"</p>}
                              </div>
                            )}

                            {/* Main Admin Override Reason pill */}
                            {mainReview?.override_reason && (
                              <div className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                                <p className="font-bold flex items-center gap-1">
                                  <MessageSquare size={11} />
                                  DG Override Reason:
                                </p>
                                <p className="italic font-medium leading-tight mt-0.5">"{mainReview.override_reason}"</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {aiIntel ? (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2" title={aiIntel.narrative}>
                                {aiIntel.narrative}
                              </p>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {isInside ? 'Intelligence derived' : 'Report rejected (breach)'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {a.submitted_at ? a.submitted_at.replace('T', ' ').substring(0, 19) : ''}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {reviewingId === a.submission_id ? (
                              <div className="flex items-center justify-end gap-1 text-slate-400">
                                <RefreshCw size={13} className="animate-spin text-cyan-600" />
                                <span className="text-[10px]">Processing...</span>
                              </div>
                            ) : isSubAdmin ? (
                              // Sub-Admin Actions
                              <div className="flex items-center justify-end gap-1.5">
                                {isManuallyApproved || isManuallyRejected ? (
                                  <span className="text-[10px] font-bold text-slate-400 italic">
                                    Locked by DG
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleSubAdminReview(a.submission_id, 'approved')}
                                      disabled={isSubAdminApproved}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        isSubAdminApproved
                                          ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 border border-indigo-300 opacity-70 cursor-default'
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95'
                                      }`}
                                    >
                                      {isSubAdminApproved ? 'Verified ✓' : 'Sub-Admin Approve'}
                                    </button>
                                    <button
                                      onClick={() => handleSubAdminReview(a.submission_id, 'rejected')}
                                      disabled={isSubAdminRejected}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        isSubAdminRejected
                                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-300 opacity-70 cursor-default'
                                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95'
                                      }`}
                                    >
                                      {isSubAdminRejected ? 'Rejected ✗' : 'Sub-Admin Reject'}
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              // Main Admin (Director General) Actions
                              <div className="flex items-center justify-end gap-1.5">
                                {subReview ? (
                                  // When Sub-Admin already reviewed: Main Admin Upper Hand Override Button
                                  <button
                                    onClick={() => handleAdminReviewClick(a, isSubAdminApproved ? 'rejected' : 'approved')}
                                    className="px-3 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm flex items-center gap-1 active:scale-95 cursor-pointer"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Recheck / Override Review</span>
                                  </button>
                                ) : (
                                  // Standard direct Main Admin actions
                                  <>
                                    <button
                                      onClick={() => handleAdminReviewClick(a, 'approved')}
                                      disabled={isManuallyApproved}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        isManuallyApproved
                                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-300 dark:border-emerald-800/40 opacity-70 cursor-default'
                                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95'
                                      }`}
                                    >
                                      {isManuallyApproved ? 'Approved ✓' : 'Approve'}
                                    </button>
                                    <button
                                      onClick={() => handleAdminReviewClick(a, 'rejected')}
                                      disabled={isManuallyRejected}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        isManuallyRejected
                                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-300 dark:border-rose-800/40 opacity-70 cursor-default'
                                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95'
                                      }`}
                                    >
                                      {isManuallyRejected ? 'Rejected ✗' : 'Reject'}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Photo Modal */}
          {previewPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative max-w-2xl w-full bg-white dark:bg-ink-900 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">On-Site Evidence Inspection</h3>
                  <button onClick={() => setPreviewPhoto(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="rounded-2xl overflow-hidden max-h-[70vh] bg-black flex items-center justify-center">
                  <img src={previewPhoto} alt="Site preview" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
          )}

          {/* Main Admin Override Modal with Mandatory Reason */}
          {overrideModalAudit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
              <div className="relative max-w-xl w-full bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 shadow-2xl p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-ink-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <RotateCcw size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        Director General Override & Recheck
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Submission #{overrideModalAudit.submission_id} • Project {overrideModalAudit.project_id}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setOverrideModalAudit(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                {/* Sub-Admin verdict summary */}
                {(() => {
                  const sRev = getSubAdminReviewInfo(overrideModalAudit)
                  return (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-950 dark:text-indigo-200">
                          Previous Sub-Admin Verdict:
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sRev?.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {sRev?.status?.toUpperCase() || 'SUB-ADMIN REVIEWED'}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        Inspector: <strong className="text-slate-900 dark:text-white">{sRev?.reviewed_by || 'Field Sub-Admin'}</strong>
                      </p>
                      {sRev?.notes && (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          Notes: "{sRev.notes}"
                        </p>
                      )}
                    </div>
                  )
                })()}

                {overrideError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{overrideError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitOverrideModal} className="space-y-4">
                  {/* Select Final Authoritative Verdict */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Target Authoritative Verdict *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOverrideVerdict('approved')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          overrideVerdict === 'approved'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-ink-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-ink-700'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>Override & Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideVerdict('rejected')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          overrideVerdict === 'rejected'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-ink-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-ink-700'
                        }`}
                      >
                        <AlertTriangle size={14} />
                        <span>Override & Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Mandatory Reason Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        Specific Reason for Override (Mandatory) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Required for audit integrity
                      </span>
                    </div>
                    <textarea
                      required
                      rows={3}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Note down the specific justification for overriding the Sub-Admin verdict (e.g. Cross-verification with satellite SAR telemetry demonstrates concrete deck curing is complete; photographic proof of reinforcing bars verified by structural integrity audit)..."
                      className="w-full text-xs p-3 rounded-2xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed transition-all"
                    />
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Additional Directorate Directives (Optional)
                    </label>
                    <input
                      type="text"
                      value={overrideNotes}
                      onChange={(e) => setOverrideNotes(e.target.value)}
                      placeholder="e.g. Proceed with Package Phase 2 disbursal upon formal filing"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-ink-800 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOverrideModalAudit(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOverride || !overrideReason.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingOverride ? 'Executing Override...' : 'Confirm Authoritative Override'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACCOUNT APPROVALS & DELEGATION (MAIN ADMIN ONLY) */}
      {!isSubAdmin && activeTab === 'approvals' && (
        <div className="space-y-8">
          {/* Notification Banner */}
          {approvalSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{approvalSuccessMsg}</span>
              </div>
              <button onClick={() => setApprovalSuccessMsg(null)} className="text-emerald-600 p-1">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Section 1: Pending Contractor Registrations */}
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Pending Contractor Registrations
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    {pendingContractors.length} Pending
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Contractor companies that registered online and require Main Admin authorization to log in and submit progress telemetry.
                </p>
              </div>

              <button
                onClick={loadApprovalsData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw size={13} className={loadingApprovals ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingApprovals ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <span>Loading pending contractor applications...</span>
              </div>
            ) : pendingContractors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-ink-950 rounded-2xl border border-dashed border-slate-200 dark:border-ink-800">
                No pending contractor registrations requiring review.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingContractors.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 p-5 space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-ink-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          {c.details?.contractor_id || c.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Pending Approval
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {c.details?.company_name || c.name}
                      </h4>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p>Contact: <strong className="text-slate-800 dark:text-slate-200">{c.details?.contact_person || 'N/A'}</strong></p>
                        <p className="truncate">Email: {c.email}</p>
                        {c.phone && <p>Phone: {c.phone}</p>}
                        {c.created_at && (
                          <p className="text-[11px] text-slate-400">
                            Registered: {c.created_at.substring(0, 10)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2">
                      <button
                        onClick={() => handleAccountApproval('contractor', c.id, 'approve')}
                        disabled={approvalActionId === c.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleAccountApproval('contractor', c.id, 'reject')}
                        disabled={approvalActionId === c.id}
                        className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200 dark:border-rose-800 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Pending Sub-Admin Applications */}
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Pending Sub-Admin Applications
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                    {pendingSubAdmins.length} Pending
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Regional quality auditors requesting oversight access. Assign the designated contractor they are authorized to monitor before approving.
                </p>
              </div>
            </div>

            {loadingApprovals ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span>Loading pending sub-admin applications...</span>
              </div>
            ) : pendingSubAdmins.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-ink-950 rounded-2xl border border-dashed border-slate-200 dark:border-ink-800">
                No pending sub-admin applications.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingSubAdmins.map((sa) => (
                  <div
                    key={sa.id}
                    className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10 p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-ink-800 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          @{sa.details?.username || sa.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Sub-Admin Applicant
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {sa.name}
                      </h4>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p>Title: <strong className="text-slate-800 dark:text-slate-200">{sa.details?.title || 'Field Quality Auditor'}</strong></p>
                        <p>Agency: {sa.details?.agency || 'MoSPI Cell'}</p>
                        <p className="truncate">Email: {sa.email}</p>
                      </div>

                      {/* Contractor Assignment for Sub-Admin */}
                      <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                        <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                          Designated Monitored Contractor *
                        </label>
                        <select
                          value={pendingContractorSelections[String(sa.id)] || sa.details?.assigned_contractor_id || (contractors[0]?.contractor_id || 'CNT-LT-01')}
                          onChange={(e) =>
                            setPendingContractorSelections({
                              ...pendingContractorSelections,
                              [String(sa.id)]: e.target.value,
                            })
                          }
                          className="w-full text-xs px-2.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-ink-900 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
                        >
                          {contractors.map((c) => (
                            <option key={c.contractor_id} value={c.contractor_id}>
                              {c.contractor_id} - {c.company_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-2">
                      <button
                        onClick={() => handleAccountApproval('subadmin', sa.id, 'approve')}
                        disabled={approvalActionId === sa.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve & Assign</span>
                      </button>
                      <button
                        onClick={() => handleAccountApproval('subadmin', sa.id, 'reject')}
                        disabled={approvalActionId === sa.id}
                        className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200 dark:border-rose-800 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Sub-Admin Officer Roster & Delegations */}
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-slate-200 dark:border-ink-800 p-6 sm:p-8 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Active Sub-Admin Inspector Roster
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Overview of all approved Sub-Admins and their assigned contractor delegations. The Main Admin can reassign monitored contractors at any time.
              </p>
            </div>

            {subAdminList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-ink-950 rounded-2xl border border-dashed border-slate-200 dark:border-ink-800">
                No active sub-admins currently approved.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-ink-850 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-ink-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Officer Name</th>
                      <th className="px-4 py-3 font-semibold">Username / ID</th>
                      <th className="px-4 py-3 font-semibold">Agency & Title</th>
                      <th className="px-4 py-3 font-semibold">Currently Monitored Contractor</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Reassign Delegation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                    {subAdminList.map((sa) => (
                      <tr key={sa.id} className="hover:bg-slate-50 dark:hover:bg-ink-850/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {sa.full_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                          @{sa.username}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{sa.title || 'Inspector'}</p>
                          <p className="text-[11px] text-slate-400">{sa.agency || 'MoSPI Cell'}</p>
                        </td>
                        <td className="px-4 py-3">
                          {sa.assigned_contractor_id ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                              <HardHat size={12} />
                              {sa.assigned_contractor_id} ({sa.assigned_company_name || 'Contractor'})
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={subAdminContractorSelections[String(sa.id)] || sa.assigned_contractor_id || ''}
                              onChange={(e) =>
                                setSubAdminContractorSelections({
                                  ...subAdminContractorSelections,
                                  [String(sa.id)]: e.target.value,
                                })
                              }
                              className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                            >
                              <option value="">Select Contractor...</option>
                              {contractors.map((c) => (
                                <option key={c.contractor_id} value={c.contractor_id}>
                                  {c.contractor_id} - {c.company_name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleReassignSubAdmin(sa.id)}
                              disabled={approvalActionId === sa.id}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Update
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
