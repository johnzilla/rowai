'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckinScreen } from '@/components/checkin/CheckinScreen';

/**
 * Check-in page — the pre-session entry point (D-01).
 *
 * Loads BEFORE BLE pairing — coach greets you first, collects energy/time,
 * suggests a session type, then navigates to /session.
 *
 * Auth guard: mirrors session/page.tsx pattern — belt-and-suspenders check
 * in addition to middleware protection. Threat model T-02-11.
 */
export default function CheckinPage() {
  const router = useRouter();

  // T-02-11: Auth guard — redirect unauthenticated users to /login
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
      }
    };
    void checkAuth();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white">
      <CheckinScreen />
    </main>
  );
}
