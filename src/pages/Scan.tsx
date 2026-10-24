/**
 * Scan — camera-based QR scanner that prefills the Send page.
 * Uses the browser's BarcodeDetector API (Chrome/Edge/Android) with a
 * MediaStream fallback message for unsupported browsers.
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, QrCode } from 'lucide-react'

export function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [supported] = useState<boolean>(() => 'BarcodeDetector' in window)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const startScan = async () => {
    if (!videoRef.current) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)

      const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })

      const doTick = async () => {
        if (!videoRef.current || !scanning) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const raw = codes[0].rawValue
            stopStream(stream)
            const url = new URL(raw)
            const params = new URLSearchParams(url.search)
            void navigate(`/send?${params.toString()}`)
            return
          }
        } catch {
          // continue scanning
        }
        requestAnimationFrame(() => { void doTick() })
      }

      requestAnimationFrame(() => { void doTick() })
    } catch {
      setError('Camera access denied. Please allow camera permission.')
    }
  }

  const stopStream = (stream: MediaStream) => {
    stream.getTracks().forEach((t) => t.stop())
    setScanning(false)
  }

  if (supported === false) {
    return (
      <div className="space-y-3">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Scan QR
        </h1>
        <div
          className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
          style={{ background: 'rgba(255,255,255,0.64)', border: '1px solid rgba(255,255,255,0.68)' }}
        >
          <QrCode className="size-10" style={{ color: 'var(--muted)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            QR scanning is not supported in this browser. Try Chrome on Android or desktop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        Scan to pay
      </h1>

      <div
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'rgba(18,45,69,0.06)', border: '1px solid rgba(255,255,255,0.68)', aspectRatio: '1' }}
      >
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera className="size-10" style={{ color: 'var(--muted)' }} />
            <button
              onClick={() => { void startScan() }}
              className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Start camera
            </button>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 rounded-2xl" style={{ border: '2px solid rgba(255,255,255,0.7)' }} />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        Scan a Dash payment QR code to auto-fill the payment form.
      </p>
    </div>
  )
}
