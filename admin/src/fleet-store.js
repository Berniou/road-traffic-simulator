export class FleetStore {
  #positions = new Map();
  #listeners = new Set();

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  replaceAll(positions) {
    for (const position of positions) this.upsert(position, false);
    this.#notify();
  }

  upsert(position, notify = true) {
    const current = this.#positions.get(position.carId);
    if (current && current.ts > position.ts) return;
    this.#positions.set(position.carId, position);
    if (notify) this.#notify();
  }

  snapshot() {
    return [...this.#positions.values()].sort((a, b) => a.carId.localeCompare(b.carId));
  }

  #notify() {
    const positions = this.snapshot();
    for (const listener of this.#listeners) listener(positions);
  }
}
