// Invocateur, côté système : lit le client League of Legends ouvert sur ce PC (son API locale, sans clé Riot).
// Le client écoute sur 127.0.0.1 avec un port et un mot de passe propres à chaque lancement : on les lit dans la ligne de commande du processus LeagueClientUx
// (ou, à défaut, dans le fichier « lockfile » des dossiers d'installation courants). Rien ne sort du PC, et seules ces lectures (GET) sont permises.
const { execFile } = require('child_process');
const https = require('https'), fs = require('fs'), path = require('path');

const ALLOWED = [/^\/lol-summoner\/v1\/current-summoner$/, /^\/lol-ranked\/v1\/current-ranked-stats$/, /^\/lol-champion-mastery\/v1\/local-player\/champion-mastery$/,
  /^\/lol-match-history\/v1\/products\/lol\/current-summoner\/matches\?begIndex=\d{1,3}&endIndex=\d{1,3}$/, /^\/lol-match-history\/v1\/games\/\d{1,12}$/, /^\/riotclient\/region-locale$/];

function creds() {
  return new Promise(ok => {
    const fromLock = () => {
      for (const d of ['C:\\Riot Games\\League of Legends', 'D:\\Riot Games\\League of Legends', 'C:\\Program Files\\Riot Games\\League of Legends', 'C:\\Program Files (x86)\\Riot Games\\League of Legends']) {
        try { const [, , port, pw] = fs.readFileSync(path.join(d, 'lockfile'), 'utf8').trim().split(':'); if (port && pw) return { port: +port, pw }; } catch {}
      }
      return null;
    };
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', "(Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -First 1).CommandLine"], { windowsHide: true, timeout: 8000 }, (e, out) => {
      const cl = String(out || ''), port = /--app-port=(\d+)/.exec(cl)?.[1], pw = /--remoting-auth-token=([\w-]+)/.exec(cl)?.[1];
      ok(port && pw ? { port: +port, pw } : fromLock());
    });
  });
}
function get(c, p) {
  if (!ALLOWED.some(r => r.test(p))) return Promise.reject(new Error('lecture non permise'));
  return new Promise((ok, ko) => {
    const rq = https.request({ host: '127.0.0.1', port: c.port, path: p, method: 'GET', rejectUnauthorized: false, headers: { Authorization: 'Basic ' + Buffer.from('riot:' + c.pw).toString('base64'), Accept: 'application/json' }, timeout: 10000 }, res => {
      const b = []; res.on('data', d => b.push(d)); res.on('end', () => { const t = Buffer.concat(b).toString('utf8'); if (res.statusCode >= 400) return ko(new Error('client ' + res.statusCode)); try { ok(JSON.parse(t)); } catch { ko(new Error('réponse illisible')); } });
    });
    rq.on('timeout', () => rq.destroy(new Error('le client ne répond pas'))); rq.on('error', ko); rq.end();
  });
}
const lane = t => { const l = t?.lane, r = t?.role; return l === 'MIDDLE' || l === 'MID' ? 'MIDDLE' : l === 'TOP' ? 'TOP' : l === 'JUNGLE' ? 'JUNGLE' : (l === 'BOTTOM' || l === 'BOT') ? (/SUPPORT/.test(r || '') ? 'UTILITY' : 'BOTTOM') : ''; };

// une partie de l'historique : le détail donne les dix joueurs, d'où la part des éliminations et des dégâts de l'équipe
function game(g, me, detail) {
  const mine = g.participants?.[0] || (detail.participants || []).find(p => p.participantId === g.participantIdentities?.find(i => i.player?.puuid === me)?.participantId);
  const all = detail.participants || g.participants || [], p = all.find(x => x.participantId === mine?.participantId) || mine; if (!p) return null;
  const s = p.stats || {}, team = all.filter(x => x.teamId === p.teamId), tk = team.reduce((a, x) => a + (x.stats?.kills || 0), 0) || 1, td = team.reduce((a, x) => a + (x.stats?.totalDamageDealtToChampions || 0), 0) || 1;
  const dur = g.gameDuration || detail.gameDuration || 0, early = !!(s.causedEarlySurrender || s.gameEndedInEarlySurrender);
  return { id: 'LCU_' + g.gameId, t: g.gameCreation, dur: dur > 3600 * 6 ? Math.round(dur / 1000) : dur, q: g.queueId, cid: p.championId, role: lane(p.timeline), win: !!s.win && !early, remake: early,
    k: s.kills || 0, d: s.deaths || 0, a: s.assists || 0, cs: (s.totalMinionsKilled || 0) + (s.neutralMinionsKilled || 0), vis: s.visionScore || 0, dmg: s.totalDamageDealtToChampions || 0, gold: s.goldEarned || 0,
    kp: Math.round(((s.kills || 0) + (s.assists || 0)) / tk * 100), share: Math.round((s.totalDamageDealtToChampions || 0) / td * 100) };
}

async function local(known) {
  const c = await creds(); if (!c) throw new Error('Le client League of Legends n\'est pas ouvert : lance-le et connecte-toi, puis réessaie.');
  const me = await get(c, '/lol-summoner/v1/current-summoner').catch(() => { throw new Error('Le client est ouvert mais pas encore connecté à ton compte : attends la fin du chargement.'); });
  const out = { acct: { gameName: me.gameName || me.displayName, tagLine: me.tagLine || '', puuid: me.puuid, local: true, regionName: '' }, profile: { summonerLevel: me.summonerLevel, profileIconId: me.profileIconId }, ranks: [], mastery: [], matches: [] };
  try { const r = await get(c, '/riotclient/region-locale'); out.acct.regionName = r.webRegion || r.region || ''; } catch {}
  try { out.ranks = ((await get(c, '/lol-ranked/v1/current-ranked-stats')).queues || []).filter(q => q.tier && q.tier !== 'NONE').map(q => ({ queueType: q.queueType, tier: q.tier, rank: q.division, leaguePoints: q.leaguePoints, wins: q.wins, losses: q.losses })); } catch {}
  try { out.mastery = (await get(c, '/lol-champion-mastery/v1/local-player/champion-mastery')).sort((a, b) => b.championPoints - a.championPoints).slice(0, 6).map(m => ({ championId: m.championId, championLevel: m.championLevel, championPoints: m.championPoints })); } catch {}
  const have = new Set(known || []);
  const list = (await get(c, '/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=40')).games?.games || [];
  for (const g of list) {
    if (have.has('LCU_' + g.gameId)) continue;
    let detail = {}; try { detail = await get(c, '/lol-match-history/v1/games/' + g.gameId); } catch {}
    const m = game(g, me.puuid, detail); if (m) out.matches.push(m);
  }
  return out;
}

module.exports = ({ ipcMain }) => {
  ipcMain.handle('lol:local', (_, known) => local(Array.isArray(known) ? known.slice(0, 500).map(String) : []));
  return () => {};
};
module.exports.game = game;  // pour les tests
module.exports.lane = lane;
