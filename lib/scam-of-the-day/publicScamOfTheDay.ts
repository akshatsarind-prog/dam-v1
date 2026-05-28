import 'server-only'

import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

const DRAFTS_TABLE = 'dam_scam_of_day_drafts'

type DraftRow = Record<string, unknown>

export type PublicScamOfTheDay = {
  title: string
  candidatePattern: string
  summary: string
  scamPattern: string
  whyRisky: string
  warningSigns: string[]
  whatUsersShouldDo: string[]
  damCta: string
  sourceCount: number
  updatedAt: string
  sourceNote: string
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readIsoDate(value: unknown) {
  const text = readString(value)
  if (!text) {
    return ''
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function normalizeBody(body: string) {
  return body.replace(/\r\n/g, '\n').trim()
}

function findSectionBlock(body: string, label: string, nextLabels: string[]) {
  const startMarker = `${label}:\n`
  const startIndex = body.indexOf(startMarker)
  if (startIndex < 0) {
    return ''
  }

  const contentStart = startIndex + startMarker.length
  const remaining = body.slice(contentStart)
  const nextIndexes = nextLabels
    .map((nextLabel) => remaining.indexOf(`\n\n${nextLabel}:\n`))
    .filter((index) => index >= 0)

  const endIndex = nextIndexes.length ? Math.min(...nextIndexes) : remaining.length
  return remaining.slice(0, endIndex).trim()
}

function parseBulletList(block: string) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
}

function sanitizePublicDraft(row: DraftRow): PublicScamOfTheDay | null {
  const body = normalizeBody(readString(row.body))
  const title = readString(row.title)
  const candidatePattern = readString(row.candidate_pattern)
  const sourceCount = readNumber(row.source_count, 0)
  const updatedAt = readIsoDate(row.updated_at) || readIsoDate(row.created_at)

  if (!body || !title || sourceCount < 2) {
    return null
  }

  const scamPattern = findSectionBlock(body, 'Scam pattern', [
    'Why this is risky',
    'Common warning signs',
    'What DAM observed',
  ])
  const whyRisky = findSectionBlock(body, 'Why this is risky', [
    'Common warning signs',
    'What DAM observed',
    'Reputable source check',
  ])
  const warningSigns = parseBulletList(
    findSectionBlock(body, 'Common warning signs', [
      'What DAM observed',
      'Reputable source check',
      'What users should do',
    ])
  )
  const whatUsersShouldDo = parseBulletList(
    findSectionBlock(body, 'What users should do', ['DAM CTA', 'Approval checklist'])
  )
  const damCta = findSectionBlock(body, 'DAM CTA', ['Approval checklist', 'Publication status'])

  if (!scamPattern || !whyRisky || warningSigns.length === 0 || whatUsersShouldDo.length === 0 || !damCta) {
    return null
  }

  return {
    title,
    candidatePattern: candidatePattern || title.replace(/^Scam of the Day:\s*/i, '').trim(),
    summary: scamPattern,
    scamPattern,
    whyRisky,
    warningSigns: warningSigns.slice(0, 4),
    whatUsersShouldDo,
    damCta,
    sourceCount,
    updatedAt,
    sourceNote:
      sourceCount >= 2
        ? `Reviewed against ${sourceCount} reputable sources before public display.`
        : 'Scam of the Day is being reviewed. Check back soon.',
  }
}

export async function getPublicScamOfTheDay(): Promise<PublicScamOfTheDay | null> {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(DRAFTS_TABLE)
    .select('title, candidate_pattern, body, source_count, updated_at, created_at, status, source_check_status')
    .eq('status', 'approved')
    .eq('source_check_status', 'complete')
    .gte('source_count', 2)
    .order('draft_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return sanitizePublicDraft(data as DraftRow)
}
