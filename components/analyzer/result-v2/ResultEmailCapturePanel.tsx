import BetaSignupCard from '../BetaSignupCard'
import type { ResultV2EmailCapture } from './resultV2Types'

type ResultEmailCapturePanelProps = {
  emailCapture: ResultV2EmailCapture
}

export default function ResultEmailCapturePanel({ emailCapture }: ResultEmailCapturePanelProps) {
  return (
    <article className="result-v2-secondary-card">
      <p className="result-v2-eyebrow">Alerts</p>
      <p className="result-v2-body">Get scam and suspicious-message alerts.</p>
      {emailCapture.reuseExistingSignup ? <BetaSignupCard /> : null}
    </article>
  )
}
