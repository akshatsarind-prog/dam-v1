'use client'

import { AdminMetricsGate, ExecutiveSection } from '../_components/AdminShell'

export default function AdminExecutivePage() {
  return (
    <AdminMetricsGate
      title="Executive Snapshot"
      description="Private DAM executive read for usage volume, repeat behavior, and current system state."
      render={(metrics) => <ExecutiveSection metrics={metrics} />}
    />
  )
}
