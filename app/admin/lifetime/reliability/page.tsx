'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeReliabilitySection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeReliabilityPage() {
  return (
    <AdminMetricsGate
      title="Lifetime Reliability"
      description="Latency, bad rows, and operational pressure."
      render={(metrics) => <LifetimeReliabilitySection metrics={metrics} />}
    />
  )
}
