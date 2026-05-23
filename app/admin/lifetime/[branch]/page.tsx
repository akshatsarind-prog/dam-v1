import { notFound } from 'next/navigation'
import { AdminReportWorkspace } from '../../_components/AdminReportSystem'
import { isLifetimeBranchSlug } from '@/lib/admin/adminReportModel'

export default async function AdminLifetimeBranchPage(
  props: PageProps<'/admin/lifetime/[branch]'>
) {
  const { branch } = await props.params

  if (!isLifetimeBranchSlug(branch)) {
    notFound()
  }

  return <AdminReportWorkspace mode={{ kind: 'lifetime-branch', slug: branch }} />
}
