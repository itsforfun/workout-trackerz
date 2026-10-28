// steps-ingest: receives today's step count from the "Workout Steps" iPhone Shortcut.
//
// The Shortcut reads Apple Health and POSTs JSON: { "token": "...", "steps": 8423, "date": "2026-10-27" },
// optionally with "exercise": Apple Health exercise minutes for the day (needs supabase-v2-setup.sql).
// The token (public.step_tokens) identifies the user without a login, so this function runs with
// JWT verification OFF. It only ever writes that user's row in public.step_counts.
//
// Deploy in the Supabase dashboard: Edge Functions → Deploy a new function → Via editor,
// name it "steps-ingest", paste this file, deploy, then turn OFF "Enforce JWT verification".
import { createClient } from 'npm:@supabase/supabase-js@2';

// Provided automatically to every Supabase Edge Function
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method !== 'POST') return json({ error: 'Send a POST request' }, 405);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'The request body must be JSON' }, 400);
    }

    const token = String(body.token ?? '').trim();
    // Shortcuts may send "8423" or "8,423 steps"; keep the digits
    const steps = parseInt(String(body.steps ?? '').replace(/[^\d.]/g, ''), 10);
    const date = String(body.date ?? '').trim();
    const exercise = body.exercise === undefined || body.exercise === '' ? null
        : parseInt(String(body.exercise).replace(/[^\d.]/g, ''), 10);

    if (!token) return json({ error: 'Missing token' }, 400);
    if (!Number.isFinite(steps) || steps < 0 || steps > 200000) return json({ error: 'steps must be a number' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'date must look like 2026-10-27' }, 400);
    if (exercise !== null && (!Number.isFinite(exercise) || exercise < 0 || exercise > 1440)) return json({ error: 'exercise must be minutes' }, 400);

    const { data: owner, error: lookupError } = await sb
        .from('step_tokens')
        .select('user_id')
        .eq('token', token)
        .maybeSingle();
    if (lookupError) return json({ error: lookupError.message }, 500);
    if (!owner) return json({ error: 'Unknown token' }, 403);

    const row: Record<string, unknown> = { user_id: owner.user_id, date, steps, source: 'shortcut', updated_at: new Date().toISOString() };
    if (exercise !== null) row.exercise_minutes = exercise;
    const { error } = await sb.from('step_counts').upsert(row, { onConflict: 'user_id,date' });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, date, steps, ...(exercise !== null ? { exercise } : {}) });
});
