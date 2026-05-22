'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeStrategySection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeRecommendationsPage() {
  return (
    <AdminMetricsGate
      title="Lifetime Strategic Recommendations"
      description="Metrics-derived next actions only."
      render={(metrics) => <LifetimeStrategySection metrics={metrics} />}
    />
  )
}
