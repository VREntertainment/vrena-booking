'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './ReportCharts.module.css'

export function ReportToolbarMenu({ label, icon, value, detail, hideLabel, children }: {
  label: string
  icon: ReactNode
  value?: string
  detail?: string
  hideLabel?: boolean
  children: ReactNode
}) {
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return <div className={styles.toolbarControl}>
    {value && !hideLabel && <span className={styles.toolbarLabel}>{label}</span>}
    <details ref={menu} className={styles.toolbarMenu}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return
        event.preventDefault()
        event.currentTarget.open = false
        event.currentTarget.querySelector('summary')?.focus()
      }}>
      <summary aria-label={[label, value, detail].filter(Boolean).join(' · ')}>
        {icon}
        <span className={styles.toolbarValue}>
          <span>{value || label}</span>{detail && <span className={styles.toolbarDetail}>· {detail}</span>}
        </span>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className={styles.toolbarOptions} onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('button')) return
        const restoreFocus = event.currentTarget.contains(document.activeElement)
        if (menu.current) menu.current.open = false
        if (restoreFocus) {
          menu.current?.querySelector('summary')?.focus()
        }
      }}>
        {children}
      </div>
    </details>
  </div>
}
