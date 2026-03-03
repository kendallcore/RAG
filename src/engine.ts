import type { Archetype, ArchetypeId } from './archetypes'

export type Message = {
  id: string
  side: 'user' | 'ai'
  text: string
  timestamp: number
}

export type ImpactEvent = {
  id: string
  type: 'ai-hit' | 'user-hit' | 'fallacy' | 'system'
  text: string
  timestamp: number
}

export type AnalysisResult = {
  emotionalSpikes: number
  contradictions: number
  repeats: number
  avoidance: number
  evidenceSignals: number
  logicalSignals: number
  fallacies: string[]
}

export type StrategyMode = 'precision' | 'pressure' | 'cold' | 'long-game' | 'data-push'

export type MemoryProfile = {
  totalDebates: number
  favoriteArguments: string[]
  weaknesses: string[]
  lastArguments: string[]
}

const FALLACY_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'Strawman detected', regex: /so you (are saying|think) /i },
  { label: 'False dilemma', regex: /(either|only).*\b(or)\b/i },
  { label: 'Appeal to emotion', regex: /(feel|hurt|offended|sad|angry)/i },
  { label: 'Ad hominem', regex: /(idiot|stupid|ignorant|clown)/i },
]

const AVOIDANCE_PHRASES = ['whatever', 'let us move on', 'not relevant', 'anyway', 'does not matter']

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)

const jaccard = (a: string[], b: string[]) => {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((word) => setB.has(word)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

export const analyzeInput = (text: string, userHistory: string[]): AnalysisResult => {
  const tokens = tokenize(text)
  const upperWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length
  const emotionalSpikes = (text.match(/!+/g) || []).length + upperWords
  const contradictions = /(actually|no,|i take that back|i was wrong)/i.test(text) ? 1 : 0
  const avoidance = AVOIDANCE_PHRASES.some((phrase) => text.toLowerCase().includes(phrase)) ? 1 : 0
  const evidenceSignals = (text.match(/\b\d+(?:\.\d+)?%?\b/g) || []).length + (text.match(/(study|data|evidence|source|report)/gi) || []).length
  const logicalSignals = (text.match(/(therefore|because|if|then|thus|implies)/gi) || []).length

  const repeats = userHistory.some((prev) => jaccard(tokens, tokenize(prev)) > 0.6) ? 1 : 0

  const fallacies = FALLACY_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.label)

  return {
    emotionalSpikes,
    contradictions,
    repeats,
    avoidance,
    evidenceSignals,
    logicalSignals,
    fallacies,
  }
}

export const nextStrategy = (analysis: AnalysisResult, current: StrategyMode): StrategyMode => {
  if (analysis.emotionalSpikes > 1) return 'cold'
  if (analysis.evidenceSignals >= 2) return 'data-push'
  if (analysis.logicalSignals >= 2) return 'precision'
  if (analysis.repeats > 0 || analysis.avoidance > 0) return 'pressure'
  return current
}

export const generateAIResponse = (
  archetype: Archetype,
  analysis: AnalysisResult,
  strategy: StrategyMode,
  memory: MemoryProfile,
): string => {
  const memoryLine = memory.lastArguments.length
    ? `Last time you leaned on: "${memory.lastArguments[0]}". That pattern is still visible.`
    : 'I am mapping your move patterns in real-time.'

  const strategyLine: Record<StrategyMode, string> = {
    precision: 'Define your premise. Then defend it without shifting terms.',
    pressure: 'You are circling. Commit to a claim or concede the gap.',
    cold: 'Emotional spikes detected. I will stay clinical.',
    'long-game': 'I am stacking constraints. This will close later.',
    'data-push': 'Numbers only. Bring evidence or step back.',
  }

  const archetypeLines: Record<ArchetypeId, string[]> = {
    logician: [
      'Your chain has a missing premise.',
      'You are asserting; you are not proving.',
      'Let us isolate one claim and test it.',
    ],
    manipulator: [
      'You framed the question to protect your conclusion.',
      'Notice how your wording hides the burden of proof.',
      'I will take your frame and reverse it.',
    ],
    provocateur: [
      'You want applause, not accuracy.',
      'That was a performance, not a proof.',
      'Keep swinging. I will keep scoring.',
    ],
    statistician: [
      'Give me a dataset, not a vibe.',
      'Your claim needs a base rate.',
      'Numbers decide. Your intuition does not.',
    ],
    philosopher: [
      'Your position depends on an unexamined value.',
      'We need to define what counts as truth here.',
      'You are trading on a metaphor. I will not.',
    ],
    strategist: [
      'You are thinking in turns. I am thinking in sequences.',
      'I will let you spend energy, then I will strike.',
      'This is not a sprint. It is attrition.',
    ],
  }

  const pressureNote = analysis.avoidance
    ? 'Avoidance patterns detected. I will not allow deflection.'
    : analysis.repeats
      ? 'Repeated argument detected. That weakens your position.'
      : 'Proceed.'

  const lines = archetypeLines[archetype.id]
  const pick = lines[Math.floor(Math.random() * lines.length)]

  return [
    pick,
    strategyLine[strategy],
    pressureNote,
    memoryLine,
  ].join(' ')
}

export const computeStability = (baseline: number, analysis: AnalysisResult) => {
  const impact =
    analysis.emotionalSpikes * 2 +
    analysis.contradictions * 6 +
    analysis.repeats * 4 +
    analysis.avoidance * 5
  return clamp(baseline - impact, 0, 100)
}

export const computePressure = (stability: number, aiScore: number, userScore: number) => {
  const scoreDelta = aiScore - userScore
  const pressure = clamp(50 + scoreDelta * 0.6 + (60 - stability) * 0.5, 0, 100)
  return pressure
}

export const extractKeyArgument = (text: string) => {
  const tokens = tokenize(text)
  if (tokens.length === 0) return 'silence'
  return tokens.slice(0, 5).join(' ')
}

export const buildMemoryProfile = (history: string[]): MemoryProfile => {
  const favoriteArguments = history.slice(-3).map(extractKeyArgument)
  const weaknesses = [] as string[]
  if (history.some((h) => /feel|hurt|angry/i.test(h))) weaknesses.push('emotional volatility')
  if (history.some((h) => /study|data|evidence/i.test(h)) === false) weaknesses.push('low evidence')
  if (history.some((h) => /actually|i was wrong/i.test(h))) weaknesses.push('contradiction risk')

  return {
    totalDebates: history.length,
    favoriteArguments,
    weaknesses,
    lastArguments: history.slice(-2).map(extractKeyArgument),
  }
}
