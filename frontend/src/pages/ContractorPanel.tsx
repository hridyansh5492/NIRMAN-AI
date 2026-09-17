import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  HardHat, 
  Building2, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Camera, 
  FileText, 
  Sparkles, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Percent,
  TrendingUp,
  RotateCcw,
  Navigation,
  RefreshCw,
  Lock,
  ShieldX,
  ShieldCheck,
  Check,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getContractorProjects, 
  getContractorSubmissions, 
  submitContractorProgress, 
  getProjectGeofence,
  isPointInsideLamina
} from '../services/api'
import { GeofenceMap } from '../components/GeofenceMap'
import type { ContractorProject, ContractorSubmission, GeofenceLamina } from '../types'

export default function ContractorPanel() {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [projects, setProjects] = useState<ContractorProject[]>([])
  const [submissions, setSubmissions] = useState<ContractorSubmission[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Selected project for progress submission
  const [selectedProject, setSelectedProject] = useState<ContractorProject | null>(null)
  const [geofence, setGeofence] = useState<GeofenceLamina | null>(null)

  // Form states
  const [physicalProgress, setPhysicalProgress] = useState<number>(65)
  const [financialExpenditure, setFinancialExpenditure] = useState<number>(120)
  const [notes, setNotes] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Determine baseline progress locked to the last approved report or master project baseline
  const lastApprovedProgress = useMemo(() => {
    if (!selectedProject) return 0
    const projectApprovedSubs = submissions.filter(
      (s) =>
        s.project_id === selectedProject.id &&
        (Boolean(s.counts_towards_progress) ||
          ['accepted', 'auto_approved', 'manually_approved', 'approved'].includes(s.verification_status))
    )
    let maxApproved = Number(selectedProject.approved_progress_pct ?? selectedProject.physicalProgress ?? 0)
    for (const s of projectApprovedSubs) {
      if (s.physical_progress_pct !== undefined && Number(s.physical_progress_pct) > maxApproved) {
        maxApproved = Number(s.physical_progress_pct)
      }
    }
    return Math.min(100, Math.max(0, Math.round(maxApproved * 10) / 10))
  }, [selectedProject, submissions])

  // Ensure reported progress never falls below last approved baseline
  useEffect(() => {
    setPhysicalProgress((prev) => Math.max(prev, lastApprovedProgress))
  }, [lastApprovedProgress])

  // Camera capture states (Strictly on-ground camera, no file upload)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Automated Device Geolocation states
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'requesting' | 'granted' | 'denied'>('requesting')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsTimestamp, setGpsTimestamp] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitResult, setSubmitResult] = useState<any | null>(null)

  const contractorId = user?.role === 'contractor' ? user.id : 'CNT-LT-01'

  // Request device location automatically via WGS-84 Geolocation API
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setLocationError('Geolocation API is not supported by your browser.')
      setGpsLat(null)
      setGpsLng(null)
      return
    }

    setLocationStatus('requesting')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setGpsLat(lat)
        setGpsLng(lng)
        setGpsAccuracy(Math.round(pos.coords.accuracy))
        setGpsTimestamp(new Date(pos.timestamp).toLocaleTimeString())
        setLocationStatus('granted')
        setLocationError(null)
        setSubmitResult(null)
      },
      (err) => {
        console.warn('Geolocation acquisition failed:', err)
        setLocationStatus('denied')
        setGpsLat(null)
        setGpsLng(null)
        if (err.code === 1) {
          setLocationError('Location permission denied. Mandatory GPS geotagging is required by statutory mandate to upload progress reports.')
        } else if (err.code === 2) {
          setLocationError('GPS position unavailable. Please ensure device location is switched on.')
        } else if (err.code === 3) {
          setLocationError('GPS acquisition timed out. Please retry with an open view of the sky.')
        } else {
          setLocationError(`Location error: ${err.message}`)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }

  // Camera Management
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device API is not supported in this browser environment.')
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      console.warn('Camera error', err)
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
          ? 'No physical camera device was detected on your hardware.'
          : err.message || 'Unable to start camera stream.'
      setCameraError(msg)
      setCameraActive(false)
    }
  }

  // Ensure video element immediately receives stream when cameraActive is triggered
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
      videoRef.current.play().catch((err) => console.warn('Video stream auto-play failed:', err))
    }
  }, [cameraActive])

  // Live Geofence Check
  const isInsideLamina = useMemo(() => {
    if (!geofence || gpsLat === null || gpsLng === null) return false
    return isPointInsideLamina(gpsLat, gpsLng, geofence.boundary_lamina)
  }, [geofence, gpsLat, gpsLng])

  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive || videoRef.current.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    const width = 1280
    const height = 720
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0, width, height)

    // Watermark HUD overlay
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
    ctx.fillRect(24, height - 145, width - 48, 120)
    ctx.strokeStyle = isInsideLamina ? '#10b981' : '#f43f5e'
    ctx.lineWidth = 2.5
    ctx.strokeRect(24, height - 145, width - 48, 120)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(`NIRMAN AI ON-GROUND AUDIT EVIDENCE — ${selectedProject?.id || 'PROJECT'}`, 48, height - 110)

    ctx.font = '16px monospace'
    ctx.fillStyle = '#38bdf8'
    ctx.fillText(
      `GPS: ${gpsLat !== null ? gpsLat.toFixed(6) : 'PENDING'}, ${gpsLng !== null ? gpsLng.toFixed(6) : 'PENDING'} | ACCURACY: ±${gpsAccuracy ? `${gpsAccuracy}m` : 'N/A'}`,
      48,
      height - 80
    )

    ctx.fillStyle = isInsideLamina ? '#34d399' : '#fb7185'
    ctx.fillText(
      `GEOFENCE: ${isInsideLamina ? 'INSIDE APPROVED LAMINA' : 'BREACH / OUTSIDE BOUNDARY'} | ${new Date().toISOString()}`,
      48,
      height - 50
    )

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob)
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          setPreviewUrl(URL.createObjectURL(blob))
          stopCamera()
        }
      },
      'image/jpeg',
      0.92
    )
  }

  const retakePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCapturedBlob(null)
    setSubmitResult(null)
    startCamera()
  }

  // Automatically ask for location access on component mount
  useEffect(() => {
    requestLocation()
  }, [])

  // Auto clean up media stream on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getContractorProjects(contractorId),
      getContractorSubmissions(contractorId),
    ])
      .then(([projData, subData]) => {
        setProjects(projData)
        setSubmissions(subData)
        if (projData.length > 0) {
          selectProject(projData[0])
        }
      })
      .catch((err) => console.warn('Error loading contractor data', err))
      .finally(() => setLoading(false))
  }, [contractorId])

  const selectProject = (p: ContractorProject) => {
    setSelectedProject(p)
    setSubmitResult(null)
    setValidationError(null)
    const pSubs = submissions.filter(
      (s) =>
        s.project_id === p.id &&
        (Boolean(s.counts_towards_progress) ||
          ['accepted', 'auto_approved', 'manually_approved', 'approved'].includes(s.verification_status))
    )
    let baseProg = Number(p.approved_progress_pct ?? p.physicalProgress ?? 0)
    for (const s of pSubs) {
      if (s.physical_progress_pct !== undefined && Number(s.physical_progress_pct) > baseProg) {
        baseProg = Number(s.physical_progress_pct)
      }
    }
    const lockedProg = Math.min(100, Math.max(0, Math.round(baseProg * 10) / 10))
    setPhysicalProgress(lockedProg)
    if (p.geofence) {
      setGeofence(p.geofence)
    } else {
      getProjectGeofence(p.id).then((geo) => {
        setGeofence(geo)
      })
    }
    // Re-verify location if not currently granted
    if (locationStatus !== 'granted') {
      requestLocation()
    }
  }

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!selectedProject) {
      const msg = 'Please select an active contract package from the left column first.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (physicalProgress === undefined || physicalProgress === null || isNaN(physicalProgress)) {
      const msg = 'Reported Physical Progress (%) is mandatory.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (physicalProgress < lastApprovedProgress) {
      const msg = `Reported physical progress (${physicalProgress}%) cannot be decreased below the last approved report progress (${lastApprovedProgress}%).`
      setValidationError(msg)
      alert(msg)
      return
    }

    if (physicalProgress > 100) {
      const msg = 'Reported physical progress cannot exceed 100%.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (
      financialExpenditure === undefined ||
      financialExpenditure === null ||
      isNaN(financialExpenditure) ||
      financialExpenditure <= 0
    ) {
      const msg = 'Claimed Expenditure (₹ Cr) is mandatory and must be greater than ₹0 Cr.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (!notes || !notes.trim()) {
      const msg = 'Milestone Details & Site Notes are mandatory. Please provide a detailed description of on-ground work.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (locationStatus === 'denied' || gpsLat === null || gpsLng === null) {
      const msg = 'Live Device GPS Telemetry is mandatory. Statutory oversight rules require verified on-ground GPS coordinates to submit progress.'
      setValidationError(msg)
      alert(msg)
      return
    }

    if (!capturedBlob) {
      const msg = 'Mandatory On-Ground Camera Photo is required. Please access the camera and capture an on-ground photo before submitting.'
      setValidationError(msg)
      alert(msg)
      return
    }

    setSubmitting(true)
    setSubmitResult(null)

    try {
      const formData = new FormData()
      formData.append('file', capturedBlob, 'site_camera_capture.jpg')
      formData.append('project_id', selectedProject.id)
      formData.append('contractor_id', contractorId)
      formData.append('physical_progress_pct', String(physicalProgress))
      formData.append('financial_expenditure_cr', String(financialExpenditure))
      formData.append('notes', notes.trim())
      formData.append('gps_lat', String(gpsLat))
      formData.append('gps_lng', String(gpsLng))

      const result = await submitContractorProgress(formData)
      setSubmitResult(result)

      // Refresh list
      getContractorProjects(contractorId).then(setProjects)
      getContractorSubmissions(contractorId).then(setSubmissions)
    } catch (err) {
      console.error('Submission error', err)
      const errText = err instanceof Error ? err.message : 'Submission failed'
      setValidationError(errText)
      alert(errText)
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'contractor') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <HardHat size={28} />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Contractor Portal Sign In Required
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Please sign in with your registered Contractor ID and password to manage assigned packages, submit verified on-site photos, and monitor geofenced lamina compliance.
          </p>
          <button
            onClick={() => navigate('/login?tab=contractor')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orangeDark text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <HardHat size={15} />
            <span>Go to Contractor Login</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Contractor Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-ink-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand-orange text-white shadow-lg shadow-amber-500/20 shrink-0">
              <HardHat size={28} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Registered Contractor Portal
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ID: {contractorId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mt-1 text-white">
                {user?.company || 'Larsen & Toubro Heavy Civil Infra'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-3">
                <span>Director: {user?.name || 'S. Ramanathan (VP Projects)'}</span>
                <span>•</span>
                <span>Rating: ★ {user?.rating || 4.8} / 5.0</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/login?tab=contractor')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all cursor-pointer"
            >
              Switch Contractor Account
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Contracts</p>
            <p className="text-xl font-bold text-white mt-0.5">{projects.length} Projects</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Geofence Compliance</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">100% On-Site</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Verified Uploads</p>
            <p className="text-xl font-bold text-cyan-400 mt-0.5">{submissions.length} Submissions</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Oversight Status</p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">Authorized</p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Assigned Projects List (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-brand-orange" />
              Projects Under Contractor's Name ({projects.length})
            </h2>
            <span className="text-xs text-slate-500">Select to update</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading assigned projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800 text-slate-500 text-xs">
              No packages currently assigned under this contractor ID.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => {
                const isSelected = selectedProject?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-brand-orange shadow-md'
                        : 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-800 hover:border-slate-300 dark:hover:border-ink-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300">
                            {p.id}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {p.sector} • {p.state}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 leading-snug">
                          {p.name}
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                          p.status === 'On Track'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : p.status === 'Watch'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-ink-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Progress:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {p.physicalProgress}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          (₹{p.sanctioned_cost ?? p.cost_cr ?? 0} Cr)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold text-[11px]">
                        <span>Select Package</span>
                        <ArrowRight size={12} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Submission History Feed */}
          {submissions.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                Recent Audit Trail ({submissions.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {submissions.map((sub) => {
                  const wasInside = Boolean(sub.inside_geofence && sub.counts_towards_progress)
                  return (
                    <div
                      key={sub.submission_id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            {sub.submission_id}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                            {sub.project_id}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5">
                          {sub.notes || 'Progress milestone submission'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {sub.submitted_at}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {wasInside ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 size={10} />
                            COUNTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle size={10} />
                            REJECTED
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Progress: {sub.physical_progress_pct}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Upload Progress & Geofence Verification (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedProject ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Active Package Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Active Contract Package
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedProject.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    ID: {selectedProject.id} • Sanctioned Package Value: ₹{selectedProject.sanctioned_cost ?? selectedProject.cost_cr ?? selectedProject.expenditure} Cr
                  </p>
                </div>
              </div>

              {/* Mandatory Compliance Protocol Notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                <ShieldCheck className="text-brand-orange shrink-0 mt-0.5" size={16} />
                <div className="space-y-0.5">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Statutory Verification Protocol</p>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Every detail on this report upload page is <strong>strictly mandatory</strong>. Submissions without reported physical progress %, claimed expenditure, milestone site notes, device GPS telemetry, and live camera photo will be rejected.
                  </p>
                </div>
              </div>

              {/* Progress Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>Reported Physical Progress (%)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Lock size={11} /> Locked Min: {lastApprovedProgress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={lastApprovedProgress}
                      max={100}
                      step={0.5}
                      value={physicalProgress}
                      onChange={(e) => {
                        setValidationError(null)
                        const val = parseFloat(e.target.value) || lastApprovedProgress
                        setPhysicalProgress(Math.max(lastApprovedProgress, Math.min(100, val)))
                      }}
                      className="flex-1 accent-brand-orange cursor-pointer"
                    />
                    <input
                      type="number"
                      required
                      min={lastApprovedProgress}
                      max={100}
                      step={0.1}
                      value={physicalProgress}
                      onChange={(e) => {
                        setValidationError(null)
                        const val = parseFloat(e.target.value)
                        if (isNaN(val)) {
                          setPhysicalProgress(lastApprovedProgress)
                        } else {
                          setPhysicalProgress(Math.max(lastApprovedProgress, Math.min(100, val)))
                        }
                      }}
                      className="w-20 px-2 py-1 text-sm font-bold text-center border border-slate-200 dark:border-ink-700 rounded-lg bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Baseline (Last Approved): <strong className="text-slate-700 dark:text-slate-300 font-mono">{lastApprovedProgress}%</strong></span>
                    <span className="text-rose-500 font-medium text-[10px]">Mandatory *</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>Claimed Expenditure (₹ Cr)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                      Mandatory *
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    value={financialExpenditure === 0 ? '' : financialExpenditure}
                    onChange={(e) => {
                      setValidationError(null)
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                      setFinancialExpenditure(isNaN(val) ? 0 : val)
                    }}
                    className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-ink-700 rounded-lg bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                    placeholder="Enter claimed billing in ₹ Cr (Mandatory)"
                  />
                  <p className="text-[11px] text-slate-400">
                    Cumulative billing claimed for this cycle (Mandatory, must be &gt; 0)
                  </p>
                </div>
              </div>

              {/* Progress Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>Milestone Details & Site Notes</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                    Mandatory *
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => {
                    setValidationError(null)
                    setNotes(e.target.value)
                  }}
                  placeholder="Enter detailed milestone progress, completed work items, and on-site observations (Mandatory for statutory audit)..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Detailed description of work completed on-site during this milestone (Mandatory)</span>
                  <span className={notes.trim().length > 0 ? 'text-emerald-500 font-medium' : 'text-slate-400'}>
                    {notes.trim().length} chars
                  </span>
                </div>
              </div>

              {/* Camera-Only On-Ground Photo Capture (No file upload) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera size={14} className="text-brand-orange" />
                    <span>On-Ground Camera Photo Evidence</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                      Mandatory *
                    </span>
                    <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Live Camera Only • No File Uploads
                    </span>
                  </div>
                </div>

                {previewUrl ? (
                  /* Captured Photo Preview with Geotag HUD */
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-ink-700 shadow-lg bg-black">
                    <img
                      src={previewUrl}
                      alt="Captured on-ground progress evidence"
                      className="w-full max-h-80 object-contain mx-auto"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                      <CheckCircle2 size={13} />
                      <span>Live On-Ground Photo Captured</span>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={retakePhoto}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900/85 hover:bg-black text-white text-xs font-bold backdrop-blur shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <RotateCcw size={13} />
                        <span>Retake Photo</span>
                      </button>
                    </div>
                  </div>
                ) : cameraActive ? (
                  /* Live Camera Viewfinder */
                  <div className="relative rounded-2xl overflow-hidden border-2 border-brand-orange bg-black aspect-video max-h-80 flex flex-col items-center justify-center shadow-xl">
                    <video
                      ref={(node) => {
                        videoRef.current = node
                        if (node && streamRef.current && node.srcObject !== streamRef.current) {
                          node.srcObject = streamRef.current
                          node.play().catch((err) => console.warn('Video play on ref callback error:', err))
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => {
                        videoRef.current?.play().catch(() => {})
                      }}
                      className="w-full h-full object-cover"
                    />

                    {/* HUD Status Bar & Close Button */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-white/15 text-white text-[11px] font-mono shadow">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="font-bold text-rose-400">REC</span>
                      <span>CAMERA ACTIVE</span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-white/15 text-slate-200 text-[10px] font-mono shadow">
                        {gpsLat !== null && gpsLng !== null ? (
                          <span>GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}</span>
                        ) : (
                          <span className="text-amber-400">WAITING FOR GPS...</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="p-1 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white/80 hover:text-white border border-white/15 backdrop-blur cursor-pointer"
                        title="Close Camera"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Center Targeting Reticle */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
                      <div className="w-24 h-24 border-2 border-dashed border-white rounded-3xl flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-brand-orange rounded-full" />
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-6 py-2.5 rounded-2xl bg-brand-orange hover:bg-brand-orangeDark text-white text-xs font-bold shadow-xl shadow-amber-500/40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                      >
                        <Camera size={16} />
                        <span>Click On-Ground Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Camera Initialization Banner */
                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-ink-700 bg-slate-50/50 dark:bg-ink-950/40 text-center space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-brand-orange">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Device Camera Access Required for Site Verification
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                        To guarantee report authenticity, file uploads from device storage are disabled. Progress updates require clicking an authentic on-ground photo with live GPS telemetry.
                      </p>
                    </div>

                    {cameraError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs max-w-md mx-auto">
                        {cameraError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orangeDark text-white text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Camera size={15} />
                        <span>{cameraError ? 'Retry Camera Access' : 'Open Device Camera'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic Geofence Coordinate Verification (No manual pin pointing) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Navigation size={14} className="text-cyan-500" />
                      <span>Live Device GPS Telemetry</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automatic WGS-84 location capture — mandatory GPS geotagging for report verification
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                      Mandatory *
                    </span>
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} className={locationStatus === 'requesting' ? 'animate-spin' : ''} />
                      <span>Re-acquire GPS</span>
                    </button>
                  </div>
                </div>

                {/* Geolocation Status Alert / Telemetry Readouts */}
                {locationStatus === 'denied' ? (
                  <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                    <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <p className="font-bold">Location Permission Denied / Blocked</p>
                      <p className="text-[11px] leading-relaxed">
                        {locationError || 'Browser location access was denied. You cannot upload a progress report without granting device GPS access.'}
                      </p>
                      <button
                        type="button"
                        onClick={requestLocation}
                        className="mt-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Grant Location Permission
                      </button>
                    </div>
                  </div>
                ) : locationStatus === 'requesting' ? (
                  <div className="p-3.5 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 text-xs flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin shrink-0" />
                    <span>Acquiring high-accuracy WGS-84 coordinates from device GPS satellites...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Capture Latitude</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                        {gpsLat !== null ? `${gpsLat}°` : 'Acquiring...'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Capture Longitude</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                        {gpsLng !== null ? `${gpsLng}°` : 'Acquiring...'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">GPS Accuracy</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                        {gpsAccuracy !== null ? `±${gpsAccuracy} m` : 'Standard'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Timestamp</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                        {gpsTimestamp || 'Live'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Read-Only Inspection Geofence Map (Interactive Pin Pointing Disabled) */}
                {geofence && (
                  <div className="mt-2">
                    <GeofenceMap
                      centerLat={geofence.center_lat}
                      centerLng={geofence.center_lng}
                      boundaryLamina={geofence.boundary_lamina}
                      radiusKm={geofence.radius_km}
                      currentLat={gpsLat}
                      currentLng={gpsLng}
                      interactive={false}
                      projectName={selectedProject.name}
                      height={260}
                    />
                  </div>
                )}

                {/* Geofence Enforcement Verification Status */}
                {gpsLat !== null && gpsLng !== null && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                      isInsideLamina
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {isInsideLamina ? (
                      <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                    ) : (
                      <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    )}
                    <div>
                      <p className="font-bold">
                        {isInsideLamina
                          ? 'Geofence Verification Passed (Device Inside Construction Lamina)'
                          : 'Geofence Boundary Violation (Device Outside Construction Lamina)'}
                      </p>
                      <p className="mt-0.5 leading-relaxed">
                        {isInsideLamina
                          ? 'Photo coordinates match the project site. This progress report will be accredited and updated in official project timelines.'
                          : 'Warning: Under statutory oversight rules, photos uploaded from outside the designated construction lamina DO NOT COUNT. Submitting will register an audit violation without crediting project progress.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submission Result Notification Banner */}
              {submitResult && (
                <div
                  className={`p-5 rounded-2xl border text-xs animate-in zoom-in-95 duration-200 space-y-3 ${
                    submitResult.counts
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {submitResult.counts ? (
                        <>
                          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                          <span>Report Verified & Counted On-Site</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="text-rose-600 dark:text-rose-400" size={20} />
                          <span>Report Rejected: Geofence Enforcement Triggered</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-black/40 border border-current/20">
                      ID: #{submitResult.submission_id}
                    </span>
                  </div>

                  <p className="leading-relaxed text-xs">{submitResult.message}</p>

                  <div className="pt-2 border-t border-current/15 flex flex-wrap items-center gap-4 text-[11px]">
                    <span>Status: <strong className="uppercase">{submitResult.status}</strong></span>
                    <span>Official Metrics Updated: <strong>{submitResult.counts ? 'YES (Updated to ' + submitResult.physical_progress_pct + '%)' : 'NO (Discarded)'}</strong></span>
                  </div>

                  {/* Derived AI Intelligence Sub-Card */}
                  {submitResult.ai_intelligence && (
                    <div className="mt-3 p-4 rounded-xl bg-white dark:bg-ink-900/90 border border-emerald-200 dark:border-emerald-800/60 shadow-sm text-slate-800 dark:text-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-amber-500 animate-pulse" />
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                            AI Model Intelligence Derivation
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          submitResult.ai_intelligence.risk_level === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                            : submitResult.ai_intelligence.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {submitResult.ai_intelligence.risk_level} RISK TIER
                        </span>
                      </div>

                      {/* Health & Metrics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Physical Progress</p>
                          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {submitResult.ai_intelligence.updated_physical_progress}%
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Composite Health</p>
                          <p className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                            {submitResult.ai_intelligence.health} / 100
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Cost Overrun Prob</p>
                          <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            {submitResult.ai_intelligence.cop_prob}%
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Schedule Delay Prob</p>
                          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {submitResult.ai_intelligence.top_prob}%
                          </p>
                        </div>
                      </div>

                      {/* AI Brief */}
                      {submitResult.ai_intelligence.narrative && (
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-ink-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-ink-700/60">
                          {submitResult.ai_intelligence.narrative}
                        </p>
                      )}

                      {/* SHAP Risk Drivers */}
                      {submitResult.ai_intelligence.shap_drivers && submitResult.ai_intelligence.shap_drivers.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Key AI Risk Drivers</p>
                          <div className="flex flex-wrap gap-1.5">
                            {submitResult.ai_intelligence.shap_drivers.slice(0, 3).map((driver: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-ink-800 border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-300">
                                {driver.feature || driver.driver}: <strong>{driver.impact || driver.weight || driver.value}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* In-form Validation Error Notice */}
              {validationError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                  <span className="font-semibold">{validationError}</span>
                </div>
              )}

              {/* Submit Button and Gatekeeper Controls */}
              {locationStatus === 'denied' ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-6 rounded-2xl bg-slate-200 dark:bg-ink-800 text-slate-500 dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-rose-300 dark:border-rose-900/60"
                >
                  <ShieldX size={17} className="text-rose-500" />
                  <span>Location Access Denied — Report Upload Disabled</span>
                </button>
              ) : locationStatus === 'requesting' ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-6 rounded-2xl bg-cyan-600/30 text-cyan-200 font-bold text-sm flex items-center justify-center gap-2 cursor-wait"
                >
                  <RefreshCw size={16} className="animate-spin text-cyan-400" />
                  <span>Acquiring Device GPS Location...</span>
                </button>
              ) : !capturedBlob ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3 px-6 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-slate-300 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-300 dark:border-ink-700"
                >
                  <Camera size={16} className="text-brand-orange" />
                  <span>Access Camera & Click On-Ground Photo to Submit</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-3 px-6 rounded-2xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    isInsideLamina
                      ? 'bg-brand-orange hover:bg-brand-orangeDark shadow-amber-500/25 active:scale-98'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25 active:scale-98'
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Verifying Geofence & Submitting...</span>
                    </>
                  ) : isInsideLamina ? (
                    <>
                      <Upload size={16} />
                      <span>Submit Verified Progress Report (Counts Towards Metrics)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} />
                      <span>Submit Progress Report (Will Be Rejected By Geofence)</span>
                    </>
                  )}
                </button>
              )}
            </form>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800 text-slate-400">
              Select a project from the left column to upload work progress.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
