// rest-push: sends the lock-screen "Rest over" notification.
//
// How it fits together (see supabase-push-setup.sql):
//   1. During a workout the app writes "alert me at <time>" to public.rest_timers.
//   2. pg_cron checks every 5 seconds and, only when a timer is due, calls this function
//      with the shared secret from public.push_config.
//   3. This function claims the due timers (deletes them, so nothing is sent twice) and
//      sends a Web Push to each of that user's devices in public.push_subscriptions.
//
// Deploy in the Supabase dashboard: Edge Functions → Deploy a new function → Via editor,
// name it "rest-push", paste this file, deploy, then turn OFF "Enforce JWT verification"
// (pg_cron authenticates with the x-cron-secret header instead).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Both are provided automatically to every Supabase Edge Function
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const { data: config, error: configError } = await sb.from('push_config').select('key, value');
    if (configError) return json({ error: configError.message }, 500);
    const cfg = Object.fromEntries(config.map((row) => [row.key, row.value]));

    if (!cfg.cron_secret || req.headers.get('x-cron-secret') !== cfg.cron_secret) {
        return json({ error: 'forbidden' }, 403);
    }
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

    // Claim due timers by deleting them, so overlapping runs never send the same alert twice
    const { data: due, error: dueError } = await sb
        .from('rest_timers')
        .delete()
        .lte('fire_at', new Date().toISOString())
        .select('user_id, title, body');
    if (dueError) return json({ error: dueError.message }, 500);
    if (!due.length) return json({ sent: 0 });

    const { data: subscriptions } = await sb
        .from('push_subscriptions')
        .select('endpoint, user_id, p256dh, auth')
        .in('user_id', due.map((timer) => timer.user_id));

    const log: { status: number; note: string }[] = [];
    let sent = 0;
    for (const timer of due) {
        for (const sub of (subscriptions ?? []).filter((s) => s.user_id === timer.user_id)) {
            const payload = JSON.stringify({ title: timer.title || 'Rest over', body: timer.body || 'Time for your next set' });
            const request = webpush.generateRequestDetails(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                { TTL: 120, urgency: 'high' },
            );
            const host = new URL(sub.endpoint).host;
            try {
                const res = await fetch(request.endpoint, { method: 'POST', headers: request.headers, body: request.body });
                // 404/410: the device unsubscribed or the app was removed — forget it
                if (res.status === 404 || res.status === 410) {
                    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
                if (res.ok) sent++;
                log.push({ status: res.status, note: res.ok ? host : `${host} ${(await res.text()).slice(0, 200)}` });
            } catch (error) {
                log.push({ status: 0, note: `${host} ${String(error).slice(0, 200)}` });
            }
        }
    }
    // Delivery results (status code + push service host only) for troubleshooting
    if (log.length) await sb.from('push_log').insert(log);
    return json({ sent, attempted: log.length });
});
