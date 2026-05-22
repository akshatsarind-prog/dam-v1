'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeTrustSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeTrustPage() {
  return (
    <AdminMetricsGate
      title="Lifetime Trust & Product"
      description="Category mix, confidence pressure, and user intent."
      render={(metrics) => <LifetimeTrustSection metrics={metrics} />}
    />
  )
}
