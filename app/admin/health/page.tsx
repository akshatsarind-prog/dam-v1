'use client'

import { AdminMetricsGate, HealthSection } from '../_components/AdminShell'

export default function AdminHealthPage() {
  return (
    <AdminMetricsGate
      title="Operational Health"
      description="Private DAM reliability read across latency, evidence coverage, and weak-quality rows."
      render={(metrics) => <HealthSection metrics={metrics} />}
    />
  )
}
