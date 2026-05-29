import BetaSignupCard from '../BetaSignupCard'
import type { ResultV2EmailCapture } from './resultV2Types'

type ResultEmailCapturePanelProps = {
  emailCapture: ResultV2EmailCapture
}

const panelStyle = {
  padding: 14,
} as const

const descriptionStyle = {
  margin: '10px 0 0',
  color: 'rgba(235, 235, 240, 0.84)',
  fontSize: '13.5px',
  lineHeight: 1.6,
} as const

export default function ResultEmailCapturePanel({ emailCapture }: ResultEmailCapturePanelProps) {
  return (
    <section
      className="result-v2-secondary-card"
      style={panelStyle}
      aria-labelledby="result-v2-email-capture"
    >
      <div className="result-v2-section-head">
        <p className="result-v2-eyebrow">{emailCapture.eyebrow}</p>
      </div>
      <h2 id="result-v2-email-capture" className="result-v2-title-sm">
        {emailCapture.title}
      </h2>
      <p style={descriptionStyle}>{emailCapture.description}</p>
      {emailCapture.reuseExistingSignup ? (
        <BetaSignupCard
          variant="inline"
          hideHeading
          buttonLabel={emailCapture.buttonLabel}
          privacyNote={emailCapture.privacyNote}
          source="result_signup"
          captureVariant={emailCapture.variant}
          claimCategory={emailCapture.claimCategory}
          riskLabel={emailCapture.riskLabel}
          verdict={emailCapture.verdict}
          sourceResultType={emailCapture.sourceResultType}
        />
      ) : null}
    </section>
  )
}
