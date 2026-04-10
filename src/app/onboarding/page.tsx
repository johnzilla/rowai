'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill name from user metadata if available
    async function prefillName() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.name) {
        setName(user.user_metadata.name as string);
      }
    }
    prefillName();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { error: upsertError } = await supabase
      .from('user_profile')
      .upsert({
        id: user.id,
        name: name.trim(),
        onboarding_complete: true,
        coaching_tone: 'calm_supportive',
      });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    router.push('/session');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-2 text-center">
          What should we call you?
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          Your coach will use this during sessions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm text-gray-400 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="given-name"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-[#333] text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors text-lg"
              placeholder="Your name"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 rounded-lg bg-white text-black font-semibold text-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting up…' : 'Start Rowing'}
          </button>
        </form>
      </div>
    </main>
  );
}
