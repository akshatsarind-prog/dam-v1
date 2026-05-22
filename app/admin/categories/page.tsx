'use client'

import { AdminMetricsGate, CategoriesSection } from '../_components/AdminShell'

export default function AdminCategoriesPage() {
  return (
    <AdminMetricsGate
      title="Claim Category Intelligence"
      description="Private DAM usage-mix read across categories, confidence, latency, and latest examples."
      render={(metrics) => <CategoriesSection metrics={metrics} />}
    />
  )
}
