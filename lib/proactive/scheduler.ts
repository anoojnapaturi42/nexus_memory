export class ProactiveBackgroundScheduler {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tick: () => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  isRunning() {
    return this.interval !== null;
  }
}
