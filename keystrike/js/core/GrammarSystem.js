/**
 * KEYSTRIKE — GrammarSystem
 * 
 * Parses typed input into structured game commands using a 
 * [VERB] [TARGET] grammar. The grammar system is the bridge between
 * raw text input and game actions.
 * 
 * Command Patterns:
 *   [VERB]            → Self-targeted action (BLOCK, DODGE, HEAL)
 *   [VERB] [TARGET]   → Targeted action (SLASH ALPHA, FIRE NEXUS)
 * 
 * The system supports:
 *   - Verb registration with full definitions (damage, type, cooldown, etc.)
 *   - Dynamic target resolution (enemies currently alive)
 *   - Partial input parsing for real-time UI feedback
 *   - Fuzzy matching hints ("Did you mean SLASH?")
 */

/**
 * @typedef {Object} VerbDefinition
 * @property {string} name — Display name
 * @property {string} category — 'attack' | 'defense' | 'spell'
 * @property {boolean} selfTargeted — If true, no target word needed
 * @property {number} baseDamage — Base damage dealt
 * @property {number} cooldown — Cooldown in ms (0 = none)
 * @property {string} description — Human-readable description
 * @property {string} animation — Animation key for the renderer
 * @property {string[]} comboTags — Tags for combo system matching
 * @property {Object} [effects] — Status effects to apply
 * @property {string} [element] — Elemental type: 'fire','ice','lightning','dark','holy'
 */

/**
 * @typedef {Object} ParsedCommand
 * @property {boolean} valid — Whether the command is executable
 * @property {string} type — 'self' | 'targeted'
 * @property {string} verb — The verb string (uppercase)
 * @property {VerbDefinition} [verbDef] — Full verb definition
 * @property {Object} [target] — Resolved target entity
 * @property {string} [targetWord] — The target word typed
 * @property {string} raw — Original input string
 * @property {string} [error] — Error code if invalid
 * @property {string} [errorMessage] — Human-readable error
 */

/**
 * @typedef {Object} PartialParse
 * @property {string} state — 'empty' | 'typing_verb' | 'verb_complete' | 'typing_target' | 'ready'
 * @property {string} [verb] — Matched or partial verb
 * @property {boolean} [verbValid] — Whether verb is fully matched
 * @property {string[]} [verbSuggestions] — Possible verb completions
 * @property {string} [targetPartial] — Partial target string
 * @property {string[]} [targetSuggestions] — Possible target completions
 */

export class GrammarSystem {
  constructor() {
    /** @type {Map<string, VerbDefinition>} */
    this.verbs = new Map();

    /** @type {Map<string, number>} verb -> last used timestamp (for cooldowns) */
    this.cooldowns = new Map();

    /**
     * Function that returns currently valid targets.
     * Each target: { id, word: string, entity: Object }
     * @type {Function|null}
     */
    this.targetResolver = null;
  }

  // ─── Verb Registration ──────────────────────────────────────────

  /**
   * Register a verb (action word) with its definition.
   */
  registerVerb(word, definition) {
    const key = word.toUpperCase().trim();
    this.verbs.set(key, {
      name: key,
      category: 'attack',
      selfTargeted: false,
      baseDamage: 0,
      cooldown: 0,
      description: '',
      animation: 'default',
      comboTags: [],
      effects: null,
      element: null,
      ...definition,
      name: key, // always enforce uppercase name
    });
  }

  /**
   * Register multiple verbs from a definitions object.
   */
  registerVerbs(definitions) {
    for (const [word, def] of Object.entries(definitions)) {
      this.registerVerb(word, def);
    }
  }

  /**
   * Get a verb definition by name.
   * @returns {VerbDefinition|undefined}
   */
  getVerb(word) {
    return this.verbs.get(word.toUpperCase().trim());
  }

