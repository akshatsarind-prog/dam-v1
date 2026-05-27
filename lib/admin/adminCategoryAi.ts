import 'server-only'

import OpenAI from 'openai'
import type { AdminClaimCategory, AdminClaimRecord } from '@/lib/admin/adminMetricsTypes'

const CATEGORY_AI_MODEL = 'gpt-4o-mini'
const AMBIGUOUS_CLAIM_LIMIT = 20

const ADMIN_CATEGORY_LIST: readonly AdminClaimCategory[] = [
  'scam',
  'government',
  'health',
  'politics',
  'statistics',
  'social_rumor',
  'breaking_news',
  'finance',
  'crypto',
  'technology_ai',
  'education',
  'science',
  'environment',
  'legal',
  'celebrity_media',
  'product_consumer',
  'religion_community',
  'general_fact',
  'other',
] as const

type AdminAiCategorizationOptions = {
  enabled?: boolean
}

type AiCategorizationResult = {
  claimText: string
  category: AdminClaimCategory
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

function isCategory(value: string): value is AdminClaimCategory {
  return ADMIN_CATEGORY_LIST.includes(value as AdminClaimCategory)
}

function normalizeAiResults(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AiCategorizationResult[]
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const row = item as Record<string, unknown>
      const claimText = typeof row.claimText === 'string' ? row.claimText.trim() : ''
      const category = typeof row.category === 'string' && isCategory(row.category) ? row.category : null
      const confidence =
        row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
          ? row.confidence
          : null
      const reason = typeof row.reason === 'string' ? row.reason.trim() : ''

      if (!claimText || !category || !confidence || !reason) {
        return null
      }

      return {
        claimText,
        category,
        confidence,
        reason,
      } satisfies AiCategorizationResult
    })
    .filter((item): item is AiCategorizationResult => Boolean(item))
}

export async function maybeApplyAdminAiCategorization(
  claims: AdminClaimRecord[],
  options?: AdminAiCategorizationOptions
) {
  if (!options?.enabled || !process.env.OPENAI_API_KEY) {
    return claims
  }

  const ambiguousClaims = claims
    .filter((claim) => claim.category === 'other' && claim.categorySource === 'fallback')
    .slice(0, AMBIGUOUS_CLAIM_LIMIT)

  if (!ambiguousClaims.length) {
    return claims
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const completion = await openai.chat.completions.create({
    model: CATEGORY_AI_MODEL,
    temperature: 0,
    response_format: {
      type: 'json_object',
    },
    messages: [
      {
        role: 'system',
        content:
          'You classify DAM admin claim logs for analytics only. Never change verdict logic. Return JSON only with key items. Each item must include claimText, category, confidence, reason. Use only the allowed categories.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          categories: ADMIN_CATEGORY_LIST,
          claims: ambiguousClaims.map((claim) => ({
            claimText: claim.claimText,
            verdict: claim.verdict,
            riskLabel: claim.riskLabel,
            currentCategory: claim.category,
            currentReason: claim.categoryReason,
          })),
        }),
      },
    ],
  })

  const rawContent = completion.choices[0]?.message?.content

  if (!rawContent) {
    return claims
  }

  const parsed = JSON.parse(rawContent) as { items?: unknown } | null
  const normalized = normalizeAiResults(parsed?.items)

  if (!normalized.length) {
    return claims
  }

  const aiByClaimText = new Map(normalized.map((item) => [item.claimText, item]))

  return claims.map((claim) => {
    const aiMatch = aiByClaimText.get(claim.claimText)

    if (!aiMatch || aiMatch.category === 'other') {
      return claim
    }

    return {
      ...claim,
      category: aiMatch.category,
      categorySource: 'ai_assisted',
      categoryConfidence: aiMatch.confidence,
      categoryReason: aiMatch.reason,
      suggestedCategory: null,
    } satisfies AdminClaimRecord
  })
}
