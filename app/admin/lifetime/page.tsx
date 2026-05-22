'use client'

import { AdminMetricsGate } from '../_components/AdminShell'
import { LifetimeOverviewSection } from '../_components/LifetimeIntelligence'

export default function AdminLifetimePage() {
  return (
    <AdminMetricsGate
      title="Lifetime Intelligence"
      description="Founder operating system view across growth, behavior, trust, reliability, and telemetry coverage."
      render={(metrics) => <LifetimeOverviewSection metrics={metrics} />}
    />
  )
}
