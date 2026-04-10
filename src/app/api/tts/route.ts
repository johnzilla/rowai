export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'CARTESIA_API_KEY not configured' }, { status: 500 });
  }

  let body: { text?: unknown; voiceId?: unknown };
  try {
    body = await request.json() as { text?: unknown; voiceId?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, voiceId } = body;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'text must be a non-empty string' }, { status: 400 });
  }

  if (text.length > 500) {
    return Response.json({ error: 'text must be 500 characters or fewer' }, { status: 400 });
  }

  const defaultVoiceId = process.env.CARTESIA_VOICE_ID ?? '';
  const resolvedVoiceId = (typeof voiceId === 'string' && voiceId.trim().length > 0)
    ? voiceId
    : defaultVoiceId;

  const cartesiaResponse = await fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': '2025-04-16',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: resolvedVoiceId,
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: 24000,
      },
    }),
  });

  if (!cartesiaResponse.ok) {
    const errorText = await cartesiaResponse.text();
    return Response.json(
      { error: `Cartesia API error: ${cartesiaResponse.status}`, detail: errorText },
      { status: 502 }
    );
  }

  // Stream the Cartesia SSE response directly back to the client
  return new Response(cartesiaResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
