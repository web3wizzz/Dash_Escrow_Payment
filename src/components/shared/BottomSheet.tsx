/**
 * BottomSheet — mobile-native sheet with spring motion.
 * Drag handle, safe-area padding, backdrop blur.
 * prefers-reduced-motion: immediate appear/disappear.
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Accent bar color — defaults to saffron. Pass false to suppress. */
  accentColor?: string | false
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  accentColor = 'var(--saffron)',
}: BottomSheetProps) {
  const reduced = useReducedMotion()
  const sheetRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  /* Lock body scroll while open */
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  /* Focus management: save focus → move into sheet → restore on close */
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement
      // Defer so the sheet has mounted into the DOM
      const id = setTimeout(() => {
        const first = sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0]
        first?.focus()
      }, 16)
      return () => clearTimeout(id)
    } else {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [open])

  /* Close on Escape; trap Tab within the sheet */
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const el = sheetRef.current
      if (!el) return
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const sheetTransition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 440, damping: 40, mass: 0.9 }

  const overlayTransition = reduced
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.25, 0.1, 0.25, 1.0] as const }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(14,16,48,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.section
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Bottom sheet'}
            className="relative w-full max-w-md overflow-hidden"
            style={{
              background: '#FFFFFF',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 40px rgba(14,16,48,0.14)',
            }}
            initial={{ y: reduced ? 0 : '100%' }}
            animate={{ y: 0 }}
            exit={{ y: reduced ? 0 : '100%' }}
            transition={sheetTransition}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent bar */}
            {accentColor && (
              <div className="h-[3px]" style={{ background: accentColor }} />
            )}

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="rounded-full"
                style={{ width: 36, height: 4, background: 'rgba(14,16,48,0.12)' }}
              />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-1">
                <h2
                  className="display text-lg font-bold"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center rounded-full transition-all active:scale-90"
                  style={{
                    width: 32, height: 32,
                    background: 'var(--surface-muted)',
                  }}
                  aria-label="Close"
                >
                  <X className="size-4" style={{ color: 'var(--ink)' }} />
                </button>
              </div>
            )}

            {/* Content */}
            <div
              className="px-5 pt-2 overflow-y-auto"
              style={{
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                maxHeight: '88vh',
              }}
            >
              {children}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
