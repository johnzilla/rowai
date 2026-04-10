import {
  PM5_SERVICE_UUID,
  PM5_ROWING_STATUS_UUID,
  PM5_EXTRA_STATUS1_UUID,
  PM5_EXTRA_STATUS2_UUID,
} from './pm5-constants';
import {
  parseRowingGeneralStatus,
  parseExtraStatus1,
  parseExtraStatus2,
  validateStrokeReading,
  type StrokeReading,
} from './pm5-parser';

// Minimal store interface needed by setupStoreListeners — avoids circular Zustand type inference
interface BleStoreActions {
  setBleStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed') => void;
  setLatestReading: (reading: StrokeReading) => void;
}

/**
 * PM5Service manages the full lifecycle of a Concept2 PM5 Bluetooth connection.
 *
 * Architecture:
 * - Extends EventTarget to emit typed CustomEvents for connection lifecycle
 * - Components and the Zustand store listen to events rather than calling methods directly
 * - All BLE GATT work happens in private methods; public surface is connect/disconnect
 *
 * Events emitted:
 *   'connected'         — GATT server connected and characteristics subscribed
 *   'disconnected'      — Device disconnected (gattserverdisconnected fired)
 *   'reconnecting'      — Reconnect attempt in progress (detail: { attempt: number })
 *   'reconnect_failed'  — All MAX_RECONNECT_ATTEMPTS exhausted
 *   'stroke_reading'    — Complete StrokeReading assembled from 3 characteristics (detail: StrokeReading)
 *
 * BLE requirements addressed:
 *   BLE-01: connect() must be called from a user gesture (navigator.bluetooth.requestDevice)
 *   BLE-02: subscribes to all 3 PM5 GATT characteristics
 *   BLE-04: detects gattserverdisconnected and dispatches 'disconnected'
 *   BLE-05: reconnects every 30s, max 3 attempts, dispatches 'reconnect_failed' on exhaustion
 */
export class PM5Service extends EventTarget {
  private device: BluetoothDevice | null = null;

  // BLE-05: reconnect every 30 seconds
  private readonly RECONNECT_INTERVAL_MS = 30000;

  // BLE-05: max 3 reconnect attempts before surfacing failure to user
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Partial reading accumulation — merged across the 3 GATT characteristics
  // Dispatched as a complete StrokeReading only when all required fields are present
  private partialReading: Partial<StrokeReading> = {};

