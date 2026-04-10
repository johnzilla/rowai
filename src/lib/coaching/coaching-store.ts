import { create } from 'zustand';
import type { EnergyLevel, TimeAvailable } from './coaching-types';

interface SessionSummary {
  durationS: number;
  totalMeters: number;
  avgSplitMs: number | null;
  avgWatts: number | null;
  avgStrokeRate: number | null;
}

interface CoachingState {
  // Check-in state (per D-01, D-02, D-03)
  checkinComplete: boolean;
  energyLevel: EnergyLevel | null;
  timeAvailableMin: TimeAvailable | null;
  suggestedSessionType: string | null;
  sessionTypeAccepted: boolean;

  // Audio state (per D-08 visual indicator)
  isSpeaking: boolean;
  currentCueText: string | null;

  // Debrief state (per D-13, D-14, D-15)
  isDebriefing: boolean;
  debriefComplete: boolean;
  debriefText: string | null;

  // Session summary (per D-16)
  sessionSummary: SessionSummary | null;

  // Actions
  setCheckinData: (energy: EnergyLevel, time: TimeAvailable) => void;
  setSuggestedSessionType: (type: string) => void;
  acceptSessionType: () => void;
  skipCheckin: () => void;
  setIsSpeaking: (speaking: boolean, cueText?: string | null) => void;
  startDebrief: () => void;
  completeDebrief: (text: string) => void;
  setSessionSummary: (summary: SessionSummary | null) => void;
  resetCoachingState: () => void;
}

const initialState = {
  checkinComplete: false,
  energyLevel: null as EnergyLevel | null,
  timeAvailableMin: null as TimeAvailable | null,
  suggestedSessionType: null as string | null,
  sessionTypeAccepted: false,
  isSpeaking: false,
  currentCueText: null as string | null,
  isDebriefing: false,
  debriefComplete: false,
  debriefText: null as string | null,
  sessionSummary: null as SessionSummary | null,
};

export const useCoachingStore = create<CoachingState>((set) => ({
  ...initialState,

  setCheckinData: (energy: EnergyLevel, time: TimeAvailable) =>
    set({
      energyLevel: energy,
      timeAvailableMin: time,
      checkinComplete: true,
    }),

  setSuggestedSessionType: (type: string) =>
    set({ suggestedSessionType: type }),

  acceptSessionType: () =>
    set({ sessionTypeAccepted: true }),

  // D-04: "Just row" skip — medium energy default, open-ended session
  skipCheckin: () =>
    set({
      checkinComplete: true,
      energyLevel: 3,
      timeAvailableMin: null,
    }),

  setIsSpeaking: (speaking: boolean, cueText?: string | null) =>
    set({
      isSpeaking: speaking,
      currentCueText: speaking ? (cueText ?? null) : null,
    }),

  startDebrief: () =>
    set({ isDebriefing: true }),

  completeDebrief: (text: string) =>
    set({
      isDebriefing: false,
      debriefComplete: true,
      debriefText: text,
    }),

  setSessionSummary: (summary: SessionSummary | null) =>
    set({ sessionSummary: summary }),

  resetCoachingState: () =>
    set({ ...initialState }),
}));
