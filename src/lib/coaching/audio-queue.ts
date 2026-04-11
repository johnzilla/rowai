import { CuePriority } from './coaching-types';
import type { AudioCue } from './coaching-types';
import { useCoachingStore } from './coaching-store';

/**
 * AudioQueue — module-level singleton for two-tier priority audio playback.
 *
 * PITFALL 1: AudioContext MUST be created inside a user gesture handler.
 * Call initialize() from the "Start Session" or "Begin Check-in" button handler.
 * Never create AudioContext at module level or on app load.
 *
 * PITFALL 2: AudioContext can become suspended (e.g. background tab).
 * ensureRunning() resumes it before each playback.
 *
 * D-05: Two-tier priority — HIGH cues cut off NORMAL cues and flush the queue.
 * D-08: Calls useCoachingStore.setIsSpeaking() for the visual indicator.
 */
class AudioQueue {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private scheduledEndTime = 0;
  private normalQueue: AudioCue[] = [];
  private isSpeaking = false;

  /**
   * Initialize the AudioContext. MUST be called inside a user gesture handler.
   * Safe to call multiple times — returns existing context if already initialized.
   */
  initialize(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
    }
    return this.ctx;
  }

  /**
   * Resume the AudioContext if it is suspended (e.g. after backgrounding).
   * Per RESEARCH.md Pattern 1 / Pitfall 2.
   */
  async ensureRunning(): Promise<void> {
    if (!this.ctx) throw new Error('AudioQueue not initialized — call initialize() first');
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Decode a Base64 PCM s16le audio chunk and schedule it for gapless playback.
   * Uses scheduledEndTime to chain chunks seamlessly on the AudioContext timeline.
   * Per RESEARCH.md Pattern 2.
   */
  async playChunk(base64Audio: string, sampleRate: number): Promise<void> {
    await this.ensureRunning();
    const ctx = this.ctx!;

    // Decode base64 → Uint8Array → Int16Array → Float32Array
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.scheduledEndTime);
    source.start(startAt);
    this.scheduledEndTime = startAt + buffer.duration;
    this.currentSource = source;
  }

  /**
   * Enqueue a cue for playback using two-tier priority routing.
   *
   * HIGH priority (D-05):
   *   - Stop current source immediately
   *   - Flush scheduledEndTime to now (no gap)
   *   - Discard all pending NORMAL cues
   *   - Play cue immediately
   *
   * NORMAL priority:
   *   - If nothing is playing, play immediately
   *   - If already speaking, append to normalQueue
   */
  enqueue(cue: AudioCue): void {
    if (cue.priority === CuePriority.HIGH) {
      // Interrupt current audio and flush normal queue (D-05)
      try { this.currentSource?.stop(); } catch { /* already ended */ }
      if (this.ctx) {
        this.scheduledEndTime = this.ctx.currentTime;
      }
      this.normalQueue = [];
      this.isSpeaking = false;
      void this.playCueNow(cue);
    } else {
      if (this.isSpeaking) {
        this.normalQueue.push(cue);
      } else {
        void this.playCueNow(cue);
      }
    }
  }

  /**
   * Stop all audio playback and clear the queue.
   * Call on session end or when component unmounts.
   */
  stopAll(): void {
    this.currentSource?.stop();
    this.currentSource = null;
    this.normalQueue = [];
    this.isSpeaking = false;
    if (this.ctx) {
      this.scheduledEndTime = this.ctx.currentTime;
    }
    useCoachingStore.getState().setIsSpeaking(false);
  }

  /**
   * Play a cue immediately via the /api/tts route.
   * Streams base64 PCM chunks from the Cartesia TTS proxy and schedules them.
   * Updates isSpeaking and the coaching store visual indicator (D-08).
   */
  private async playCueNow(cue: AudioCue): Promise<void> {
    if (!this.ctx) return;

    this.isSpeaking = true;
    useCoachingStore.getState().setIsSpeaking(true, cue.text);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cue.text }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Track last source node so we can set onended
      let lastSource: AudioBufferSourceNode | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as { type?: string; data?: string; done?: boolean };
            if (parsed.type === 'chunk' && parsed.data) {
              await this.playChunk(parsed.data, 24000);
              lastSource = this.currentSource;
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      // When the last chunk finishes playing, advance to next in queue
      if (lastSource) {
        lastSource.onended = () => {
          this.isSpeaking = false;
          useCoachingStore.getState().setIsSpeaking(false);
          this.processNextInQueue();
        };
      } else {
        // No audio was played — mark as done immediately
        this.isSpeaking = false;
        useCoachingStore.getState().setIsSpeaking(false);
        this.processNextInQueue();
      }
    } catch {
      // TTS error — reset speaking state and continue
      this.isSpeaking = false;
      useCoachingStore.getState().setIsSpeaking(false);
      this.processNextInQueue();
    }
  }

  private processNextInQueue(): void {
    if (this.normalQueue.length > 0) {
      const next = this.normalQueue.shift()!;
      void this.playCueNow(next);
    }
  }
}

// Module-level singleton — survives React re-renders (per RESEARCH.md Pitfall 1)
export const audioQueue = new AudioQueue();
