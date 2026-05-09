# DAM V1 Benchmark Automation

This folder contains a manual benchmark harness only.

It does not run automatically.

## What it does

- Loads `benchmarks/benchmark_claims.json`
- Sends each claim one-by-one to `http://localhost:3000/api/analyze`
- Measures latency
- Writes results to `benchmarks/benchmark_results.csv`
- Leaves manual review fields blank for later scoring

## How to run later

1. Start DAM first:

   ```bash
   npm run dev
   ```

2. Run the benchmark script:

   ```bash
   npx tsx benchmarks/runBenchmark.ts
   ```

3. Open the generated CSV:

   - `benchmarks/benchmark_results.csv`

4. Import the CSV into Google Sheets.

5. Manually fill:

   - verdict quality
   - confidence quality
   - hallucination
   - evidence quality
   - notes

## tsx

If `tsx` is not already available in this project, install it manually:

```bash
npm install -D tsx
```

## Benchmarking rules

- Do not modify production logic during benchmark collection.
- Do not change retrieval, source ranking, system prompt, or UI for benchmark runs.
- Do not run the benchmark from this setup step.
