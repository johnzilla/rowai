import { create } from 'zustand';
import type { StrokeReading } from '../ble/pm5-parser';

// BleStatus represents the current state of the BLE connection to the PM5.
// Transitions: disconnected → connecting → connected → reconnecting → failed
type BleStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

// SessionPhase represents the lifecycle of a rowing session.
// idle: no active session; active: rowing in progress; ending: auto-detected session end
type SessionPhase = 'idle' | 'active' | 'ending';

interface SessionState {
  // BLE connection status — drives connection indicator and reconnect UI
  bleStatus: BleStatus;

  // The most recently received, validated stroke reading from the PM5
  latestReading: StrokeReading | null;

  // Session lifecycle phase
  sessionPhase: SessionPhase;

  // Whether a rowing session is currently active
  isSessionActive: boolean;

  // Epoch ms when the session started, null if not active
  sessionStartedAt: number | null;

  // Epoch ms of the most recent stroke reading, null if no strokes yet
  lastStrokeAt: number | null;

  // Actions — called by PM5Service event listeners and UI components
  setBleStatus: (status: BleStatus) => void;
  setLatestReading: (reading: StrokeReading) => void;
  setSessionPhase: (phase: SessionPhase) => void;
  startSession: () => void;
  endSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state
  bleStatus: 'disconnected',
  latestReading: null,
  sessionPhase: 'idle',
  isSessionActive: false,
  sessionStartedAt: null,
  lastStrokeAt: null,

  // Actions
  setBleStatus: (status: BleStatus) => set({ bleStatus: status }),

  setLatestReading: (reading: StrokeReading) =>
    set({ latestReading: reading, lastStrokeAt: reading.timestamp }),

  setSessionPhase: (phase: SessionPhase) => set({ sessionPhase: phase }),

  startSession: () =>
    set({
      isSessionActive: true,
      sessionStartedAt: Date.now(),
      sessionPhase: 'active',
    }),

  endSession: () =>
    set({
      isSessionActive: false,
      sessionPhase: 'idle',
    }),
}));
