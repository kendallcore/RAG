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

const STORAGE_KEY = 'cognitive-combat-memory'

type SpectatorVote = { label: string; count: number }

const initialSpectatorVotes: SpectatorVote[] = [
  { label: 'User Edge', count: 41 },
  { label: 'AI Momentum', count: 58 },
  { label: 'Draw', count: 12 },
]

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

  const winCondition = useMemo(() => {
    if (stability <= 30) return 'Emotional Breakdown (AI wins)'
    if (fallacies >= 4) return 'Contradiction Collapse'
    if (userScore >= 90) return 'Logical Victory (User)'
    if (aiScore >= 90) return 'Endurance Victory (AI)'
    return 'Evidence Dominance'
  }, [aiScore, fallacies, stability, userScore])

  const pushImpact = (event: ImpactEvent) =>
    setImpacts((prev) => [event, ...prev].slice(0, 8))

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
      pushImpact({
        id: nowId(),
        type: 'system',
        text: 'Share card copied to clipboard.',
        timestamp: Date.now(),
      })
    } catch {
      pushImpact({
        id: nowId(),
        type: 'system',
        text: 'Unable to copy. Select the share text manually.',
        timestamp: Date.now(),
      })
    }
  }

  return (
    <div className={`app ${flash ? `flash-${flash}` : ''}`}>
      <header className="header">
        <div>
          <p className="eyebrow">Cognitive Combat Engine</p>
          <h1>Cognitive Arena</h1>
          <div className="divider" />
          <p className="subhead">
            A gamified AI-powered intellectual combat platform. Choose your opponent and enter the arena.
          </p>
        </div>
        <div className={`scoreboard ${scorePulse ? 'pulse' : ''}`}>
          <div>
            <span>User</span>
            <strong>{animatedUserScore}</strong>
          </div>
          <div className="score-divider" />
          <div>
            <span>AI</span>
            <strong>{animatedAiScore}</strong>
          </div>
        </div>
      </header>

      <section className="archetypes">
        {ARCHETYPES.map((item) => (
          <button
            key={item.id}
            className={`archetype ${selectedArchetypeId === item.id ? 'active' : ''}`}
            onClick={() => setSelectedArchetypeId(item.id)}
          >
            <h3>{item.name}</h3>
            <p>{item.tone}</p>
            <span>{item.tactics.join(' • ')}</span>
          </button>
        ))}
      </section>

      <section className="arena">
        <div className="panel">
          <div className="panel-header">
            <h2>You</h2>
            <span className="tag">{extractKeyArgument(topic)}</span>
          </div>
          <div className="panel-body">
            {messages.filter((m) => m.side === 'user').length === 0 ? (
              <p className="panel-empty">Make the first move.</p>
            ) : (
              messages
                .filter((m) => m.side === 'user')
                .map((m) => (
                  <div key={m.id} className="message user">
                    {m.text}
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="impact-feed">
          <div className="impact-header">
            <h2>Impact Feed</h2>
            <div className="meters">
              <div>
                <span>Cognitive Stability</span>
                <strong>{stability}%</strong>
                <div className="meter-bar">
                  <div className="meter-fill" style={{ width: `${stability}%` }} />
                </div>
              </div>
              <div>
                <span>Pressure Level</span>
                <strong>{pressureLabel}</strong>
                <div className={`meter-bar ${pressurePulse ? 'jitter' : ''}`}>
                  <div className="meter-fill" style={{ width: `${pressure}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="impact-body">
            {impacts.length === 0 ? (
              <p className="panel-empty">No hits yet. Strike first.</p>
            ) : (
              impacts.map((impact) => (
                <div key={impact.id} className={`impact ${impact.type}`}>
                  {impact.text}
                </div>
              ))
            )}
          </div>

          <div className="win-conditions">
            <h3>Win Conditions</h3>
            <div className="win-grid">
              <div>
                <span>Logical Victory</span>
                <strong>{userScore}/100</strong>
              </div>
              <div>
                <span>Endurance</span>
                <strong>{aiScore}/100</strong>
              </div>
              <div>
                <span>Contradiction</span>
                <strong>{fallacies}/4</strong>
              </div>
              <div>
                <span>Stability</span>
                <strong>{stability}%</strong>
              </div>
            </div>
            <div className="win-current">Current Win Path: {winCondition}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>{archetype.name}</h2>
            <span className="tag">Strategy: {strategy.replace('-', ' ')}</span>
          </div>
          <div className="panel-body">
            {messages.filter((m) => m.side === 'ai').length === 0 ? (
              <p className="panel-empty">Awaiting your move.</p>
            ) : (
              messages
                .filter((m) => m.side === 'ai')
                .map((m) => (
                  <div key={m.id} className="message ai">
                    {m.text}
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      <section className="controls">
        <div className="control-card">
          <label>Debate Topic</label>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} />
        </div>
        <div className="control-card">
          <label>Memory Snapshot</label>
          <p>
            Past debates: {memoryProfile.totalDebates} • Favorite patterns:{' '}
            {memoryProfile.favoriteArguments.join(', ') || 'None yet'}
          </p>
          <p className="muted">Weaknesses: {memoryProfile.weaknesses.join(', ') || 'No pattern yet'}.</p>
        </div>
        <div className="control-card">
          <label>Share Result</label>
          <button onClick={handleShare}>Share My Debate Result</button>
        </div>
        <div className="control-card">
          <label>Spectator Mode</label>
          <div className="toggle-row">
            <span>Enable live crowd view</span>
            <button onClick={() => setSpectatorMode((prev) => !prev)}>
              {spectatorMode ? 'Disable' : 'Enable'}
            </button>
          </div>
          {spectatorMode && (
            <div className="spectator-panel">
              <p>Live spectators: 128</p>
              {spectatorVotes.map((vote, index) => (
                <button key={vote.label} className="ghost" onClick={() => handleVote(index)}>
                  {vote.label}: {vote.count}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="input-bar">
        <textarea
          rows={3}
          value={input}
          placeholder="Enter your argument. Push for evidence. Avoid contradictions."
          onChange={(event) => setInput(event.target.value)}
        />
        <button onClick={handleSubmit}>Strike</button>
      </section>

      <footer className="footer">
        <span>Fallacies detected: {fallacies}</span>
        <span>Contradictions: {contradictions}</span>
        <span>Pressure: {pressureLabel}</span>
      </footer>
    </div>
  )
}
