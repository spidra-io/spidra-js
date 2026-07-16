/**
 * Minimal typed event emitter. Hand-rolled instead of `node:events` so the
 * SDK keeps working in browsers and edge runtimes.
 */
export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (payload: never) => void);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): this {
    this.listeners.get(event)?.delete(listener as (payload: never) => void);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): this {
    const wrapper = (payload: Events[K]) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as (payload: Events[K]) => void)(payload);
      } catch {
        // a throwing listener must not break the watch loop or other listeners
      }
    }
  }
}
