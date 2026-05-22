'use client'

import { AdminMetricsGate, FunnelSection } from '../_components/AdminShell'

export default function AdminFunnelPage() {
  return (
    <AdminMetricsGate
      title="Funnel Intelligence"
      description="Private DAM funnel view from distributed reach through claim and signup."
      render={(metrics) => <FunnelSection metrics={metrics} />}
    />
  )
}
