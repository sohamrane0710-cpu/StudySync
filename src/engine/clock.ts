export interface IClock {
  /**
   * Returns current timestamp in milliseconds.
   */
  now(): number;

  /**
   * Returns wall-clock Unix timestamp in milliseconds for persisted records.
   */
  wallTime(): number;
}

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }

  wallTime(): number {
    return Date.now();
  }
}

export class SimulatedClock implements IClock {
  private currentTime: number;
  private currentWallTime: number;

  constructor(initialTime: number = 1700000000000) {
    this.currentTime = initialTime;
    this.currentWallTime = initialTime;
  }

  now(): number {
    return this.currentTime;
  }

  wallTime(): number {
    return this.currentWallTime;
  }

  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('Cannot advance clock backwards in time');
    }
    this.currentTime += ms;
    this.currentWallTime += ms;
  }

  setTime(timeMs: number): void {
    this.currentTime = timeMs;
    this.currentWallTime = timeMs;
  }
}
