import { useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPES, ARCHETYPE_MAP, type ArchetypeId } from './archetypes'
import {
  analyzeInput,
  buildMemoryProfile,
  clamp,
  computePressure,
  computeStability,
  extractKeyArgument,
  generateAIResponse,
  nextStrategy,
  type ImpactEvent,
  type Message,
  type StrategyMode,
} from './engine'
import './styles.css'

const STORAGE_KEY = 'cognitive-combat-memory'

type SpectatorVote = { label: string; count: number }

const initialSpectatorVotes: SpectatorVote[] = [
  { label: 'User Edge', count: 41 },
  { label: 'AI Momentum', count: 58 },
  { label: 'Draw', count: 12 },
]

const ARCHETYPE_ICONS: Record<ArchetypeId, string> = {
  logician: '⚖',
  manipulator: '🌀',
  provocateur: '⚡',
  statistician: '📊',
  philosopher: '∞',
  strategist: '♟',
}

const IMPACT_ICONS: Record<string, string> = {
  'ai-hit': '↯',
  'user-hit': '✦',
  'fallacy': '⚠',
  'system': '·',
}

const nowId = () => Math.random().toString(36).slice(2)

const useAnimatedNumber = (value: number, duration = 300) => {
  const [animated, setAnimated] = useState(value)

  useEffect(() => {
    const start = performance.now()
    const from = animated

    const tick = (time: number) => {
      const progress = Math.min((time - start) / duration, 1)
      const nextValue = from + (value - from) * progress
      setAnimated(nextValue)
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return Math.round(animated)
}

export default function App() {
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<ArchetypeId>('logician')
  const [topic, setTopic] = useState('Is AI a net positive for society?')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [impacts, setImpacts] = useState<ImpactEvent[]>([])
  const [userScore, setUserScore] = useState(50)
  const [aiScore, setAiScore] = useState(50)
  const [stability, setStability] = useState(92)
  const [pressure, setPressure] = useState(35)
  const [strategy, setStrategy] = useState<StrategyMode>('precision')
  const [contradictions, setContradictions] = useState(0)
  const [fallacies, setFallacies] = useState(0)
  const [spectatorMode, setSpectatorMode] = useState(false)
  const [spectatorVotes, setSpectatorVotes] = useState<SpectatorVote[]>(initialSpectatorVotes)
  const [flash, setFlash] = useState<'ai' | 'user' | null>(null)
  const [scorePulse, setScorePulse] = useState(false)
  const [pressurePulse, setPressurePulse] = useState(false)
  const prevPressure = useRef(pressure)
  const [memoryHistory, setMemoryHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })

  const archetype = useMemo(() => ARCHETYPE_MAP.get(selectedArchetypeId)!, [selectedArchetypeId])
  const memoryProfile = useMemo(() => buildMemoryProfile(memoryHistory), [memoryHistory])
  const animatedUserScore = useAnimatedNumber(userScore)
  const animatedAiScore = useAnimatedNumber(aiScore)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryHistory.slice(-25)))
  }, [memoryHistory])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 500)
    return () => window.clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    setScorePulse(true)
    const timer = window.setTimeout(() => setScorePulse(false), 300)
    return () => window.clearTimeout(timer)
  }, [userScore, aiScore])

  useEffect(() => {
    if (pressure > prevPressure.current) {
      setPressurePulse(true)
      const timer = window.setTimeout(() => setPressurePulse(false), 320)
      prevPressure.current = pressure
      return () => window.clearTimeout(timer)
    }
    prevPressure.current = pressure
  }, [pressure])

  const pressureLabel = pressure > 70 ? 'Critical' : pressure > 50 ? 'Rising' : 'Stable'
  const pressureColorClass = pressure > 70 ? 'red' : pressure > 50 ? 'red' : 'muted'
  const stabilityClass = stability >= 60 ? 'green' : 'red'

  const winCondition = useMemo(() => {
    if (stability <= 30) return 'Emotional Breakdown (AI wins)'
    if (fallacies >= 4) return 'Contradiction Collapse'
    if (userScore >= 90) return 'Logical Victory (User)'
    if (aiScore >= 90) return 'Endurance Victory (AI)'
    return 'Evidence Dominance'
  }, [aiScore, fallacies, stability, userScore])

  const pushImpact = (event: ImpactEvent) =>
    setImpacts((prev) => [event, ...prev].slice(0, 10))

  const handleVote = (index: number) => {
    setSpectatorVotes((prev) =>
      prev.map((vote, i) => (i === index ? { ...vote, count: vote.count + 1 } : vote)),
    )
  }

  const handleSubmit = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: nowId(),
      side: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    }

    const analysis = analyzeInput(userMessage.text, memoryHistory)

    const userDelta =
      analysis.logicalSignals * 4 +
      analysis.evidenceSignals * 3 -
      analysis.fallacies.length * 5 -
      analysis.repeats * 3 -
      analysis.avoidance * 4 -
      analysis.emotionalSpikes * 1

    const aiDelta = userDelta >= 3 ? 2 : userDelta <= -2 ? 6 : 3

    const nextUserScore = clamp(userScore + userDelta, 0, 100)
    const nextAiScore = clamp(aiScore + aiDelta, 0, 100)

    const nextStability = computeStability(stability, analysis)
    const nextPressure = computePressure(nextStability, nextAiScore, nextUserScore)
    const nextStrategyMode = nextStrategy(analysis, strategy)

    const nextMemory = [...memoryHistory, userMessage.text]
    const nextMemoryProfile = buildMemoryProfile(nextMemory)

    const aiMessage: Message = {
      id: nowId(),
      side: 'ai',
      text: generateAIResponse(archetype, analysis, nextStrategyMode, nextMemoryProfile),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage, aiMessage])
    setMemoryHistory(nextMemory)
    setUserScore(nextUserScore)
    setAiScore(nextAiScore)
    setStability(nextStability)
    setPressure(nextPressure)
    setStrategy(nextStrategyMode)
    setContradictions((prev) => prev + analysis.contradictions)
    setFallacies((prev) => prev + analysis.fallacies.length)

    if (userDelta >= 2) {
      setFlash('user')
      pushImpact({
        id: nowId(),
        type: 'user-hit',
        text: `Solid rebuttal. User momentum +${userDelta.toFixed(0)}.`,
        timestamp: Date.now(),
      })
    } else {
      setFlash('ai')
      pushImpact({
        id: nowId(),
        type: 'ai-hit',
        text: `AI lands a hit. Pressure +${aiDelta.toFixed(0)}.`,
        timestamp: Date.now(),
      })
    }

    analysis.fallacies.forEach((fallacy) => {
      pushImpact({
        id: nowId(),
        type: 'fallacy',
        text: fallacy,
        timestamp: Date.now(),
      })
    })

    if (analysis.contradictions > 0) {
      pushImpact({
        id: nowId(),
        type: 'system',
        text: 'Contradiction spike detected. Stability dropping.',
        timestamp: Date.now(),
      })
    }

    setInput('')
  }

  const handleShare = async () => {
    const shareText = `I debated ${archetype.name} in the Cognitive Arena.\nLogical Score: ${userScore}\nContradictions: ${contradictions}\nFallacies: ${fallacies}`
    try {
      await navigator.clipboard.writeText(shareText)
      pushImpact({ id: nowId(), type: 'system', text: 'Share card copied to clipboard.', timestamp: Date.now() })
    } catch {
      pushImpact({ id: nowId(), type: 'system', text: 'Unable to copy. Select the share text manually.', timestamp: Date.now() })
    }
  }

  const userMessages = messages.filter((m) => m.side === 'user')
  const aiMessages = messages.filter((m) => m.side === 'ai')

  return (
    <div className={`app ${flash ? `flash-${flash}` : ''}`}>

      {/* ═══ TOP BAR ═══ */}
      <header className="header">
        <div className="header-brand">
          <p className="eyebrow">Cognitive Combat Engine</p>
          <h1>Cognitive Arena</h1>
        </div>

        <div className="header-center">
          <div className="arena-badge">
            <span className="arena-badge-dot" />
            Live Match
          </div>
        </div>

        <div className="header-right">
          <div className={`scoreboard ${scorePulse ? 'pulse' : ''}`}>
            <div className="score-side user">
              <span className="score-label">You</span>
              <span className="score-value">{animatedUserScore}</span>
            </div>
            <div className="score-sep" />
            <span className="score-vs">VS</span>
            <div className="score-sep" />
            <div className="score-side ai">
              <span className="score-label">AI</span>
              <span className="score-value">{animatedAiScore}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ OPPONENT SELECTOR ═══ */}
      <section className="opponent-band">
        <p className="opponent-band-label">Choose Opponent</p>
        <div className="archetypes">
          {ARCHETYPES.map((item) => (
            <button
              key={item.id}
              id={`archetype-${item.id}`}
              className={`archetype ${selectedArchetypeId === item.id ? 'active' : ''}`}
              onClick={() => setSelectedArchetypeId(item.id)}
            >
              {selectedArchetypeId === item.id && <span className="active-indicator" />}
              <span className="archetype-icon">{ARCHETYPE_ICONS[item.id]}</span>
              <h3>{item.name}</h3>
              <p className="archetype-tone">{item.tone}</p>
              <div className="archetype-tactics">
                {item.tactics.map((t) => (
                  <span key={t} className="tactic-chip">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ═══ MAIN ARENA ═══ */}
      <section className="arena-section">

        {/* — Left: User Panel — */}
        <div className="panel user-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-dot" />
              <h2>You</h2>
            </div>
            <span className="panel-tag">{extractKeyArgument(topic)}</span>
          </div>
          <div className="panel-body">
            {userMessages.length === 0 ? (
              <div className="panel-empty">
                <span className="panel-empty-icon">✦</span>
                Make the first move.
              </div>
            ) : (
              userMessages.map((m) => (
                <div key={m.id} className="message user">{m.text}</div>
              ))
            )}
          </div>
        </div>

        {/* — Center: Impact Feed — */}
        <div className="impact-feed">
          {/* Stats */}
          <div className="impact-feed-header">
            <p className="impact-feed-title">Combat Stats</p>

            <div className="stat-row">
              <div className="stat-row-head">
                <span className="stat-label">Cognitive Stability</span>
                <span className={`stat-value ${stabilityClass}`}>{stability}%</span>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill ${stabilityClass}`}
                  style={{ width: `${stability}%` }}
                />
              </div>
            </div>

            <div className="stat-row">
              <div className="stat-row-head">
                <span className="stat-label">AI Pressure</span>
                <span className={`stat-value ${pressureColorClass}`}>{pressureLabel}</span>
              </div>
              <div className={`bar-track ${pressurePulse ? 'jitter' : ''}`}>
                <div
                  className="bar-fill red"
                  style={{ width: `${pressure}%` }}
                />
              </div>
            </div>
          </div>

          {/* Impact log */}
          <div className="impact-log">
            {impacts.length === 0 ? (
              <p className="impact-log-empty">No hits yet. Strike first.</p>
            ) : (
              impacts.map((ev) => (
                <div key={ev.id} className={`impact-entry ${ev.type}`}>
                  <span className="impact-icon">{IMPACT_ICONS[ev.type]}</span>
                  <span>{ev.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Win condition pills */}
          <div className="win-pills">
            <div className={`win-pill ${userScore >= 80 ? 'positive' : ''}`}>
              <span className="win-pill-label">Logical Victory</span>
              <span className="win-pill-value">{userScore}/100</span>
            </div>
            <div className={`win-pill ${aiScore >= 80 ? 'danger' : ''}`}>
              <span className="win-pill-label">Endurance</span>
              <span className="win-pill-value">{aiScore}/100</span>
            </div>
            <div className={`win-pill ${fallacies >= 3 ? 'danger' : ''}`}>
              <span className="win-pill-label">Contradiction</span>
              <span className="win-pill-value">{fallacies}/4</span>
            </div>
            <div className={`win-pill ${stability >= 70 ? 'positive' : stability < 40 ? 'danger' : ''}`}>
              <span className="win-pill-label">Stability</span>
              <span className="win-pill-value">{stability}%</span>
            </div>
          </div>

          <div className="win-path-bar">
            <p className="win-path-label">Active Win Path</p>
            <p className="win-path-value">{winCondition}</p>
          </div>
        </div>

        {/* — Right: AI Panel — */}
        <div className="panel ai-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-dot" />
              <h2>{archetype.name}</h2>
            </div>
            <span className="panel-tag">⚔ {strategy.replace('-', ' ')}</span>
          </div>
          <div className="panel-body">
            {aiMessages.length === 0 ? (
              <div className="panel-empty">
                <span className="panel-empty-icon">↯</span>
                Awaiting your move.
              </div>
            ) : (
              aiMessages.map((m) => (
                <div key={m.id} className="message ai">{m.text}</div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══ CONTROLS SECTION ═══ */}
      <section className="controls-section">

        {/* Debate Topic */}
        <div className="control-card">
          <label className="control-label" htmlFor="debate-topic">Debate Topic</label>
          <input
            id="debate-topic"
            className="topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <div className="topic-underline" />
        </div>

        {/* Memory Snapshot */}
        <div className="control-card">
          <span className="control-label">Memory Snapshot</span>
          <p className="memory-text">
            Debates: <strong>{memoryProfile.totalDebates}</strong>
          </p>
          {memoryProfile.favoriteArguments.length > 0 && (
            <div className="memory-chips">
              {memoryProfile.favoriteArguments.map((arg, i) => (
                <span key={i} className="memory-chip">{arg}</span>
              ))}
            </div>
          )}
          {memoryProfile.weaknesses.length > 0 && (
            <p className="memory-text" style={{ color: 'rgba(244,35,40,0.7)', marginTop: 4 }}>
              ⚠ {memoryProfile.weaknesses.join(' · ')}
            </p>
          )}
        </div>

        {/* Spectator Mode */}
        <div className="control-card">
          <span className="control-label">Spectator Mode</span>
          <div className="toggle-row">
            <span className="toggle-label-text">Live crowd view</span>
            <button
              id="spectator-toggle"
              className={`toggle-btn ${spectatorMode ? 'on' : ''}`}
              onClick={() => setSpectatorMode((prev) => !prev)}
            >
              {spectatorMode ? 'ON' : 'OFF'}
            </button>
          </div>
          {spectatorMode && (
            <div className="spectator-body">
              <p>Live spectators: 128</p>
              {spectatorVotes.map((vote, index) => (
                <button
                  key={vote.label}
                  className="ghost-btn"
                  onClick={() => handleVote(index)}
                >
                  {vote.label} — {vote.count}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Share */}
        <div className="control-card">
          <span className="control-label">Share Result</span>
          <button id="share-btn" className="share-btn" onClick={handleShare}>
            <span>↗</span> Copy Card
          </button>
        </div>
      </section>

      {/* ═══ INPUT BAR ═══ */}
      <section className="input-bar">
        <div className="input-wrapper">
          <textarea
            id="argument-input"
            rows={3}
            value={input}
            placeholder="Enter your argument. Push for evidence. Avoid contradictions."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
          />
        </div>
        <button
          id="strike-btn"
          className="strike-btn"
          onClick={handleSubmit}
        >
          Strike ↯
        </button>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer-bar">
        <div className="footer-stat">Fallacies: <span className={fallacies > 0 ? '' : ''}>{fallacies}</span></div>
        <div className={`footer-stat ${contradictions > 0 ? 'danger' : ''}`}>Contradictions: <span>{contradictions}</span></div>
        <div className={`footer-stat ${pressure > 60 ? 'danger' : ''}`}>Pressure: <span>{pressureLabel}</span></div>
        <div className="footer-stat">Archetype: <span>{archetype.name}</span></div>
      </footer>
    </div>
  )
}
