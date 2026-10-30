// Test mode (index.html?test): a pretend Supabase so the checks never touch the real database.
// Every query resolves to "no rows, no error"; upserts are recorded in window.__sbCalls for the save checks.
window.__sbCalls = [];

(() => {
    const query = table => {
        const q = {
            then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
        };
        ['select', 'eq', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'maybeSingle', 'single', 'delete', 'insert', 'update', 'in']
            .forEach(name => { q[name] = () => q; });
        q.upsert = (row, options) => {
            window.__sbCalls.push({ table, op: 'upsert', row, options });
            return q;
        };
        return q;
    };
    window.supabase = {
        createClient: () => ({
            auth: {
                getSession: async () => ({ data: { session: null }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                signOut: async () => ({ error: null }),
            },
            from: query,
            rpc: async (name, args) => { window.__sbCalls.push({ op: 'rpc', name, args }); return { data: null, error: null }; },
            functions: { invoke: async () => ({ data: null, error: null }) },
        }),
    };
    try { localStorage.setItem('wt_splash_off', '1'); } catch (e) { /* private mode */ }
})();
