export class LatestPositionFilter {
  constructor({
    windowSizeMs = 300,
    onWindowClosed,
    now = () => Date.now(),
    schedule = setTimeout,
    cancel = clearTimeout,
  }) {
    this.windowSizeMs = windowSizeMs;
    this.onWindowClosed = onWindowClosed;
    this.now = now;
    this.schedule = schedule;
    this.cancel = cancel;
    this.windowsByCar = new Map();
    this.closedThroughByCar = new Map();
    this.publications = new Set();
  }

  ingest(position) {
    if (!position || typeof position.carId !== 'string' || !position.carId
      || !Number.isFinite(position.ts)) {
      throw new Error('Une position doit contenir carId et un horodatage ts valides.');
    }

    const windowStart = Math.floor(position.ts / this.windowSizeMs) * this.windowSizeMs;
    const windowEnd = windowStart + this.windowSizeMs;
    const closedThrough = this.closedThroughByCar.get(position.carId) ?? -Infinity;

    // Une fenêtre déjà publiée ne doit jamais produire un second événement.
    if (windowEnd <= closedThrough) return false;

    let carWindows = this.windowsByCar.get(position.carId);
    if (!carWindows) {
      carWindows = new Map();
      this.windowsByCar.set(position.carId, carWindows);
    }

    const current = carWindows.get(windowStart);
    if (current) {
      if (position.ts > current.position.ts) current.position = position;
      return true;
    }

    const entry = { position, timer: null };
    carWindows.set(windowStart, entry);
    entry.timer = this.schedule(
      () => this.closeWindow(position.carId, windowStart),
      Math.max(0, windowEnd - this.now()),
    );
    return true;
  }

  closeWindow(carId, windowStart) {
    const carWindows = this.windowsByCar.get(carId);
    const entry = carWindows?.get(windowStart);
    if (!entry) return;

    carWindows.delete(windowStart);
    if (carWindows.size === 0) this.windowsByCar.delete(carId);

    const windowEnd = windowStart + this.windowSizeMs;
    this.closedThroughByCar.set(
      carId,
      Math.max(windowEnd, this.closedThroughByCar.get(carId) ?? -Infinity),
    );

    const publication = Promise.resolve().then(() => this.onWindowClosed(entry.position, {
      start: windowStart,
      end: windowEnd,
    }));
    this.publications.add(publication);
    publication.finally(() => this.publications.delete(publication));
  }

  async flush() {
    await Promise.all([...this.publications]);
  }

  stop() {
    for (const carWindows of this.windowsByCar.values()) {
      for (const entry of carWindows.values()) this.cancel(entry.timer);
    }
    this.windowsByCar.clear();
  }
}
