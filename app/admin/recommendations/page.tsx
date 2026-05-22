'use client'

import { AdminMetricsGate, RecommendationsSection } from '../_components/AdminShell'

export default function AdminRecommendationsPage() {
  return (
    <AdminMetricsGate
      title="Operator Recommendations"
      description="Private DAM operator guidance derived from the existing admin metrics response."
      render={(metrics) => <RecommendationsSection metrics={metrics} />}
    />
  )
}
