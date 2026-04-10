// PM5 GATT UUIDs — Source: ErgometerJS analysis of Concept2 PM5 BLE Interface Definition
// NOTE: UUIDs ce060031/32/33 are inferred from ErgometerJS source analysis [ASSUMED].
// MUST verify against official Concept2 PM5 Bluetooth Smart Interface Definition PDF
// before production use. Fetch from: developers.concept2.com or request via
// Concept2 software development contact form.
export const PM5_SERVICE_UUID = 'ce060030-43e5-11e4-916c-0800200c9a66';
export const PM5_ROWING_STATUS_UUID = 'ce060031-43e5-11e4-916c-0800200c9a66';
export const PM5_EXTRA_STATUS1_UUID = 'ce060032-43e5-11e4-916c-0800200c9a66';
export const PM5_EXTRA_STATUS2_UUID = 'ce060033-43e5-11e4-916c-0800200c9a66';

// Byte offsets within ROWING_STATUS characteristic (Rowing General Status)
// Source: ErgometerJS analysis [ASSUMED — verify against official Concept2 BLE spec]
export const ROWING_STATUS_ELAPSED_TIME_OFFSET = 0; // 3 bytes, little-endian, units 10ms
export const ROWING_STATUS_DISTANCE_OFFSET = 3;      // 3 bytes, little-endian, units 0.1m
export const ROWING_STATUS_STROKE_STATE_OFFSET = 6;  // 1 byte: 0=idle, 1=drive, 2=recover

// Byte offsets within EXTRA_STATUS1 characteristic
// Source: ErgometerJS analysis [ASSUMED — verify against official Concept2 BLE spec]
export const EXTRA1_STROKE_RATE_OFFSET = 0;  // 1 byte, spm
export const EXTRA1_SPLIT_OFFSET = 3;        // 3 bytes, little-endian, units 10ms per 500m [ASSUMED]

// Byte offsets within EXTRA_STATUS2 characteristic
// Source: ErgometerJS analysis [ASSUMED — verify against official Concept2 BLE spec]
export const EXTRA2_WATTS_OFFSET = 0; // 2 bytes, little-endian, watts
