import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, MapPin, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import api from '@/api/axios'
import { FormError } from '@/components/AuthShell'
import PriorityBadge from '@/components/PriorityBadge'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'
import { useAuth } from '@/context/AuthContext'
import { errorMessage } from '@/utils/helpers'

const MAX_MB = 5 // matches the backend's own cap

export default function SubmitComplaint() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const [description, setDescription] = useState('')
  const [ward, setWard] = useState(user?.ward || '')
  const [landmark, setLandmark] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [dragging, setDragging] = useState(false)
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  // object URLs leak until revoked
  useEffect(() => {
    if (!photo) return setPreview('')
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const acceptFile = (file) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Photo must be a JPG, PNG or WEBP image')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Photo must be ${MAX_MB} MB or smaller`)
    setError('')
    setPhoto(file)
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocating(false)
      },
      // a refused lookup must never block the report
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (description.trim().length < 10) return setError('Describe the issue in at least 10 characters')
    if (!ward.trim()) return setError('Enter your district')

    const form = new FormData()
    form.append('description', description.trim())
    form.append('ward', ward.trim())
    if (landmark.trim()) form.append('landmark', landmark.trim())
    if (photo) form.append('photo', photo)
    if (coords) {
      form.append('latitude', coords.latitude)
      form.append('longitude', coords.longitude)
    }

    setBusy(true)
    try {
      const res = await api.post('/api/citizen/complaints', form)
      setResult(res.data.data.complaint)
    } catch (err) {
      setError(errorMessage(err, 'Could not submit complaint'))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-[720px] rounded-2xl border border-white/14 bg-[rgba(26,26,29,0.75)] p-8 text-center shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
      >
        <h1 className="text-xl font-bold text-on-surface">Complaint #{result.id} submitted</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Our AI classified it as <strong className="text-on-surface">{result.issue_type}</strong> with{' '}
          <strong className="text-on-surface">{result.urgency_level}</strong> urgency.
        </p>
        <div className="mt-4 flex justify-center">
          <PriorityBadge score={result.priority_score} />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <InteractiveHoverButton
            onClick={() => navigate('/citizen/complaints')}
            text="View my complaints"
            className="w-full sm:w-48 py-2.5"
          />
          <InteractiveHoverButton
            onClick={() => {
              setResult(null)
              setDescription('')
              setLandmark('')
              setPhoto(null)
            }}
            text="Report another"
            className="w-full sm:w-40 py-2.5"
          />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[720px] rounded-2xl border border-white/14 bg-[rgba(26,26,29,0.75)] p-6 shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:p-8"
    >
      <div className="text-center">
        <h1 className="text-lg font-bold text-on-surface">Report a Civic Issue</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-on-surface-variant">
          Provide details about the issue to help our team resolve it quickly.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            acceptFile(e.dataTransfer.files?.[0])
          }}
          className={`relative rounded-lg border border-dashed transition-colors ${
            dragging ? 'border-accent-sky bg-accent-sky/5' : 'border-white/15'
          }`}
        >
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Selected complaint" className="max-h-60 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label="Remove photo"
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/70 text-on-surface transition-colors hover:bg-black"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-3 px-6 py-12"
            >
              <span className="flex size-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                <Camera className="size-6" />
              </span>
              <span className="font-semibold text-on-surface">Click to upload or drag and drop</span>
              <span className="text-xs text-on-surface-variant">PNG, JPG up to {MAX_MB}MB</span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => acceptFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-label text-sm font-medium tracking-[0.02em] text-on-surface">
            Describe the issue
          </span>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please provide as much detail as possible..."
            className="w-full rounded-lg bg-surface-container p-4 text-base text-on-surface ring-1 ring-white/10 transition-all outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-accent-sky"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label text-sm font-medium tracking-[0.02em] text-on-surface">
            District <span className="text-error">*</span>
          </span>
          <input
            required
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            placeholder="e.g. Kalwa West"
            className="w-full rounded-lg bg-surface-container px-4 py-3 text-base text-on-surface ring-1 ring-white/10 transition-all outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-accent-sky"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label text-sm font-medium tracking-[0.02em] text-on-surface">
            Landmark (Optional)
          </span>
          <input
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="e.g., Near the central park gate"
            className="h-11 w-full rounded-lg bg-surface-container px-4 text-base text-on-surface ring-1 ring-white/10 transition-all outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-accent-sky"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface-variant ring-1 ring-white/10 transition-colors hover:text-on-surface disabled:opacity-60"
          >
            <MapPin className="size-4" />
            {locating ? 'Locating…' : coords ? 'Location pinned' : 'Pin my location'}
          </button>
          {coords && (
            <span className="font-label text-xs text-on-surface-variant">
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </span>
          )}
        </div>

        <FormError>{error}</FormError>

        <InteractiveHoverButton
          type="submit"
          disabled={busy}
          text={busy ? 'Analyzing…' : 'Submit Complaint'}
          className="h-11 w-full disabled:opacity-70"
        />
      </form>
    </motion.div>
  )
}
