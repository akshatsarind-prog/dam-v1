import type { ResultV2ListItem } from './resultV2Types'

type ResultNextStepsProps = {
  items: ResultV2ListItem[]
}

export default function ResultNextSteps({ items }: ResultNextStepsProps) {
  return (
    <section className="result-v2-card result-v2-card--action" aria-labelledby="result-v2-next-steps">
      <div className="result-v2-section-head">
        <p className="result-v2-eyebrow">What you should do now</p>
      </div>
      <h2 id="result-v2-next-steps" className="result-v2-title-sm">
        What you should do now
      </h2>
      <ul className="result-v2-list result-v2-list--action result-v2-list--steps">
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </section>
  )
}
