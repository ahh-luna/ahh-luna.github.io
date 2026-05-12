/**
 * KEYSTRIKE — WordBank
 * 
 * Central registry of all game verbs (actions) and their definitions,
 * plus combo definitions and enemy target word pools.
 * 
 * This is the "data layer" — it defines what words exist in the game,
 * what they do, and how they combine. The GrammarSystem and ComboSystem
 * read from this bank.
 */

// ═══════════════════════════════════════════════════════════════════
// VERB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const VERBS = {
  // ─── ATTACK VERBS ──────────────────────────────────────────────
  SLASH: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 30,
    cooldown: 0,
    description: 'Quick blade slash. Fast and reliable.',
    animation: 'slash',
    comboTags: ['blade', 'physical', 'quick'],
    element: null,
  },
  STRIKE: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 45,
    cooldown: 0,
    description: 'Heavy forceful strike. Strong combo finisher.',
    animation: 'strike',
    comboTags: ['blunt', 'physical', 'heavy'],
    element: null,
  },
  JAB: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 15,
    cooldown: 0,
    description: 'Lightning-fast jab. Minimal damage, maximum speed.',
    animation: 'jab',
    comboTags: ['fist', 'physical', 'quick'],
    element: null,
  },
  CRUSH: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 60,
    cooldown: 500,
    description: 'Devastating overhead crush. Slow but punishing.',
    animation: 'crush',
    comboTags: ['blunt', 'physical', 'heavy'],
    element: null,
  },
  PIERCE: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 40,
    cooldown: 0,
    description: 'Precise piercing thrust. High crit chance.',
    animation: 'pierce',
    comboTags: ['blade', 'physical', 'precision'],
    effects: { critBonus: 0.3 },
    element: null,
  },
  REND: {
    category: 'attack',
    selfTargeted: false,
    baseDamage: 35,
    cooldown: 0,
    description: 'Tearing slash that causes bleeding.',
    animation: 'rend',
    comboTags: ['blade', 'physical', 'dot'],
    effects: { bleed: { damage: 5, ticks: 3 } },
    element: null,
  },

  // ─── DEFENSE VERBS ────────────────────────────────────────────
  BLOCK: {
    category: 'defense',
    selfTargeted: true,
    baseDamage: 0,
    cooldown: 0,
    description: 'Raise guard. Reduces next incoming damage by 60%.',
    animation: 'block',
    comboTags: ['defense', 'guard'],
    effects: { damageReduction: 0.6, duration: 2000 },
    element: null,
  },
  DODGE: {
    category: 'defense',
    selfTargeted: true,
    baseDamage: 0,
    cooldown: 800,
    description: 'Swift evasion. Completely avoid the next attack.',
    animation: 'dodge',
    comboTags: ['defense', 'evasion'],
    effects: { invulnerable: true, duration: 800 },
    element: null,
  },
  PARRY: {
    category: 'defense',
    selfTargeted: false,     // Targeted! PARRY [enemy] = counter
    baseDamage: 25,
    cooldown: 1500,
    description: 'Counter an attacking enemy. Reflects damage if timed right.',
    animation: 'parry',
    comboTags: ['defense', 'counter', 'precision'],
    effects: { counter: true, reflectMultiplier: 1.5 },
    element: null,
  },

  // ─── SPELL VERBS ──────────────────────────────────────────────
  FIRE: {
    category: 'spell',
    selfTargeted: false,
    baseDamage: 25,
    cooldown: 2000,
    description: 'Hurl a fireball. Burns target over time.',
    animation: 'fire',
    comboTags: ['magic', 'elemental', 'dot'],
    effects: { burn: { damage: 8, ticks: 3 } },
    element: 'fire',
  },
  ICE: {
    category: 'spell',
    selfTargeted: false,
    baseDamage: 20,
    cooldown: 2500,
    description: 'Freeze blast. Slows target movement and attacks.',
    animation: 'ice',
    comboTags: ['magic', 'elemental', 'control'],
    effects: { slow: { factor: 0.5, duration: 3000 } },
    element: 'ice',
  },
  BOLT: {
    category: 'spell',
    selfTargeted: false,
    baseDamage: 35,
    cooldown: 1800,
    description: 'Lightning bolt. Fast, high damage, chains to nearby.',
    animation: 'bolt',
    comboTags: ['magic', 'elemental', 'quick'],
    effects: { chain: { targets: 1, falloff: 0.5 } },
    element: 'lightning',
  },
  HEAL: {
    category: 'spell',
    selfTargeted: true,
    baseDamage: 0,
    cooldown: 5000,
    description: 'Restore 30 HP. Long cooldown.',
    animation: 'heal',
    comboTags: ['magic', 'restoration'],
    effects: { heal: 30 },
    element: 'holy',
  },
  DRAIN: {
    category: 'spell',
    selfTargeted: false,
    baseDamage: 20,
    cooldown: 3000,
    description: 'Siphon life force. Damage enemy, heal yourself.',
    animation: 'drain',
    comboTags: ['magic', 'dark', 'lifesteal'],
    effects: { lifesteal: 0.5 },
    element: 'dark',
  },
};

