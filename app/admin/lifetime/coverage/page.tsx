'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeCoverageSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeCoveragePage() {
  return (
    <AdminMetricsGate
      title="Lifetime Data Coverage"
      description="Telemetry scope, coverage gaps, and the current Vercel disconnect."
      render={(metrics) => <LifetimeCoverageSection metrics={metrics} />}
    />
  )
}
