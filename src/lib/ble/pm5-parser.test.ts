import { describe, it, expect } from 'vitest';
import {
  parseRowingGeneralStatus,
  parseExtraStatus1,
  parseExtraStatus2,
  validateStrokeReading,
  type StrokeReading,
} from './pm5-parser';

// Helper to build a DataView from an array of bytes
function makeDataView(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

describe('parseRowingGeneralStatus', () => {
  it('decodes elapsedTimeMs from offset 0 (3-byte LE, units 10ms)', () => {
    // 0x64 = 100 → 100 * 10 = 1000ms
    const bytes = Array(20).fill(0);
    bytes[0] = 0x64; // 100
    bytes[1] = 0x00;
    bytes[2] = 0x00;
    const result = parseRowingGeneralStatus(makeDataView(bytes));
    expect(result.elapsedTimeMs).toBe(1000);
  });

  it('decodes distanceMeters from offset 3 (24-bit LE, units 0.1m)', () => {
    // 0x0A = 10 → 10 / 10 = 1.0m
    const bytes = Array(20).fill(0);
    bytes[3] = 0x0a;
    bytes[4] = 0x00;
    bytes[5] = 0x00;
    const result = parseRowingGeneralStatus(makeDataView(bytes));
    expect(result.distanceMeters).toBeCloseTo(1.0);
  });

  it('decodes strokeState=1 (drive) from offset 6', () => {
    const bytes = Array(20).fill(0);
    bytes[6] = 1;
    const result = parseRowingGeneralStatus(makeDataView(bytes));
    expect(result.strokeState).toBe(1);
  });

  it('decodes strokeState=0 (idle) when byte is 0', () => {
    const bytes = Array(20).fill(0);
    const result = parseRowingGeneralStatus(makeDataView(bytes));
    expect(result.strokeState).toBe(0);
  });

  it('decodes multi-byte elapsed time correctly', () => {
    // 0x01, 0x01, 0x00 = 1 + 256 = 257 → 257 * 10 = 2570ms
    const bytes = Array(20).fill(0);
    bytes[0] = 0x01;
    bytes[1] = 0x01;
    bytes[2] = 0x00;
    const result = parseRowingGeneralStatus(makeDataView(bytes));
    expect(result.elapsedTimeMs).toBe(2570);
  });
});

describe('parseExtraStatus1', () => {
  it('decodes strokeRate from offset 0', () => {
    const bytes = Array(20).fill(0);
    bytes[0] = 24; // 24 spm
    const result = parseExtraStatus1(makeDataView(bytes));
    expect(result.strokeRate).toBe(24);
  });

  it('decodes splitMs from offset 3 (3-byte LE, units 10ms)', () => {
    // 2:05/500m = 125 seconds = 125000ms
    // 125000 / 10 = 12500 = 0x30D4 (little-endian: 0xD4, 0x30, 0x00)
    const bytes = Array(20).fill(0);
    bytes[3] = 0xd4; // low byte
    bytes[4] = 0x30; // mid byte  (12500 = 0x30D4)
    bytes[5] = 0x00; // high byte
    const result = parseExtraStatus1(makeDataView(bytes));
    expect(result.splitMs).toBe(125000);
  });
});

describe('parseExtraStatus2', () => {
  it('decodes watts from offset 0 (16-bit LE)', () => {
    // 200 watts = 0x00C8 → bytes 0xC8, 0x00 (little-endian)
    const bytes = Array(10).fill(0);
    bytes[0] = 0xc8; // 200 low byte
    bytes[1] = 0x00; // high byte
    const result = parseExtraStatus2(makeDataView(bytes));
    expect(result.watts).toBe(200);
  });
});

describe('validateStrokeReading', () => {
  function makeReading(overrides: Partial<StrokeReading> = {}): StrokeReading {
    return {
      elapsedTimeMs: 60000,
      distanceMeters: 500,
      strokeState: 1,
      strokeRate: 20,
      splitMs: 120000, // 2:00/500m
      watts: 200,
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('does not throw for a valid reading', () => {
    expect(() => validateStrokeReading(makeReading())).not.toThrow();
  });

  it('throws RangeError when splitMs < 60000 (faster than 1:00/500m)', () => {
    expect(() =>
      validateStrokeReading(makeReading({ splitMs: 59999 }))
    ).toThrow(RangeError);
    expect(() =>
      validateStrokeReading(makeReading({ splitMs: 59999 }))
    ).toThrow('splitMs below physical minimum');
  });

  it('throws RangeError when splitMs > 900000 (slower than 15:00/500m)', () => {
    expect(() =>
      validateStrokeReading(makeReading({ splitMs: 900001 }))
    ).toThrow(RangeError);
    expect(() =>
      validateStrokeReading(makeReading({ splitMs: 900001 }))
    ).toThrow('splitMs above physical maximum');
  });

  it('throws RangeError when strokeRate > 60', () => {
    expect(() =>
      validateStrokeReading(makeReading({ strokeRate: 61 }))
    ).toThrow(RangeError);
    expect(() =>
      validateStrokeReading(makeReading({ strokeRate: 61 }))
    ).toThrow('strokeRate above physical maximum');
  });

  it('throws RangeError when watts < 0', () => {
    expect(() =>
      validateStrokeReading(makeReading({ watts: -1 }))
    ).toThrow(RangeError);
    expect(() =>
      validateStrokeReading(makeReading({ watts: -1 }))
    ).toThrow('watts cannot be negative');
  });
});
