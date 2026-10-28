// ════════════════════════════════════════════
//  ODYR PRO WAITLIST: measures interest before Pro is built (no payment, nothing changes in the app)
// ════════════════════════════════════════════

// Answers are saved to the pro_waitlist table (supabase-pro-waitlist-setup.sql) and mirrored in profile.pro
const PRO_INTERESTS = [
    ['coach', 'AI coach chat'],
    ['nutrition', 'Adaptive nutrition'],
    ['readiness', 'Readiness from sleep'],
    ['programs', 'Programs built for me'],
];
const PRO_PRICES = ['5', '8', '12', 'none'];
let proDraft = null;   // answers being chosen, before "Join the waitlist"

function proCurrency() {
    return LANG === 'fr' ? 'EUR' : 'USD';
}

function proPriceLabel(price) {
    if (price === 'none') return 'Wouldn\'t pay';
    return `${Number(price).toLocaleString(LOCALE, { style: 'currency', currency: proCurrency(), maximumFractionDigits: 0 })}/month`;
}

function renderProCards() {
    document.querySelectorAll('[data-pro-card]').forEach(el => { el.innerHTML = proCardHtml(); });
}

function proCardHtml() {
    const pro = (userProfile && userProfile.pro) || null;
    const head = `
        <div class="pro-kicker"><span>Odyr Pro</span><em>Coming soon</em></div>
        <p class="pro-title">A coach that thinks with you.</p>`;
    if (pro && pro.joined && !proDraft) {
        return `${head}
            <p class="pro-joined">You're on the list. You'll hear about it first.</p>
            <button class="pro-link" onclick="editPro()">Change my answers</button>`;
    }
    if (!proDraft) {
        return `${head}
            <ul class="pro-points">
                <li>Ask your coach anything, answered from your own training</li>
                <li>Nutrition targets that adapt to your progress</li>
                <li>Daily readiness from your sleep and heart rate</li>
            </ul>
            <button class="btn btn-primary pro-btn" onclick="startPro()">Notify me</button>
            <p class="pro-fine">No payment now. Nothing changes in your free app.</p>`;
    }
    return `${head}
        <div class="pro-q">What matters most to you?</div>
        <div class="pro-chips">${PRO_INTERESTS.map(([id, label]) =>
            `<button class="pro-chip${proDraft.interests.includes(id) ? ' on' : ''}" onclick="toggleProInterest('${id}')">${label}</button>`).join('')}</div>
        <div class="pro-q">What would feel like a fair price?</div>
        <div class="pro-chips">${PRO_PRICES.map(price =>
            `<button class="pro-chip${proDraft.price === price ? ' on' : ''}" onclick="setProPrice('${price}')">${escapeHtml(proPriceLabel(price))}</button>`).join('')}</div>
        <button class="btn btn-primary pro-btn" onclick="joinPro()">Join the waitlist</button>
        <button class="pro-link" onclick="cancelPro()">Not now</button>`;
}

function startPro() {
    haptic();
    const pro = (userProfile && userProfile.pro) || {};
    proDraft = { interests: [...(pro.interests || [])], price: pro.price || null };
    renderProCards();
}

const editPro = startPro;

function cancelPro() {
    haptic();
    proDraft = null;
    renderProCards();
}

function toggleProInterest(id) {
    haptic();
    const list = proDraft.interests;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    renderProCards();
}

function setProPrice(price) {
    haptic();
    proDraft.price = proDraft.price === price ? null : price;
    renderProCards();
}

async function joinPro() {
    if (!currentUser || !proDraft) return;
    haptic();
    const answers = { interests: proDraft.interests, price: proDraft.price };
    const first = !(userProfile && userProfile.pro && userProfile.pro.joined);
    userProfile = { ...userProfile, pro: { joined: (userProfile.pro && userProfile.pro.joined) || todayStr(), ...answers } };
    proDraft = null;
    renderProCards();
    scheduleSave();
    try {
        const { error } = await sb.from('pro_waitlist').upsert({
            user_id: currentUser.id,
            email: currentUser.email || null,
            interests: answers.interests,
            price: answers.price,
            currency: proCurrency(),
            lang: LANG,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;
    } catch (error) {
        // Still kept in the profile, so nothing is lost; the table copy is only for counting interest
        console.warn('Waitlist not saved:', error.message || error);
    }
    showToast(first ? 'You\'re on the list' : 'Answers updated');
}
