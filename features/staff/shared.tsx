'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

export const StaffReportDateRangeModal = dynamic(() => import('../../components/StaffReportDateRangeModal'), {
  ssr: false,
})

export const StaffHrHub = dynamic(() => import('../../components/StaffHrHub'), {
  ssr: false,
})

export const StaffPlayerInsights = dynamic(() => import('../../components/StaffPlayerInsights'), {
  ssr: false,
})

export const StaffQrAnalytics = dynamic(() => import('../../components/StaffQrAnalytics'), {
  ssr: false,
})

export function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}
