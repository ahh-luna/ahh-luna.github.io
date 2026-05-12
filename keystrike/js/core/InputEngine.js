/**
 * KEYSTRIKE — InputEngine
 * 
 * The central nervous system of the game. Every single keypress flows
 * through this engine. It captures raw input, maintains the typing buffer,
 * calculates real-time metrics (WPM, LPM, accuracy), and emits events
 * that drive the entire game.
 * 
 * Design principles:
 *   1. SINGLE SOURCE OF TRUTH for all input state
 *   2. No keyboard events should be handled outside this engine
 *   3. All metrics are derivable from the keystroke log
 *   4. Event-driven: game systems subscribe, never poll
 *   5. Deterministic: given the same keystroke sequence, same results
 * 
 * Events emitted (via EventBus):
 *   'input:keystroke'    — Every keypress { key, timestamp, buffer }
 *   'input:bufferChange' — Buffer content changed { buffer, partial }
 *   'input:execute'      — Command executed (Enter) { command, metrics }
 *   'input:error'        — Invalid command { error, buffer }
 *   'input:cancel'       — Buffer cleared (Escape) { previousBuffer }
 *   'input:wpmUpdate'    — WPM/LPM metrics updated { wpm, lpm, accuracy }
 */

/**
 * @typedef {Object} KeystrokeRecord
 * @property {string} key — The key pressed
 * @property {number} timestamp — performance.now() timestamp
 * @property {boolean} isBackspace — Was this a backspace/delete
 * @property {boolean} isExecute — Was this Enter (command execute)
 * @property {boolean} isCancel — Was this Escape (buffer clear)
 * @property {boolean} isCharacter — Is this a printable character
 * @property {number} bufferLength — Buffer length after this keystroke
 */

/**
 * @typedef {Object} CommandRecord
 * @property {string} raw — Raw input string
 * @property {Object} parsed — GrammarSystem parse result
 * @property {number} startTime — When first character was typed
 * @property {number} endTime — When Enter was pressed
 * @property {number} duration — endTime - startTime in ms
 * @property {number} keystrokes — Total keystrokes for this command
 * @property {number} backspaces — Backspaces used during this command
 * @property {number} characters — Characters typed (non-backspace)
 * @property {number} accuracy — 0-1, characters / (characters + backspaces)
 * @property {number} wpm — WPM for this specific command
 * @property {boolean} valid — Whether the command was valid
 */

/**
 * @typedef {Object} InputMetrics
 * @property {number} wpm — Words per minute (rolling window)
 * @property {number} lpm — Letters per minute (rolling window)
 * @property {number} accuracy — Overall accuracy 0-1
 * @property {number} currentAccuracy — Accuracy for current buffer 0-1
 * @property {number} totalKeystrokes — All-time keystroke count
 * @property {number} totalBackspaces — All-time backspace count
 * @property {number} totalCharacters — All-time character count
 * @property {number} totalCommands — Commands executed
 * @property {number} validCommands — Valid commands executed
 * @property {number} comboCount — Current combo chain length
 * @property {number} maxCombo — Best combo chain this session
 */

