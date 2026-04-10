import {
  ROWING_STATUS_ELAPSED_TIME_OFFSET,
  ROWING_STATUS_DISTANCE_OFFSET,
  ROWING_STATUS_STROKE_STATE_OFFSET,
  EXTRA1_STROKE_RATE_OFFSET,
  EXTRA1_SPLIT_OFFSET,
  EXTRA2_WATTS_OFFSET,
} from './pm5-constants';

// StrokeReading — typed PM5 metric snapshot
// All fields sourced from three GATT characteristics merged together.
// byte offsets are [ASSUMED] from ErgometerJS analysis — verify against official Concept2 BLE spec.
export interface StrokeReading {
  elapsedTimeMs: number;   // from Rowing General Status — offset 0, 3-byte LE, units 10ms
  distanceMeters: number;  // from Rowing General Status — offset 3, 3-byte LE, units 0.1m
  strokeState: number;     // 0=idle, 1=drive, 2=recover — used for auto-start detection
  strokeRate: number;      // strokes per minute, from Extra Status 1
  splitMs: number;         // pace per 500m in milliseconds, from Extra Status 1
  watts: number;           // power in watts, 16-bit LE, from Extra Status 2
  timestamp: number;       // Date.now() at notification receipt
}

// Physical validation bounds for StrokeReading fields
// These guards prevent corrupt GATT bytes from propagating as impossible metric values.
const SPLIT_MS_MIN = 60000;   // 1:00/500m — physically impossible to row faster on an ergometer
const SPLIT_MS_MAX = 900000;  // 15:00/500m — suspiciously slow; likely a sensor error
const STROKE_RATE_MAX = 60;   // 60 spm — extreme upper bound for any ergometer stroke rate
const WATTS_MIN = 0;          // Negative power is physically impossible
const WATTS_MAX = 3000;       // Upper bound for plausible ergometer wattage

/**
 * Read a 24-bit unsigned integer from a DataView in little-endian byte order.
 */
export function getUint24LE(data: DataView, offset: number): number {
  return (
    data.getUint8(offset) |
    (data.getUint8(offset + 1) << 8) |
    (data.getUint8(offset + 2) << 16)
  );
}

/**
 * Decode the Rowing General Status GATT characteristic.
 * Returns elapsedTimeMs, distanceMeters, and strokeState.
 *
 * Byte layout [ASSUMED from ErgometerJS — verify against official Concept2 BLE spec]:
 *   offset 0: elapsed time, 3-byte LE, units 10ms
 *   offset 3: distance, 3-byte LE, units 0.1m
 *   offset 6: stroke state byte (0=idle, 1=drive, 2=recover)
 */
export function parseRowingGeneralStatus(
  data: DataView
): Pick<StrokeReading, 'elapsedTimeMs' | 'distanceMeters' | 'strokeState'> {
  const elapsedTimeMs = getUint24LE(data, ROWING_STATUS_ELAPSED_TIME_OFFSET) * 10;
  const distanceMeters = getUint24LE(data, ROWING_STATUS_DISTANCE_OFFSET) / 10;
  const strokeState = data.getUint8(ROWING_STATUS_STROKE_STATE_OFFSET);
  return { elapsedTimeMs, distanceMeters, strokeState };
}

/**
 * Decode the Extra Status 1 GATT characteristic.
 * Returns strokeRate and splitMs.
 *
 * Byte layout [ASSUMED from ErgometerJS — verify against official Concept2 BLE spec]:
 *   offset 0: stroke rate (spm), 1 byte
 *   offset 3: split time, 3-byte LE, units 10ms per 500m
 */
export function parseExtraStatus1(
  data: DataView
): Pick<StrokeReading, 'strokeRate' | 'splitMs'> {
  const strokeRate = data.getUint8(EXTRA1_STROKE_RATE_OFFSET);
  const splitMs = getUint24LE(data, EXTRA1_SPLIT_OFFSET) * 10;
  return { strokeRate, splitMs };
}

/**
 * Decode the Extra Status 2 GATT characteristic.
 * Returns watts.
 *
 * Byte layout [ASSUMED from ErgometerJS — verify against official Concept2 BLE spec]:
 *   offset 0: watts, 16-bit LE
 */
export function parseExtraStatus2(data: DataView): Pick<StrokeReading, 'watts'> {
  const watts = data.getUint16(EXTRA2_WATTS_OFFSET, true); // true = little-endian
  return { watts };
}

/**
 * Validate a StrokeReading against physical ergometer limits.
 * Throws RangeError if any field is outside plausible bounds.
 *
 * This is the T-02-01 threat mitigation: corrupt GATT bytes cannot produce
 * impossible metric values that would reach session state or the coaching engine.
 */
export function validateStrokeReading(reading: StrokeReading): void {
  if (reading.splitMs < SPLIT_MS_MIN) {
    throw new RangeError(
      `splitMs below physical minimum: ${reading.splitMs}ms (min ${SPLIT_MS_MIN}ms)`
    );
  }
  if (reading.splitMs > SPLIT_MS_MAX) {
    throw new RangeError(
      `splitMs above physical maximum: ${reading.splitMs}ms (max ${SPLIT_MS_MAX}ms)`
    );
  }
  if (reading.strokeRate > STROKE_RATE_MAX) {
    throw new RangeError(
      `strokeRate above physical maximum: ${reading.strokeRate} spm (max ${STROKE_RATE_MAX})`
    );
  }
  if (reading.watts < WATTS_MIN) {
    throw new RangeError(
      `watts cannot be negative: ${reading.watts}`
    );
  }
  if (reading.watts > WATTS_MAX) {
    throw new RangeError(
      `watts above physical maximum: ${reading.watts}W (max ${WATTS_MAX}W)`
    );
  }
  if (reading.distanceMeters < 0) {
    throw new RangeError(
      `distanceMeters cannot be negative: ${reading.distanceMeters}`
    );
  }
}
