import type { ResultV2ListItem } from './resultV2Types'

type ResultMainProblemsProps = {
  items: ResultV2ListItem[]
}

export default function ResultMainProblems({ items }: ResultMainProblemsProps) {
  return (
    <section className="result-v2-card" aria-labelledby="result-v2-main-problems">
      <div className="result-v2-section-head">
        <p className="result-v2-eyebrow">Main warning signs</p>
      </div>
      <h2 id="result-v2-main-problems" className="result-v2-title-sm">
        Main warning signs
      </h2>
      <ul className="result-v2-list result-v2-list--warning">
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </section>
  )
}