  /**
   * Get all verbs, optionally filtered by category.
   * @param {string} [category] — 'attack', 'defense', 'spell'
   * @returns {VerbDefinition[]}
   */
  getVerbs(category = null) {
    const all = Array.from(this.verbs.values());
    if (!category) return all;
    return all.filter(v => v.category === category);
  }

  /**
   * Set the target resolver function.
   * @param {Function} fn — () => Array<{id, word, entity}>
   */
  setTargetResolver(fn) {
    this.targetResolver = fn;
  }

  // ─── Command Parsing ────────────────────────────────────────────

  /**
   * Parse a complete input string into a structured command.
   * Called when the player presses Enter/Space to execute.
   * 
   * @param {string} input — Raw input string
   * @returns {ParsedCommand}
   */
  parse(input) {
    const raw = input.trim();
    if (!raw) {
      return { valid: false, error: 'EMPTY_INPUT', errorMessage: 'NO INPUT', raw };
    }

    const words = raw.toUpperCase().split(/\s+/);
    const verbStr = words[0];
    const verbDef = this.verbs.get(verbStr);

    // Unknown verb
    if (!verbDef) {
      const suggestions = this._fuzzyMatch(verbStr, Array.from(this.verbs.keys()));
      return {
        valid: false,
        error: 'UNKNOWN_VERB',
        errorMessage: suggestions.length
          ? `UNKNOWN: ${verbStr}. TRY: ${suggestions.join(', ')}`
          : `UNKNOWN COMMAND: ${verbStr}`,
        verb: verbStr,
        suggestions,
        raw,
      };
    }

    // Check cooldown
    if (verbDef.cooldown > 0 && this.cooldowns.has(verbStr)) {
      const lastUsed = this.cooldowns.get(verbStr);
      const elapsed = performance.now() - lastUsed;
      if (elapsed < verbDef.cooldown) {
        const remaining = Math.ceil((verbDef.cooldown - elapsed) / 1000);
        return {
          valid: false,
          error: 'ON_COOLDOWN',
          errorMessage: `${verbStr} ON COOLDOWN (${remaining}s)`,
          verb: verbStr,
          verbDef,
          cooldownRemaining: verbDef.cooldown - elapsed,
          raw,
        };
      }
    }

    // Self-targeted verb
    if (verbDef.selfTargeted) {
      return {
        valid: true,
        type: 'self',
        verb: verbStr,
        verbDef,
        target: null,
        targetWord: null,
        raw,
      };
    }

    // Targeted verb — need a target word
    if (words.length < 2) {
      const targets = this._getTargets();
      return {
        valid: false,
        error: 'MISSING_TARGET',
        errorMessage: `${verbStr} REQUIRES A TARGET`,
        verb: verbStr,
        verbDef,
        availableTargets: targets.map(t => t.word),
        raw,
      };
    }

    const targetWord = words[1];
    const targets = this._getTargets();
    const target = targets.find(t => t.word.toUpperCase() === targetWord);

    if (!target) {
      const suggestions = this._fuzzyMatch(targetWord, targets.map(t => t.word.toUpperCase()));
      return {
        valid: false,
        error: 'INVALID_TARGET',
        errorMessage: suggestions.length
          ? `NO TARGET: ${targetWord}. TARGETS: ${suggestions.join(', ')}`
          : `INVALID TARGET: ${targetWord}`,
        verb: verbStr,
        verbDef,
        targetWord,
        suggestions,
        raw,
      };
    }

    return {
      valid: true,
      type: 'targeted',
      verb: verbStr,
      verbDef,
      target,
      targetWord: target.word.toUpperCase(),
      raw,
    };
  }

