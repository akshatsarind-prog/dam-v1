'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeGrowthSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeGrowthPage() {
  return (
    <AdminMetricsGate
      title="Lifetime Growth Intelligence"
      description="Channel quality, conversion, and the biggest current growth bottleneck."
      render={(metrics) => <LifetimeGrowthSection metrics={metrics} />}
    />
  )
}
