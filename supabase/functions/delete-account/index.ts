// delete-account: permanently deletes the signed-in user's account (Settings → Delete my account).
//
// Deleting the login (auth.users) removes every row that belongs to it, because each Odyr table
// references auth.users "on delete cascade": workout data, steps, reminders, push subscriptions,
// the Pro waitlist entry, crew membership and horns. Two things are handled first:
//   - a crew this person started is handed to another member, so friends don't lose their crew;
//   - their error reports (no link to the login) are removed.
//
// Only the person themselves can call it: the request must carry their own login token, which the
// app sends automatically. Keep "Enforce JWT verification" ON (the default).
//
// Deploy in the Supabase dashboard: Edge Functions → Deploy a new function → Via editor,
// name it "delete-account", paste this file, deploy.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Provided automatically to every Supabase Edge Function
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// The app runs on another site (GitHub Pages), so the browser asks permission first
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Send a POST request' }, 405);

    // Who is asking: their own login token, checked by Supabase
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Not signed in' }, 401);

    // Crews they started go to the longest-standing other member (if any)
    const { data: owned } = await admin.from('crews').select('id').eq('created_by', user.id);
    for (const crew of owned ?? []) {
        const { data: next } = await admin.from('crew_members').select('user_id')
            .eq('crew_id', crew.id).neq('user_id', user.id).order('joined_at', { ascending: true }).limit(1);
        if (next && next.length) await admin.from('crews').update({ created_by: next[0].user_id }).eq('id', crew.id);
    }

    // Error reports aren't linked to the login, so remove them by hand (fine if the table doesn't exist)
    await admin.from('error_log').delete().eq('user_id', user.id);

    // The login itself; everything else follows
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ deleted: true });
});