  /**
   * Parse partial input for real-time UI feedback.
   * Called on every keystroke to update the HUD.
   * 
   * @param {string} input — Current buffer contents
   * @returns {PartialParse}
   */
  parsePartial(input) {
    const raw = input.trim();
    if (!raw) {
      return { state: 'empty' };
    }

    const words = raw.toUpperCase().split(/\s+/);
    const verbStr = words[0];
    const hasSpace = input.includes(' ');

    // Check if verb is complete (exact match)
    const verbDef = this.verbs.get(verbStr);

    if (!hasSpace) {
      // Still typing the first word
      if (verbDef) {
        // Exact match but no space yet — verb is typed but not confirmed
        return {
          state: 'typing_verb',
          verb: verbStr,
          verbValid: true,
          verbSuggestions: [verbStr],
        };
      }
      // Partial match — find suggestions
      const suggestions = this._prefixMatch(verbStr, Array.from(this.verbs.keys()));
      return {
        state: 'typing_verb',
        verb: verbStr,
        verbValid: false,
        verbSuggestions: suggestions,
      };
    }

    // Space has been typed — verb part is done
    if (!verbDef) {
      return {
        state: 'typing_verb',
        verb: verbStr,
        verbValid: false,
        verbSuggestions: [],
      };
    }

    // Self-targeted verb with space — ready to execute
    if (verbDef.selfTargeted) {
      return {
        state: 'ready',
        verb: verbStr,
        verbValid: true,
        verbDef,
      };
    }

    // Targeted verb — now parsing target
    if (words.length < 2 || words[1] === '') {
      const targets = this._getTargets();
      return {
        state: 'typing_target',
        verb: verbStr,
        verbValid: true,
        verbDef,
        targetPartial: '',
        targetSuggestions: targets.map(t => t.word.toUpperCase()),
      };
    }

    const targetPartial = words[1];
    const targets = this._getTargets();
    const exactTarget = targets.find(t => t.word.toUpperCase() === targetPartial);

    if (exactTarget) {
      return {
        state: 'ready',
        verb: verbStr,
        verbValid: true,
        verbDef,
        targetPartial,
        targetMatch: exactTarget,
        targetSuggestions: [exactTarget.word.toUpperCase()],
      };
    }

    const suggestions = this._prefixMatch(targetPartial, targets.map(t => t.word.toUpperCase()));
    return {
      state: 'typing_target',
      verb: verbStr,
      verbValid: true,
      verbDef,
      targetPartial,
      targetSuggestions: suggestions,
    };
  }

  // ─── Cooldown Management ────────────────────────────────────────

  /**
   * Mark a verb as used (starts cooldown).
   */
  markUsed(verb) {
    this.cooldowns.set(verb.toUpperCase(), performance.now());
  }

  /**
   * Get remaining cooldown for a verb in ms. 0 = ready.
   */
  getCooldown(verb) {
    const key = verb.toUpperCase();
    const def = this.verbs.get(key);
    if (!def || def.cooldown <= 0) return 0;

    if (!this.cooldowns.has(key)) return 0;
    const lastUsed = this.cooldowns.get(key);
    const elapsed = performance.now() - lastUsed;
    return Math.max(0, def.cooldown - elapsed);
  }

  /**
   * Reset all cooldowns.
   */
  resetCooldowns() {
    this.cooldowns.clear();
  }

  // ─── Private Helpers ────────────────────────────────────────────

  _getTargets() {
    return this.targetResolver ? this.targetResolver() : [];
  }

  /**
   * Prefix match: find strings that start with the given prefix.
   */
  _prefixMatch(prefix, candidates) {
    const upper = prefix.toUpperCase();
    return candidates.filter(c => c.startsWith(upper));
  }

  /**
   * Simple fuzzy matching for "did you mean?" suggestions.
   * Uses Levenshtein distance with a threshold.
   */
  _fuzzyMatch(input, candidates, maxDistance = 2) {
    const upper = input.toUpperCase();
    const scored = candidates
      .map(c => ({ word: c, dist: this._levenshtein(upper, c) }))
      .filter(s => s.dist <= maxDistance)
      .sort((a, b) => a.dist - b.dist);
    return scored.map(s => s.word);
  }

  /**
   * Levenshtein distance between two strings.
   */
  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }
}
