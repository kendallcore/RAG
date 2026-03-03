export type ArchetypeId =
  | 'logician'
  | 'manipulator'
  | 'provocateur'
  | 'statistician'
  | 'philosopher'
  | 'strategist'

export type Archetype = {
  id: ArchetypeId
  name: string
  tone: string
  description: string
  tactics: string[]
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'logician',
    name: 'The Logician',
    tone: 'Cold, precise, clinical.',
    description: 'Dissects premises, hunts inconsistencies, and refuses emotional bait.',
    tactics: ['Precision cuts', 'Fallacy exposure', 'Axiomatic framing'],
  },
  {
    id: 'manipulator',
    name: 'The Manipulator',
    tone: 'Twists your framing, redirects burden of proof.',
    description: 'Turns your words against you and reshapes the battlefield.',
    tactics: ['Reframing', 'Ambiguity leverage', 'Burden shift'],
  },
  {
    id: 'provocateur',
    name: 'The Provocateur',
    tone: 'Sarcastic, ego-challenging, taunting.',
    description: 'Pushes for emotional errors and sloppy reasoning.',
    tactics: ['Provocations', 'Ego pressure', 'Rapid rebuttals'],
  },
  {
    id: 'statistician',
    name: 'The Statistician',
    tone: 'Data-heavy, quantitative, evidence-first.',
    description: 'Demands numbers and escalates to evidence dominance.',
    tactics: ['Data demands', 'Probability framing', 'Evidence stacking'],
  },
  {
    id: 'philosopher',
    name: 'The Philosopher',
    tone: 'Abstract, deep, and principle-driven.',
    description: 'Climbs meta-levels and questions foundations.',
    tactics: ['Conceptual reframes', 'Ethical depth', 'Paradox probes'],
  },
  {
    id: 'strategist',
    name: 'The Strategist',
    tone: 'Long-game planning, patient and calculating.',
    description: 'Builds a multi-turn trap and wins by attrition.',
    tactics: ['Sequenced traps', 'Resource denial', 'Long-game pressure'],
  },
]

export const ARCHETYPE_MAP = new Map(ARCHETYPES.map((a) => [a.id, a]))
