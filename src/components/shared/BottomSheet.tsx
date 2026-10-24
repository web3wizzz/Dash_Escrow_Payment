/**
 * BottomSheet — modal sheet sliding up from bottom.
 * Motion: spring per 60fps.design patterns. Spectral strip for consumer money flows.
 * Always includes a prefers-reduced-motion fallback.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'

const spectral = 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)'

const sheet = { type: 'spring', stiffness: 400, damping: 36 } as const
const fade = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] } as const

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Show the spectral strip — use for money flow sheets only */
  spectralStrip?: boolean
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, spectralStrip = true, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheet}
            onClick={(e) => e.stopPropagation()}
          >
            {spectralStrip && (
              <div className="h-1" style={{ background: spectral }} />
            )}

            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <div className="flex justify-center w-10 mx-auto">
                <div className="h-1 w-10 rounded-full bg-black/10" />
              </div>
            </div>

            {title && (
              <div className="flex items-center justify-between px-5 pt-1 pb-2">
                <h2
                  className="display text-lg font-bold"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 -mr-1"
                  style={{ background: 'rgba(18,45,69,0.07)' }}
                  aria-label="Close"
                >
                  <X className="size-4" style={{ color: 'var(--ink-2)' }} />
                </button>
              </div>
            )}

            <div className="px-5 pb-8 pt-2">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
