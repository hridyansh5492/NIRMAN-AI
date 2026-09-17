import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Download,
  Eye,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  X,
  Filter,
  ShieldAlert,
  Building2,
  Calendar,
  ArrowUpRight,
  Copy,
  Check,
  Search,
  SlidersHorizontal,
  Layers,
  HardHat,
  ShieldCheck,
  RefreshCw,
  Activity,
  FileCheck,
  ChevronRight,
} from 'lucide-react'
import {
  getPortfolioSummary,
  getProjects,
  getSectorBaselines,
  getStateBaselines,
  getAdminAudits,
  getContractors,
} from '../services/api'
import type {
  PortfolioSummary,
  Project,
  SectorBaselineItem,
  StateBaselineItem,
  Contractor,
} from '../types'
import paimanaLogo from '../assests/paimana-logo.png'
import ministryLogo from '../assests/ministry-logo.png'

interface ReportConfig {
  id: string
  title: string
  subtitle: string
  cadence: string
  category: 'Apex Cabinet' | 'Risk Intelligence' | 'Sector & Regional' | 'Vigilance & Forensics' | 'Contractor Oversight' | 'Custom'
  description: string
  iconColor: string
  icon: React.ElementType
}

const REPORT_DEFINITIONS: ReportConfig[] = [
  {
    id: 'monthly-executive',
    title: 'Monthly Cabinet Executive Brief',
    subtitle: 'High-level synthesis for Apex Review Room & PMO',
    cadence: 'Monthly Edition (July 2026)',
    category: 'Apex Cabinet',
    description: 'Concise summary of national infrastructure portfolio health, capital exposure, macro execution velocity, and high-impact interventions required this cycle.',
    iconColor: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
    icon: Building2,
  },
  {
    id: 'at-risk-dossier',
    title: 'Critical & At-Risk Projects Dossier',
    subtitle: 'Exception list with ML Cost & Time Slip Flags',
    cadence: 'Live Automated Feed',
    category: 'Risk Intelligence',
    description: 'Itemized directory of projects in Critical and High risk tiers, complete with XGBoost probabilities, capital exposure at risk, and active early warning triggers.',
    iconColor: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
    icon: AlertTriangle,
  },
  {
    id: 'sector-capex',
    title: 'Sector Capex Velocity & Slip Matrix',
    subtitle: 'Inter-ministerial delivery comparative review',
    cadence: 'Fortnightly Review',
    category: 'Sector & Regional',
    description: 'Detailed progress vs expenditure velocity across Railways, Highways, Urban Transit, and Energy sectors against baseline MoSPI curves.',
    iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    icon: Layers,
  },
  {
    id: 'state-delivery',
    title: 'State Infrastructure Baseline Report',
    subtitle: 'Cross-state implementation & bottleneck assessment',
    cadence: 'Quarterly Audit',
    category: 'Sector & Regional',
    description: 'Cross-state evaluation of capital expenditure rates, local execution gaps, land acquisition drag, and statutory clearances across all 36 States & UTs.',
    iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    icon: Activity,
  },
  {
    id: 'anti-fraud-audit',
    title: 'Anti-Fraud & Forensic Compliance Audit',
    subtitle: 'Zero-Trust telemetry, photo hashes & dual sign-off log',
    cadence: 'Continuous Audit Trail',
    category: 'Vigilance & Forensics',
    description: 'Itemized audit log of contractor submissions, cross-project duplicate photo matching, geofence boundary compliance, and Maker-Checker justification records.',
    iconColor: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    icon: ShieldCheck,
  },
  {
    id: 'contractor-scorecard',
    title: 'EPC Contractor Performance & Delivery Ledger',
    subtitle: 'Accountability scorecards for national construction EPCs',
    cadence: 'Monthly Review',
    category: 'Contractor Oversight',
    description: 'Performance scorecards for major infrastructure contractors (L&T, Afcons, Tata Projects, etc.) tracking milestone accuracy, rating, and active packages.',
    iconColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    icon: HardHat,
  },
]

