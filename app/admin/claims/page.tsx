'use client'

import { AdminMetricsGate, ClaimsSection } from '../_components/AdminShell'

export default function AdminClaimsPage() {
  return (
    <AdminMetricsGate
      title="Recent Claims"
      description="Private DAM claim-log view with verdict, confidence, risk, latency, and attribution context."
      render={(metrics) => <ClaimsSection metrics={metrics} />}
    />
  )
}
