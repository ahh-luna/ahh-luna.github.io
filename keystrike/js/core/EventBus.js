/**
 * KEYSTRIKE — EventBus
 * 
 * Central publish/subscribe event system. All game systems communicate
 * through this bus, ensuring loose coupling and easy extensibility.
 * 
 * Supports:
 *   - Named events with arbitrary data payloads
 *   - Priority ordering of listeners
 *   - One-shot listeners (auto-unsubscribe)
 *   - Wildcard '*' listener (receives ALL events)
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Array<{callback: Function, priority: number}>>} */
    this.listeners = new Map();
    this.eventLog = [];
    this.debug = false;
  }

  /**
   * Subscribe to an event.
   * @param {string} event — Event name, or '*' for all events
   * @param {Function} callback — Handler function receiving (data, eventName)
   * @param {number} priority — Higher priority fires first (default 0)
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, priority = 0) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const entry = { callback, priority };
    const list = this.listeners.get(event);
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      const idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first fire.
   */
  once(event, callback, priority = 0) {
    const unsub = this.on(event, (data, eventName) => {
      unsub();
      callback(data, eventName);
    }, priority);
    return unsub;
  }

  /**
   * Emit an event with optional data.
   * Fires specific listeners, then wildcard '*' listeners.
   */
  emit(event, data = null) {
    if (this.debug) {
      this.eventLog.push({ event, data, timestamp: performance.now() });
    }

    // Fire specific listeners
    const specific = this.listeners.get(event);
    if (specific) {
      for (const { callback } of specific) {
        callback(data, event);
      }
    }

    // Fire wildcard listeners
    if (event !== '*') {
      const wildcards = this.listeners.get('*');
      if (wildcards) {
        for (const { callback } of wildcards) {
          callback(data, event);
        }
      }
    }
  }

  /**
   * Remove all listeners for an event, or all listeners entirely.
   */
  clear(event = null) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get count of listeners for an event.
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }
}
