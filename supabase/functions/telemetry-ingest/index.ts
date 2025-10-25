// deno-lint-ignore-file no-explicit-any
// @ts-nocheck - Deno Edge Function (runtime types not available in IDE)
import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[telemetry-ingest] Missing Supabase credentials');
}

const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

type Severity = 'info' | 'warning' | 'critical';

interface TelemetryPayload {
  event: string;
  severity?: Severity;
  conversation?: string | null;
  actor?: string | null;
  timestamp?: string;
  meta?: Record<string, unknown>;
}

const severityWeights: Record<Severity, number> = {
  info: 0.05,
  warning: 0.2,
  critical: 0.5,
};

const clampRisk = (value: number) => Math.min(1, Math.max(0, value));

async function handleEvent(payload: TelemetryPayload) {
  if (!supabase) {
    return { status: 500, body: { ok: false, reason: 'supabase_unavailable' } };
  }

  const { event, conversation, actor, meta = {} } = payload;
  const severity: Severity = payload.severity ?? 'info';

  if (!event) {
    return { status: 400, body: { ok: false, reason: 'missing_event' } };
  }

  if (!conversation) {
    return { status: 202, body: { ok: true, skipped: 'no_conversation_hash' } };
  }

  const weight = severityWeights[severity] ?? severityWeights.info;

  const { data: existing, error: selectError } = await supabase
    .from('conversation_risk_state')
    .select('risk_score')
    .eq('conversation_hash', conversation)
    .maybeSingle();

  if (selectError) {
    console.error('[telemetry-ingest] Select error', selectError);
    return { status: 500, body: { ok: false, reason: 'select_failed' } };
  }

  const previousRisk = existing?.risk_score ?? 0;
  const decayFactor = 0.82;
  const newRisk = clampRisk(previousRisk * decayFactor + weight);

  const { error: upsertError } = await supabase
    .from('conversation_risk_state')
    .upsert({
      conversation_hash: conversation,
      risk_score: newRisk,
      last_event: event,
      last_actor_hash: actor ?? null,
      last_event_severity: severity,
      last_event_meta: Object.keys(meta).length ? meta : null,
      last_event_at: payload.timestamp ?? new Date().toISOString(),
    });

  if (upsertError) {
    console.error('[telemetry-ingest] Upsert error', upsertError);
    return { status: 500, body: { ok: false, reason: 'upsert_failed' } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      risk: newRisk,
      severity,
    },
  };
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = (await req.json()) as TelemetryPayload;
    const result = await handleEvent(payload);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[telemetry-ingest] Unhandled error', error);
    return new Response(
      JSON.stringify({ ok: false, reason: 'invalid_payload' }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      }
    );
  }
});
