export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log({ [label]: true, timeoutMs: ms })
      }

      resolve(fallback)
    }, ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
