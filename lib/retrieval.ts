import { tavily } from '@tavily/core'

export type RetrievedEvidence = {
  title: string
  url: string
  content: string
  rawContent: string
  score: number
  publishedDate: string | null
  favicon: string | null
  query: string
}

type TavilyResult = {
  title?: string
  url?: string
  content?: string
  rawContent?: string
  score?: number
  publishedDate?: string
  favicon?: string
}

function getClient() {
  if (!process.env.TAVILY_API_KEY) {
    return null
  }

  return tavily({
    apiKey: process.env.TAVILY_API_KEY,
  })
}

function uniqueQueries(queries: string[]) {
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).slice(0, 3)
}

export async function retrieveEvidence(queryOrQueries: string | string[]) {
  const client = getClient()
  const queries = uniqueQueries(Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])

  if (!client || !queries.length) {
    return []
  }

  const searches = queries.map(async (query, index) => {
    try {
      if (!query || query.trim().length < 2) {
        return []
      }

      const response = await client.search(query, {
        searchDepth: 'fast',
        topic: index === 0 ? 'news' : 'general',
        maxResults: 3,
        chunksPerSource: 1,
        includeRawContent: false,
        includeAnswer: false,
        includeFavicon: true,
        autoParameters: false,
        timeout: 5,
      })

      return response.results.map((result: TavilyResult) => ({
        title: result.title || 'Untitled source',
        url: result.url || '',
        content: (result.content || '').slice(0, 500),
        rawContent: '',
        score: typeof result.score === 'number' ? result.score : 0,
        publishedDate: result.publishedDate || null,
        favicon: result.favicon || null,
        query,
      }))
    } catch (error) {
      console.error('Tavily retrieval failed:', error)
      return []
    }
  })

  return (await Promise.all(searches)).flat().filter((result) => result.url)
}