  /**
   * Connect to the PM5 via Web Bluetooth.
   *
   * MUST be called from a user gesture handler (button click, tap event).
   * Throws if the user cancels the device chooser or BLE is unavailable.
   *
   * BLE-01: requestDevice filtered by PM5_SERVICE_UUID — prevents non-PM5 devices
   * from being selected (T-02-04 spoofing mitigation).
   */
  async connect(): Promise<void> {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PM5_SERVICE_UUID] }],
      // optionalServices required so the browser grants access to extra characteristics
      optionalServices: [PM5_EXTRA_STATUS1_UUID, PM5_EXTRA_STATUS2_UUID],
    });

    // BLE-04: wire the disconnect handler before GATT connect
    this.device.addEventListener('gattserverdisconnected', this.onDisconnected);

    await this.connectGatt();
  }

  /**
   * Establish the GATT connection and subscribe to all 3 rowing characteristics.
   * Called by connect() and by scheduleReconnect() on reconnect attempts.
   */
  private async connectGatt(): Promise<void> {
    const server = await this.device!.gatt!.connect();
    const service = await server.getPrimaryService(PM5_SERVICE_UUID);
    await this.subscribeCharacteristics(service);
    this.dispatchEvent(new CustomEvent('connected'));
  }

  /**
   * Subscribe to all 3 PM5 GATT rowing characteristics.
   * BLE-02: Each characteristic triggers its respective notification handler.
   */
  private async subscribeCharacteristics(
    service: BluetoothRemoteGATTService
  ): Promise<void> {
    const rowingStatusChar = await service.getCharacteristic(PM5_ROWING_STATUS_UUID);
    await rowingStatusChar.startNotifications();
    rowingStatusChar.addEventListener('characteristicvaluechanged', this.handleRowingStatus);

    const extraStatus1Char = await service.getCharacteristic(PM5_EXTRA_STATUS1_UUID);
    await extraStatus1Char.startNotifications();
    extraStatus1Char.addEventListener('characteristicvaluechanged', this.handleExtraStatus1);

    const extraStatus2Char = await service.getCharacteristic(PM5_EXTRA_STATUS2_UUID);
    await extraStatus2Char.startNotifications();
    extraStatus2Char.addEventListener('characteristicvaluechanged', this.handleExtraStatus2);
  }

  /**
   * Handle Rowing General Status (characteristic PM5_ROWING_STATUS_UUID).
   * Decodes elapsedTimeMs, distanceMeters, strokeState and merges into partialReading.
   */
  private handleRowingStatus = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    try {
      const parsed = parseRowingGeneralStatus(characteristic.value);
      this.partialReading = { ...this.partialReading, ...parsed };
      this.tryDispatchReading();
    } catch (err) {
      console.warn('[PM5Service] Malformed ROWING_STATUS packet:', err);
    }
  };

  /**
   * Handle Extra Status 1 (characteristic PM5_EXTRA_STATUS1_UUID).
   * Decodes strokeRate and splitMs and merges into partialReading.
   */
  private handleExtraStatus1 = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    try {
      const parsed = parseExtraStatus1(characteristic.value);
      this.partialReading = { ...this.partialReading, ...parsed };
      this.tryDispatchReading();
    } catch (err) {
      console.warn('[PM5Service] Malformed EXTRA_STATUS1 packet:', err);
    }
  };

  /**
   * Handle Extra Status 2 (characteristic PM5_EXTRA_STATUS2_UUID).
   * Decodes watts and merges into partialReading.
   */
  private handleExtraStatus2 = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    try {
      const parsed = parseExtraStatus2(characteristic.value);
      this.partialReading = { ...this.partialReading, ...parsed };
      this.tryDispatchReading();
    } catch (err) {
      console.warn('[PM5Service] Malformed EXTRA_STATUS2 packet:', err);
    }
  };

  /**
   * Check if all required StrokeReading fields are present.
   * If complete, validate the reading and dispatch a 'stroke_reading' CustomEvent.
   * Corrupt or out-of-range data is discarded (logged to console) rather than propagated.
   */
  private tryDispatchReading(): void {
    const p = this.partialReading;
    // All required fields must be present before dispatching
    if (
      p.elapsedTimeMs === undefined ||
      p.distanceMeters === undefined ||
      p.strokeState === undefined ||
      p.strokeRate === undefined ||
      p.splitMs === undefined ||
      p.watts === undefined
    ) {
      return; // Not all characteristics have reported yet
    }

    const reading: StrokeReading = {
      elapsedTimeMs: p.elapsedTimeMs,
      distanceMeters: p.distanceMeters,
      strokeState: p.strokeState,
      strokeRate: p.strokeRate,
      splitMs: p.splitMs,
      watts: p.watts,
      timestamp: Date.now(),
    };

    // Do not dispatch idle readings — they carry no valid performance data.
    // useSessionLifecycle already handles auto-start on first non-idle stroke.
    if (reading.strokeState === 0) {
      return;
    }

    // T-02-01 mitigation: validate before dispatching — corrupt bytes cannot reach session state
    try {
      validateStrokeReading(reading);
    } catch (err) {
      console.warn('[PM5Service] Discarding out-of-range reading:', err);
      return;
    }

    this.dispatchEvent(new CustomEvent('stroke_reading', { detail: reading }));
  }

  /**
   * BLE-04: Called when the device fires 'gattserverdisconnected'.
   * Dispatches 'disconnected' event and starts the reconnect loop.
   */
  private onDisconnected = (): void => {
    this.dispatchEvent(new CustomEvent('disconnected'));
    this.scheduleReconnect();
  };

  /**
   * BLE-05: Schedule a single reconnect attempt after RECONNECT_INTERVAL_MS (30s).
   * Tracks reconnect attempts. After MAX_RECONNECT_ATTEMPTS, dispatches 'reconnect_failed'.
   *
   * T-02-02 mitigation: capped at MAX_RECONNECT_ATTEMPTS — no infinite retry battery drain.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.dispatchEvent(new CustomEvent('reconnect_failed'));
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      this.dispatchEvent(
        new CustomEvent('reconnecting', {
          detail: { attempt: this.reconnectAttempts },
        })
      );

      try {
        await this.connectGatt();
        // Success — reset attempt counter for next disconnect event.
        // connectGatt() already dispatches 'connected' as its final step.
        this.reconnectAttempts = 0;
      } catch {
        // GATT connect failed — schedule another attempt (if under limit)
        this.scheduleReconnect();
      }
    }, this.RECONNECT_INTERVAL_MS);
  }

  /**
   * Gracefully disconnect from the PM5 and cancel any pending reconnect timers.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.device?.gatt?.disconnect();
  }
}

/**
 * Wire PM5Service CustomEvents to the Zustand session store.
 * Call once at application startup (e.g., in the session page component).
 *
 * Binding pattern:
 *   connected      → setBleStatus('connected')
 *   disconnected   → setBleStatus('reconnecting')  (BLE-04: optimistic — reconnect attempt will follow)
 *   reconnecting   → setBleStatus('reconnecting')
 *   reconnect_failed → setBleStatus('failed')
 *   stroke_reading → setLatestReading(event.detail)
 */
export function setupStoreListeners(
  service: PM5Service,
  store: BleStoreActions
): void {
  service.addEventListener('connected', () => {
    store.setBleStatus('connected');
  });

  service.addEventListener('disconnected', () => {
    // BLE-04: treat initial disconnect as reconnecting (reconnect attempt imminent)
    store.setBleStatus('reconnecting');
  });

  service.addEventListener('reconnecting', () => {
    store.setBleStatus('reconnecting');
  });

  service.addEventListener('reconnect_failed', () => {
    store.setBleStatus('failed');
  });

  service.addEventListener('stroke_reading', (event) => {
    const reading = (event as CustomEvent<StrokeReading>).detail;
    store.setLatestReading(reading);
  });
}

// Singleton instance — consumed by session UI components
export const pm5Service = new PM5Service();
