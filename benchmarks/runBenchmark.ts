import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type BenchmarkClaim = {
  id: number
  category: string
  claim: string
  expected_behavior: string
}

type SafeRecord = Record<string, unknown>

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const claimsPath = path.join(scriptDir, 'benchmark_claims.json')
const outputPath = path.join(scriptDir, 'benchmark_results.csv')
const apiUrl = 'http://localhost:3000/api/analyze'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, '\n')}"`
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3)}...`
}

function asObject(value: unknown): SafeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SafeRecord) : null
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return ''
}

function resolveResult(payload: unknown): SafeRecord | null {
  const root = asObject(payload)
  if (!root) {
    return null
  }

  const result = asObject(root.result)
  if (result) {
    return result
  }

  const data = asObject(root.data)
  if (data) {
    return data
  }

  return root
}

function extractVerdict(result: SafeRecord | null) {
  if (!result) return ''

  return firstString(
    result.verdict,
    asObject(result.assessment)?.verdict,
    asObject(result.output)?.verdict,
    asObject(result.analysis)?.verdict
  )
}

function extractConfidence(result: SafeRecord | null) {
  if (!result) return ''

  const direct = firstNumber(
    result.confidence,
    result.score,
    result.confidenceScore,
    asObject(result.assessment)?.confidence,
    asObject(result.assessment)?.score,
    asObject(result.output)?.confidence,
    asObject(result.output)?.score,
    asObject(result.analysis)?.confidence,
    asObject(result.analysis)?.score
  )

  return direct === '' ? '' : String(direct)
}

function extractContradiction(result: SafeRecord | null) {
  if (!result) return ''

  const value =
    result.contradictions ??
    result.contradictionSummary ??
    result.conflictingSignals ??
    asObject(result.assessment)?.contradictions ??
    asObject(result.output)?.contradictions ??
    asObject(result.analysis)?.contradictions

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return ''
}

function extractExcerpt(payload: unknown) {
  try {
    const text = JSON.stringify(payload)
    return text ? truncate(text, 500) : ''
  } catch {
    return ''
  }
}

async function main() {
  const raw = await readFile(claimsPath, 'utf8')
  const claims = JSON.parse(raw) as BenchmarkClaim[]
  const rows: string[] = []

  rows.push(
    [
      'id',
      'category',
      'claim',
      'expected_behavior',
      'dam_verdict',
      'confidence_score',
      'confidence_quality_manual',
      'hallucination_manual',
      'contradiction_result',
      'evidence_quality_manual',
      'latency_ms',
      'latency_seconds',
      'api_success',
      'error',
      'notes_manual',
      'raw_response_excerpt',
    ]
      .map(csvEscape)
      .join(',')
  )

  for (let index = 0; index < claims.length; index += 1) {
    const claim = claims[index]
    const startedAt = Date.now()
    let apiSuccess = false
    let error = ''
    let verdict = ''
    let confidence = ''
    let contradiction = ''
    let rawResponseExcerpt = ''
    let latencyMs = 0

    console.log(`[${index + 1}/${claims.length}] testing claim...`)

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ claim: claim.claim }),
      })

      const text = await response.text()
      latencyMs = Date.now() - startedAt
      apiSuccess = response.ok

      let parsed: unknown = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = text
      }

      const result = resolveResult(parsed)
      verdict = extractVerdict(result)
      confidence = extractConfidence(result)
      contradiction = extractContradiction(result)
      rawResponseExcerpt = extractExcerpt(parsed)

      if (!response.ok) {
        error = firstString(
          asObject(parsed)?.error,
          asObject(parsed)?.message,
          `${response.status} ${response.statusText}`.trim()
        )
      }
    } catch (caught) {
      latencyMs = Date.now() - startedAt
      apiSuccess = false
      error = caught instanceof Error ? caught.message : String(caught)
    }

    rows.push(
      [
        claim.id,
        claim.category,
        claim.claim,
        claim.expected_behavior,
        verdict,
        confidence,
        '',
        '',
        contradiction,
        '',
        latencyMs,
        (latencyMs / 1000).toFixed(3),
        apiSuccess ? 'true' : 'false',
        error,
        '',
        rawResponseExcerpt,
      ]
        .map(csvEscape)
        .join(',')
    )

    if (index < claims.length - 1) {
      await sleep(500)
    }
  }

  await writeFile(outputPath, `${rows.join('\n')}\n`, 'utf8')
  console.log(`Benchmark results written to ${outputPath}`)
}

main().catch((error) => {
  console.error('Benchmark runner failed:', error)
  process.exitCode = 1
})
