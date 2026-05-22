'use client'

import { AdminMetricsGate, RetentionSection } from '../_components/AdminShell'

export default function AdminRetentionPage() {
  return (
    <AdminMetricsGate
      title="Retention Intelligence"
      description="Private DAM repeat-usage view across returning sessions, claim depth, and high-intent behavior."
      render={(metrics) => <RetentionSection metrics={metrics} />}
    />
  )
}