export class InputEngine {
  /**
   * @param {import('./EventBus.js').EventBus} eventBus
   * @param {import('./GrammarSystem.js').GrammarSystem} grammar
   */
  constructor(eventBus, grammar) {
    this.eventBus = eventBus;
    this.grammar = grammar;

    // ─── Input Buffer ────────────────────────────────────────
    this.buffer = '';
    this.cursorPos = 0;

    // ─── Keystroke Log ───────────────────────────────────────
    /** @type {KeystrokeRecord[]} */
    this.keystrokes = [];
    this.maxKeystrokeLog = 10000; // Keep last 10k for memory safety

    // ─── Per-Command Tracking ────────────────────────────────
    this.commandStartTime = null;   // When current command's first char was typed
    this.commandKeystrokes = 0;     // Keystrokes in current command
    this.commandBackspaces = 0;     // Backspaces in current command
    this.commandCharacters = 0;     // Characters in current command

    // ─── Command History ─────────────────────────────────────
    /** @type {CommandRecord[]} */
    this.commandHistory = [];
    this.maxHistory = 500;

    // ─── Session Totals ──────────────────────────────────────
    this.totalKeystrokes = 0;
    this.totalBackspaces = 0;
    this.totalCharacters = 0;
    this.totalCommands = 0;
    this.validCommands = 0;
    this.sessionStartTime = null;

    // ─── WPM / LPM Tracking ─────────────────────────────────
    this.metricsWindowMs = 15000;  // 15-second rolling window
    /** @type {{timestamp: number, chars: number}[]} */
    this.characterTimestamps = []; // For WPM/LPM calculation
    this.currentWPM = 0;
    this.currentLPM = 0;
    this.metricsUpdateInterval = null;

    // ─── Combo Tracking ──────────────────────────────────────
    this.comboCount = 0;
    this.maxCombo = 0;
    this.lastCommandTime = 0;
    this.comboWindowMs = 3000; // Combo breaks after 3s of inactivity

    // ─── State ───────────────────────────────────────────────
    this.active = false;
    this.locked = false; // Temporarily prevent input (during animations, etc.)

    // ─── Bound handlers ──────────────────────────────────────
    this._onKeyDown = this._handleKeyDown.bind(this);
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Activate the input engine. Starts capturing keyboard events.
   */
  activate() {
    if (this.active) return;
    this.active = true;
    this.sessionStartTime = this.sessionStartTime || performance.now();
    document.addEventListener('keydown', this._onKeyDown);

    // Start metrics update loop
    this.metricsUpdateInterval = setInterval(() => {
      this._updateMetrics();
    }, 250); // Update 4x per second
  }

  /**
   * Deactivate the input engine. Stops capturing keyboard events.
   */
  deactivate() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
  }

  /**
   * Lock input temporarily (e.g., during attack animations).
   */
  lock() {
    this.locked = true;
  }

  /**
   * Unlock input.
   */
  unlock() {
    this.locked = false;
  }

