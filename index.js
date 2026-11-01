// League of Legends : ton compte Riot (Riot ID + région + clé d'API Riot), tes dernières parties, tes statistiques, tes champions et des courbes d'évolution.
// Plugin à accès complet (signé) pour afficher les images de Data Dragon ; il ne parle qu'à l'API de Riot et à Data Dragon, jamais à un autre site.
export default async function (ctx) {
  const el = ctx.el, net = (url, opts) => ctx.neo.pluginNet(ctx.id, url, opts);
  let netOk; const ensureNet = async () => netOk ??= await ctx.permission('network');  // l'autorisation réseau est demandée à l'usage
  const REGIONS = {  // nom affiché : [serveur de la région, routage des parties]
    'EUW (Europe Ouest)': ['euw1', 'europe'], 'EUNE (Europe Nord-Est)': ['eun1', 'europe'], 'TR (Turquie)': ['tr1', 'europe'], 'RU (Russie)': ['ru', 'europe'],
    'NA (Amérique du Nord)': ['na1', 'americas'], 'BR (Brésil)': ['br1', 'americas'], 'LAN': ['la1', 'americas'], 'LAS': ['la2', 'americas'],
    'KR (Corée)': ['kr', 'asia'], 'JP (Japon)': ['jp1', 'asia'], 'OCE (Océanie)': ['oc1', 'sea'], 'SG': ['sg2', 'sea'], 'PH': ['ph2', 'sea'], 'TH': ['th2', 'sea'], 'TW': ['tw2', 'sea'], 'VN': ['vn2', 'sea'],
  };
  const QUEUES = {420: 'Classée solo/duo', 440: 'Classée flex', 400: 'Normale draft', 430: 'Normale aveugle', 490: 'Normale rapide', 450: 'ARAM', 700: 'Clash', 480: 'Swiftplay', 1700: 'Arena', 1900: 'URF', 900: 'URF'};
  const GROUPS = {all: ['Toutes', () => true], rank: ['Classées', q => q === 420 || q === 440], normal: ['Normales', q => [400, 430, 490, 480].includes(q)], aram: ['ARAM', q => q === 450]};
  const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
  const TIER_FR = {IRON: 'Fer', BRONZE: 'Bronze', SILVER: 'Argent', GOLD: 'Or', PLATINUM: 'Platine', EMERALD: 'Émeraude', DIAMOND: 'Diamant', MASTER: 'Maître', GRANDMASTER: 'Grand maître', CHALLENGER: 'Challenger'};
  const TIER_COL = {IRON: '#7a6f6a', BRONZE: '#b0703a', SILVER: '#b9c4d0', GOLD: '#ffc23a', PLATINUM: '#3fc8b8', EMERALD: '#3fd070', DIAMOND: '#6a9cff', MASTER: '#c05aff', GRANDMASTER: '#ff5a5a', CHALLENGER: '#ffe27a'};
  const DIV = {I: 3, II: 2, III: 1, IV: 0};
  const ROLES = {TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support'};
  const lpScore = r => TIERS.indexOf(r.tier) < 7 ? TIERS.indexOf(r.tier) * 400 + (DIV[r.rank] ?? 0) * 100 + r.leaguePoints : 2800 + r.leaguePoints;
  const rankName = r => r ? (TIER_FR[r.tier] || r.tier) + (TIERS.indexOf(r.tier) < 7 ? ' ' + r.rank : '') : 'Sans classement';

  ctx.host.addStyle(`
    .lol{display:flex;flex-direction:column;gap:16px;padding:20px;box-sizing:border-box;max-width:1000px;margin:0 auto;color:var(--shell,#fff)}
    .lol h2{font:12px var(--title,monospace);margin:0 0 8px;letter-spacing:1px;line-height:1.6}
    .lol .card{padding:14px;background:color-mix(in srgb,var(--line2,#3a2a6e) 45%,#000);box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e)}
    .lol .hint{font-size:13px;color:var(--lilac,#c9bde6);line-height:1.5}
    .lol .err{color:#ff7a8a;font-size:14px}
    .lol input,.lol select{font:15px var(--title,monospace);color:#fff;background:#0d0820;border:2px solid var(--line2,#3a2a6e);padding:10px;min-width:0}
    .lol .form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .lol .form .full{grid-column:1/-1}
    .lol .form label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--lilac,#c9bde6)}
    .lol button{font:12px var(--title,monospace);color:#fff;border:0;padding:10px 14px;cursor:pointer;background:color-mix(in srgb,var(--violet,#8a5cf0) 80%,#000);box-shadow:inset 0 2px 0 rgba(255,255,255,.25),inset 0 -3px 0 rgba(0,0,0,.35)}
    .lol button.main{background:color-mix(in srgb,var(--magenta,#e01ec8) 80%,#000)}
    .lol button.q{background:color-mix(in srgb,var(--line2,#3a2a6e) 80%,transparent)}
    .lol button.on{background:color-mix(in srgb,var(--magenta,#e01ec8) 80%,#000)}
    .lol button:disabled{opacity:.5;cursor:default}
    .lol .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .lol .head{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
    .lol .pic{width:72px;height:72px;image-rendering:auto;box-shadow:0 0 0 3px var(--violet,#8a5cf0),4px 4px 0 3px rgba(0,0,0,.45);background:#0d0820;display:grid;place-items:center;font:24px var(--title,monospace)}
    .lol .who{display:flex;flex-direction:column;gap:6px;flex:1;min-width:200px}
    .lol .who b{font:18px var(--title,monospace)}
    .lol .ranks{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
    .lol .rk{display:flex;gap:12px;align-items:center}
    .lol .badge{width:46px;height:46px;flex:none;display:grid;place-items:center;font:16px var(--title,monospace);color:#130a20;box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -4px 0 rgba(0,0,0,.35),0 0 0 2px #000}
    .lol .rk b{font:13px var(--title,monospace)}
    .lol .rk span{font-size:13px;color:var(--lilac,#c9bde6)}
    .lol .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
    .lol .tile{display:flex;flex-direction:column;gap:6px;padding:12px;background:#120a2a;box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e)}
    .lol .tile b{font:18px var(--title,monospace)} .lol .tile span{font-size:12px;color:var(--lilac,#c9bde6)}
    .lol .good{color:#8ee8a0} .lol .bad{color:#ff7a8a} .lol .mid{color:#ffd07a}
    .lol .tabs{display:flex;gap:8px;flex-wrap:wrap}
    .lol .tbl{display:flex;flex-direction:column;gap:6px}
    .lol .line{display:grid;grid-template-columns:44px 1.4fr repeat(4,1fr);gap:10px;align-items:center;padding:8px 10px;background:#120a2a;font-size:14px}
    .lol .line.h{font:8px var(--title,monospace);color:var(--lilac,#c9bde6);background:transparent;padding:0 10px}
    .lol .ic{width:40px;height:40px;background:#0d0820;box-shadow:0 0 0 2px #000;display:grid;place-items:center;font:14px var(--title,monospace)}
    .lol .m{display:grid;grid-template-columns:6px 44px 1.2fr 1fr 1fr 1fr 1fr;gap:10px;align-items:center;padding:8px 10px 8px 0;background:#120a2a;font-size:14px;cursor:pointer}
    .lol .m .bar{align-self:stretch;background:#8ee8a0} .lol .m.lose .bar{background:#ff7a8a}
    .lol .m small{display:block;font-size:12px;color:var(--lilac,#c9bde6)}
    .lol .det{padding:10px 14px;background:#0d0820;font-size:13px;color:var(--lilac,#c9bde6);display:flex;gap:18px;flex-wrap:wrap}
    .lol .charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px}
    .lol canvas{width:100%;height:auto;image-rendering:pixelated;background:#0d0820;box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e);display:block}
    .lol .empty{opacity:.7;padding:20px 0;text-align:center}
    @media (max-width:640px){.lol .line{grid-template-columns:40px 1fr 1fr 1fr}.lol .line>:nth-child(n+5){display:none}.lol .m{grid-template-columns:6px 40px 1fr 1fr}.lol .m>:nth-child(n+5){display:none}}`);
  const root = el('div', 'lol'); ctx.view.append(root);

  // ---- l'état : gardé dans le dossier du plugin (le cache des parties) ; la clé d'API dans un document à part
  let D = {acct: null, profile: null, ranks: [], mastery: [], matches: [], rankHist: [], dd: null, updated: 0}, KEY = '', tab = 'apercu', group = 'all', busy = false, note = '', open = null, err = '';
  const save = () => ctx.folder.write('cache', D).catch(() => {});
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---- l'API de Riot (la clé voyage dans l'en-tête X-Riot-Token, seulement vers *.api.riotgames.com)
  const MSG = {400: 'Requête refusée par Riot.', 401: 'Riot ne reconnaît pas cette clé (« Unknown apikey »). Sur developer.riotgames.com, clique « Regenerate API Key » puis copie la nouvelle clé en entier : dès qu\'on en génère une autre, l\'ancienne ne marche plus.', 403: 'Clé d\'API expirée ou refusée : une clé de développement dure 24 h, génères-en une nouvelle sur developer.riotgames.com.',
    404: 'Introuvable : vérifie le Riot ID (Nom#TAG) et la région.', 429: 'Trop de requêtes pour Riot : attends une minute et réessaie.', 500: 'Riot a un problème, réessaie plus tard.', 503: 'Les serveurs de Riot sont indisponibles.'};
  async function riot(host, path, retry = true) {
    if (!/^[a-z0-9]+$/.test(host)) throw new Error('hôte invalide');
    if (!await ensureNet()) throw new Error('Autorisation réseau refusée : sans elle, impossible de parler à Riot.');
    const r = await net('https://' + host + '.api.riotgames.com' + path, {headers: {'X-Riot-Token': KEY, Accept: 'application/json'}});
    if (r.status === 429 && retry) { await sleep(2500); return riot(host, path, false); }
    if (!r.ok) { const e = new Error(MSG[r.status] || 'Erreur ' + r.status + ' de Riot.'); e.status = r.status; throw e; }
    return JSON.parse(r.body);
  }
  async function dragon() {  // les noms et les images des champions (Data Dragon, sans clé)
    if (D.dd && Date.now() - D.dd.at < 6 * 864e5) return;
    if (!await ensureNet()) throw new Error('Autorisation réseau refusée.');
    const v = JSON.parse((await net('https://ddragon.leagueoflegends.com/api/versions.json')).body)[0];
    const c = JSON.parse((await net('https://ddragon.leagueoflegends.com/cdn/' + v + '/data/fr_FR/champion.json')).body).data, byKey = {};
    for (const x of Object.values(c)) byKey[x.key] = {id: x.id, name: x.name};
    D.dd = {v, byKey, at: Date.now()};
  }
  const champImg = id => D.dd ? 'https://ddragon.leagueoflegends.com/cdn/' + D.dd.v + '/img/champion/' + id + '.png' : '';
  const picture = (src, cls, fb) => {
    const box = el('div', cls); const fallback = () => { box.textContent = (fb || '?').slice(0, 1).toUpperCase(); };
    if (!src) { fallback(); return box; }
    const i = el('img'); i.src = src; i.alt = ''; i.style.cssText = 'width:100%;height:100%;display:block'; i.onerror = () => { i.remove(); fallback(); }; box.append(i); return box;
  };

  // ---- récupérer le profil, le classement, les maîtrises et les parties
  const compact = (m, puuid) => {
    const p = m.info.participants.find(x => x.puuid === puuid); if (!p) return null;
    const team = m.info.participants.filter(x => x.teamId === p.teamId), tk = team.reduce((a, x) => a + x.kills, 0) || 1, td = team.reduce((a, x) => a + x.totalDamageDealtToChampions, 0) || 1, dur = m.info.gameDuration;
    return {id: m.metadata.matchId, t: m.info.gameStartTimestamp, dur: dur > 3600 * 6 ? Math.round(dur / 1000) : dur, q: m.info.queueId, champ: p.championName, cid: p.championId, role: p.teamPosition || '', win: !!p.win && !p.gameEndedInEarlySurrender,
      remake: !!p.gameEndedInEarlySurrender, k: p.kills, d: p.deaths, a: p.assists, cs: p.totalMinionsKilled + p.neutralMinionsKilled, vis: p.visionScore, dmg: p.totalDamageDealtToChampions, gold: p.goldEarned, kp: Math.round((p.kills + p.assists) / tk * 100), share: Math.round(p.totalDamageDealtToChampions / td * 100)};
  };
  async function refresh(older) {
    if (busy || !D.acct) return; busy = true; note = 'Mise à jour…'; draw();
    try {
      const {platform, region, puuid} = D.acct;
      await dragon();
      D.profile = await riot(platform, '/lol/summoner/v4/summoners/by-puuid/' + puuid);
      D.ranks = await riot(platform, '/lol/league/v4/entries/by-puuid/' + puuid);
      D.mastery = await riot(platform, '/lol/champion-mastery/v4/champion-masteries/by-puuid/' + puuid + '/top?count=6').catch(() => []);
      const solo = D.ranks.find(r => r.queueType === 'RANKED_SOLO_5x5');
      if (solo) { const sc = lpScore(solo), last = D.rankHist.at(-1); if (!last || last.s !== sc) D.rankHist.push({t: Date.now(), s: sc, label: rankName(solo) + ' · ' + solo.leaguePoints + ' LP'}); D.rankHist = D.rankHist.slice(-300); }
      const start = older ? D.matches.length : 0, ids = await riot(region, '/lol/match/v5/matches/by-puuid/' + puuid + '/ids?start=' + start + '&count=20');
      const known = new Set(D.matches.map(m => m.id)); let added = 0;
      for (const id of ids) {
        if (known.has(id)) continue;
        note = 'Parties : ' + (++added) + ' / ' + ids.filter(x => !known.has(x)).length + '…'; draw();
        const c = compact(await riot(region, '/lol/match/v5/matches/' + id), puuid); if (c) D.matches.push(c);
        await sleep(90);  // la clé de développement tolère 20 requêtes par seconde
      }
      D.matches.sort((a, b) => b.t - a.t); D.matches = D.matches.slice(0, 400); D.updated = Date.now();
      note = added ? added + ' nouvelle(s) partie(s).' : 'À jour.'; await save();
    } catch (e) { note = ''; err = e.message || String(e); }
    busy = false; draw();
  }
  async function link(riotId, regionName, key) {
    err = ''; const m = /^\s*(.+?)\s*#\s*([^#\s]{2,5})\s*$/.exec(riotId); if (!m) { err = 'Le Riot ID s\'écrit Nom#TAG (par exemple Faker#KR1).'; return draw(); }
    key = key.replace(/[^\w-]/g, '');  // guillemets, espaces ou caractères invisibles collés avec la clé
    if (!/^RGAPI-[\w-]{20,}$/.test(key)) { err = 'La clé d\'API commence par RGAPI- (developer.riotgames.com → « Development API Key »).'; return draw(); }
    KEY = key; const [platform, region] = REGIONS[regionName] || REGIONS['EUW (Europe Ouest)']; busy = true; note = 'Recherche du compte…'; draw();
    try {
      const a = await riot(region, '/riot/account/v1/accounts/by-riot-id/' + encodeURIComponent(m[1]) + '/' + encodeURIComponent(m[2]));
      D = {acct: {gameName: a.gameName, tagLine: a.tagLine, puuid: a.puuid, platform, region, regionName}, profile: null, ranks: [], mastery: [], matches: [], rankHist: [], dd: D.dd, updated: 0};
      await ctx.folder.write('key', {k: KEY}); await save(); busy = false; await refresh(false);
    } catch (e) { busy = false; note = ''; err = e.message || String(e); draw(); }
  }
  async function unlink() { D = {acct: null, profile: null, ranks: [], mastery: [], matches: [], rankHist: [], dd: D.dd, updated: 0}; KEY = ''; await ctx.folder.remove('key').catch(() => {}); await save(); err = note = ''; draw(); }
  async function newKey(k) { k = k.replace(/[^\w-]/g, ''); if (!/^RGAPI-[\w-]{20,}$/.test(k)) { err = 'La clé d\'API commence par RGAPI-.'; return draw(); } KEY = k; await ctx.folder.write('key', {k: KEY}); err = ''; await refresh(false); }

  // ---- les chiffres
  const kdaOf = ms => { const k = ms.reduce((a, m) => a + m.k, 0), d = ms.reduce((a, m) => a + m.d, 0), a = ms.reduce((x, m) => x + m.a, 0); return d ? (k + a) / d : k + a; };
  const avg = (ms, f) => ms.length ? ms.reduce((a, m) => a + f(m), 0) / ms.length : 0;
  const real = ms => ms.filter(m => !m.remake);
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const ago = t => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' j'; };
  const dur = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const tile = (value, label, cls) => { const t = el('div', 'tile'); t.append(el('b', cls || '', value), el('span', '', label)); return t; };
  const wrCls = w => w >= 55 ? 'good' : w >= 50 ? 'mid' : 'bad';

  // ---- les courbes (pixel art : des carrés, pas de bibliothèque)
  function chart(title, pts, o = {}) {  // pts : [{y, tip}] du plus ancien au plus récent
    const box = el('div', 'card'), cv = el('canvas'), W = 240, H = 90; cv.width = W; cv.height = H; box.append(el('h2', '', title), cv);
    const g = cv.getContext('2d'); g.fillStyle = '#0d0820'; g.fillRect(0, 0, W, H);
    if (pts.length < 2) { g.fillStyle = '#8f7bb8'; g.font = '8px monospace'; g.fillText('Pas assez de données', 62, 48); return box; }
    const ys = pts.map(p => p.y), lo = o.min ?? Math.min(...ys), hi = o.max ?? Math.max(...ys), span = hi - lo || 1, L = 22, R = 6, T = 8, B = 10, X = i => L + i * (W - L - R) / (pts.length - 1), Y = v => T + (1 - (v - lo) / span) * (H - T - B);
    g.font = '6px monospace'; g.fillStyle = '#8f7bb8';
    for (let k = 0; k <= 3; k++) { const v = lo + span * k / 3, y = Math.round(Y(v)); g.fillStyle = 'rgba(138,92,240,.18)'; g.fillRect(L, y, W - L - R, 1); g.fillStyle = '#8f7bb8'; g.fillText((o.fmt || (x => Math.round(x)))(v), 1, y + 2); }
    if (o.line !== undefined) { const y = Math.round(Y(o.line)); g.fillStyle = 'rgba(255,208,122,.55)'; for (let x = L; x < W - R; x += 4) g.fillRect(x, y, 2, 1); }
    const col = o.color || '#ff5ad9';
    if (o.bars) pts.forEach((p, i) => { const x = Math.round(X(i)), y = Math.round(Y(p.y)); g.fillStyle = p.c || col; g.fillRect(x - 1, y, 3, H - B - y); });
    else { for (let i = 1; i < pts.length; i++) { const x0 = X(i - 1), y0 = Y(pts[i - 1].y), x1 = X(i), y1 = Y(pts[i].y), n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0))); g.fillStyle = col; for (let s = 0; s <= n; s++) g.fillRect(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n), 1, 2); }
      pts.forEach((p, i) => { g.fillStyle = '#fff'; g.fillRect(Math.round(X(i)) - 1, Math.round(Y(p.y)) - 1, 3, 3); }); }
    const last = pts.at(-1); g.fillStyle = '#fff'; g.font = '7px monospace'; g.textAlign = 'right'; g.fillText(last.tip || String(Math.round(last.y)), W - R, 7); g.textAlign = 'left';
    return box;
  }
  const rolling = (ms, f, n = 10) => ms.map((_, i) => { const w = ms.slice(Math.max(0, i - n + 1), i + 1); return {y: f(w), tip: ''}; });

  // ---- l'affichage
  function draw() {
    root.replaceChildren();
    if (!D.acct) return drawLink();
    const head = el('div', 'card head'), p = D.profile, who = el('div', 'who');
    head.append(picture(p && D.dd ? 'https://ddragon.leagueoflegends.com/cdn/' + D.dd.v + '/img/profileicon/' + p.profileIconId + '.png' : '', 'pic', D.acct.gameName));
    who.append(el('b', '', D.acct.gameName + ' #' + D.acct.tagLine), el('span', 'hint', (D.acct.regionName || D.acct.platform) + (p ? ' · niveau ' + p.summonerLevel : '') + (D.updated ? ' · mis à jour il y a ' + ago(D.updated) : '')));
    const acts = el('div', 'row'), bR = el('button', 'main', 'ACTUALISER'), bM = el('button', 'q', '+ DE PARTIES'), bK = el('button', 'q', 'NOUVELLE CLÉ'), bU = el('button', 'q', 'DÉLIER');
    bR.disabled = bM.disabled = busy; bR.onclick = () => refresh(false); bM.onclick = () => refresh(true); bK.onclick = () => { keyBox.style.display = keyBox.style.display ? '' : 'none'; };
    bU.onclick = () => ctx.host.confirm('Délier ce compte et effacer ses parties gardées ?').then(ok => ok && unlink());
    acts.append(bR, bM, bK, bU); who.append(acts); head.append(who); root.append(head);
    const keyBox = el('div', 'card'); keyBox.style.display = 'none'; const ki = el('input'); ki.placeholder = 'RGAPI-…'; ki.type = 'password'; const kb = el('button', 'main', 'ENREGISTRER'); kb.onclick = () => newKey(ki.value);
    const kr = el('div', 'row'); kr.append(ki, kb); keyBox.append(el('p', 'hint', 'Une clé de développement dure 24 h : colle ici la nouvelle quand elle expire.'), kr); root.append(keyBox);
    if (note) root.append(el('div', 'hint', note)); if (err) root.append(el('div', 'err', err));
    const ranks = el('div', 'ranks');
    for (const [qt, label] of [['RANKED_SOLO_5x5', 'Solo / Duo'], ['RANKED_FLEX_SR', 'Flex 5c5']]) {
      const r = D.ranks.find(x => x.queueType === qt), c = el('div', 'card rk'), b = el('div', 'badge', r ? (TIER_FR[r.tier] || r.tier)[0] : '–'); b.style.background = r ? TIER_COL[r.tier] : '#3a2a6e';
      const t = el('div'); t.append(el('span', '', label), el('br'), el('b', '', rankName(r) + (r ? ' · ' + r.leaguePoints + ' LP' : '')), el('br'), el('span', r ? wrCls(pct(r.wins, r.wins + r.losses)) : '', r ? r.wins + ' V · ' + r.losses + ' D · ' + pct(r.wins, r.wins + r.losses) + ' %' : 'Pas de partie classée cette saison'));
      c.append(b, t); ranks.append(c);
    }
    root.append(ranks);
    const tabs = el('div', 'tabs');
    for (const [k, l] of [['apercu', 'APERÇU'], ['champions', 'CHAMPIONS'], ['historique', 'HISTORIQUE'], ['courbes', 'ÉVOLUTION']]) { const b = el('button', k === tab ? 'on' : 'q', l); b.onclick = () => { tab = k; draw(); }; tabs.append(b); }
    const sel = el('select'); for (const [k, [l]] of Object.entries(GROUPS)) { const o = el('option', '', l); o.value = k; sel.append(o); } sel.value = group; sel.onchange = () => { group = sel.value; draw(); }; tabs.append(sel);
    root.append(tabs);
    const ms = D.matches.filter(m => GROUPS[group][1](m.q)), rs = real(ms);
    if (!D.matches.length) { root.append(el('div', 'empty', busy ? '' : 'Aucune partie en mémoire : appuie sur ACTUALISER.')); return; }
    if (!ms.length) { root.append(el('div', 'empty', 'Aucune partie de ce type parmi les ' + D.matches.length + ' gardées. Charge-en plus avec « + DE PARTIES ».')); return; }
    ({apercu: tabOverview, champions: tabChampions, historique: tabHistory, courbes: tabCharts})[tab](ms, rs);
  }
  function drawLink() {
    const card = el('div', 'card'), f = el('div', 'form');
    const mk = (label, node, full) => { const l = el('label', full ? 'full' : '', label); l.append(node); f.append(l); return node; };
    const id = mk('Riot ID (Nom#TAG)', el('input')); id.placeholder = 'Faker#KR1';
    const reg = mk('Région', el('select')); for (const k of Object.keys(REGIONS)) { const o = el('option', '', k); o.value = k; reg.append(o); }
    const key = mk('Clé d\'API Riot', el('input'), true); key.type = 'password'; key.placeholder = 'RGAPI-…'; key.autocomplete = 'off';
    const go = el('button', 'main', 'LIER MON COMPTE'); go.disabled = busy; go.onclick = () => link(id.value, reg.value, key.value);
    const dev = el('button', 'q', 'OBTENIR UNE CLÉ (developer.riotgames.com)'); dev.onclick = () => ctx.host.newTab('https://developer.riotgames.com/');
    const row = el('div', 'row full'); row.append(go, dev); f.append(row);
    card.append(el('h2', '', 'LIER MON COMPTE RIOT'), el('p', 'hint', 'Riot ne laisse une appli lire un compte qu\'avec une clé d\'API : connecte-toi sur developer.riotgames.com avec ton compte Riot, copie la « Development API Key » (elle dure 24 h, tu pourras la remplacer d\'un clic) et colle-la ici avec ton Riot ID. Aucun mot de passe n\'est demandé ; la clé reste dans le dossier de ce plugin et ne part que vers l\'API de Riot.'), f);
    root.append(card); if (note) root.append(el('div', 'hint', note)); if (err) root.append(el('div', 'err', err));
  }
  function tabOverview(ms, rs) {
    const w = rs.filter(m => m.win).length, wr = pct(w, rs.length), t = el('div', 'tiles');
    t.append(tile(rs.length, 'parties analysées'), tile(wr + ' %', w + ' V · ' + (rs.length - w) + ' D', wrCls(wr)), tile(kdaOf(rs).toFixed(2), 'KDA · ' + avg(rs, m => m.k).toFixed(1) + ' / ' + avg(rs, m => m.d).toFixed(1) + ' / ' + avg(rs, m => m.a).toFixed(1)),
      tile((avg(rs, m => m.cs / (m.dur / 60))).toFixed(1), 'sbires par minute'), tile(avg(rs, m => m.vis / (m.dur / 60)).toFixed(2), 'vision par minute'), tile(Math.round(avg(rs, m => m.kp)) + ' %', 'participation aux kills'),
      tile(Math.round(avg(rs, m => m.dmg / (m.dur / 60))), 'dégâts par minute'), tile(dur(Math.round(avg(rs, m => m.dur))), 'durée moyenne'));
    root.append(t);
    if (D.mastery.length && D.dd) {
      const c = el('div', 'card'); c.append(el('h2', '', 'MAÎTRISES'));
      const tb = el('div', 'tbl'); for (const m of D.mastery.slice(0, 5)) { const ch = D.dd.byKey[m.championId]; if (!ch) continue; const l = el('div', 'line'); l.append(picture(champImg(ch.id), 'ic', ch.name), el('span', '', ch.name), el('span', '', 'niveau ' + m.championLevel), el('span', '', m.championPoints.toLocaleString('fr-FR') + ' pts'), el('span', ''), el('span', '')); tb.append(l); }
      c.append(tb); root.append(c);
    }
    const recent = rs.slice(0, 10), c2 = el('div', 'card'), strip = el('div', 'row'); c2.append(el('h2', '', 'DIX DERNIÈRES PARTIES'));
    for (const m of recent) { const s = el('div', 'badge', m.win ? 'V' : 'D'); s.style.background = m.win ? '#8ee8a0' : '#ff7a8a'; s.style.width = s.style.height = '30px'; s.title = m.champ + ' ' + m.k + '/' + m.d + '/' + m.a; strip.append(s); }
    c2.append(strip); root.append(c2);
  }
  function tabChampions(ms, rs) {
    const by = new Map(); for (const m of rs) { const c = by.get(m.champ) || []; c.push(m); by.set(m.champ, c); }
    const rows = [...by].sort((a, b) => b[1].length - a[1].length), c = el('div', 'card'), tb = el('div', 'tbl'), h = el('div', 'line h');
    for (const x of ['', 'CHAMPION', 'PARTIES', 'VICTOIRES', 'KDA', 'SBIRES/MIN']) h.append(el('span', '', x));
    tb.append(h);
    for (const [name, list] of rows) {
      const w = pct(list.filter(m => m.win).length, list.length), l = el('div', 'line'), nm = D.dd && Object.values(D.dd.byKey).find(x => x.id === name)?.name || name;
      l.append(picture(champImg(name), 'ic', name), el('span', '', nm), el('span', '', String(list.length)), el('span', wrCls(w), w + ' %'), el('span', '', kdaOf(list).toFixed(2)), el('span', '', avg(list, m => m.cs / (m.dur / 60)).toFixed(1))); tb.append(l);
    }
    c.append(el('h2', '', 'CHAMPIONS JOUÉS · ' + rows.length), tb); root.append(c);
  }
  function tabHistory(ms) {
    const tb = el('div', 'tbl'); root.append(tb);
    for (const m of ms.slice(0, 60)) {
      const r = el('div', 'm' + (m.win || m.remake ? '' : ' lose')), nm = D.dd && Object.values(D.dd.byKey).find(x => x.id === m.champ)?.name || m.champ;
      const res = el('div'); res.append(el('b', m.remake ? 'mid' : m.win ? 'good' : 'bad', m.remake ? 'REFAITE' : m.win ? 'VICTOIRE' : 'DÉFAITE'), el('small', '', QUEUES[m.q] || 'Autre mode'));
      const who = el('div'); who.append(el('b', '', nm), el('small', '', ROLES[m.role] || ''));
      const kda = el('div'); kda.append(el('b', '', m.k + ' / ' + m.d + ' / ' + m.a), el('small', '', (m.d ? ((m.k + m.a) / m.d).toFixed(2) : 'parfait') + ' KDA'));
      const cs = el('div'); cs.append(el('b', '', m.cs + ' sbires'), el('small', '', (m.cs / (m.dur / 60)).toFixed(1) + ' / min'));
      const tm = el('div'); tm.append(el('b', '', dur(m.dur)), el('small', '', 'il y a ' + ago(m.t)));
      r.append(el('i', 'bar'), picture(champImg(m.champ), 'ic', m.champ), res, who, kda, cs, tm);
      const det = el('div', 'det'); det.style.display = open === m.id ? 'flex' : 'none';
      det.append(el('span', '', 'Dégâts : ' + m.dmg.toLocaleString('fr-FR') + ' (' + m.share + ' % de l\'équipe)'), el('span', '', 'Participation : ' + m.kp + ' %'), el('span', '', 'Or : ' + m.gold.toLocaleString('fr-FR')), el('span', '', 'Vision : ' + m.vis));
      r.onclick = () => { open = open === m.id ? null : m.id; det.style.display = open === m.id ? 'flex' : 'none'; };
      tb.append(r, det);
    }
  }
  function tabCharts(ms, rs) {
    const old = [...rs].reverse(), wrap = el('div', 'charts');  // du plus ancien au plus récent
    wrap.append(
      chart('VICTOIRES · glissant sur 10', rolling(old, w => pct(w.filter(m => m.win).length, w.length)).map(p => ({y: p.y, tip: p.y + ' %'})), {min: 0, max: 100, line: 50, color: '#8ee8a0', fmt: x => Math.round(x) + '%'}),
      chart('KDA par partie', old.map(m => ({y: Math.min(10, m.d ? (m.k + m.a) / m.d : m.k + m.a), tip: ((m.d ? (m.k + m.a) / m.d : m.k + m.a)).toFixed(1), c: m.win ? '#8ee8a0' : '#ff7a8a'})), {bars: true, min: 0, fmt: x => x.toFixed(0)}),
      chart('SBIRES / MIN · moyenne sur 10', rolling(old, w => avg(w, m => m.cs / (m.dur / 60))).map(p => ({y: p.y, tip: p.y.toFixed(1)})), {color: '#7fe0ee', fmt: x => x.toFixed(1)}),
      chart('DÉGÂTS / MIN · moyenne sur 10', rolling(old, w => avg(w, m => m.dmg / (m.dur / 60))).map(p => ({y: p.y, tip: String(Math.round(p.y))})), {color: '#ffd07a'}),
      chart('VISION / MIN · moyenne sur 10', rolling(old, w => avg(w, m => m.vis / (m.dur / 60))).map(p => ({y: p.y, tip: p.y.toFixed(2)})), {color: '#c05aff', fmt: x => x.toFixed(1)}),
      chart('CLASSEMENT SOLO / DUO', D.rankHist.map(h => ({y: h.s, tip: h.label})), {color: '#ff5ad9', fmt: x => { const t = TIERS[Math.min(9, Math.floor(x / 400))]; return x >= 2800 ? 'M+' : (TIER_FR[t] || '').slice(0, 2) + ' ' + ['IV', 'III', 'II', 'I'][Math.floor(x % 400 / 100)]; }}));
    root.append(wrap);
  }

  ctx.onOpen(async () => {
    const [cache, k] = await Promise.all([ctx.folder.read('cache').catch(() => null), ctx.folder.read('key').catch(() => null)]);
    if (cache && cache.acct) D = {...D, ...cache}; KEY = k?.k || ''; draw();
    if (D.acct && KEY && (!D.updated || Date.now() - D.updated > 10 * 60000)) refresh(false);  // au plus une mise à jour automatique toutes les 10 minutes
  });
  draw();
}
