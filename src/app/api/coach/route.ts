import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { buildMemorySnapshot } from '@/lib/coaching/memory-snapshot';

export const runtime = 'edge';

type Intent = 'too_hard' | 'push_me' | 'im_good' | 'checkin' | 'debrief';

interface Metrics {
  rate: number;
  splitMs: number;
  watts: number;
  elapsedMin: number;
  distanceM: number;
}

interface SessionSummary {
  durationS: number;
  totalMeters: number;
  avgSplitMs: number;
  avgWatts: number;
  avgStrokeRate: number;
}

interface SessionContext {
  metrics?: Metrics;
  energyLevel?: number;
  timeAvailableMin?: number;
  sessionType?: string;
  sessionSummary?: SessionSummary;
}

const ALLOWED_INTENTS: Intent[] = ['too_hard', 'push_me', 'im_good', 'checkin', 'debrief'];

function getSupabaseFromRequest(request: Request) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('Cookie') ?? '';
          return cookieHeader
            .split(';')
            .map((c) => {
              const [name, ...rest] = c.trim().split('=');
              return { name: name ?? '', value: rest.join('=') };
            })
            .filter((c) => c.name);
        },
        setAll() { /* read-only in route handler */ },
      },
    }
  );
}

function buildSystemPrompt(memoryBlock: string): string {
  const base =
    "You are a calm, direct rowing coach. Keep responses under 2 sentences for mid-session intents, up to 4 sentences for debrief. Reference the athlete's current metrics when relevant. No filler phrases. Tone: supportive but honest. Never use 'Great job!' as a standalone response.";

  if (!memoryBlock) return base;

  return `${base}

${memoryBlock}

IMPORTANT: Reference the athlete's past sessions naturally when relevant -- e.g., "Last Tuesday you held 1:55 for 20 minutes, think you can match that today?" Do NOT explicitly say "according to my records" or "I see from your history." Speak as a coach who simply KNOWS their athlete.`;
}

function formatSplit(splitMs: number): string {
  const totalSec = Math.round(splitMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function buildPrompt(intent: Intent, ctx: SessionContext): string {
  switch (intent) {
    case 'checkin': {
      const energy = ctx.energyLevel ?? 3;
      const time = ctx.timeAvailableMin ?? 20;
      return `The athlete has an energy level of ${energy}/5 and ${time} minutes available. Greet them warmly and suggest ONE specific session type that fits their energy and time (e.g., "steady state 20 min at a comfortable pace"). Be brief and encouraging.`;
    }
    case 'too_hard': {
      const m = ctx.metrics;
      const metricsStr = m
        ? `Current metrics: rate ${m.rate} spm, split ${formatSplit(m.splitMs)}/500m, ${m.watts}W, ${m.elapsedMin.toFixed(1)} min elapsed, ${m.distanceM}m covered.`
        : '';
      return `${metricsStr} The athlete says it's too hard. Acknowledge their difficulty and suggest easing up with a specific target (e.g., a lower stroke rate or slightly slower split).`;
    }
    case 'push_me': {
      const m = ctx.metrics;
      const metricsStr = m
        ? `Current metrics: rate ${m.rate} spm, split ${formatSplit(m.splitMs)}/500m, ${m.watts}W, ${m.elapsedMin.toFixed(1)} min elapsed, ${m.distanceM}m covered.`
        : '';
      return `${metricsStr} The athlete wants to push harder. Encourage them to increase intensity with a specific target (e.g., a faster split or slightly higher rate).`;
    }
    case 'im_good': {
      const m = ctx.metrics;
      const metricsStr = m
        ? `Current metrics: rate ${m.rate} spm, split ${formatSplit(m.splitMs)}/500m, ${m.watts}W, ${m.elapsedMin.toFixed(1)} min elapsed.`
        : '';
      return `${metricsStr} The athlete says they're feeling good. Briefly acknowledge this positively.`;
    }
    case 'debrief': {
      const s = ctx.sessionSummary;
      const summaryStr = s
        ? `Session summary: ${s.durationS}s duration, ${s.totalMeters}m, avg split ${formatSplit(s.avgSplitMs)}/500m, avg ${s.avgWatts}W, avg stroke rate ${s.avgStrokeRate} spm.`
        : 'Session just completed.';
      return `${summaryStr} Provide a debrief: recap 3-4 key stats and call out one standout moment. After your spoken debrief, output the separator ---COACH_MEMORY--- on its own line followed by a JSON array of {key, value} objects representing things to remember about this athlete for future sessions (e.g., preferred_rate, endurance_trend, injury_notes). Include 1-4 entries. If nothing notable, output an empty array [].`;
    }
  }
}

function getMaxTokens(intent: Intent): number {
  switch (intent) {
    case 'checkin':
      return 80;
    case 'too_hard':
    case 'push_me':
      return 60;
    case 'im_good':
      return 40;
    case 'debrief':
      return 300;
  }
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { intent: unknown; sessionContext?: SessionContext };
  try {
    body = await request.json() as { intent: unknown; sessionContext?: SessionContext };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { intent, sessionContext = {} } = body;

  if (!ALLOWED_INTENTS.includes(intent as Intent)) {
    return Response.json(
      { error: `Invalid intent. Must be one of: ${ALLOWED_INTENTS.join(', ')}` },
      { status: 400 }
    );
  }

  const validIntent = intent as Intent;

  const supabase = getSupabaseFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();

  let memoryBlock = '';
  if (user) {
    try {
      memoryBlock = await buildMemorySnapshot(supabase, user.id);
    } catch (err) {
      console.error('[coach] memory snapshot error:', err);
      // Continue without memory -- graceful degradation
    }
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: getMaxTokens(validIntent),
    system: buildSystemPrompt(memoryBlock),
    messages: [{ role: 'user', content: buildPrompt(validIntent, sessionContext) }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