  /**
   * Full reset — clear all state for a new game session.
   */
  reset() {
    this.buffer = '';
    this.cursorPos = 0;
    this.keystrokes = [];
    this.commandStartTime = null;
    this.commandKeystrokes = 0;
    this.commandBackspaces = 0;
    this.commandCharacters = 0;
    this.commandHistory = [];
    this.totalKeystrokes = 0;
    this.totalBackspaces = 0;
    this.totalCharacters = 0;
    this.totalCommands = 0;
    this.validCommands = 0;
    this.sessionStartTime = null;
    this.characterTimestamps = [];
    this.currentWPM = 0;
    this.currentLPM = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.lastCommandTime = 0;
    this.locked = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Main keyboard event handler. Routes to specific handlers.
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    if (!this.active || this.locked) return;

    // Prevent default for keys we handle
    const key = e.key;

    // Always capture these:
    if (key === 'Enter' || key === 'Escape' || key === 'Backspace' ||
        key === 'Tab' || (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault();
    } else {
      return; // Ignore modifier keys, F-keys, etc.
    }

    const now = performance.now();
    const record = this._createKeystrokeRecord(key, now);

    // Log keystroke
    this.keystrokes.push(record);
    if (this.keystrokes.length > this.maxKeystrokeLog) {
      this.keystrokes.splice(0, this.keystrokes.length - this.maxKeystrokeLog);
    }

    this.totalKeystrokes++;
    this.commandKeystrokes++;

    // Emit raw keystroke event
    this.eventBus.emit('input:keystroke', {
      key,
      timestamp: now,
      buffer: this.buffer,
      record,
    });

    // Route to specific handler
    if (key === 'Enter') {
      this._handleExecute(now);
    } else if (key === 'Escape') {
      this._handleCancel(now);
    } else if (key === 'Backspace') {
      this._handleBackspace(now);
    } else if (key === 'Tab') {
      this._handleTab(now);
    } else if (key.length === 1) {
      this._handleCharacter(key, now);
    }
  }

  /**
   * Handle a printable character input.
   */
  _handleCharacter(char, now) {
    // Start command timer on first character
    if (this.buffer.length === 0 && this.commandStartTime === null) {
      this.commandStartTime = now;
    }

    // Insert character at cursor position
    this.buffer =
      this.buffer.slice(0, this.cursorPos) + char + this.buffer.slice(this.cursorPos);
    this.cursorPos++;

    this.totalCharacters++;
    this.commandCharacters++;

    // Track for WPM
    this.characterTimestamps.push({ timestamp: now, chars: 1 });

    this._emitBufferChange();
  }

  /**
   * Handle backspace.
   */
  _handleBackspace(now) {
    if (this.buffer.length === 0 || this.cursorPos === 0) return;

    this.buffer =
      this.buffer.slice(0, this.cursorPos - 1) + this.buffer.slice(this.cursorPos);
    this.cursorPos--;

    this.totalBackspaces++;
    this.commandBackspaces++;

    this._emitBufferChange();
  }

  /**
   * Handle Tab — autocomplete from grammar suggestions.
   */
  _handleTab(now) {
    const partial = this.grammar.parsePartial(this.buffer);
    let completion = null;

    if (partial.state === 'typing_verb' && partial.verbSuggestions.length === 1) {
      // Autocomplete verb
      completion = partial.verbSuggestions[0];
      const verbDef = this.grammar.getVerb(completion);
      // Add space after if verb needs a target
      this.buffer = completion + (verbDef && !verbDef.selfTargeted ? ' ' : '');
      this.cursorPos = this.buffer.length;
    } else if (partial.state === 'typing_target' && partial.targetSuggestions.length === 1) {
      // Autocomplete target
      completion = partial.targetSuggestions[0];
      this.buffer = partial.verb + ' ' + completion;
      this.cursorPos = this.buffer.length;
    }

    if (completion) {
      // Count autocompleted chars for metrics
      const newChars = this.buffer.length - (this.cursorPos - completion.length);
      this.totalCharacters += Math.max(0, newChars);
      this._emitBufferChange();
    }
  }

  /**
   * Handle Enter — execute the current buffer as a command.
   */
  _handleExecute(now) {
    const raw = this.buffer.trim();
    if (!raw) return;

    // Parse through grammar system
    const parsed = this.grammar.parse(raw);

    // Build command record
    const commandRecord = this._buildCommandRecord(raw, parsed, now);

    // Add to history
    this.commandHistory.push(commandRecord);
    if (this.commandHistory.length > this.maxHistory) {
      this.commandHistory.shift();
    }

    this.totalCommands++;

    if (parsed.valid) {
      this.validCommands++;

      // Update combo
      if (now - this.lastCommandTime < this.comboWindowMs && this.lastCommandTime > 0) {
        this.comboCount++;
      } else {
        // Combo reset — emit if we had a combo going
        if (this.comboCount > 1) {
          this.eventBus.emit('input:comboBreak', {
            comboCount: this.comboCount,
            wasMax: this.comboCount >= this.maxCombo,
          });
        }
        this.comboCount = 1;
      }
      this.maxCombo = Math.max(this.maxCombo, this.comboCount);
      this.lastCommandTime = now;

      // Mark cooldown
      if (parsed.verbDef && parsed.verbDef.cooldown > 0) {
        this.grammar.markUsed(parsed.verb);
      }

      // Emit successful execution
      this.eventBus.emit('input:execute', {
        command: parsed,
        record: commandRecord,
        comboCount: this.comboCount,
        metrics: this.getMetrics(),
      });
    } else {
      // Break combo on error
      if (this.comboCount > 1) {
        this.eventBus.emit('input:comboBreak', {
          comboCount: this.comboCount,
          wasMax: this.comboCount >= this.maxCombo,
        });
      }
      this.comboCount = 0;

      // Emit error
      this.eventBus.emit('input:error', {
        error: parsed,
        record: commandRecord,
      });
    }

    // Clear buffer
    this._clearBuffer();
  }

  /**
   * Handle Escape — clear the buffer (emergency cancel).
   */
  _handleCancel(now) {
    const previousBuffer = this.buffer;
    if (!previousBuffer) return;

    this._clearBuffer();

    this.eventBus.emit('input:cancel', {
      previousBuffer,
      timestamp: now,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // METRICS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update rolling WPM and LPM metrics.
   * Called periodically by the metrics interval.
   */
  _updateMetrics() {
    const now = performance.now();
    const windowStart = now - this.metricsWindowMs;

    // Prune old timestamps
    this.characterTimestamps = this.characterTimestamps.filter(
      ct => ct.timestamp >= windowStart
    );

    // Calculate LPM (letters per minute)
    const charsInWindow = this.characterTimestamps.reduce((sum, ct) => sum + ct.chars, 0);
    const windowMinutes = this.metricsWindowMs / 60000;
    this.currentLPM = Math.round(charsInWindow / windowMinutes);

    // Calculate WPM (standard: 5 chars = 1 word)
    this.currentWPM = Math.round(this.currentLPM / 5);

    this.eventBus.emit('input:metricsUpdate', {
      wpm: this.currentWPM,
      lpm: this.currentLPM,
      accuracy: this.getAccuracy(),
      currentAccuracy: this.getCurrentAccuracy(),
      comboCount: this.comboCount,
    });
  }

  /**
   * Get overall session accuracy (0-1).
   */
  getAccuracy() {
    const total = this.totalCharacters + this.totalBackspaces;
    if (total === 0) return 1;
    return this.totalCharacters / total;
  }

  /**
   * Get accuracy for the current buffer (0-1).
   */
  getCurrentAccuracy() {
    const total = this.commandCharacters + this.commandBackspaces;
    if (total === 0) return 1;
    return this.commandCharacters / total;
  }

  /**
   * Get a full metrics snapshot.
   * @returns {InputMetrics}
   */
  getMetrics() {
    return {
      wpm: this.currentWPM,
      lpm: this.currentLPM,
      accuracy: this.getAccuracy(),
      currentAccuracy: this.getCurrentAccuracy(),
      totalKeystrokes: this.totalKeystrokes,
      totalBackspaces: this.totalBackspaces,
      totalCharacters: this.totalCharacters,
      totalCommands: this.totalCommands,
      validCommands: this.validCommands,
      comboCount: this.comboCount,
      maxCombo: this.maxCombo,
      sessionDuration: this.sessionStartTime
        ? performance.now() - this.sessionStartTime
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORY & QUERIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the last N commands from history.
   */
  getRecentCommands(n = 10) {
    return this.commandHistory.slice(-n);
  }

  /**
   * Get only valid commands from history.
   */
  getValidCommands(n = 10) {
    return this.commandHistory.filter(c => c.valid).slice(-n);
  }

  /**
   * Get the last executed valid command (for combo checking).
   */
  getLastValidCommand() {
    for (let i = this.commandHistory.length - 1; i >= 0; i--) {
      if (this.commandHistory[i].valid) return this.commandHistory[i];
    }
    return null;
  }

  /**
   * Get unique words used this session.
   */
  getWordUsageStats() {
    const stats = new Map();
    for (const cmd of this.commandHistory) {
      if (!cmd.valid) continue;
      const verb = cmd.parsed.verb;
      if (!stats.has(verb)) {
        stats.set(verb, { count: 0, totalDamage: 0, avgSpeed: 0 });
      }
      const s = stats.get(verb);
      s.count++;
    }
    return stats;
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a keystroke record.
   * @returns {KeystrokeRecord}
   */
  _createKeystrokeRecord(key, timestamp) {
    return {
      key,
      timestamp,
      isBackspace: key === 'Backspace',
      isExecute: key === 'Enter',
      isCancel: key === 'Escape',
      isCharacter: key.length === 1,
      bufferLength: this.buffer.length,
    };
  }

  /**
   * Build a command record from the current state.
   * @returns {CommandRecord}
   */
  _buildCommandRecord(raw, parsed, endTime) {
    const startTime = this.commandStartTime || endTime;
    const duration = endTime - startTime;
    const chars = this.commandCharacters;
    const backspaces = this.commandBackspaces;
    const accuracy = (chars + backspaces) > 0 ? chars / (chars + backspaces) : 1;

    // WPM for this specific command: (chars / 5) / (duration in minutes)
    const minutes = duration / 60000;
    const wpm = minutes > 0 ? Math.round((chars / 5) / minutes) : 0;

    return {
      raw,
      parsed,
      startTime,
      endTime,
      duration,
      keystrokes: this.commandKeystrokes,
      backspaces,
      characters: chars,
      accuracy,
      wpm,
      valid: parsed.valid,
    };
  }

  /**
   * Clear the input buffer and reset per-command tracking.
   */
  _clearBuffer() {
    this.buffer = '';
    this.cursorPos = 0;
    this.commandStartTime = null;
    this.commandKeystrokes = 0;
    this.commandBackspaces = 0;
    this.commandCharacters = 0;

    this._emitBufferChange();
  }

  /**
   * Emit a buffer change event with partial parse.
   */
  _emitBufferChange() {
    const partial = this.grammar.parsePartial(this.buffer);

    this.eventBus.emit('input:bufferChange', {
      buffer: this.buffer,
      cursorPos: this.cursorPos,
      partial,
      currentAccuracy: this.getCurrentAccuracy(),
    });
  }
}