// ═══════════════════════════════════════════════════════════════════
// COMBO DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const COMBOS = [
  {
    name: 'ONSLAUGHT',
    sequence: ['SLASH', 'STRIKE'],
    sameTarget: true,
    damageMultiplier: 1.8,
    description: 'Blade flurry into crushing blow.',
    animation: 'combo_onslaught',
  },
  {
    name: 'RIPOSTE',
    sequence: ['DODGE', 'SLASH'],
    sameTarget: false,
    damageMultiplier: 2.0,
    description: 'Evade then counter with a precise slash.',
    animation: 'combo_riposte',
  },
  {
    name: 'SHATTER',
    sequence: ['ICE', 'CRUSH'],
    sameTarget: true,
    damageMultiplier: 3.0,
    description: 'Freeze then shatter. Devastating.',
    animation: 'combo_shatter',
  },
  {
    name: 'FIRESTORM',
    sequence: ['FIRE', 'BOLT'],
    sameTarget: false,
    damageMultiplier: 2.0,
    description: 'Ignite the air then electrify it. AoE burst.',
    animation: 'combo_firestorm',
    bonusEffect: { aoe: { radius: 100, damage: 15 } },
  },
  {
    name: 'VORTEX',
    sequence: ['SLASH', 'SLASH', 'STRIKE'],
    sameTarget: true,
    damageMultiplier: 2.5,
    description: 'Triple blade combo ending in a devastating strike.',
    animation: 'combo_vortex',
  },
  {
    name: 'EXECUTION',
    sequence: ['REND', 'PIERCE'],
    sameTarget: true,
    damageMultiplier: 2.2,
    description: 'Tear open defenses then strike true.',
    animation: 'combo_execution',
  },
  {
    name: 'SIPHON STORM',
    sequence: ['DRAIN', 'FIRE'],
    sameTarget: false,
    damageMultiplier: 1.5,
    description: 'Dark energy fuels a devastating fireball.',
    animation: 'combo_siphon',
    bonusEffect: { lifesteal: 0.3 },
  },
  {
    name: 'FORTRESS',
    sequence: ['BLOCK', 'PARRY'],
    sameTarget: false,
    damageMultiplier: 2.5,
    description: 'Perfect defense into devastating counter.',
    animation: 'combo_fortress',
  },
];

// ═══════════════════════════════════════════════════════════════════
// ENEMY TARGET WORD POOLS
// ═══════════════════════════════════════════════════════════════════

/**
 * Enemy targeting words — these appear above enemy heads.
 * Organized by difficulty/length. Thematic cyberpunk vocabulary.
 */
export const TARGET_WORDS = {
  // Tier 1: Short words (weak enemies)
  easy: [
    'BUG', 'BOT', 'BIT', 'HEX', 'RAM', 'ROM', 'ARC', 'ION',
    'PIX', 'NET', 'KEY', 'LOG', 'MOD', 'ORB', 'ZAP', 'VEX',
  ],
  // Tier 2: Medium words (standard enemies)
  medium: [
    'NEON', 'BYTE', 'CORE', 'FLUX', 'GRID', 'NODE', 'VOID',
    'PULSE', 'SYNTH', 'GLITCH', 'PROXY', 'WIRED', 'DRONE',
    'NEXUS', 'SPIKE', 'CODEC', 'ETHER', 'OXIDE', 'RAZOR',
  ],
  // Tier 3: Long words (elite enemies)
  hard: [
    'CIPHER', 'VECTOR', 'MATRIX', 'SIGNAL', 'STATIC',
    'PHOTON', 'KERNEL', 'DAEMON', 'SOCKET', 'BINARY',
    'CRYPTO', 'PLASMA', 'TROJAN', 'CORTEX', 'PRAXIS',
  ],
  // Tier 4: Boss words
  boss: [
    'OVERLOCK', 'MAINFRAME', 'PROTOCOL', 'DARKWEB',
    'FIREWALL', 'BLACKOUT', 'DEADLOCK', 'TERMINUS',
  ],
};

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize the grammar system and combo system with all game data.
 * 
 * @param {import('./GrammarSystem.js').GrammarSystem} grammar
 * @param {import('./ComboSystem.js').ComboSystem} comboSystem
 */
export function initializeWordBank(grammar, comboSystem) {
  // Register all verbs
  grammar.registerVerbs(VERBS);

  // Register all combos
  comboSystem.registerCombos(COMBOS);

  return { verbs: VERBS, combos: COMBOS, targetWords: TARGET_WORDS };
}
