const DEMO_WORDS = [
  'collaboration',
  'realtime',
  'offline',
  'sync',
  'merge',
  'conflict',
  'yjs',
  'crdt',
  'quill',
  'websocket',
  'cache',
  'reconnect',
  'converge',
  'distributed',
  'resilient',
]

const DEMO_PREFIXES = ['[auto]', '[bot]', '[demo]']

export function getRandomDemoFragment() {
  const prefix =
    DEMO_PREFIXES[Math.floor(Math.random() * DEMO_PREFIXES.length)]!
  const word = DEMO_WORDS[Math.floor(Math.random() * DEMO_WORDS.length)]!
  const suffix = Math.random() > 0.5 ? ' ' : ' · '

  return `${prefix} ${word}${suffix}`
}

export function getRandomInsertPosition(length: number) {
  return Math.floor(Math.random() * (length + 1))
}

/** Random delay between 600ms and 1.4s to create realistic edit collisions. */
export function getDemoIntervalMs() {
  return 600 + Math.floor(Math.random() * 800)
}

export function insertDemoFragment(
  yText: { length: number; insert: (index: number, text: string) => void },
) {
  const position = getRandomInsertPosition(yText.length)
  yText.insert(position, getRandomDemoFragment())
}
