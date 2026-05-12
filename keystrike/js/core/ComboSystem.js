/**
 * KEYSTRIKE — ComboSystem
 * 
 * Detects and rewards combo chains — specific sequences of commands
 * that trigger bonus effects. Integrates with the grammar system
 * by matching verb sequences and combo tags.
 * 
 * Combo Types:
 *   1. SEQUENCE COMBOS — specific verb chains (SLASH → STRIKE = "ONSLAUGHT")
 *   2. TAG COMBOS — verbs sharing combo tags in sequence
 *   3. SPEED COMBOS — rapid successive commands regardless of type
 *   4. ELEMENTAL COMBOS — elemental verb chains (ICE → CRUSH = "SHATTER")
 * 
 * The combo system listens to input:execute events and evaluates
 * whether the new command extends or triggers a combo.
 */

/**
 * @typedef {Object} ComboDefinition
 * @property {string} name — Display name (e.g., "ONSLAUGHT")
 * @property {string[]} sequence — Required verb sequence ["SLASH", "STRIKE"]
 * @property {boolean} [sameTarget] — Must target the same enemy? (default: false)
 * @property {number} damageMultiplier — Multiplier applied to final hit
 * @property {string} [description] — Flavor text
 * @property {string} [animation] — Special combo animation key
 * @property {Object} [bonusEffect] — Additional effect on trigger
 */

export class ComboSystem {
  /**
   * @param {import('./EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;

    /** @type {ComboDefinition[]} */
    this.combos = [];

    /** Recent valid command verbs (for sequence matching) */
    this.recentVerbs = [];
    this.recentTargets = [];
    this.recentTimestamps = [];

    /** Time window for combo sequences (ms) */
    this.sequenceWindowMs = 4000;

    /** Max sequence history to track */
    this.maxSequenceLength = 5;

    /** Current active chain count */
    this.chainCount = 0;

    /** Speed combo thresholds */
    this.speedComboThresholds = [
      { count: 3, name: 'RAPID',    multiplier: 1.1 },
      { count: 5, name: 'FRENZY',   multiplier: 1.25 },
      { count: 8, name: 'OVERDRIVE', multiplier: 1.5 },
      { count: 12, name: 'UNSTOPPABLE', multiplier: 2.0 },
    ];

    // Listen for executed commands
    this._unsub = this.eventBus.on('input:execute', (data) => {
      this._onCommandExecute(data);
    });
  }

  // ─── Combo Registration ─────────────────────────────────────────

  /**
   * Register a combo definition.
   */
  registerCombo(combo) {
    this.combos.push({
      name: combo.name,
      sequence: combo.sequence.map(v => v.toUpperCase()),
      sameTarget: combo.sameTarget || false,
      damageMultiplier: combo.damageMultiplier || 1.5,
      description: combo.description || '',
      animation: combo.animation || null,
      bonusEffect: combo.bonusEffect || null,
    });
  }

  /**
   * Register multiple combos.
   */
  registerCombos(combos) {
    combos.forEach(c => this.registerCombo(c));
  }

  /**
   * Get all registered combo definitions.
   */
  getCombos() {
    return [...this.combos];
  }

  // ─── Combo Detection ────────────────────────────────────────────

  /**
   * Called when a valid command is executed.
   * Checks for sequence combos, speed combos, and emits events.
   */
  _onCommandExecute(data) {
    const { command, comboCount } = data;
    if (!command.valid) return;

    const now = performance.now();
    const verb = command.verb;
    const targetWord = command.targetWord || null;

    // Prune old entries outside the window
    this._pruneSequence(now);

    // Add to sequence
    this.recentVerbs.push(verb);
    this.recentTargets.push(targetWord);
    this.recentTimestamps.push(now);
    this.chainCount = comboCount;

    // Trim to max length
    while (this.recentVerbs.length > this.maxSequenceLength) {
      this.recentVerbs.shift();
      this.recentTargets.shift();
      this.recentTimestamps.shift();
    }

    // Check for sequence combos
    const triggeredCombo = this._checkSequenceCombos();

    // Check for speed combos
    const speedCombo = this._checkSpeedCombo(comboCount);

    // Emit combo events
    if (triggeredCombo) {
      this.eventBus.emit('combo:triggered', {
        combo: triggeredCombo,
        chainCount: comboCount,
        command,
      });
    }

    if (speedCombo) {
      this.eventBus.emit('combo:speed', {
        tier: speedCombo,
        chainCount: comboCount,
      });
    }

    // Always emit chain update
    this.eventBus.emit('combo:chainUpdate', {
      chainCount: comboCount,
      recentVerbs: [...this.recentVerbs],
    });
  }

  /**
   * Check if recent verb sequence matches any registered combo.
   * Matches from the END of the sequence (most recent commands).
   * @returns {ComboDefinition|null}
   */
  _checkSequenceCombos() {
    for (const combo of this.combos) {
      const seqLen = combo.sequence.length;
      if (this.recentVerbs.length < seqLen) continue;

      // Get the last N verbs
      const lastVerbs = this.recentVerbs.slice(-seqLen);
      const lastTargets = this.recentTargets.slice(-seqLen);

      // Check verb sequence match
      let match = true;
      for (let i = 0; i < seqLen; i++) {
        if (combo.sequence[i] !== '*' && combo.sequence[i] !== lastVerbs[i]) {
          match = false;
          break;
        }
      }

      if (!match) continue;

      // Check same-target constraint
      if (combo.sameTarget) {
        const firstTarget = lastTargets[0];
        if (!firstTarget || lastTargets.some(t => t !== firstTarget)) {
          continue;
        }
      }

      // Combo triggered! Clear the sequence to prevent re-triggering
      this.recentVerbs = [];
      this.recentTargets = [];
      this.recentTimestamps = [];

      return combo;
    }

    return null;
  }

  /**
   * Check if current chain count hits a speed combo threshold.
   * @returns {Object|null} Speed combo tier or null
   */
  _checkSpeedCombo(chainCount) {
    // Only trigger on exact thresholds (not every command after)
    for (const tier of this.speedComboThresholds) {
      if (chainCount === tier.count) {
        return tier;
      }
    }
    return null;
  }

  /**
   * Get the current speed combo tier based on chain count.
   */
  getCurrentSpeedTier(chainCount) {
    let best = null;
    for (const tier of this.speedComboThresholds) {
      if (chainCount >= tier.count) {
        best = tier;
      }
    }
    return best;
  }

  /**
   * Get the damage multiplier for the current state.
   * Combines speed tier multiplier with any active combo.
   */
  getDamageMultiplier(chainCount) {
    const tier = this.getCurrentSpeedTier(chainCount);
    return tier ? tier.multiplier : 1.0;
  }

  /**
   * Remove entries older than the sequence window.
   */
  _pruneSequence(now) {
    while (
      this.recentTimestamps.length > 0 &&
      now - this.recentTimestamps[0] > this.sequenceWindowMs
    ) {
      this.recentVerbs.shift();
      this.recentTargets.shift();
      this.recentTimestamps.shift();
    }
  }

  /**
   * Reset all combo state.
   */
  reset() {
    this.recentVerbs = [];
    this.recentTargets = [];
    this.recentTimestamps = [];
    this.chainCount = 0;
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    if (this._unsub) this._unsub();
  }
}
