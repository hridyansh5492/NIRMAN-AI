import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import type { MapProject } from '../types'

/** Cluster colouring keeps the same language as the rest of the dashboard. */
const STATUS_COLORS: Record<string, string> = {
  'At Risk': '#ef4444', // red-500
  Watch: '#f59e0b', // amber-500
  'On Track': '#10b981', // emerald-500
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 66.0],
  [38.5, 99.0],
]

function statusOf(p: MapProject): 'At Risk' | 'Watch' | 'On Track' {
  if (p.status === 'On Track') return 'On Track'
  if (p.status === 'Watch') return 'Watch'
  return 'At Risk'
}

/** Cache created dot DivIcons so Leaflet reuses DOM elements efficiently */
const dotIconCache: Record<string, L.DivIcon> = {}

function getDotIcon(status: 'At Risk' | 'Watch' | 'On Track', isHighRisk: boolean = false): L.DivIcon {
  const color = STATUS_COLORS[status] ?? '#ef4444'
  const key = `${status}-${isHighRisk ? 'lg' : 'sm'}`

  if (!dotIconCache[key]) {
    const size = isHighRisk ? 12 : 10
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.9}" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
      </svg>
    `
    dotIconCache[key] = L.divIcon({
      className: 'custom-project-dot',
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 4],
      tooltipAnchor: [0, -size / 2 - 2],
    })
  }

  return dotIconCache[key]
}

function formatCr(v: number): string {
  return v >= 1000 ? `₹${(v / 1000).toFixed(2)}K Cr` : `₹${Math.round(v)} Cr`
}

interface ProjectMapProps {
  projects: MapProject[]
  height?: number | string
  center?: [number, number]
  zoom?: number
  dark?: boolean
}

export default function ProjectMap({
  projects,
  height = 380,
  center = [22.0, 79.0],
  zoom = 5,
}: ProjectMapProps) {
  // Always use bright OpenStreetMap basemap (never switch to dark)
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  return (
    <div className="relative z-0 overflow-hidden rounded-lg" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        maxZoom={18}
        maxBounds={INDIA_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        <ZoomControl position="bottomright" />
        {projects.map((p) => {
          const st = statusOf(p)
          const isHighRisk =
            st === 'At Risk' &&
            (p.risk_score != null ? p.risk_score >= 70 : p.risk_level === 'Critical' || p.risk_level === 'High')

          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={getDotIcon(st, isHighRisk)}
            >
              <Tooltip direction="top" opacity={1}>
                <span className="text-xs font-semibold">
                  {p.name} {p.location ? `· ${p.location}` : ''}
                </span>
              </Tooltip>
              <Popup>
                <div className="min-w-[230px] text-slate-900 dark:text-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {p.sector} · {p.state}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-snug">{p.name}</p>
                  {p.location && (
                    <p className="mt-0.5 text-xs text-cyan-700 dark:text-cyan-400 font-medium">
                      📍 Site: {p.location}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                        st === 'At Risk'
                          ? 'bg-red-500'
                          : st === 'Watch'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                    >
                      {st}
                    </span>
                    <span>{p.risk_score != null ? `Risk ${p.risk_score}` : `Risk ${p.risk_level ?? '—'}`}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {p.cost_cr != null && p.cost_cr > 0 && <p>Sanctioned cost: {formatCr(p.cost_cr)}</p>}
                    {p.physical_progress_pct != null && <p>Physical progress: {p.physical_progress_pct}%</p>}
                  </div>
                  <Link
                    to={`/projects/${p.project_id ?? p.id}`}
                    className="mt-3 inline-block text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    Open project intelligence →
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}