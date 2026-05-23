import { notFound } from 'next/navigation'
import { AdminReportWorkspace } from '../../_components/AdminReportSystem'
import { isAdminBranchSlug } from '@/lib/admin/adminReportModel'

export default async function AdminReportBranchPage(
  props: PageProps<'/admin/report/[branch]'>
) {
  const { branch } = await props.params

  if (!isAdminBranchSlug(branch)) {
    notFound()
  }

  return <AdminReportWorkspace mode={{ kind: 'admin-branch', slug: branch }} />
}
