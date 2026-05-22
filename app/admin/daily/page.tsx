'use client'

import { AdminMetricsGate, DailySection } from '../_components/AdminShell'

export default function AdminDailyPage() {
  return (
    <AdminMetricsGate
      title="Daily Intelligence"
      description="Private daily operator layer across growth, product, and reliability signals."
      render={(metrics) => <DailySection metrics={metrics} />}
    />
  )
}
