'use client';

import { useEffect } from 'react';
import { flushPendingWrites } from '@/lib/coaching/offline-cache';

/**
 * SyncTrigger — invisible component that flushes pending offline writes.
 * Runs on app load and when the device comes back online (D-08).
 * Renders nothing — pure side-effect.
 */
export function SyncTrigger() {
  useEffect(() => {
    // Flush on app load
    void flushPendingWrites();

    // Flush when coming back online
    const handleOnline = () => void flushPendingWrites();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}
