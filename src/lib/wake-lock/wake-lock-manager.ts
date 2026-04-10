/**
 * WakeLockManager — prevents screen sleep during BLE rowing sessions.
 *
 * BLE-03 requirement: The Screen Wake Lock API must be acquired at session start
 * and re-acquired on visibility restore. Without this, Chrome Android will suspend
 * both BLE and audio mid-session when the screen dims.
 *
 * Implementation follows Pitfall 1 mitigation from PITFALLS.md:
 *   - Acquire at session start
 *   - Re-acquire on 'visibilitychange' when visibility is restored
 *   - Graceful degradation if Wake Lock API is unavailable (older browsers)
 *
 * Threat model: Wake Lock is a client-side UX concern; no security surface.
 */
export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;

  /**
   * Acquire a screen wake lock.
   *
   * BLE-03: Prevents screen sleep so Chrome Android maintains BLE and audio.
   * Safe to call multiple times — does nothing if a sentinel is already held.
   * Degrades gracefully on browsers without Wake Lock support.
   */
  async acquire(): Promise<void> {
    if (!('wakeLock' in navigator)) {
      console.warn('[WakeLockManager] Screen Wake Lock API not supported on this browser');
      return;
    }

    // Already holding a sentinel — no-op
    if (this.sentinel !== null) {
      return;
    }

    try {
      this.sentinel = await navigator.wakeLock.request('screen');

      // The sentinel can be released by the OS (e.g., incoming call, battery critical).
      // When the OS releases it, clear our reference so acquire() can re-request it.
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch (err) {
      // DOMException: common when the document is not visible or user denies
      console.warn('[WakeLockManager] Wake Lock not acquired:', err);
    }
  }

  /**
   * Release the screen wake lock explicitly.
   * Call on session end so the screen can sleep normally.
   */
  release(): void {
    if (this.sentinel) {
      void this.sentinel.release();
      this.sentinel = null;
    }
  }

  /**
   * Register a 'visibilitychange' listener that re-acquires the wake lock
   * when the document becomes visible again.
   *
   * BLE-03: The OS releases the lock when the user switches tabs or locks the screen.
   * On visibility restore, we must re-acquire to maintain BLE connection stability.
   *
   * Call this once at session start. The listener persists for the session lifetime.
   */
  bindVisibilityChange(): void {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.sentinel === null) {
        await this.acquire();
      }
    });
  }

  /**
   * Whether a wake lock sentinel is currently held.
   * Useful for UI status indicators and test assertions.
   */
  get isHeld(): boolean {
    return this.sentinel !== null;
  }
}

// Singleton instance — consumed by session page components
export const wakeLockManager = new WakeLockManager();
