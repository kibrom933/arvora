// En lille efterligning af Supabase (auth, rest, rpc, storage, functions) i hukommelsen, så appen kan testes i en
// browser uden net. Den efterligner kun det, appen bruger, og de vigtigste adgangsregler (ønsker kun til ejeren).
// Fordelingen regnes med den rigtige motor. Koder er altid 123456 (login) og 654321 (underskrift).
import { solvePoints, solveBids, validatePoints, validateBids } from '../engine/arvora-engine.js';
import { createHash, randomUUID, randomBytes } from 'node:crypto';

const sha = s => createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
const b64u = s => Buffer.from(s).toString('base64url');

export function createFake({ url = 'https://jqulxozrejhrinqxyffr.supabase.co', stripe = true, ai = true } = {}) {
  const T = {}; for (const t of ['estates', 'estate_members', 'heirs', 'invitations', 'items', 'item_images', 'wishes', 'distribution_runs', 'distribution_inputs', 'distribution_explanations', 'tie_break_records', 'signatures', 'consent_records', 'audit_events', 'notifications', 'payments', 'otp_codes']) T[t] = [];
  const users = [], sessions = {}, pendingOtp = {}, storage = {}, inviteTokens = {}, log = [];
  let nextNo = {};
  const F = { T, users, storage, inviteTokens, log, sent: [], url };

  /* ---------- Auth ---------- */
  const jwt = u => { const p = { sub: u.id, email: u.email, phone: u.phone, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }; return b64u('{"alg":"HS256"}') + '.' + b64u(JSON.stringify(p)) + '.sig'; };
  const session = u => { const access_token = jwt(u); sessions[access_token] = u.id; return { access_token, refresh_token: 'r-' + randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(u) }; };
  const user = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email ?? '', phone: u.phone ? u.phone.replace(/^\+/, '') : '', app_metadata: {}, user_metadata: {}, created_at: now() });
  const findUser = ({ email, phone }) => users.find(u => (email && u.email === email) || (phone && u.phone === phone));
  const uidOf = req => { const a = (req.headers['authorization'] || '').replace(/^Bearer /, ''); return sessions[a] || null; };

  /* ---------- Hjælpere til "RLS" ---------- */
  const member = (uid, e) => T.estate_members.find(m => m.estate_id === e && m.user_id === uid);
  const isTov = (uid, e) => member(uid, e)?.role === 'tovholder';
  const myHeir = (uid, e) => member(uid, e)?.heir_id ?? null;
  const estate = e => T.estates.find(x => x.id === e);
  const err = (message, status = 400) => ({ status, body: { message, code: 'P0001', details: null, hint: null } });
  const audit = (uid, action, table, row, e) => T.audit_events.push({ id: T.audit_events.length + 1, estate_id: e ?? row?.estate_id ?? null, actor: uid, action, table_name: table, row_id: row?.id ?? null, meta: table === 'wishes' ? { heir_id: row.heir_id } : row?.name ? { name: row.name } : {}, created_at: now() });

  /* ---------- PostgREST-filtre ---------- */
  function applyFilters(rows, q) {
    for (const [k, v] of q) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      const m = v.match(/^(eq|neq|is|in|gt|lt|gte|lte)\.(.*)$/s); if (!m) continue;
      const [, op, raw] = m;
      rows = rows.filter(r => { const x = r[k];
        if (op === 'eq') return String(x) === raw; if (op === 'neq') return String(x) !== raw;
        if (op === 'is') return raw === 'null' ? x == null : raw === 'true' ? x === true : x === false;
        if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(x));
        return true; });
    }
    const ord = q.get('order'); if (ord) for (const part of ord.split(',').reverse()) { const [col, dir] = part.split('.'); rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
    const lim = q.get('limit'); if (lim) rows = rows.slice(0, Number(lim));
    return rows;
  }
  function project(rows, sel) { if (!sel || sel === '*') return rows; const cols = sel.split(',').map(s => s.trim()); return rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))); }

  /* ---------- Hvad brugeren må se ---------- */
  function visible(table, uid) {
    const rows = T[table] || [];
    if (!uid) return [];
    const mine = e => !!member(uid, e);
    switch (table) {
      case 'estates': return rows.filter(r => mine(r.id));
      case 'estate_members': case 'heirs': case 'items': case 'item_images': case 'signatures': case 'tie_break_records': return rows.filter(r => mine(r.estate_id));
      case 'invitations': case 'audit_events': case 'payments': return rows.filter(r => r.estate_id && isTov(uid, r.estate_id));
      case 'wishes': return rows.filter(r => r.heir_id === myHeir(uid, r.estate_id));
      case 'distribution_runs': return rows.filter(r => mine(r.estate_id) && r.released_at);
      case 'distribution_explanations': return rows.filter(r => { const run = T.distribution_runs.find(x => x.id === r.run_id); return run && r.heir_id === myHeir(uid, run.estate_id); });
      case 'consent_records': return rows.filter(r => isTov(uid, r.estate_id) || r.heir_id === myHeir(uid, r.estate_id) || r.user_id === uid || (r.kind === 'ny_runde' && mine(r.estate_id)));
      case 'notifications': return rows.filter(r => isTov(uid, r.estate_id));
      case 'estate_overview': return T.estates.filter(r => mine(r.id)).map(e => ({ id: e.id, name: e.name, status: e.status, method: e.method, mode: e.mode, deadline: e.deadline, paid_at: e.paid_at, closed_at: e.closed_at, retention_until: e.retention_until, created_at: e.created_at,
        heirs: T.heirs.filter(h => h.estate_id === e.id).length, submitted: T.heirs.filter(h => h.estate_id === e.id && h.submitted_at).length, items: T.items.filter(i => i.estate_id === e.id && !i.deleted_at).length,
        signed: T.signatures.filter(s => s.estate_id === e.id && !T.distribution_runs.find(r => r.id === s.run_id)?.superseded_at).length }));
      default: return [];
    }
  }
  const editable = (table, uid, row, op) => {
    const e = row.estate_id ?? row.id, st = estate(e)?.status;
    if (table === 'estates') return isTov(uid, row.id) && st !== 'slettet';
    if (['heirs', 'items', 'item_images'].includes(table)) return isTov(uid, e) && ['kladde', 'aaben'].includes(st);
    if (table === 'invitations') return isTov(uid, e) && op === 'update';
    return false;
  };
  const COLS = { estates: ['name', 'years', 'mode', 'method', 'deadline', 'retention_days'], heirs: ['estate_id', 'name', 'relation', 'phone', 'email', 'share', 'sort'],
    items: ['estate_id', 'name', 'room', 'kind', 'description', 'group_name', 'valuable', 'will_heir_id', 'will_note', 'will_unclear', 'ai_suggested', 'rest_decision', 'deleted_at'], item_images: ['estate_id', 'item_id', 'path', 'bytes'], invitations: ['revoked_at'] };

  function rest(req, uid) {
    const u = new URL(req.url), table = u.pathname.replace('/rest/v1/', ''), q = u.searchParams, sel = q.get('select');
    const single = /vnd\.pgrst\.object/.test(req.headers['accept'] || '');
    const prefer = req.headers['prefer'] || '';
    const pick = (rows) => { if (single) return rows.length ? { status: 200, body: rows[0] } : { status: 406, body: { code: 'PGRST116', message: '0 rows' } }; return { status: 200, body: rows }; };
    if (req.method === 'GET' || req.method === 'HEAD') {
      const rows = applyFilters(visible(table, uid), q);
      if (/count=exact/.test(prefer)) return { status: 200, body: req.method === 'HEAD' ? '' : project(rows, sel), headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } };
      return pick(project(rows, sel));
    }
    const body = req.body ? JSON.parse(req.body) : {};
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body], out = [];
      for (const b of list) {
        const bad = Object.keys(b).filter(k => !(COLS[table] || []).includes(k)); if (bad.length) return err(`permission denied for column ${bad[0]}`, 403);
        const row = { id: randomUUID(), created_at: now(), updated_at: now(), ...defaults(table), ...b };
        if (!editable(table, uid, row, 'insert')) return err('new row violates row-level security policy for table "' + table + '"', 403);
        if (table === 'items') { nextNo[row.estate_id] = Math.max(nextNo[row.estate_id] || 0, ...T.items.filter(i => i.estate_id === row.estate_id).map(i => i.no)) + 1; row.no = nextNo[row.estate_id]; }
        T[table].push(row); audit(uid, 'insert', table, row); out.push(row);
      }
      return /return=representation/.test(prefer) ? pick(project(out, sel)) : { status: 201, body: '' };
    }
    if (req.method === 'PATCH') {
      const bad = Object.keys(body).filter(k => !(COLS[table] || []).includes(k)); if (bad.length) return err(`permission denied for column ${bad[0]}`, 403);
      const rows = applyFilters(visible(table, uid), q).filter(r => editable(table, uid, r, 'update'));
      for (const r of rows) {
        if (table === 'items' && body.deleted_at) unlockPointsOn(r);
        if (table === 'items' && body.will_heir_id !== undefined && body.will_heir_id !== r.will_heir_id) unlockPointsOn(r);
        Object.assign(r, body, { updated_at: now() }); audit(uid, 'update', table, r);
      }
      return /return=representation/.test(prefer) ? pick(project(rows, sel)) : { status: 204, body: '' };
    }
    if (req.method === 'DELETE') {
      const rows = applyFilters(visible(table, uid), q).filter(r => editable(table, uid, r, 'delete') || table === 'item_images');
      for (const r of rows) { if (table === 'heirs' && r.submitted_at) continue; T[table] = T[table].filter(x => x !== r); audit(uid, 'delete', table, r); if (table === 'heirs') { T.wishes = T.wishes.filter(w => w.heir_id !== r.id); T.items.forEach(i => { if (i.will_heir_id === r.id) i.will_heir_id = null; }); } }
      return { status: 204, body: '' };
    }
    return err('Ukendt', 405);
  }
  function defaults(table) { return { heirs: { share: 1, sort: 0, user_id: null, submitted_at: null, no_wish: false, proxy_by: null, relation: null, phone: null, email: null }, items: { room: 'Andet', kind: 'thing', valuable: false, will_heir_id: null, will_unclear: false, ai_suggested: false, description: null, rest_decision: null, deleted_at: null }, estates: {}, item_images: {} }[table] || {}; }
  function unlockPointsOn(item) { for (const w of T.wishes.filter(w => w.item_id === item.id && w.points > 0)) { const h = T.heirs.find(h => h.id === w.heir_id); if (h) h.submitted_at = null; } }

  /* ---------- RPC'er ---------- */
  const rpcs = {
    create_estate(uid, p) {
      const e = { id: randomUUID(), name: p.p_name, years: p.p_years, mode: p.p_mode || 'doed', method: p.p_method || 'point', status: 'kladde', deadline: p.p_deadline, lod: randomBytes(4).readUInt32BE() || 1, created_by: uid, paid_at: null, retention_days: 90, retention_until: null, closed_at: null, created_at: now(), updated_at: now() };
      if (!e.name) return err('null value in column "name"');
      T.estates.push(e); let hid = null;
      if (p.p_me_as_heir !== false) { const u = users.find(x => x.id === uid); const h = { ...defaults('heirs'), id: randomUUID(), estate_id: e.id, name: p.p_my_name || 'Tovholder', relation: p.p_my_relation, user_id: uid, phone: u?.phone ?? null, email: u?.email ?? null, created_at: now() }; T.heirs.push(h); hid = h.id; }
      T.estate_members.push({ estate_id: e.id, user_id: uid, role: 'tovholder', heir_id: hid, created_at: now() });
      if (p.p_partner_code) { if (p.p_partner_code.toUpperCase() !== 'TEST01') return err('Partnerkoden findes ikke'); T.payments.push({ id: randomUUID(), estate_id: e.id, amount_ore: 0, status: 'partner', created_at: now() }); e.paid_at = now(); e.status = 'aaben'; }
      audit(uid, 'insert', 'estates', e, e.id); return { status: 200, body: JSON.stringify(e.id) };
    },
    open_estate(uid, p) { const e = estate(p.p_estate); if (!e || !isTov(uid, e.id)) return err('Ingen adgang', 403); if (e.status !== 'kladde') return err('Boet er allerede åbnet'); if (!e.paid_at) return err('Boet er ikke betalt endnu'); if (T.heirs.filter(h => h.estate_id === e.id).length < 2) return err('Der skal være mindst to arvinger'); e.status = 'aaben'; return { status: 204, body: '' }; },
    set_wishes(uid, p) { const e = estate(p.p_estate), hid = myHeir(uid, p.p_estate), h = T.heirs.find(x => x.id === hid); if (!h || h.submitted_at || e.status !== 'aaben') return err('Ønskerne kan ikke ændres nu', 403);
      T.wishes = T.wishes.filter(w => w.heir_id !== hid); for (const w of p.p_wishes) { const it = T.items.find(i => i.id === w.item_id && i.estate_id === e.id && !i.deleted_at && !i.will_heir_id); if (!it) return err('Tingen findes ikke eller er testamenteret'); T.wishes.push({ id: randomUUID(), estate_id: e.id, heir_id: hid, item_id: w.item_id, points: w.points || 0, bid: w.bid || 0 }); }
      audit(uid, 'update', 'wishes', { heir_id: hid, estate_id: e.id }); return { status: 200, body: { points_used: T.wishes.filter(w => w.heir_id === hid).reduce((a, w) => a + w.points, 0) } }; },
    lock_wishes(uid, p) { const e = estate(p.p_estate), hid = myHeir(uid, p.p_estate), h = T.heirs.find(x => x.id === hid); if (!h || h.submitted_at || e.status !== 'aaben') return err('Kan ikke låse nu', 403);
      const used = T.wishes.filter(w => w.heir_id === hid).reduce((a, w) => a + w.points, 0), nb = T.wishes.filter(w => w.heir_id === hid && w.bid > 0).length; if (e.method === 'point' && ![0, 100].includes(used)) return err('Du skal bruge alle 100 point, eller ingen');
      h.submitted_at = now(); h.no_wish = e.method === 'point' ? used === 0 : nb === 0; if (T.heirs.filter(x => x.estate_id === e.id).every(x => x.submitted_at)) F.sent.push({ kind: 'alle_har_svaret' }); return { status: 204, body: '' }; },
    unlock_my_wishes(uid, p) { const e = estate(p.p_estate), h = T.heirs.find(x => x.id === myHeir(uid, p.p_estate)); if (!h || e.status !== 'aaben') return err('Kan ikke låse op nu', 403); h.submitted_at = null; return { status: 204, body: '' }; },
    record_consent(uid, p) { const e = estate(p.p_estate); if (!e || !member(uid, e.id)) return err('Ingen adgang', 403); const c = { id: randomUUID(), estate_id: e.id, heir_id: p.p_kind === 'proxy_oensker' ? p.p_heir : myHeir(uid, e.id), user_id: uid, kind: p.p_kind, channel: p.p_channel, note: p.p_note, run_id: null, given_at: now() };
      if (p.p_kind === 'proxy_oensker') { if (!isTov(uid, e.id)) return err('Kun tovholderen', 403); const h = T.heirs.find(x => x.id === p.p_heir && !x.user_id); if (!h) return err('Arvingen har sit eget link'); if (!p.p_channel || !p.p_note) return err('Skriv hvordan og hvornår arvingen gav lov'); h.proxy_by = uid; h.proxy_consent_id = c.id; }
      T.consent_records.push(c); return { status: 200, body: JSON.stringify(c.id) }; },
    proxy_set_wishes(uid, p) { const e = estate(p.p_estate), h = T.heirs.find(x => x.id === p.p_heir); if (!h || !isTov(uid, e.id)) return err('Ingen adgang', 403); if (!h.proxy_consent_id) return err('Registrér først, at arvingen har givet lov'); if (e.status !== 'aaben') return err('Boet er ikke åbent');
      T.wishes = T.wishes.filter(w => w.heir_id !== h.id); for (const w of p.p_wishes) T.wishes.push({ id: randomUUID(), estate_id: e.id, heir_id: h.id, item_id: w.item_id, points: w.points || 0, bid: w.bid || 0 });
      const used = T.wishes.filter(w => w.heir_id === h.id).reduce((a, w) => a + w.points, 0); if (p.p_lock) { if (e.method === 'point' && ![0, 100].includes(used)) return err('Alle 100 point skal bruges, eller ingen'); h.submitted_at = now(); h.no_wish = used === 0; } return { status: 200, body: { points_used: used } }; },
    start_distribution(uid, p) { const e = estate(p.p_estate); if (!e || !isTov(uid, e.id)) return err('Kun tovholderen', 403); if (e.status !== 'aaben') return err('Boet er ikke åbent for fordeling'); const miss = T.heirs.filter(h => h.estate_id === e.id && !h.submitted_at).length; if (miss) return err(miss + ' har ikke afgivet ønsker endnu'); if (!T.items.some(i => i.estate_id === e.id && !i.deleted_at)) return err('Der er ingen ting'); e.status = 'laast'; return { status: 204, body: '' }; },
    request_reopen(uid, p) { const e = estate(p.p_estate); if (!e || !isTov(uid, e.id)) return err('Kun tovholderen', 403); if (!['fordelt', 'underskrevet'].includes(e.status)) return err('Der er ingen fordeling at åbne'); const r = currentRun(e.id); T.consent_records.push({ id: randomUUID(), estate_id: e.id, heir_id: myHeir(uid, e.id), user_id: uid, kind: 'ny_runde', run_id: r.id, note: p.p_reason, given_at: now() }); checkReopen(e); return { status: 204, body: '' }; },
    consent_reopen(uid, p) { const e = estate(p.p_estate), hid = myHeir(uid, e?.id); if (!hid) return err('Ingen adgang', 403); const r = currentRun(e.id); if (!r || !T.consent_records.some(c => c.kind === 'ny_runde' && c.run_id === r.id)) return err('Ingen har bedt om en ny runde'); T.consent_records.push({ id: randomUUID(), estate_id: e.id, heir_id: hid, user_id: uid, kind: 'ny_runde', run_id: r.id, given_at: now() }); checkReopen(e); return { status: 204, body: '' }; },
    close_estate(uid, p) { const e = estate(p.p_estate); if (!e || !isTov(uid, e.id)) return err('Kun tovholderen', 403); if (e.status !== 'underskrevet') return err('Alle skal have skrevet under først'); e.status = 'afsluttet'; e.closed_at = now(); e.retention_until = new Date(Date.now() + e.retention_days * 864e5).toISOString(); return { status: 204, body: '' }; },
    delete_estate_now(uid, p) { const e = estate(p.p_estate); if (!e || !isTov(uid, e.id)) return err('Kun tovholderen', 403); for (const t of Object.keys(T)) T[t] = T[t].filter(r => r.estate_id !== e.id && r.id !== e.id); for (const k of Object.keys(storage)) if (k.startsWith(e.id + '/')) delete storage[k]; return { status: 204, body: '' }; },
  };
  const currentRun = e => T.distribution_runs.filter(r => r.estate_id === e && !r.superseded_at).sort((a, b) => b.version - a.version)[0];
  function checkReopen(e) { const r = currentRun(e.id); if (!r) return; const all = T.heirs.filter(h => h.estate_id === e.id).every(h => T.consent_records.some(c => c.kind === 'ny_runde' && c.run_id === r.id && c.heir_id === h.id)); if (all) { r.superseded_at = now(); T.heirs.filter(h => h.estate_id === e.id).forEach(h => h.submitted_at = null); e.status = 'aaben'; } }

  /* ---------- Serverfunktioner ---------- */
  const fns = {
    invite(uid, b) { if (!uid) return { status: 401, body: { error: 'Ikke logget ind' } }; const h = T.heirs.find(x => x.id === b.heir_id); if (!h || !isTov(uid, h.estate_id)) return { status: 403, body: { error: 'Kun tovholderen kan invitere' } }; const to = b.channel === 'email' ? h.email : h.phone; if (!to) return { status: 400, body: { error: 'Arvingen har intet telefonnummer' } };
      T.invitations.forEach(i => { if (i.heir_id === h.id && !i.used_at && !i.revoked_at) i.revoked_at = now(); }); const token = randomBytes(32).toString('base64url'); inviteTokens[h.id] = token;
      T.invitations.push({ id: randomUUID(), estate_id: h.estate_id, heir_id: h.id, token_hash: sha(token), channel: b.channel, sent_to: to, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), used_at: null, revoked_at: null, attempts: 0, created_at: now() });
      F.sent.push({ kind: 'invitation', to, link: 'https://app.arvora.test/i/' + token }); return { status: 200, body: { ok: true, sent_to: to, expires_in_days: 14 } }; },
    'accept-invite'(uid, b) { const inv = T.invitations.find(i => i.token_hash === sha(String(b.token || ''))); if (!inv) return { status: 404, body: { error: 'Linket findes ikke. Bed tovholderen sende et nyt.' } }; if (inv.revoked_at) return { status: 410, body: { error: 'Linket er trukket tilbage. Bed tovholderen sende et nyt.' } };
      const h = T.heirs.find(x => x.id === inv.heir_id), e = estate(inv.estate_id); pendingOtp[inv.sent_to] = '123456'; F.sent.push({ kind: 'otp', to: inv.sent_to, code: '123456' });
      return { status: 200, body: { heir: h.name, estate: e.name, mode: e.mode, channel: inv.channel, send_to: inv.sent_to, masked: inv.channel === 'sms' ? inv.sent_to.slice(0, 3) + ' •• •• ' + inv.sent_to.slice(-4) : inv.sent_to[0] + '•••@' + inv.sent_to.split('@')[1], already_linked: !!h.user_id, used: !!inv.used_at } }; },
    'link-invite'(uid, b) { if (!uid) return { status: 401, body: { error: 'Ikke logget ind' } }; const inv = T.invitations.find(i => i.token_hash === sha(String(b.token || ''))); if (!inv || inv.revoked_at) return { status: 410, body: { error: 'Linket er ikke gyldigt længere' } }; const u = users.find(x => x.id === uid); const mine = inv.channel === 'sms' ? u.phone : u.email;
      if (!mine || mine.toLowerCase() !== inv.sent_to.toLowerCase()) return { status: 403, body: { error: 'Koden blev bekræftet på et andet nummer end det, invitationen blev sendt til' } }; const h = T.heirs.find(x => x.id === inv.heir_id); if (h.user_id && h.user_id !== uid) return { status: 409, body: { error: 'En anden bruger er allerede koblet til denne arving. Kontakt tovholderen.' } };
      if (!h.user_id) { h.user_id = uid; T.estate_members.push({ estate_id: h.estate_id, user_id: uid, role: 'arving', heir_id: h.id, created_at: now() }); } inv.used_at = inv.used_at || now(); return { status: 200, body: { ok: true, estate_id: h.estate_id, heir_id: h.id } }; },
    'run-distribution'(uid, b) { const e = estate(b.estate_id); if (!e || !isTov(uid, e.id)) return { status: 403, body: { error: 'Kun tovholderen kan dele tingene' } }; if (e.status !== 'laast') return { status: 400, body: { error: 'Start fordelingen først (boet skal være låst)' } };
      const hs = T.heirs.filter(h => h.estate_id === e.id).sort((a, b) => a.sort - b.sort || (a.created_at < b.created_at ? -1 : 1)), heirs = hs.map(h => ({ id: h.id, name: h.name, w: Number(h.share) })), its = T.items.filter(i => i.estate_id === e.id && !i.deleted_at).sort((a, b) => a.no - b.no), items = its.map(i => ({ id: i.id, name: i.name, no: i.no, will: i.will_heir_id || '' }));
      const pts = {}, bids = {}; heirs.forEach(h => { pts[h.id] = {}; bids[h.id] = {}; }); for (const w of T.wishes.filter(w => w.estate_id === e.id)) { if (!pts[w.heir_id]) continue; if (w.points) pts[w.heir_id][w.item_id] = w.points; if (w.bid) bids[w.heir_id][w.item_id] = w.bid; }
      const bad = e.method === 'point' ? validatePoints(heirs, items, pts) : validateBids(heirs, items, bids); if (bad.length) { const ids = [...new Set(bad.map(x => x.heirId))]; hs.forEach(h => { if (ids.includes(h.id)) h.submitted_at = null; }); e.status = 'aaben'; return { status: 409, body: { error: 'Ønskerne passer ikke længere for ' + heirs.filter(h => ids.includes(h.id)).map(h => h.name).join(', ') + '. De skal fordele deres point igen.' } }; }
      const lod = Number(e.lod), r = e.method === 'point' ? solvePoints({ heirs, items, pts, lod }) : solveBids({ heirs, items, bids, lod }); const version = (currentRun(e.id)?.version ?? T.distribution_runs.filter(x => x.estate_id === e.id).length) + 1;
      const owner = {}; for (const h of heirs) for (const x of r.out[h.id]) owner[x.itemId] = h.id; const nameOf = Object.fromEntries(heirs.map(h => [h.id, h.name])), itemName = Object.fromEntries(items.map(i => [i.id, i.name]));
      const result = { version, engine: '1', method: r.method, lod, out: r.out, rest: r.rest, ef1_ok: r.ef.length === 0, ef: r.ef, lod_notes: r.lod, lod_ids: r.lodIds, zero: r.zero, score: r.score ?? null, of: r.of ?? null, price: r.price ?? null, total: r.total ?? null, settle: r.settle ?? null, heirs: hs.map(h => ({ id: h.id, name: h.name, share: Number(h.share), no_wish: h.no_wish, proxy: !!h.proxy_by })), items: items.map(i => ({ id: i.id, no: i.no, name: i.name, will: i.will || null })), swap_check_skipped: false };
      const run = { id: randomUUID(), estate_id: e.id, version, method: e.method, lod, input_hash: sha(JSON.stringify(pts)), result: { ...result, document_hash: sha(JSON.stringify(result)) }, ef1_ok: r.ef.length === 0, engine_version: '1', released_at: now(), superseded_at: null, created_by: uid, created_at: now() }; T.distribution_runs.push(run);
      for (const h of heirs) { const mine = e.method === 'point' ? Object.entries(pts[h.id]).filter(([k]) => itemName[k]).sort((a, b) => b[1] - a[1]).map(([itemId, p]) => ({ itemId, name: itemName[itemId], mine: p, winnerId: owner[itemId] ?? null, winner: owner[itemId] ? nameOf[owner[itemId]] : null, winnerGave: owner[itemId] ? (pts[owner[itemId]][itemId] ?? 0) : null, got: owner[itemId] === h.id, lod: r.lodIds.includes(itemId) }))
        : Object.entries(bids[h.id]).filter(([k]) => itemName[k]).sort((a, b) => b[1] - a[1]).map(([itemId, bb]) => ({ itemId, name: itemName[itemId], mine: bb, winnerId: owner[itemId] ?? null, winner: owner[itemId] ? nameOf[owner[itemId]] : null, winnerGave: r.price?.[itemId] ?? null, got: owner[itemId] === h.id, lod: r.lodIds.includes(itemId) }));
        T.distribution_explanations.push({ run_id: run.id, heir_id: h.id, data: { wishes: mine, got: r.out[h.id].map(x => x.itemId), score: r.score?.[h.id] ?? null, of: r.of?.[h.id] ?? null } }); }
      r.ties.forEach((t, k) => T.tie_break_records.push({ id: randomUUID(), run_id: run.id, estate_id: e.id, kind: t.kind, item_ids: t.itemIds ?? (t.itemId ? [t.itemId] : []), heir_ids: t.heirIds, winner_heir_id: t.winnerId, note: r.lod[k] ?? '' }));
      e.status = 'fordelt'; hs.forEach(h => F.sent.push({ kind: 'fordeling_klar', to: h.phone || h.email })); return { status: 200, body: { ok: true, run_id: run.id, version, ef1_ok: r.ef.length === 0, lod: r.lod.length } }; },
    sign(uid, b) { if (!uid) return { status: 401, body: { error: 'Ikke logget ind' } }; const run = T.distribution_runs.find(r => r.id === b.run_id); if (!run || run.superseded_at) return { status: 409, body: { error: 'Fordelingen kan ikke underskrives' } }; const h = T.heirs.find(x => x.estate_id === run.estate_id && x.user_id === uid); if (!h) return { status: 403, body: { error: 'Du er ikke arving i boet' } }; const channel = h.phone ? 'sms' : 'email';
      if (b.step === 'request') { T.otp_codes = T.otp_codes.filter(o => !(o.heir_id === h.id && o.run_id === run.id)); T.otp_codes.push({ heir_id: h.id, run_id: run.id, code: '654321', attempts: 0 }); F.sent.push({ kind: 'underskrift_kode', to: h.phone || h.email, code: '654321' }); return { status: 200, body: { ok: true, channel, sent_to_masked: channel === 'sms' ? h.phone.slice(0, 3) + '••••' + h.phone.slice(-2) : h.email.replace(/^(.).*@/, '$1•••@') } }; }
      const o = T.otp_codes.find(x => x.heir_id === h.id && x.run_id === run.id); if (!o) return { status: 410, body: { error: 'Koden er udløbet. Bed om en ny.' } }; if (o.code !== String(b.code)) { o.attempts++; return { status: 400, body: { error: 'Koden passer ikke' } }; }
      T.otp_codes = T.otp_codes.filter(x => x !== o); if (T.signatures.some(s => s.run_id === run.id && s.heir_id === h.id)) return { status: 400, body: { error: 'Du har allerede skrevet under' } };
      T.signatures.push({ id: randomUUID(), run_id: run.id, estate_id: run.estate_id, heir_id: h.id, signed_name: (b.signed_name || '').trim() || h.name, method: channel === 'sms' ? 'otp_sms' : 'otp_email', document_hash: run.result.document_hash, created_at: now() });
      const e = estate(run.estate_id); if (T.heirs.filter(x => x.estate_id === e.id).every(x => T.signatures.some(s => s.run_id === run.id && s.heir_id === x.id))) { e.status = 'underskrevet'; F.sent.push({ kind: 'alle_har_underskrevet' }); } return { status: 200, body: { ok: true, document_hash: run.result.document_hash } }; },
    'ai-name'(uid, b) { if (!ai) return { status: 503, body: { error: 'AI-navne er ikke sat op endnu' } }; if (!storage[b.path]) return { status: 404, body: { error: 'Billedet blev ikke fundet' } }; return { status: 200, body: { ok: true, name: 'Spisebord i eg', room: 'Stue', kind: 'table', valuable: false, description: 'Bord med fire ben', duplicate_of: null, confidence: 'high' } }; },
    'stripe-checkout'(uid, b) { if (!stripe) return { status: 503, body: { error: 'Betaling er ikke sat op endnu' } }; const e = estate(b.estate_id); if (!e || !isTov(uid, e.id)) return { status: 403, body: { error: 'Kun tovholderen kan betale' } }; if (e.paid_at) return { status: 409, body: { error: 'Boet er allerede betalt' } };
      // Efterligner Stripe + webhook på én gang
      T.payments.push({ id: randomUUID(), estate_id: e.id, amount_ore: 79500, status: 'betalt', paid_at: now(), created_at: now() }); e.paid_at = now(); return { status: 200, body: { url: 'https://app.arvora.test/bo/' + e.id + '?betaling=ok' } }; },
    pdf(uid, b, req) { const u = new URL(req.url); const runId = u.searchParams.get('run_id'); const run = T.distribution_runs.find(r => r.id === runId); if (!run || !uid || !member(uid, run.estate_id)) return { status: 404, body: { error: 'Fordelingen findes ikke, eller du har ikke adgang' } }; return { status: 200, raw: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'), contentType: 'application/pdf' }; },
  };

  /* ---------- HTTP-indgang ---------- */
  function handle(req) {
    const u = new URL(req.url), p = u.pathname, uid = uidOf(req), body = req.body && req.headers['content-type']?.includes('json') ? JSON.parse(req.body) : null;
    log.push(req.method + ' ' + p);
    if (p.startsWith('/auth/v1/')) {
      if (p === '/auth/v1/otp') { const to = body.email || body.phone; pendingOtp[to] = '123456'; F.sent.push({ kind: 'otp', to, code: '123456' }); return { status: 200, body: {} }; }
      if (p === '/auth/v1/verify') { const to = body.email || body.phone; if (pendingOtp[to] !== String(body.token)) return { status: 403, body: { error_code: 'otp_expired', msg: 'Token has expired or is invalid' } }; delete pendingOtp[to]; let usr = findUser({ email: body.email, phone: body.phone }); if (!usr) { usr = { id: randomUUID(), email: body.email ?? null, phone: body.phone ?? null }; users.push(usr); } return { status: 200, body: session(usr) }; }
      if (p === '/auth/v1/user') { const usr = users.find(x => x.id === uid); return usr ? { status: 200, body: user(usr) } : { status: 401, body: { msg: 'invalid' } }; }
      if (p === '/auth/v1/token') { const usr = users.find(x => x.id === uid) || users[users.length - 1]; return usr ? { status: 200, body: session(usr) } : { status: 401, body: {} }; }
      if (p === '/auth/v1/logout') return { status: 204, body: '' };
      return { status: 404, body: {} };
    }
    if (p.startsWith('/rest/v1/rpc/')) { const name = p.slice('/rest/v1/rpc/'.length); const f = rpcs[name]; if (!f) return err('Ukendt funktion ' + name, 404); if (!uid) return err('Ikke logget ind', 401); return f(uid, body || {}); }
    if (p.startsWith('/rest/v1/')) return rest(req, uid);
    if (p.startsWith('/storage/v1/')) {
      if (p.startsWith('/storage/v1/object/sign/ting') && req.method === 'POST') return { status: 200, body: (body.paths || []).map(path => ({ error: null, path, signedURL: '/object/sign/ting/' + path + '?token=x' })) };
      if (p.startsWith('/storage/v1/object/sign/ting/') && req.method === 'GET') { const key = decodeURIComponent(p.slice('/storage/v1/object/sign/ting/'.length)); return storage[key] ? { status: 200, raw: storage[key], contentType: 'image/jpeg' } : { status: 404, body: '' }; }
      if (p.startsWith('/storage/v1/object/ting/') && req.method === 'POST') { const key = decodeURIComponent(p.slice('/storage/v1/object/ting/'.length)); const e = key.split('/')[0]; if (!uid || !isTov(uid, e)) return { status: 403, body: { message: 'new row violates row-level security policy' } }; storage[key] = req.raw || Buffer.from(''); return { status: 200, body: { Key: 'ting/' + key, Id: randomUUID() } }; }
      if (p === '/storage/v1/object/ting' && req.method === 'DELETE') { for (const k of body.prefixes || []) delete storage[k]; return { status: 200, body: [] }; }
      return { status: 404, body: {} };
    }
    if (p.startsWith('/functions/v1/')) { const name = p.slice('/functions/v1/'.length).split('?')[0]; const f = fns[name]; if (!f) return { status: 404, body: { error: 'ukendt' } }; return f(uid, body || {}, req); }
    return { status: 404, body: { error: 'ukendt sti ' + p } };
  }

  /** Playwright-route: route.fulfill ud fra handle(). */
  F.route = async route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors(), body: '' });
    const headers = Object.fromEntries(Object.entries(r.headers()).map(([k, v]) => [k.toLowerCase(), v]));
    const req = { url: r.url(), method: r.method(), headers, body: r.postData(), raw: r.postDataBuffer() };
    let res; try { res = handle(req); } catch (e) { console.error('FAKE', e); res = { status: 500, body: { error: String(e.message) } }; }
    if (res.raw) return route.fulfill({ status: res.status, headers: { ...cors(), 'content-type': res.contentType }, body: res.raw });
    return route.fulfill({ status: res.status, headers: { ...cors(), ...(res.headers || {}), 'content-type': 'application/json' }, body: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) });
  };
  const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD', 'access-control-expose-headers': 'content-range' });
  return F;
}
