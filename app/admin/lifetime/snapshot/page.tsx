'use client'

import { AdminMetricsGate } from '../../_components/AdminShell'
import { LifetimeSnapshotSection } from '../../_components/LifetimeIntelligence'

export default function AdminLifetimeSnapshotPage() {
  return (
    <AdminMetricsGate
      title="Lifetime Snapshot"
      description="Lifetime scale, usage mix, and operating footprint."
      render={(metrics) => <LifetimeSnapshotSection metrics={metrics} />}
    />
  )
}