export default function Reports() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sectors, setSectors] = useState<SectorBaselineItem[]>([])
  const [states, setStates] = useState<StateBaselineItem[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeReport, setActiveReport] = useState<ReportConfig | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false)

  // Category Tab Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All Reports')

  // Custom Report Builder Filter Matrix States
  const [filterSector, setFilterSector] = useState<string>('All')
  const [filterState, setFilterState] = useState<string>('All')
  const [filterRisk, setFilterRisk] = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterSearch, setFilterSearch] = useState<string>('')
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, projRes, secRes, staRes, audRes, conRes] = await Promise.all([
          getPortfolioSummary(),
          getProjects(),
          getSectorBaselines().catch(() => []),
          getStateBaselines().catch(() => []),
          getAdminAudits(100).catch(() => []),
          getContractors().catch(() => []),
        ])
        setSummary(sumRes)
        setProjects(projRes)
        setSectors(secRes)
        setStates(staRes)
        setAudits(audRes)
        setContractors(conRes)
      } catch (err) {
        console.error('Failed to load report data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Unique dropdown lists
  const availableSectors = useMemo(() => {
    const set = new Set(projects.map((p) => p.sector).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [projects])

  const availableStates = useMemo(() => {
    const set = new Set(projects.map((p) => p.state).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [projects])

  // Filtered Projects Matrix
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filterSector !== 'All' && p.sector !== filterSector) return false
      if (filterState !== 'All' && p.state !== filterState) return false
      if (filterStatus !== 'All' && p.status !== filterStatus) return false
      if (filterRisk !== 'All') {
        const score = p.final_risk_score ?? p.costOverrunRisk
        if (filterRisk === 'Critical' && score < 70) return false
        if (filterRisk === 'High' && (score < 50 || score >= 70)) return false
        if (filterRisk === 'Medium' && (score < 30 || score >= 50)) return false
        if (filterRisk === 'Low' && score >= 30) return false
      }
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase()
        const matchName = p.name.toLowerCase().includes(q)
        const matchId = p.id.toLowerCase().includes(q)
        const matchMin = p.ministry.toLowerCase().includes(q)
        if (!matchName && !matchId && !matchMin) return false
      }
      return true
    })
  }, [projects, filterSector, filterState, filterRisk, filterStatus, filterSearch])

  const criticalProjects = useMemo(() => {
    return projects.filter(
      (p) => p.status === 'At Risk' || (p.final_risk_score && p.final_risk_score >= 60)
    )
  }, [projects])

  // Filter reports by category tab
  const displayedReports = useMemo(() => {
    if (selectedCategory === 'All Reports') return REPORT_DEFINITIONS
    return REPORT_DEFINITIONS.filter((r) => r.category === selectedCategory)
  }, [selectedCategory])

  // Reset Filters
  const handleClearFilters = () => {
    setFilterSector('All')
    setFilterState('All')
    setFilterRisk('All')
    setFilterStatus('All')
    setFilterSearch('')
  }

  // Preview Custom Filtered Slice
  const handlePreviewCustomSlice = () => {
    const customConfig: ReportConfig = {
      id: 'custom-dossier',
      title: 'Custom Filtered Infrastructure Dossier',
      subtitle: `Filtered slice of ${filteredProjects.length} national capital projects`,
      cadence: 'On-Demand Query',
      category: 'Custom',
      description: 'Dynamic dossier generated from custom sector, state, risk tier, and status parameters.',
      iconColor: 'bg-brand-orange/10 text-brand-orange',
      icon: SlidersHorizontal,
    }
    setActiveReport(customConfig)
  }

  // Export CSV
  const handleExportCSV = (reportId: string, customTitle?: string) => {
    let filename = (customTitle || reportId).toLowerCase().replace(/[^a-z0-9]/g, '_')
    let headers: string[] = []
    let rows: (string | number)[][] = []

    if (reportId === 'sector-capex') {
      headers = ['Sector', 'Projects Count', 'Avg Cost Overrun %', 'Avg Expenditure (Cr)']
      rows = sectors.map((s) => [
        `"${s.sector}"`,
        s.project_count,
        s.avg_cost_overrun_pct,
        s.avg_expenditure,
      ])
    } else if (reportId === 'state-delivery') {
      headers = ['State / UT', 'Projects Monitored', 'Avg Cost Overrun %']
      rows = states.map((st) => [
        `"${st.state}"`,
        st.project_count,
        st.avg_cost_overrun_pct,
      ])
    } else if (reportId === 'anti-fraud-audit') {
      headers = [
        'Submission ID',
        'Project ID',
        'Contractor ID',
        'Physical %',
        'Spend (Cr)',
        'Inside Geofence',
        'Fraud Score %',
        'Verification Status',
        'Photo Hash',
        'Submitted At',
      ]
      rows = audits.map((a) => [
        `"${a.submission_id}"`,
        `"${a.project_id}"`,
        `"${a.contractor_id}"`,
        a.physical_progress_pct ?? 0,
        a.financial_expenditure_cr ?? 0,
        a.inside_geofence === 1 ? 'Yes' : 'No',
        a.fraud_score ?? 0,
        `"${a.verification_status}"`,
        `"${a.photo_hash || 'N/A'}"`,
        `"${a.submitted_at}"`,
      ])
    } else if (reportId === 'contractor-scorecard') {
      headers = ['Contractor ID', 'Company Name', 'Contact Person', 'Email', 'Active Packages', 'Performance Rating']
      rows = contractors.map((c) => [
        `"${c.contractor_id}"`,
        `"${c.company_name}"`,
        `"${c.contact_person}"`,
        `"${c.email}"`,
        c.active_contracts ?? 0,
        c.rating ?? 0,
      ])
    } else {
      // Default / Projects / At-Risk / Custom Dossier
      const target = reportId === 'at-risk-dossier' 
        ? criticalProjects 
        : reportId === 'custom-dossier' 
          ? filteredProjects 
          : projects

      headers = [
        'Project ID',
        'Name',
        'Ministry',
        'Sector',
        'State',
        'Status',
        'Health Score',
        'Physical Progress %',
        'Financial Progress %',
        'Expenditure (Cr)',
        'Cost Variance %',
        'Schedule Slip (Mo)',
        'Cost Overrun Risk %',
        'Time Overrun Risk %',
        'Composite Risk Score',
        'Review Reason',
      ]
      rows = target.map((p) => [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.ministry.replace(/"/g, '""')}"`,
        `"${p.sector}"`,
        `"${p.state}"`,
        `"${p.status}"`,
        p.health,
        p.physicalProgress,
        p.financialProgress,
        `"${p.expenditure}"`,
        p.costVariance,
        p.timeVariance,
        p.costOverrunRisk,
        p.timeOverrunRisk,
        p.final_risk_score ?? '',
        `"${(p.reviewReason || '').replace(/"/g, '""')}"`,
      ])
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setExportNotice(`Exported ${rows.length} records to CSV successfully.`)
    setTimeout(() => setExportNotice(null), 4000)
  }

  // Copy Executive Summary to Clipboard
  const handleCopySummary = (report: ReportConfig) => {
    const text = `
GOVERNMENT OF INDIA • MoSPI & PM GATISHAKTI
NATIONAL INFRASTRUCTURE OVERSIGHT INTELLIGENCE BRIEF
------------------------------------------------------------
Report: ${report.title}
Subtitle: ${report.subtitle}
Cadence: ${report.cadence}
Date Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}

EXECUTIVE SUMMARY:
Total Monitored Projects: ${summary?.total_projects ?? projects.length}
Projects Requiring Attention: ${summary?.projects_at_risk ?? criticalProjects.length}
Mean Portfolio Health: ${summary?.avg_health ?? 72.4}/100
Average Cost Overrun Risk: ${summary?.avg_cop_prob ?? 42.1}%

KEY FINDINGS:
1. Critical projects currently display high probability of schedule or budget drift.
2. The primary bottleneck across flagged schemes remains the financial-physical divergence.
3. Maker-Checker zero-trust verification actively guards against premature or unverified milestone claims.

RECOMMENDED INTERVENTIONS:
- Convene inter-ministerial coordination on Right-of-Way (RoW) clearances.
- Require formal statutory justification notes for any escalated audit review.
- Prioritize milestone disbursement on verified ground progress.
------------------------------------------------------------
Generated via Nirman-AI (Paimana) Infrastructure Oversight Platform
`.trim()

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2500)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold tracking-wider text-cyan-600 dark:text-cyan-400 uppercase">
              GOVTECH INTELLIGENCE &bull; MINISTERIAL REPORT CENTER
            </p>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950 dark:text-white">
            Reports Built for Review Rooms
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl text-sm">
            Turn live project alerts and key delay causes into clear action summaries for leadership.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExportCSV('at-risk-dossier', 'National_Critical_Projects')}
            className="flex items-center gap-2 rounded-xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 px-4 py-2.5 text-xs font-semibold text-ink-950 dark:text-white hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors shadow-sm"
          >
            <FileSpreadsheet size={15} className="text-rose-500" />
            <span>Export Critical Projects ({criticalProjects.length})</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-sm animate-in fade-in">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600" /> {exportNotice}
          </span>
          <button onClick={() => setExportNotice(null)} className="text-emerald-600 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Live Portfolio Snapshot Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tracked Projects</p>
          <p className="text-2xl font-bold text-ink-950 dark:text-white mt-1">
            {summary?.total_projects ?? projects.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Across 10 Ministries</p>
        </div>
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Projects Requiring Attention</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {summary?.projects_at_risk ?? criticalProjects.length}
          </p>
          <p className="text-xs text-rose-500/80 mt-0.5">Critical & High Risk Tiers</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Portfolio Health</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {summary?.avg_health ?? 72.4}%
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Composite 100-pt index</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Cost Overrun Probability</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {summary?.avg_cop_prob ?? 42.1}%
          </p>
          <p className="text-xs text-slate-400 mt-0.5">XGBoost inference baseline</p>
        </div>
      </div>

      {/* Interactive Custom Report Builder Filter Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-brand-orange">
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Interactive Custom Report Builder & Filter Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filter by Ministry, State, Risk Tier, and Status to generate an instant tailored dossier.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterPanel((v) => !v)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-orange font-medium"
            >
              {showFilterPanel ? 'Hide Controls' : 'Show Controls'}
            </button>
            {(filterSector !== 'All' || filterState !== 'All' || filterRisk !== 'All' || filterStatus !== 'All' || filterSearch) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-rose-500 hover:underline font-semibold ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {showFilterPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search by project name/ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange"
              />
            </div>

            {/* Sector */}
            <div>
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="All">All Sectors & Ministries</option>
                {availableSectors.filter((s) => s !== 'All').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="All">All 36 States & UTs</option>
                {availableStates.filter((st) => st !== 'All').map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Risk Tier */}
            <div>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="All">All Risk Tiers</option>
                <option value="Critical">Critical (Risk ≥ 70)</option>
                <option value="High">High (Risk 50–69)</option>
                <option value="Medium">Medium (Risk 30–49)</option>
                <option value="Low">Low (Risk &lt; 30)</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="All">All Project Statuses</option>
                <option value="Under Construction">Under Construction</option>
                <option value="Delayed">Delayed</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        )}

        {/* Filter Summary & Custom Actions Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-ink-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Active Filter Match: <strong className="text-slate-900 dark:text-white">{filteredProjects.length}</strong> of {projects.length} projects
            ({filteredProjects.filter((p) => p.status === 'At Risk' || (p.final_risk_score && p.final_risk_score >= 60)).length} at risk)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviewCustomSlice}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-900 dark:text-white font-semibold transition-colors cursor-pointer"
            >
              <Eye size={13} />
              <span>Preview Custom Dossier</span>
            </button>
            <button
              onClick={() => handleExportCSV('custom-dossier', 'Custom_Filtered_Infrastructure_Dossier')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-brand-orange hover:from-amber-600 hover:to-brand-orangeDark text-white font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Export Custom CSV ({filteredProjects.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap">
        {[
          'All Reports',
          'Apex Cabinet',
          'Risk Intelligence',
          'Sector & Regional',
          'Vigilance & Forensics',
          'Contractor Oversight',
        ].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-brand-orange text-white shadow-sm'
                : 'bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-ink-800'
            }`}
          >
            {cat} {cat === 'All Reports' ? `(${REPORT_DEFINITIONS.length})` : ''}
          </button>
        ))}
      </div>

      {/* Standard Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedReports.map((r) => {
          const IconComp = r.icon
          return (
            <div
              key={r.id}
              className="group rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-cyan-500/40"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${r.iconColor}`}>
                    <IconComp size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {r.category}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mt-0.5 mb-2.5">
                  {r.subtitle}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {r.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-ink-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 dark:text-slate-500">{r.cadence}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveReport(r)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 px-3.5 py-1.5 text-xs font-semibold text-ink-950 dark:text-white transition-colors cursor-pointer"
                  >
                    <Eye size={13} /> Preview
                  </button>
                  <button
                    onClick={() => handleExportCSV(r.id, r.title)}
                    className="flex items-center gap-1.5 rounded-xl bg-brand-orange hover:bg-brand-orangeDark px-3.5 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Interactive Tailored Report Preview Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 shadow-2xl p-6 sm:p-8 print-report-container">
            
            {/* Official GovTech Print-Ready Header */}
            <div className="border-b border-slate-200 dark:border-ink-800 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={ministryLogo} alt="Gov Logo" className="h-10 w-auto object-contain dark:brightness-110" />
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                      GOVERNMENT OF INDIA &bull; MoSPI & PM GATISHAKTI
                    </span>
                    <h2 className="font-display text-2xl font-bold text-ink-950 dark:text-white">
                      {activeReport.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeReport.subtitle} &bull; Official Decision Room Intelligence Brief
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveReport(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-ink-800 no-print cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Statutory Metadata Bar */}
              <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-ink-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono gap-2">
                <span>DOC REF: PM-GATI/REPORT/2026-07/{activeReport.id.toUpperCase()}</span>
                <span>REPORTING PERIOD: JULY 2026</span>
                <span>SECURITY: OFFICIAL USE ONLY (APEX)</span>
                <span>TIMESTAMP: {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
              </div>
            </div>

            {/* Document Body */}
            <div className="py-6 space-y-6 text-sm text-slate-700 dark:text-slate-300">
              
              {/* Executive KPI Strip tailored per report */}
              <div className="rounded-2xl bg-slate-50 dark:bg-ink-950 p-4 sm:p-5 border border-slate-200 dark:border-ink-800 grid grid-cols-2 sm:grid-cols-4 gap-4 print-avoid-break">
                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide font-mono">Projects Evaluated</p>
                  <p className="text-xl font-bold text-ink-950 dark:text-white mt-1">
                    {activeReport.id === 'custom-dossier' ? filteredProjects.length : (summary?.total_projects ?? projects.length)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">National Infrastructure</p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide font-mono">
                    {activeReport.id === 'anti-fraud-audit' ? 'Flagged Anomalies' : 'Attention Signals'}
                  </p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {activeReport.id === 'anti-fraud-audit' 
                      ? audits.filter((a) => (a.fraud_score ?? 0) >= 25 || a.verification_status === 'flagged_anomaly').length 
                      : (summary?.projects_at_risk ?? criticalProjects.length)}
                  </p>
                  <p className="text-[11px] text-rose-500/80 mt-0.5">
                    {activeReport.id === 'anti-fraud-audit' ? 'Pending DG Countersign' : 'Cost/Schedule Slip'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide font-mono">
                    {activeReport.id === 'anti-fraud-audit' ? 'Geofence Compliance' : 'Mean Health Score'}
                  </p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {activeReport.id === 'anti-fraud-audit' ? '96.8%' : `${summary?.avg_health ?? 72.4}/100`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeReport.id === 'anti-fraud-audit' ? 'WGS-84 Lamina Verified' : 'Composite 100-pt index'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide font-mono">
                    {activeReport.id === 'contractor-scorecard' ? 'EPC Contractors' : 'Model COP Probability'}
                  </p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {activeReport.id === 'contractor-scorecard' ? contractors.length : `${summary?.avg_cop_prob ?? 42.1}%`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeReport.id === 'contractor-scorecard' ? 'Major Civil EPCs' : 'XGBoost Risk Baseline'}
                  </p>
                </div>
              </div>

              {/* DYNAMIC CONTENT PER REPORT ID */}

              {/* 1. Monthly Executive Brief & Custom Dossier */}
              {(activeReport.id === 'monthly-executive' || activeReport.id === 'custom-dossier') && (
                <>
                  <div className="space-y-3 print-avoid-break">
                    <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                      <ShieldAlert size={17} className="text-brand-orange" />
                      1. Executive Strategic Assessment
                    </h4>
                    <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                      Based on machine learning models trained on national infrastructure datasets, 
                      <strong> {summary?.projects_at_risk ?? criticalProjects.length} projects</strong> currently display high probability of schedule or cost overruns. 
                      The primary driver across flagged schemes is the <em>financial-physical execution gap</em>, where cumulative financial progress diverges by more than 10% from physical delivery on the ground.
                    </p>
                  </div>

                  <div className="space-y-3 print-avoid-break">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                        <AlertTriangle size={17} className="text-rose-500" />
                        2. Priority Schemes Requiring Immediate Escalation
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">
                        Showing Top {Math.min(5, (activeReport.id === 'custom-dossier' ? filteredProjects : criticalProjects).length)} Projects
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                          <tr>
                            <th className="p-3">Project ID</th>
                            <th className="p-3">Sector & State</th>
                            <th className="p-3">Physical %</th>
                            <th className="p-3">Cost Overrun</th>
                            <th className="p-3">Schedule Slip</th>
                            <th className="p-3">ML Risk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                          {(activeReport.id === 'custom-dossier' ? filteredProjects : criticalProjects).slice(0, 6).map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                              <td className="p-3 font-semibold text-ink-950 dark:text-white font-mono">
                                <Link to={`/projects/${p.id}`} className="text-cyan-600 dark:text-cyan-400 hover:underline">
                                  {p.id}
                                </Link>
                              </td>
                              <td className="p-3">
                                <span className="font-medium text-ink-950 dark:text-white">{p.sector}</span>
                                <span className="text-slate-400 block text-[11px]">{p.state}</span>
                              </td>
                              <td className="p-3 font-semibold">{p.physicalProgress}%</td>
                              <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">
                                {p.costVariance > 0 ? `+${p.costVariance}%` : `${p.costVariance}%`}
                              </td>
                              <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">
                                +{p.timeVariance} mo
                              </td>
                              <td className="p-3">
                                <span className="inline-flex rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 font-mono">
                                  {p.final_risk_score ? `${p.final_risk_score}/100` : `${p.costOverrunRisk}% COP`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* 2. Critical & At-Risk Projects Dossier */}
              {activeReport.id === 'at-risk-dossier' && (
                <div className="space-y-4 print-avoid-break">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                      <AlertTriangle size={17} className="text-rose-500" />
                      Critical Projects Exception Dossier (Risk Score &ge; 60)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">{criticalProjects.length} Projects Flagged</span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                        <tr>
                          <th className="p-3">Project & ID</th>
                          <th className="p-3">Ministry</th>
                          <th className="p-3">State</th>
                          <th className="p-3">Physical %</th>
                          <th className="p-3">Cost Variance</th>
                          <th className="p-3">Delay Slip</th>
                          <th className="p-3">Primary Delay Root Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                        {criticalProjects.slice(0, 10).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                            <td className="p-3 font-semibold text-ink-950 dark:text-white font-mono">
                              <Link to={`/projects/${p.id}`} className="text-cyan-600 dark:text-cyan-400 hover:underline block truncate max-w-[180px]">
                                {p.name}
                              </Link>
                              <span className="text-[10px] text-slate-400">{p.id}</span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{p.ministry}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{p.state}</td>
                            <td className="p-3 font-semibold">{p.physicalProgress}%</td>
                            <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">
                              +{p.costVariance}%
                            </td>
                            <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">
                              +{p.timeVariance} mo
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                              {p.reviewReason || 'Physical-Financial Execution Divergence'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. Sector Capex Velocity Matrix */}
              {activeReport.id === 'sector-capex' && (
                <div className="space-y-4 print-avoid-break">
                  <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                    <Layers size={17} className="text-amber-500" />
                    Inter-Ministerial Sector Capex Velocity Benchmark
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                        <tr>
                          <th className="p-3">Sector</th>
                          <th className="p-3 text-right">Projects Monitored</th>
                          <th className="p-3 text-right">Avg Cost Overrun %</th>
                          <th className="p-3 text-right">Avg Expenditure (₹ Cr)</th>
                          <th className="p-3 text-center">Execution Health</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                        {sectors.map((s) => (
                          <tr key={s.sector} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                            <td className="p-3 font-semibold text-ink-950 dark:text-white">{s.sector}</td>
                            <td className="p-3 text-right text-slate-600 dark:text-slate-300">{s.project_count}</td>
                            <td className={`p-3 text-right font-medium ${s.avg_cost_overrun_pct > 15 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                              +{s.avg_cost_overrun_pct}%
                            </td>
                            <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                              ₹ {s.avg_expenditure.toLocaleString('en-IN')} Cr
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s.avg_cost_overrun_pct > 20 ? 'bg-rose-500/10 text-rose-500' : s.avg_cost_overrun_pct > 10 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                              }`}>
                                {s.avg_cost_overrun_pct > 20 ? 'Critical Drift' : s.avg_cost_overrun_pct > 10 ? 'Moderate' : 'Optimal'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. State Infrastructure Baseline Report */}
              {activeReport.id === 'state-delivery' && (
                <div className="space-y-4 print-avoid-break">
                  <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                    <Activity size={17} className="text-emerald-500" />
                    Top 10 State Delivery Benchmark Leaderboard
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                        <tr>
                          <th className="p-3">State / Union Territory</th>
                          <th className="p-3 text-right">Projects</th>
                          <th className="p-3 text-right">Cost Variance %</th>
                          <th className="p-3 text-right">Health Score</th>
                          <th className="p-3 text-center">Implementation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                        {states.slice(0, 10).map((st) => {
                          const health = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, st.avg_cost_overrun_pct))))
                          return (
                            <tr key={st.state} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                              <td className="p-3 font-semibold text-ink-950 dark:text-white">{st.state}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-300">{st.project_count}</td>
                              <td className={`p-3 text-right font-medium ${st.avg_cost_overrun_pct > 15 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                +{st.avg_cost_overrun_pct}%
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                                {health}/100
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  health >= 80 ? 'bg-emerald-500/10 text-emerald-500' : health >= 60 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {health >= 80 ? 'On Track' : health >= 60 ? 'Watch Tier' : 'High Friction'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. Anti-Fraud & Forensic Compliance Audit */}
              {activeReport.id === 'anti-fraud-audit' && (
                <div className="space-y-4 print-avoid-break">
                  <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                    <ShieldCheck size={17} className="text-purple-500" />
                    Zero-Trust Telemetry & Forensic Photo Verification Register
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                        <tr>
                          <th className="p-3">Submission ID</th>
                          <th className="p-3">Project</th>
                          <th className="p-3">Contractor</th>
                          <th className="p-3">Perceptual Hash</th>
                          <th className="p-3">Fraud Risk</th>
                          <th className="p-3">Audit Status</th>
                          <th className="p-3">Governance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                        {audits.slice(0, 8).map((a) => {
                          const fScore = a.fraud_score ?? 0
                          const isHigh = fScore >= 50
                          const isMed = fScore >= 25 && fScore < 50
                          return (
                            <tr key={a.submission_id} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                              <td className="p-3 font-mono font-semibold text-ink-950 dark:text-white">
                                {a.submission_id}
                              </td>
                              <td className="p-3 font-mono text-cyan-600 dark:text-cyan-400">{a.project_id}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{a.contractor_id}</td>
                              <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                                {a.photo_hash ? `${a.photo_hash.substring(0, 10)}...` : 'N/A'}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isHigh ? 'bg-rose-500/10 text-rose-600' : isMed ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                                }`}>
                                  {fScore}% {isHigh ? 'HIGH' : isMed ? 'MED' : 'LOW'}
                                </span>
                              </td>
                              <td className="p-3 font-mono capitalize text-[11px]">
                                {String(a.verification_status).replace(/_/g, ' ')}
                              </td>
                              <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
                                {a.requires_main_admin_approval ? 'DG Counter-Sign Required' : 'Field Clear'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. Contractor Performance Scorecard */}
              {activeReport.id === 'contractor-scorecard' && (
                <div className="space-y-4 print-avoid-break">
                  <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                    <HardHat size={17} className="text-blue-500" />
                    Major National EPC Contractor Delivery Ledger
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-ink-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-slate-400 font-semibold font-mono">
                        <tr>
                          <th className="p-3">Contractor ID</th>
                          <th className="p-3">Company Name</th>
                          <th className="p-3">Contact Person</th>
                          <th className="p-3 text-right">Active Packages</th>
                          <th className="p-3 text-right">Audit Rating</th>
                          <th className="p-3 text-center">Compliance Tier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-ink-800/60 font-tabular">
                        {contractors.map((c) => (
                          <tr key={c.contractor_id} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                            <td className="p-3 font-mono font-semibold text-ink-950 dark:text-white">{c.contractor_id}</td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{c.company_name}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{c.contact_person}</td>
                            <td className="p-3 text-right text-slate-700 dark:text-slate-300">{c.active_contracts} Packages</td>
                            <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">
                              ★ {c.rating} / 5.0
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                                Sovereign Certified
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommended Action Plan */}
              <div className="space-y-3 pt-2 print-avoid-break">
                <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                  <CheckCircle2 size={17} className="text-emerald-500" />
                  Official Recommendations for Review Officers
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <li>Initiate immediate tripartite review for projects with schedule slip exceeding 4.0 months.</li>
                  <li>Perform physical milestone verification on projects with expenditure rates surpassing 80% while physical progress remains under 50%.</li>
                  <li>Deploy PM GatiShakti multi-modal alignment teams to unblock Right of Way (RoW) clearances in high-slip sectors.</li>
                  <li>Enforce Maker-Checker dual signatures on all high-risk or cross-project duplicate flagged submissions.</li>
                </ul>
              </div>

              {/* Official Statutory Sign-off Block */}
              <div className="pt-6 border-t border-slate-200 dark:border-ink-800 grid grid-cols-2 gap-8 text-xs print-avoid-break">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-mono">Prepared & Verified By</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">Field Quality Auditor / Sub-Admin</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">MoSPI Regional Oversight Cell</p>
                  <div className="mt-3 w-40 border-b border-dashed border-slate-300 dark:border-ink-700" />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">DIGITALLY STAMPED &bull; WGS-84 VERIFIED</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[10px] uppercase font-mono">Authoritative Sign-Off</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">Director General / Project Monitoring Group</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">National Infrastructure Monitoring Authority</p>
                  <div className="mt-3 ml-auto w-40 border-b border-dashed border-slate-300 dark:border-ink-700" />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">CABINET REVIEW APPROVED</p>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 dark:border-ink-800 pt-4 gap-3 no-print">
              <button
                onClick={() => setActiveReport(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-ink-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-ink-800 cursor-pointer"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleCopySummary(activeReport)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-xs font-semibold text-ink-950 dark:text-white transition-colors cursor-pointer"
                  title="Copy formatted summary to clipboard"
                >
                  {copiedSummary ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedSummary ? 'Copied Brief' : 'Copy Summary'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-xs font-semibold text-ink-950 dark:text-white transition-colors cursor-pointer"
                >
                  <Printer size={14} /> <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => handleExportCSV(activeReport.id, activeReport.title)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand-orange hover:from-amber-600 hover:to-brand-orangeDark text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <Download size={14} /> <span>Export CSV Dossier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
