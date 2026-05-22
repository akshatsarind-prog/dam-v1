'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeBehaviorSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeBehaviorPage() {
  return (
    <AdminMetricsGate
      title="Lifetime User Behavior"
      description="Session depth, claim timing, and repeat patterns."
      render={(metrics) => <LifetimeBehaviorSection metrics={metrics} />}
    />
  )
}
