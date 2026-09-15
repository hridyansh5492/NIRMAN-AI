import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaTone?: 'up-good' | 'up-bad' | 'down-good' | 'down-bad'
  sparkline?: ReactNode
}

const toneClass: Record<string, string> = {
  'up-good': 'text-emerald-600 dark:text-emerald-400',
  'up-bad': 'text-amber-600 dark:text-amber-400',
  'down-good': 'text-emerald-600 dark:text-emerald-400',
  'down-bad': 'text-rose-500 dark:text-rose-400',
}

export default function StatCard({ label, value, delta, deltaTone, sparkline }: StatCardProps) {
  const deltaColor = deltaTone ? (toneClass[deltaTone] || 'text-slate-500 dark:text-slate-400') : 'text-slate-500 dark:text-slate-400'

  return (
    <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-sm transition-colors duration-200 flex flex-col justify-between">
      <div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          {label}
        </p>
        <p className="mt-2 font-display text-2xl font-bold text-ink-950 dark:text-white">
          {value}
        </p>
      </div>

      {(delta || sparkline) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {delta && (
            <span className={`text-xs font-semibold ${deltaColor}`}>
              {delta}
            </span>
          )}
          {sparkline && (
            <div className="shrink-0 w-16 h-7 flex items-center justify-end">
              {sparkline}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

