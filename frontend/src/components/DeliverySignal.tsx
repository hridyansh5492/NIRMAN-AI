import React from 'react'
import { CheckCircle2, Clock, Calendar } from 'lucide-react'

export interface DeliverySignalProps {
  project: {
    id?: string
    physicalProgress: number
    approved_progress_pct?: number
    status?: string
    currentStageIndex?: number
    originalCompletion?: string
    predictedCompletion?: string
    completionDate?: string
    dateOfCompletion?: string
    expenditure?: string
    sector_risk_baseline?: number
    state_risk_baseline?: number
    latest_approved_report?: {
      submission_id: string
      physical_progress_pct: number
      submitted_at?: string
      notes?: string
      verification_status?: string
    }
  }
  showMilestones?: boolean
  showBaselines?: boolean
  compact?: boolean
  title?: string
}

export default function DeliverySignal({
  project,
  showMilestones = true,
  showBaselines = true,
  compact = false,
  title = 'Delivery Signal',
}: DeliverySignalProps) {
  const stageLabels = [
    { id: 1, name: 'Sanctioned', stageNum: 1 },
    { id: 2, name: 'Planning', stageNum: 2 },
    { id: 3, name: 'Construction', stageNum: 3 },
    { id: 4, name: 'Progress', stageNum: 4 },
    { id: 5, name: 'Finished', stageNum: 5 },
  ]

  const progressPct = Math.min(
    100,
    Math.max(
      0,
      Number(project.approved_progress_pct ?? project.physicalProgress) || 0
    )
  )
  const isCompleted = project.status === 'Completed' || progressPct >= 100

  // Progress line width calculation:
  // Node 1 (Sanctioned): 0%
  // Node 2 (Planning): 25%
  // Node 3 (Construction): 50%
  // Node 4 (Progress): 75%
  // Node 5 (Finished): 100%
  // When in active progress, the line fills from left to Progress (75%),
  // and proceeds from Progress towards Finished according to the approved report %:
  const lineFillPct = isCompleted
    ? 100
    : progressPct > 0
    ? 75 + (progressPct / 100) * 25
    : (project.currentStageIndex ?? 0) >= 2
    ? 50
    : (project.currentStageIndex ?? 0) === 1
    ? 25
    : 0

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1 uppercase">
            Project Overview
          </p>
          <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white">
            {title}
          </h3>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Clock size={13} /> Active snapshot: July 2026
        </span>
      </div>

      {/* Stepper */}
      <div className="relative pt-2 pb-1">
        <div className="flex justify-between">
          {stageLabels.map((stage, i) => {
            const isProgress = i === 3
            const isFinished = i === 4

            // Stage reached logic:
            // Earlier stages (1, 2, 3) are already completed if progress has started
            const reached = isCompleted || (i < 3 && progressPct > 0) || (isProgress && progressPct > 0)
            const isCurrent = isCompleted ? isFinished : isProgress && progressPct > 0

            return (
              <div key={stage.name} className="flex flex-col items-center relative z-10 text-center w-20 sm:w-24">
                {/* Node Circle */}
                <span
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isCurrent && !isCompleted
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 ring-4 ring-cyan-500/20 shadow-sm'
                      : reached
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-ink-900 text-slate-400'
                  }`}
                >
                  {reached && !isCurrent ? (
                    <CheckCircle2 size={16} />
                  ) : isCurrent && !isCompleted ? (
                    <span className="text-xs font-bold font-mono">4</span>
                  ) : reached && isCompleted ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <span className="text-xs font-medium">{stage.stageNum}</span>
                  )}
                </span>

                {/* Stage Title */}
                <span
                  className={`text-xs mt-2 transition-colors ${
                    isCurrent
                      ? 'font-bold text-slate-900 dark:text-white'
                      : reached
                      ? 'font-semibold text-slate-700 dark:text-slate-300'
                      : 'font-medium text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {stage.name}
                </span>

                {/* Information below word */}
                {isProgress && (
                  <div className="flex flex-col items-center mt-0.5">
                    <span className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400 font-mono tracking-tight bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/60">
                      {progressPct}%
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                      Approved Report
                    </span>
                  </div>
                )}

                {isFinished && (
                  <div className="flex flex-col items-center mt-0.5">
                    <span
                      className={`text-[11px] font-mono font-bold mt-0.5 whitespace-nowrap ${
                        isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isCompleted ? '100%' : '100%'}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                      {isCompleted ? 'Completed' : 'Target'}
                    </span>
                  </div>
                )}

                {!isProgress && !isFinished && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                    {i === 0 ? 'Sanctioned' : i === 1 ? 'Clearances' : 'Mobilized'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Connecting Progress Line */}
        <div
          className="absolute left-10 right-10 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full -z-0"
          style={{ top: '23px' }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-700 ease-out relative"
            style={{ width: `${lineFillPct}%` }}
          >
            {/* Pulsing indicator proceeding from Progress to Finished */}
            {!isCompleted && progressPct > 0 && (
              <span
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex h-4 w-4 items-center justify-center pointer-events-none"
                title={`Approved report progress proceeding to Finished: ${progressPct}%`}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border-2 border-white dark:border-ink-900 shadow" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Status Bar summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-slate-600 dark:text-slate-300">
            Approved Delivery Progress:{' '}
            <strong className="text-cyan-600 dark:text-cyan-400 font-bold font-mono">
              {progressPct}%
            </strong>
            {isCompleted
              ? ' • 100% Commissioned'
              : ' • Proceeding from Progress to Finished'}
          </span>
        </div>
        {project.latest_approved_report ? (
          <span className="text-[11px] font-mono text-slate-400">
            Report #{project.latest_approved_report.submission_id}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">
            Approved On-Ground Telemetry
          </span>
        )}
      </div>

      {/* Milestones & Budgets */}
      {showMilestones && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">ORIGINAL TARGET</p>
            <p className="text-sm font-semibold text-ink-950 dark:text-white">
              {project.originalCompletion || '31 Dec 2028'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">
              {project.status === 'Completed' ? 'DATE OF COMPLETION' : 'PREDICTED COMPLETION'}
            </p>
            <p
              className={`text-sm font-semibold flex items-center gap-1 ${
                project.status === 'Completed'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-500'
              }`}
            >
              <Calendar size={14} />{' '}
              {project.status === 'Completed'
                ? project.completionDate || project.dateOfCompletion || project.predictedCompletion
                : project.predictedCompletion}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">EXPENDITURE TO DATE</p>
            <p className="text-sm font-semibold text-ink-950 dark:text-white">
              {project.expenditure || '₹ 0 Cr'}
            </p>
          </div>
        </div>
      )}

      {/* Baseline comparison */}
      {showBaselines && (
        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-ink-950/60 border border-slate-200 dark:border-white/5 text-xs">
          <div>
            <span className="text-slate-400">Sector Baseline Overrun:</span>
            <p className="font-semibold text-ink-950 dark:text-white text-sm mt-0.5">
              +{project.sector_risk_baseline ?? 8.5}% avg
            </p>
          </div>
          <div>
            <span className="text-slate-400">State Baseline Overrun:</span>
            <p className="font-semibold text-ink-950 dark:text-white text-sm mt-0.5">
              +{project.state_risk_baseline ?? 6.2}% avg
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
