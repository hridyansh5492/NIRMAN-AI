import { useState, useEffect, useMemo } from 'react'
import {
  Target,
  TrendingUp,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Cpu,
  RotateCw,
  ExternalLink,
  Layers,
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getPortfolioSummary,
  getWarnings,
  getAINarrative,
  getPortfolioAINarrative,
  type AINarrative,
  type PortfolioAINarrative,
} from '../services/api'
import type { PortfolioSummary, EarlyWarning, Project } from '../types'
import RadialGauge from '../components/RadialGauge'

export default function Intelligence() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [warnings, setWarnings] = useState<EarlyWarning[]>([])
  const [loading, setLoading] = useState(true)

  // GAS state (OpenRouter Portfolio Analytical Summary)
  const [gasNarrative, setGasNarrative] = useState<PortfolioAINarrative | null>(null)
  const [loadingGas, setLoadingGas] = useState(false)

  // AI PI state (Project Intelligence: Models + OpenRouter)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectNarrative, setProjectNarrative] = useState<AINarrative | null>(null)
  const [loadingProjectNarrative, setLoadingProjectNarrative] = useState(false)

  const fetchGas = (refresh = false) => {
    setLoadingGas(true)
    getPortfolioAINarrative(refresh)
      .then((data) => setGasNarrative(data))
      .catch((err) => console.warn('Failed to fetch portfolio analytical summary', err))
      .finally(() => setLoadingGas(false))
  }

  useEffect(() => {
    fetchGas(false)
  }, [])

  useEffect(() => {
    Promise.all([getPortfolioSummary(), getWarnings(10)])
      .then(([sum, warn]) => {
        setSummary(sum)
        setWarnings(warn)
        if (sum?.top_risk_projects && sum.top_risk_projects.length > 0) {
          setSelectedProjectId(sum.top_risk_projects[0].id)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.warn('Failed to load intelligence metrics', err)
        setLoading(false)
      })
  }, [])

  // Find selected project for AI PI
  const selectedProject = useMemo(() => {
    if (!summary?.top_risk_projects) return null
    return (
      summary.top_risk_projects.find((p) => p.id === selectedProjectId) ||
      summary.top_risk_projects[0] ||
      null
    )
  }, [summary, selectedProjectId])

  // Fetch AI PI OpenRouter narrative when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return
    let active = true
    setLoadingProjectNarrative(true)
    getAINarrative(selectedProjectId)
      .then((data) => {
        if (active) setProjectNarrative(data)
      })
      .catch((err) => console.warn('Failed to load project AI brief', err))
      .finally(() => {
        if (active) setLoadingProjectNarrative(false)
      })
    return () => {
      active = false
    }
  }, [selectedProjectId])

  const total = summary?.total_projects ?? 317
  const atRisk = summary?.projects_at_risk ?? 73
  const avgHealth = summary?.avg_health ?? 63.7
  const avgCop = summary?.avg_cop_prob ?? 35.1
  const avgTop = summary?.avg_top_prob ?? 60.5

  const healthBreakdown = useMemo(() => {
    const low = summary?.low_count ?? 202
    const med = summary?.medium_count ?? 42
    const high = summary?.high_count ?? 72
    const crit = summary?.critical_count ?? 1
    const tot = total || 1
    return [
      { label: 'On Track', pct: Math.round((low / tot) * 100), count: low, color: '#10b981' },
      { label: 'Watch', pct: Math.round((med / tot) * 100), count: med, color: '#f59e0b' },
      { label: 'At Risk', pct: Math.round((high / tot) * 100), count: high, color: '#f97316' },
      { label: 'Critical', pct: Math.max(1, Math.round((crit / tot) * 100)), count: crit, color: '#ef4444' },
    ]
  }, [summary, total])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-2">INTELLIGENCE LAYER</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950 dark:text-white">From Data to Decisions</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
          Unified synthesis of machine-learning models, OpenRouter natural-language narratives, and telemetry early warnings.
        </p>
      </div>

      {/* Model Detection Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 mb-4">
              <Target size={18} />
            </span>
            <p className="text-xs font-semibold tracking-wide text-slate-400 mb-1">DETECT (ML RISK ENGINE)</p>
            <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{atRisk}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Flagged at-risk schemes (out of {total} total)
            </p>
          </div>
          <p className="mt-4 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5 leading-snug">
            Identifies infrastructure projects crossing combined risk thresholds.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 mb-4">
              <TrendingUp size={18} />
            </span>
            <p className="text-xs font-semibold tracking-wide text-red-500 dark:text-red-400 mb-1">TOP RISK</p>
            <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{avgTop}%</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">National average time-slip probability</p>
          </div>
          <p className="mt-4 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5 leading-snug">
            <strong className="font-semibold text-slate-700 dark:text-slate-300">TOP:</strong> Predicts the probability of project completion delays past the scheduled deadline.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500 mb-4">
              <Lightbulb size={18} />
            </span>
            <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">COP RISK</p>
            <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{avgCop}%</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Average cost-overrun probability</p>
          </div>
          <p className="mt-4 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5 leading-snug">
            <strong className="font-semibold text-slate-700 dark:text-slate-300">COP:</strong> Predicts the probability of total project costs exceeding the sanctioned budget.
          </p>
        </div>
      </div>

      {/* TIER 1: COMPOSITE INTELLIGENCE (CI) - Directly from ML Models */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-cyan-500" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Composite Intelligence (CI) — Model Telemetry
            </h2>
          </div>
          <span className="rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/50 dark:border-cyan-800/50 px-3 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
            Live Model Scoring (XGBoost + Random Forest)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 flex items-center gap-6">
            <RadialGauge value={avgHealth} />
            <div>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">National Health Index</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-display mt-0.5">
                {avgHealth} <span className="text-sm text-slate-400">/ 100</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Composite evaluation across physical velocity, financial gap, and slip models.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Portfolio Tier Distribution (from Risk Classifier):
            </p>
            {healthBreakdown.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-20">{h.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${h.pct}%`, backgroundColor: h.color }} />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-12 text-right">{h.pct}%</span>
                <span className="text-[11px] text-slate-400 w-12 text-right">({h.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TIER 2: GENERATED ANALYTICAL SUMMARY (GAS) - OpenRouter Executive Synthesis */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-ink-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Generated Analytical Summary (GAS) — Portfolio Overview
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {gasNarrative?.available && gasNarrative.source === 'openrouter' && (
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                OpenRouter · {gasNarrative.model}
              </span>
            )}
            <button
              onClick={() => fetchGas(true)}
              disabled={loadingGas}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={12} className={loadingGas ? 'animate-spin text-cyan-500' : ''} />
              <span>Regenerate Summary</span>
            </button>
          </div>
        </div>

        {loadingGas ? (
          <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <RotateCw size={16} className="animate-spin text-brand-orange" />
            <span>Generating national portfolio synthesis via OpenRouter...</span>
          </div>
        ) : (
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base font-medium">
            "{gasNarrative?.narrative || 'The national infrastructure portfolio is currently tracking at an average health index of 63.7/100. Analysis of the latest reporting cycle reveals elevated cost and schedule volatility in transport and water schemes.'}"
          </p>
        )}

        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800">
            <p className="text-[10px] text-slate-400 uppercase">Monitored Schemes</p>
            <p className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {gasNarrative?.metrics_used?.total_projects || total}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800">
            <p className="text-[10px] text-slate-400 uppercase">At-Risk Count</p>
            <p className="font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
              {gasNarrative?.metrics_used?.projects_at_risk || atRisk}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800">
            <p className="text-[10px] text-slate-400 uppercase">COP Overrun Avg</p>
            <p className="font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {gasNarrative?.metrics_used?.avg_cop || avgCop}%
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800">
            <p className="text-[10px] text-slate-400 uppercase">TOP Slip Avg</p>
            <p className="font-bold text-red-600 dark:text-red-400 font-mono mt-0.5">
              {gasNarrative?.metrics_used?.avg_top || avgTop}%
            </p>
          </div>
        </div>
      </div>

      {/* TIER 3: AI PROJECT INTELLIGENCE (AI PI) - Models + OpenRouter Deep Dive */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-ink-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-cyan-500" />
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                AI Project Intelligence (AI PI) — Deep Dive
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select any project to inspect live ML model risk outputs and generated OpenRouter executive analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inspect Project:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-800 dark:text-slate-200 font-semibold outline-none focus:border-cyan-500 cursor-pointer"
            >
              {(summary?.top_risk_projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.sector} ({p.state}) — {p.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProject && (
          <div className="space-y-5">
            {/* Project Header Info */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                  {selectedProject.name || `${selectedProject.state} ${selectedProject.sector} Project (${selectedProject.id})`}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedProject.ministry} • {selectedProject.sector} • {selectedProject.state}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedProject.status === 'At Risk'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      : selectedProject.status === 'Watch'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {selectedProject.status}
                </span>
                <Link
                  to={`/projects/${selectedProject.id}`}
                  className="px-3 py-1 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <span>Project Page</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>

            {/* Model Outputs Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400 block">COP Risk</span>
                  <p className="font-display text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {selectedProject.costOverrunRisk}%
                  </p>
                  <div className="h-1 rounded-full bg-slate-200 dark:bg-ink-800 mt-2">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${selectedProject.costOverrunRisk}%` }} />
                  </div>
                </div>
                <p className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-ink-800 leading-snug">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">COP:</strong> Predicts probability of cost overrun beyond budget.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400 block">TOP Risk</span>
                  <p className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {selectedProject.timeOverrunRisk}%
                  </p>
                  <div className="h-1 rounded-full bg-slate-200 dark:bg-ink-800 mt-2">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${selectedProject.timeOverrunRisk}%` }} />
                  </div>
                </div>
                <p className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-ink-800 leading-snug">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">TOP:</strong> Predicts probability of schedule delay beyond target date.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Project Health Score</span>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {selectedProject.health} <span className="text-xs text-slate-400">/ 100</span>
                  </p>
                  <div className="h-1 rounded-full bg-slate-200 dark:bg-ink-800 mt-2">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${selectedProject.health}%` }} />
                  </div>
                </div>
                <p className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-ink-800 leading-snug">
                  Overall composite index of health and delivery status.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Schedule Slip</span>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {selectedProject.timeVariance > 0 ? `+${selectedProject.timeVariance} mo` : '0 mo'}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Cost Var: {selectedProject.costVariance}%</span>
                </div>
                <p className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-ink-800 leading-snug">
                  Current physical milestone timeline variance.
                </p>
              </div>
            </div>

            {/* OpenRouter Project Intervention Brief */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  OpenRouter Narrative Brief:
                </p>
                {projectNarrative?.available && projectNarrative.source === 'openrouter' && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Engine: OpenRouter · {projectNarrative.model}
                  </span>
                )}
              </div>

              {loadingProjectNarrative ? (
                <div className="py-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <RotateCw size={13} className="animate-spin text-cyan-500" />
                  <span>Synthesizing natural-language risk drivers via OpenRouter...</span>
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {projectNarrative?.narrative || selectedProject.reviewReason}
                </p>
              )}

              {selectedProject.flags && selectedProject.flags.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {selectedProject.flags.map((f, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                        f.tone === 'positive'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/50 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                          : f.tone === 'negative'
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200/50 dark:border-rose-800/50 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200/50 dark:border-amber-800/50 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Early Warning Feed */}
      <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
        <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" /> Live Early Warnings Feed (from Feature Store)
        </h3>
        {warnings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-ink-950/40 border border-slate-200 dark:border-white/5 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {w.warning_type.replace(/_/g, ' ')}
                  </span>
                  <p className="text-slate-400 mt-0.5">
                    Signal magnitude: <span className="font-mono">{w.signal_value}</span>
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                    w.severity === 'High'
                      ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {w.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4">No critical warning signals active.</p>
        )}
      </div>
    </div>
  )
}

