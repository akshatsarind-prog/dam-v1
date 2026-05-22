'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeTimelineSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeTimelinePage() {
  return (
    <AdminMetricsGate
      title="Lifetime Timeline"
      description="Historical milestones across product, growth, and operations."
      render={(metrics) => <LifetimeTimelineSection metrics={metrics} />}
    />
  )
}
