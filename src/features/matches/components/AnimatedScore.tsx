import { useEffect, useRef, useState } from 'react'

type ScoreChange = { from: number; to: number; direction: 'up' | 'down'; revision: number }

export const scoreChangeDirection = (from: number, to: number, active = true) => !active || from === to ? null : to > from ? 'up' as const : 'down' as const

export const AnimatedScore = ({ value, active = true, className = '' }: { value: number; active?: boolean; className?: string }) => {
  const previous = useRef(value)
  const revision = useRef(0)
  const [change, setChange] = useState<ScoreChange | null>(null)

  useEffect(() => {
    const from = previous.current
    previous.current = value
    const direction = scoreChangeDirection(from, value, active)
    if (!direction) { setChange(null); return }
    const next = { from, to: value, direction, revision: ++revision.current }
    setChange(next)
    const timer = window.setTimeout(() => setChange(current => current?.revision === next.revision ? null : current), 400)
    return () => window.clearTimeout(timer)
  }, [active, value])

  return <span className={`animated-score ${change ? `animated-score--changing animated-score--${change.direction}` : ''} ${className}`} aria-label={`Score ${value}`}>
    {change ? <><span key={`old-${change.revision}`} aria-hidden="true" className="animated-score__old">{change.from}</span><span key={`new-${change.revision}`} aria-hidden="true" className="animated-score__new">{change.to}</span></> : <span aria-hidden="true">{value}</span>}
  </span>
}
