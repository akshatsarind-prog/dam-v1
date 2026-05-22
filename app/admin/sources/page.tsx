'use client'

import { AdminMetricsGate, SourcesSection } from '../_components/AdminShell'

export default function AdminSourcesPage() {
  return (
    <AdminMetricsGate
      title="Traffic Source Intelligence"
      description="Private DAM attribution and source-quality read across sessions, claims, and signups."
      render={(metrics) => <SourcesSection metrics={metrics} />}
    />
  )
}
