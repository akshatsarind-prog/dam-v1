'use client'

import { AdminHomeCardGrid, AdminMetricsGate } from './_components/AdminShell'

export default function AdminPage() {
  return (
    <AdminMetricsGate
      title="DAM admin home"
      description="Private navigation hub for DAM admin sections. Enter the admin password to access the section routes."
      showHomeLink={false}
      render={(metrics) => <AdminHomeCardGrid generatedAt={metrics.generatedAt} />}
    />
  )
}
