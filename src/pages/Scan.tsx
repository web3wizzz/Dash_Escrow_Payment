/**
 * Scan — camera QR scanner that prefills the Send page.
 * Uses BarcodeDetector API with a graceful fallback.
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, QrCode, X, AlertCircle } from 'lucide-react'
import { PageHeader } from '../components/ui'

export function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [supported] = useState<boolean>(() => 'BarcodeDetector' in window)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const navigate = useNavigate()

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const startScan = async () => {
    if (!videoRef.current) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)

      const detector = new (window as unknown as {
        BarcodeDetector: new (opts: object) => {
          detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>
        }
      }).BarcodeDetector({ formats: ['qr_code'] })

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const raw = codes[0].rawValue
            stopStream()
            try {
              const url = new URL(raw)
              const params = new URLSearchParams(url.search)
              void navigate(`/send?${params.toString()}`)
            } catch {
              setError('QR code does not contain a valid Dash payment link.')
            }
            return
          }
        } catch {
          // continue scanning
        }
        requestAnimationFrame(() => { void tick() })
      }

      requestAnimationFrame(() => { void tick() })
    } catch {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  if (supported === false) {
    return (
      <div className="space-y-4">
        <PageHeader title="Scan to pay" />
        <div
          className="rounded-3xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <span
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--surface-muted)' }}
          >
            <QrCode className="size-7" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>QR scanning unavailable</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Use Chrome on Android or desktop for QR code scanning.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scan to pay"
        subtitle="Point at a Dash payment QR code"
      />

      {/* Camera view */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          aspectRatio: '1',
          background: '#0A0F1E',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(16,25,52,0.12)',
        }}
      >
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />

        {/* Not scanning: call to action */}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col items-center gap-4"
            >
              <div
                className="flex size-16 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <Camera className="size-8" style={{ color: 'rgba(255,255,255,0.60)' }} strokeWidth={1.5} />
              </div>
              <button
                onClick={() => { void startScan() }}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition-all active:scale-95"
                style={{
                  background: '#F3B51C',
                  color: '#0A0F1E',
                  boxShadow: '0 4px 16px rgba(243,181,28,0.45)',
                }}
              >
                <Camera className="size-4" strokeWidth={2.2} />
                Start camera
              </button>
            </motion.div>
          </div>
        )}

        {/* Scanning: viewfinder overlay */}
        {scanning && (
          <>
            {/* Corner guides */}
            <div className="absolute inset-10 pointer-events-none">
              {/* TL */}
              <div className="absolute top-0 left-0 w-6 h-6" style={{ borderTop: '2.5px solid #F3B51C', borderLeft: '2.5px solid #F3B51C', borderRadius: '3px 0 0 0' }} />
              {/* TR */}
              <div className="absolute top-0 right-0 w-6 h-6" style={{ borderTop: '2.5px solid #F3B51C', borderRight: '2.5px solid #F3B51C', borderRadius: '0 3px 0 0' }} />
              {/* BL */}
              <div className="absolute bottom-0 left-0 w-6 h-6" style={{ borderBottom: '2.5px solid #F3B51C', borderLeft: '2.5px solid #F3B51C', borderRadius: '0 0 0 3px' }} />
              {/* BR */}
              <div className="absolute bottom-0 right-0 w-6 h-6" style={{ borderBottom: '2.5px solid #F3B51C', borderRight: '2.5px solid #F3B51C', borderRadius: '0 0 3px 0' }} />
            </div>

            {/* Scan line */}
            <motion.div
              className="absolute inset-x-10 h-px"
              style={{ background: 'rgba(243,181,28,0.70)', top: '40%' }}
              animate={{ top: ['35%', '65%', '35%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Stop button */}
            <button
              onClick={stopStream}
              className="absolute top-4 right-4 flex items-center justify-center size-9 rounded-full transition-all active:scale-90"
              style={{
                background: 'rgba(0,0,0,0.50)',
                border: '1px solid rgba(255,255,255,0.20)',
              }}
              aria-label="Stop scanning"
            >
              <X className="size-4" style={{ color: '#fff' }} />
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: 'var(--danger-muted)', border: '1px solid rgba(192,51,74,0.18)' }}
        >
          <AlertCircle className="size-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
        </motion.div>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        Scan any Dash payment QR code to auto-fill the payment form.
      </p>
    </div>
  )
}
