/* The Tip-Off — where to watch women's basketball. */
(() => {
  "use strict";

  const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball";
  const DAYS_AHEAD = 10;
  const NATIONAL = new Set(["abc", "cbs", "nbc", "fox", "ion", "espn", "espn2", "fs1", "prime", "peacock", "tnt", "trutv", "tsn", "ctv", "cbc"]);
  const BROADCAST = new Set(["abc", "cbs", "nbc", "fox", "ctv", "cbc"]);
  const SITE = "The Tip-Off";
  const BASE_TITLE = document.title;
  const VIEW_TITLES = {
    home: BASE_TITLE,
    teams: "Women's Basketball Teams: Schedules & Where to Watch | The Tip-Off",
    platforms: "Women's Basketball Streaming Services & Prices | The Tip-Off",
  };

  const state = {
    games: [],
    teams: [],
    news: [],
    league: "all",
    price: "all",
    q: "",
    view: "home",
    loading: true,
    liveFailed: false,
    favs: loadFavs(),
    pendingOpen: null,
    region: initialRegion(),
    mine: loadMine(), // ids from SERVICES (js/services.js) the viewer has
  };
  const gameById = new Map();
  const teamByKey = new Map();
  const scheduleCache = new Map();

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hex = (c, fallback = "3f3f46") => "#" + (/^[0-9a-f]{6}$/i.test(c || "") ? c : fallback);
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const dayKey = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  /** Run an animation from js/motion-fx.js if it's there; the site works the same without it. */
  const fx = (name, ...args) => window.FX?.[name]?.(...args);

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.4"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    tv: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  };

  // ---------- region (US / Canada) ----------
  // Order: ?region= in the link, then the viewer's saved choice, then a guess from time zone / language.
  function initialRegion() {
    const CA_ZONES = /^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Yellowknife|Iqaluit|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Dawson|Dawson_Creek|Creston|Fort_Nelson|Swift_Current|Thunder_Bay|Nipigon|Rainy_River|Atikokan|Blanc-Sablon|Pangnirtung)$/;
    const fromUrl = new URLSearchParams(location.search).get("region");
    if (fromUrl === "ca" || fromUrl === "us") return fromUrl;
    try { const saved = localStorage.getItem("fc-region"); if (saved === "ca" || saved === "us") return saved; } catch { /* storage unavailable */ }
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* old browser */ }
    if (CA_ZONES.test(tz) || (navigator.languages || [navigator.language]).some((l) => /-CA$/i.test(l || ""))) return "ca";
    return "us";
  }

  function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem("fc-favs") || "[]")); } catch { return new Set(); }
  }
  function saveFavs() {
    try { localStorage.setItem("fc-favs", JSON.stringify([...state.favs])); } catch { /* storage unavailable */ }
  }
  function loadMine() {
    try { return new Set(JSON.parse(localStorage.getItem("fc-services") || "[]")); } catch { return new Set(); }
  }
  function saveMine() {
    try { localStorage.setItem("fc-services", JSON.stringify([...state.mine])); } catch { /* storage unavailable */ }
  }

  // ---------- dates & times (always shown with the viewer's time zone) ----------
  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  function dayLabel(d, style = "short") {
    const diff = Math.round((dayKey(d) - dayKey(new Date())) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return d.toLocaleDateString(undefined, style === "long" ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  }
  function timeLabel(g) {
    return g.tba || g.timeValid === false ? "Time TBA" : fmtTime(g.date);
  }
  function whenLabel(g, style = "short") {
    if (g.tba) return g.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · Time TBA";
    return `${dayLabel(g.date, style)} · ${timeLabel(g)}`;
  }

  function priceInfo(platforms) {
    const known = platforms.filter((p) => p.access !== "unknown");
    const free = platforms.filter((p) => isFreeAccess(p.access));
    if (free.length) return { kind: "free", free };
    if (!known.length) return { kind: "unknown", free };
    return { kind: "paid", free };
  }

  // ---------- my services ----------
  /** The viewer's services for the selected region. */
  const myServices = () => servicesFor(state.region).filter((s) => state.mine.has(s.id));
  const hasServices = () => myServices().length > 0;
  let covKey = "", covSet = new Set();
  /** Platform ids the viewer's services unlock (cached until the services or region change). */
  function myCoverage() {
    const key = state.region + "|" + [...state.mine].join(",");
    if (key !== covKey) { covKey = key; covSet = new Set(myServices().flatMap((s) => s.covers)); }
    return covSet;
  }
  /** Channels the viewer can watch now: free streams, plus anything their services cover. */
  const watchableWith = (platforms, cov = myCoverage()) => platforms.filter((p) => p.access === "free" || cov.has(p.id));
  const canWatch = (g, cov) => watchableWith(g.platforms, cov).length > 0;
  /** True when the game needs a paid service the viewer already has (and has no free option). */
  /** Whether a platform card passes the price filter (All / Free / Paid / My services). */
  const priceFilterPlatform = (p) => state.price === "all"
    || (state.price === "free" ? isFreeAccess(p.access)
      : state.price === "paid" ? !isFreeAccess(p.access)
        : p.access === "free" || myCoverage().has(p.id));
  const includedForMe = (g) => hasServices() && priceInfo(g.platforms).kind !== "free" && canWatch(g);

  // ---------- data loading ----------
  function dedupePlatforms(names) {
    const seen = new Map();
    for (const n of names) {
      const p = resolvePlatform(n);
      if (!p) continue;
      const key = p.id === "local" ? "local:" + p.name : p.id;
      if (!seen.has(key)) seen.set(key, p);
    }
    const rank = { free: 0, antenna: 1, paid: 2, tv: 3, unknown: 4 };
    return [...seen.values()].sort((a, b) => rank[a.access] - rank[b.access]);
  }

  // ---------- Canadian listings ----------
  // ESPN only publishes U.S. channels, so Canadian options come from each league's Canadian TV deal.
  const ESPN_FAMILY = new Set(["espn", "espn2", "espnu", "espnews", "espnplus", "espnunl", "abc", "secn", "secnplus", "accn", "accnx", "patriot"]);
  const isToronto = (t) => /toronto/i.test(t?.name || "");
  function canadaListing(g) {
    const us = new Set(g.us.map((p) => p.id));
    const ids = [];
    let note = "";
    const shared = g.us.filter((p) => inRegion(p, "ca") && p.id !== "prime" && p.id !== "leaguepass").map((p) => p.id);
    if (g.league === "wnba") {
      if (g.tba) ids.push(...LEAGUES.wnba.platformsCA);
      else if (g.away && (isToronto(g.home) || isToronto(g.away))) {
        if (us.has("prime")) ids.push("prime");
        ids.push("tsn", "tsnplus");
        note = "TSN carries every Toronto Tempo game in Canada. Select Tempo games also air free on CTV, so check CTV's listings closer to tip-off.";
      } else {
        if (us.has("prime")) ids.push("prime");
        ids.push("leaguepass");
        note = "TSN also carries select games from around the league, so check the TSN schedule for this one.";
      }
    } else if (g.league === "ncaa") {
      if (g.us.some((p) => ESPN_FAMILY.has(p.id))) {
        ids.push("tsnplus");
        note = "TSN carries ESPN's college games in Canada, mostly on TSN+. Bigger games and March Madness also air on TSN channels.";
      }
      ids.push(...shared);
      if (!ids.length && g.us.length) note = `We haven't found a Canadian broadcast for this game. Its U.S. ${g.us.length === 1 ? "channel" : "channels"} (${g.us.map((p) => p.name).join(", ")}) ${g.us.length === 1 ? "usually isn't" : "usually aren't"} available in Canada.`;
    } else if (g.league === "fiba") {
      if (g.id === "la28") { ids.push("cbc"); note = "CBC holds Canada's Olympic rights through 2032, with games free on CBC and CBC Gem."; }
      else { ids.push("tsn", "tsnplus"); note = "Bell Media has exclusive FIBA and Canada Basketball rights in Canada."; }
    } else if (g.league === "upshot") {
      ids.push(...shared);
      note = "UpShot's U.S. local TV partners aren't available in Canada. YouTube streams may be, but that isn't confirmed.";
    } else if (g.league === "unrivaled") {
      note = "Unrivaled hasn't announced a Canadian broadcaster for 2027. TSN+ carried it in Canada in 2025. Check unrivaled.basketball closer to tip-off.";
    }
    const seen = new Set();
    const platforms = ids.filter((id) => !seen.has(id) && seen.add(id)).map((id) => platformById(id, "ca")).filter(Boolean)
      .map((p) => ({ ...p, raw: p.name }));
    const rank = { free: 0, antenna: 1, paid: 2, tv: 3, unknown: 4 };
    platforms.sort((x, y) => rank[x.access] - rank[y.access]);
    return { platforms, note };
  }
  /** Keep the U.S. list on `g.us`; `g.platforms` and `g.regionNote` follow the selected region. */
  function regionalize(g) {
    g.us = g.platforms;
    delete g.platforms;
    let ca = null;
    Object.defineProperties(g, {
      platforms: { get() { return state.region === "ca" ? (ca ||= canadaListing(g)).platforms : g.us; }, enumerable: true },
      regionNote: { get() { return state.region === "ca" ? (ca ||= canadaListing(g)).note : ""; } },
    });
    return g;
  }
  const leaguePlatformIds = (lg) => (state.region === "ca" ? lg.platformsCA : lg.platforms) || [];
  const regionPlatforms = () => PLATFORMS.filter((p) => p.id !== "local" && inRegion(p, state.region)).map((p) => forRegion(p, state.region));

  function parseCompetitor(c) {
    const t = c.team || {};
    const logo = t.logo || (t.logos && t.logos[0] && t.logos[0].href) || "";
    const score = typeof c.score === "object" ? c.score?.displayValue : c.score;
    const rank = c.curatedRank?.current;
    return {
      id: t.id, name: t.displayName || t.name, short: t.shortDisplayName || t.location || t.displayName,
      abbr: t.abbreviation, logo, color: t.color,
      rank: rank && rank <= 25 ? rank : null, score: score ?? "", winner: !!c.winner, conf: t.conferenceId || "",
    };
  }

  function parseEspnEvent(e, leagueId) {
    const comp = (e.competitions || [])[0];
    if (!comp) return null;
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === "home") || cs[0];
    const away = cs.find((c) => c.homeAway === "away") || cs[1];
    if (!home || !away) return null;
    const names = [];
    for (const b of comp.broadcasts || []) {
      if (Array.isArray(b.names)) names.push(...b.names);
      if (b.media?.shortName) names.push(b.media.shortName);
    }
    for (const gb of comp.geoBroadcasts || []) if (gb.media?.shortName) names.push(gb.media.shortName);
    const st = comp.status?.type || e.status?.type || {};
    return regionalize({
      id: `${leagueId}-${e.id}`,
      league: leagueId,
      date: new Date(e.date),
      timeValid: comp.timeValid !== false,
      state: st.state || "pre",
      statusText: st.shortDetail || st.detail || "",
      home: parseCompetitor(home),
      away: parseCompetitor(away),
      neutral: !!comp.neutralSite,
      venue: comp.venue?.fullName || "",
      city: [comp.venue?.address?.city, comp.venue?.address?.state].filter(Boolean).join(", "),
      note: (comp.notes || [])[0]?.headline || "",
      platforms: dedupePlatforms(names),
      link: (e.links || []).find((l) => (l.rel || []).includes("summary"))?.href || (e.links || [])[0]?.href || "",
    });
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  /** Returns { games, failed } — failed is true only if every request failed. */
  async function loadScoreboards() {
    const start = new Date();
    const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return ymd(d);
    });
    let ok = 0, total = 0;
    const jobs = [];
    for (const lg of ["ncaa", "wnba"]) {
      for (const d of dates) {
        total++;
        const url = `${ESPN}/${LEAGUES[lg].espn}/scoreboard?dates=${d}&limit=300${lg === "ncaa" ? "&groups=50" : ""}`;
        jobs.push(getJSON(url).then((j) => { ok++; return (j.events || []).map((e) => parseEspnEvent(e, lg)); }).catch(() => []));
      }
    }
    const all = (await Promise.all(jobs)).flat().filter(Boolean);
    return { games: [...new Map(all.map((g) => [g.id, g])).values()], failed: total > 0 && ok === 0 };
  }

  function loadTeams() {
    const out = [];
    for (const lg of ["wnba", "ncaa"]) {
      for (const t of (typeof ESPN_TEAMS !== "undefined" && ESPN_TEAMS[lg]) || []) {
        out.push({ key: `${lg}:${t.id}`, league: lg, espnId: t.id, name: t.name, short: t.short, abbr: t.abbr, logo: t.logo, color: t.color });
      }
    }
    for (const [lg, list] of Object.entries(CURATED_TEAMS)) {
      for (const t of list) out.push({ key: `${lg}:${t.name}`, league: lg, name: t.name, short: t.name, color: t.color, logo: "" });
    }
    for (const t of out) teamByKey.set(t.key, t);
    return out;
  }

  function curatedGames() {
    return CURATED_EVENTS.map((e) => regionalize({
      id: e.id, league: e.league, date: new Date(e.date), tba: !!e.tba, timeValid: false,
      state: "pre", statusText: "", title: e.title, subtitle: e.subtitle, expected: e.expected,
      home: { name: e.home, short: e.home }, away: e.away ? { name: e.away, short: e.away } : null,
      venue: "", city: "", note: "",
      platforms: dedupePlatforms(e.platforms.map((id) => PLATFORMS.find((p) => p.id === id)?.name || id)),
      link: e.link,
    }));
  }

  const NEWS_LEAGUES = ["wnba", "ncaa"]; // ESPN only has news feeds for these two; others come from js/news-data.js.
  async function loadNews() {
    const lists = await Promise.all(NEWS_LEAGUES.map((lg) =>
      getJSON(`${ESPN}/${LEAGUES[lg].espn}/news?limit=8`)
        .then((j) => (j.articles || []).map((a) => ({
          id: `news-${a.id || a.headline}`, league: lg, headline: a.headline,
          url: a.links?.web?.href || "", date: new Date(a.published || 0),
        })).filter((a) => a.headline && a.url))
        .catch(() => [])));
    if (typeof SITE_NEWS !== "undefined") {
      const cutoff = Date.now() - 45 * 86400000;
      const byLeague = new Map();
      for (const a of SITE_NEWS.articles || []) {
        const date = a.published ? new Date(a.published) : new Date(SITE_NEWS.updated);
        if (!LEAGUES[a.league] || !a.headline || !a.url || date < cutoff) continue;
        if (!byLeague.has(a.league)) byLeague.set(a.league, []);
        byLeague.get(a.league).push({ id: `news-${a.id}`, league: a.league, headline: a.headline, url: a.url, date });
      }
      lists.push(...byLeague.values());
    }
    const out = [];
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
    return out;
  }

  // ---------- filtering ----------
  function gameText(g) {
    const parts = [g.title, g.subtitle, LEAGUES[g.league]?.name, LEAGUES[g.league]?.short, g.venue, g.city, g.note];
    for (const t of [g.home, g.away]) if (t) parts.push(t.name, t.short, t.abbr);
    for (const p of g.platforms) parts.push(p.name, p.raw);
    return norm(parts.filter(Boolean).join(" | "));
  }
  function matchesQuery(text, q) {
    if (!q) return true;
    return norm(q).split(/\s+/).filter(Boolean).every((tok) => text.includes(tok));
  }
  function passesFilters(g, { ignoreQuery = false } = {}) {
    if (state.league !== "all" && g.league !== state.league) return false;
    if (state.price !== "all") {
      const k = priceInfo(g.platforms).kind;
      if (state.price === "free" && k !== "free") return false;
      if (state.price === "paid" && k !== "paid") return false;
      if (state.price === "mine" && !canWatch(g)) return false;
    }
    if (!ignoreQuery && !matchesQuery(g._text || (g._text = gameText(g)), state.q)) return false;
    return true;
  }
  const teamText = (t) => norm(`${t.name} ${t.abbr || ""} ${LEAGUES[t.league].short} ${LEAGUES[t.league].name}`);
  const upcoming = (g) => g.state !== "post" || dayKey(g.date) === dayKey(new Date());
  const notability = (g) => (g.home.rank || g.away?.rank ? 2 : 0) + (g.platforms.some((p) => NATIONAL.has(p.id)) ? 1 : 0);

  // ---------- rendering: pieces ----------
  // ESPN publishes dark-background versions of team logos; use them so navy/black logos stay visible.
  const darkLogo = (url) => url.replace(/(\/i\/teamlogos\/[a-z]+\/)500\//, "$1500-dark/");
  // ESPN logos are 500×500 files; ask ESPN's resizer for a copy at the size we show (×2 for sharp phone screens).
  // A quick-pick logo drops from about 95 KB to about 9 KB.
  function sizedLogo(url, px) {
    const m = /^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/[^?]+\.png)$/.exec(url || "");
    return m && px ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${px}&h=${px}` : url;
  }
  /** size = how big the logo is shown, in CSS pixels; eager = load right away (above the fold). */
  function logoHTML(t, { size = 90, eager = false } = {}) {
    if (t?.logo) {
      const dark = darkLogo(t.logo), px = size * 2;
      const src = sizedLogo(dark, px), fb = dark !== t.logo ? sizedLogo(t.logo, px) : "";
      return `<img src="${esc(src)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-initials="${esc(initials(t.name))}"${fb ? ` data-fallback="${esc(fb)}"` : ""}>`;
    }
    return `<div class="mono" aria-hidden="true">${esc(initials(t?.name))}</div>`;
  }
  // Swap broken logos for initials (one listener instead of inline handlers).
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || !img.dataset.initials) return;
    if (img.dataset.fallback) { img.src = img.dataset.fallback; delete img.dataset.fallback; return; }
    const m = document.createElement("div");
    m.className = "mono"; m.setAttribute("aria-hidden", "true"); m.textContent = img.dataset.initials;
    img.replaceWith(m);
  }, true);

  function platformTags(platforms, max = 3) {
    if (!platforms.length) return `<span class="ptag more">${state.region === "ca" ? "No Canadian broadcast listed" : "No broadcast listed yet"}</span>`;
    const shown = platforms.slice(0, max).map((p) => `<span class="ptag ${p.access}">${esc(p.name)}</span>`).join("");
    return shown + (platforms.length > max ? `<span class="ptag more">+${platforms.length - max}</span>` : "");
  }
  const tint = (c, pct = 40) => `color-mix(in srgb, ${c} ${pct}%, #141418)`;
  function artBackground(g) {
    if (!g.away) {
      const c = LEAGUES[g.league]?.color || "#444";
      return `background: ${tint(c)}`;
    }
    // Two flat fields of team colour: away on the left, home on the right (the ::before half, see
    // styles.css). Each colour is mixed into the dark base so same-colour logos stay visible.
    // Teams without a color in ESPN's data (often small schools) fall back to the league color, not gray.
    const fallback = (LEAGUES[g.league]?.color || "#3f3f46").slice(1);
    const a = hex(g.away.color, fallback), h = hex(g.home.color, fallback);
    return `--ta: ${tint(a)}; background: ${tint(h)}`;
  }
  function priceBadge(g) {
    const k = priceInfo(g.platforms).kind;
    if (k === "free") return `<span class="pill free">Free</span>`;
    if (includedForMe(g)) return `<span class="pill mine" title="Included in your services">${ICON.check}Yours</span>`;
    if (k === "paid") return `<span class="pill paid">Paid</span>`;
    return `<span class="pill tba">TBA</span>`;
  }
  const matchupLabel = (g) => (g.away ? `${g.away.name} ${g.neutral ? "vs." : "at"} ${g.home.name}` : g.title);

  /**
   * Showcase events: early-season neutral-site events like the Foundry Classic, Oui-Play or Ally Tipoff.
   * ESPN names these in the game's notes, but it uses the same field for small conference challenges
   * played on campus, so a game counts only if it's a named event, at a neutral site, with a Top 25 team.
   */
  const showcaseName = (g) => (g.league === "ncaa" && g.away && g.neutral && g.note && (g.home.rank || g.away.rank) ? g.note : "");
  const eventTag = (g, cls = "event-tag") => {
    const name = showcaseName(g);
    return name ? `<span class="${cls}">${ICON.trophy}${esc(name)}</span>` : "";
  };

  function cardHTML(g) {
    gameById.set(g.id, g);
    const lg = LEAGUES[g.league];
    const status = g.state === "in" ? `<span class="pill live">Live</span>`
      : g.state === "post" ? `<span class="pill">Final</span>`
      : `<span class="pill lg" style="--c:${lg.color}">${esc(lg.short)}</span>`;
    let art, title;
    if (g.away) {
      art = `${logoHTML(g.away)}<span class="at">${g.neutral ? "VS" : "@"}</span>${logoHTML(g.home)}`;
      const row = (t, other) => {
        const showScore = g.state !== "pre" && t.score !== "";
        const lost = g.state === "post" && other.winner;
        return `<div class="team ${lost ? "lost" : ""}"><span>${t.rank ? `<span class="rank">${t.rank}</span>` : ""}${esc(t.short || t.name)}</span>${showScore ? `<span class="score">${esc(t.score)}</span>` : ""}</div>`;
      };
      title = row(g.away, g.home) + row(g.home, g.away);
    } else {
      art = `<div class="art-title">${esc(g.title)}</div>`;
      title = `<div class="card-sub">${esc(g.subtitle || "")}</div>`;
    }
    const meta = g.state === "in" ? esc(g.statusText) : g.state === "post" ? esc(g.statusText || "Final") : esc(whenLabel(g));
    const price = priceInfo(g.platforms).kind;
    const aria = `${matchupLabel(g)}. ${g.state === "pre" ? whenLabel(g) : g.statusText}. ${price === "free" ? "Free to watch" : includedForMe(g) ? "Included in your services" : price === "paid" ? "Subscription needed" : ""}`;
    return `<button type="button" class="card" data-game="${esc(g.id)}" data-card-league="${esc(g.league)}" aria-label="${esc(aria)}">
      <div class="card-art" style="${artBackground(g)}">
        <div class="card-badges">${status}${priceBadge(g)}</div>
        ${art}
        ${eventTag(g, "event-tag card-event")}
      </div>
      <div class="card-body">
        <div class="card-title">${title}</div>
        <div class="card-meta">${meta}${g.expected ? " · Expected" : ""}</div>
        <div class="platform-row">${platformTags(g.platforms)}</div>
      </div>
    </button>`;
  }

  function secHead(title, sub = "", { color, live, action = "" } = {}) {
    return `<div class="sec-head"${color ? ` style="--c:${color}"` : ""}><h2>${live ? '<span class="live-dot" aria-hidden="true"></span>' : ""}${esc(title)}</h2>${sub || action ? `<span class="sec-side">${sub ? `<span class="sub">${esc(sub)}</span>` : ""}${action}</span>` : ""}</div>`;
  }
  // Each game row is remembered by a short key so "See all" can list it in a pop-up.
  const rowLists = new Map();
  const rowKey = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function shelfHTML(title, games, sub = "", opts = {}) {
    if (!games.length) return "";
    const leagues = new Set(games.map((g) => g.league));
    const tag = leagues.size === 1 ? ` data-brand-league="${[...leagues][0]}"` : "";
    const key = rowKey(title);
    rowLists.set(key, { title, sub, games, color: opts.color });
    // "See all N" tells people the row has more than fits, and opens it as a list (easier than swiping).
    const action = games.length > 1
      ? `<button type="button" class="see-all" data-open-row="${esc(key)}" aria-label="See all ${games.length} ${esc(title)} games"><b>${games.length}</b> games <span aria-hidden="true">→</span></button>` : "";
    return `<div class="shelf-block"${tag}>${secHead(title, sub, { ...opts, action })}
      <div class="row">
        <button type="button" class="shelf-arrow prev" aria-label="Scroll ${esc(title)} left" data-scroll="-1">${ICON.left}</button>
        <div class="shelf">${games.map(cardHTML).join("")}</div>
        <button type="button" class="shelf-arrow next" aria-label="Scroll ${esc(title)} right" data-scroll="1">${ICON.right}</button>
      </div></div>`;
  }
  // ---------- My Teams ----------
  // Before anyone follows a team: "Who do you root for?" with one-tap picks (this week's top-ranked
  // college teams plus popular WNBA teams). After: a card per followed team with its next game.
  const WNBA_PICKS = ["wnba:5", "wnba:9", "wnba:17", "wnba:131935", "wnba:129689"]; // Fever, Liberty, Aces, Tempo, Valkyries
  function quickPickKeys() {
    const ranked = new Map();
    for (const g of state.games) {
      if (g.league !== "ncaa" || !g.away) continue;
      for (const tm of [g.home, g.away]) if (tm.rank && tm.id) ranked.set(`ncaa:${tm.id}`, tm.rank);
    }
    const college = [...ranked].sort((x, y) => x[1] - y[1]).slice(0, 7).map(([k]) => k);
    const wnba = state.region === "ca" ? ["wnba:131935", ...WNBA_PICKS.filter((k) => k !== "wnba:131935")] : WNBA_PICKS;
    return [...college, ...wnba].filter((k) => teamByKey.has(k) && !state.favs.has(k));
  }
  // Games for one followed team: this week's scoreboard plus, once loaded, the team's full season.
  function teamGames(key) {
    const isTeam = (g) => g.away && !g.tba && [g.away, g.home].some((tm) => tm.id && `${g.league}:${tm.id}` === key);
    const byId = new Map();
    for (const g of scheduleCache.get(key) || []) if (isTeam(g)) byId.set(g.id, g);
    for (const g of state.games) if (isTeam(g)) byId.set(g.id, g); // scoreboard copies are fresher (live scores)
    return [...byId.values()];
  }
  function nextGameFor(key) {
    const games = teamGames(key).filter((g) => g.state !== "post");
    return games.sort((x, y) => (x.state === "in" ? -1 : 0) - (y.state === "in" ? -1 : 0) || x.date - y.date)[0] || null;
  }
  function lastResultFor(key) {
    return teamGames(key).filter((g) => g.state === "post" && g.date <= Date.now()).sort((x, y) => y.date - x.date)[0] || null;
  }

  // Load the full season for each followed team (one request per team, once per visit) so the cards can
  // show last results and games beyond this week's scoreboard.
  const favSchedLoading = new Set();
  let favSchedDone = false;
  function ensureFavSchedules() {
    const keys = [...state.favs].filter((k) => teamByKey.has(k) && LEAGUES[teamByKey.get(k).league]?.espn && !scheduleCache.has(k) && !favSchedLoading.has(k));
    if (!keys.length) { if (!favSchedLoading.size && !favSchedDone) { favSchedDone = true; markNewSinceVisit(); } return; }
    for (const k of keys) {
      favSchedLoading.add(k);
      const tm = teamByKey.get(k);
      getJSON(`${ESPN}/${LEAGUES[tm.league].espn}/teams/${tm.espnId}/schedule`)
        .then((j) => scheduleCache.set(k, (j.events || []).map((e) => parseEspnEvent(e, tm.league)).filter(Boolean)))
        .catch(() => scheduleCache.set(k, []))
        .finally(() => {
          favSchedLoading.delete(k);
          if (!favSchedLoading.size) { favSchedDone = true; markNewSinceVisit(); if (state.view === "home") refreshMyTeams(); }
        });
    }
  }
  function refreshMyTeams() {
    const box = $(".myteams");
    if (!box) return;
    const fresh = document.createElement("div");
    fresh.innerHTML = myTeamsHTML();
    const next = fresh.firstElementChild;
    if (next) box.replaceWith(next);
  }

  // "New since your last visit": remember what each followed team's cards showed last time (on this device only).
  // When a result, a new game or a newly announced channel appears, that card gets a small amber dot for this visit.
  const newSinceVisit = new Map();
  function teamSignature(key) {
    const last = lastResultFor(key), next = nextGameFor(key);
    return { last: last?.id || "", next: next?.id || "", ch: next ? next.platforms.map((x) => x.id).sort().join(",") : "" };
  }
  function markNewSinceVisit() {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("fc-seen") || "{}") || {}; } catch { /* private mode */ }
    const now = {};
    for (const k of state.favs) {
      if (!teamByKey.has(k)) continue;
      const sig = teamSignature(k), old = seen[k];
      now[k] = sig;
      if (!old) continue; // first time we've seen this team: nothing to compare yet
      if (sig.last && sig.last !== old.last) newSinceVisit.set(k, "New result");
      else if (sig.next && sig.next !== old.next) newSinceVisit.set(k, "New game");
      else if (sig.ch && sig.ch !== old.ch && sig.next === old.next) newSinceVisit.set(k, "Channel added");
    }
    try { localStorage.setItem("fc-seen", JSON.stringify(now)); } catch { /* private mode */ }
  }

  function myTeamCardHTML(key) {
    const team = teamByKey.get(key);
    if (!team) return "";
    const g = nextGameFor(key), last = lastResultFor(key);
    const sideOf = (x) => (`${x.league}:${x.home.id}` === key ? "home" : "away");
    const oppOf = (x) => (sideOf(x) === "home" ? x.away : x.home);
    const vsOf = (x) => `${sideOf(x) === "home" || x.neutral ? "vs." : "at"} ${oppOf(x).short || oppOf(x).name}`;
    const soon = g && g.state === "pre" && g.date - Date.now() < 3 * 3600000;
    const recentFinal = last && (Date.now() - last.date < 20 * 3600000 || newSinceVisit.get(key) === "New result") && !(g && (g.state === "in" || soon));
    let line, attr;
    if (recentFinal) {
      // Just played: show the result, with the next game underneath.
      const me = last[sideOf(last)], opp = oppOf(last);
      const won = me.winner || (!opp.winner && Number(me.score) > Number(opp.score));
      const score = me.score !== "" && opp.score !== "" ? ` ${me.score}–${opp.score}` : "";
      const res = `Final: ${won ? "Won" : "Lost"}${score}`;
      const nextDay = g && g.date - Date.now() < 6 * 86400000 ? g.date.toLocaleDateString([], { weekday: "short" }) : g && dayLabel(g.date);
      const nextTxt = g ? `Next: ${nextDay} · ${clock(g)}` : "See the full schedule";
      line = `<span class="mt-when mt-final ${won ? "won" : "lost"}">${esc(res)}</span><span class="mt-vs">${esc(vsOf(last))}</span><span class="mt-ch">${esc(nextTxt)}</span>`;
      attr = `data-game="${esc(last.id)}" aria-label="${esc(`${team.name}: ${res}, ${vsOf(last)}. ${nextTxt}`)}"`;
      gameById.set(last.id, last);
    } else if (g) {
      const live = g.state === "in";
      const me = g[sideOf(g)], opp = oppOf(g);
      const when = live ? `Live now${me.score !== "" ? ` · ${me.score}–${opp.score}` : ""}` : `${dayLabel(g.date)} · ${clock(g)}`;
      const ch = g.platforms.length ? g.platforms.slice(0, 2).map((x) => x.name).join(", ") : "Channel TBA";
      line = `<span class="mt-when${live ? " is-live" : ""}">${esc(when)}</span><span class="mt-vs">${esc(vsOf(g))}</span><span class="mt-ch">${esc(ch)}</span>`;
      attr = `data-game="${esc(g.id)}" aria-label="${esc(`${team.name}: ${when}, ${vsOf(g)}, on ${ch}`)}"`;
      gameById.set(g.id, g);
    } else {
      line = `<span class="mt-when">No upcoming games</span><span class="mt-ch">See the full schedule</span>`;
      attr = `data-team="${esc(key)}" aria-label="${esc(`${team.name}: full schedule`)}"`;
    }
    const isNew = newSinceVisit.get(key);
    const newTag = isNew ? `<span class="mt-new" title="${esc(isNew)} since your last visit"><span class="sr-only">${esc(isNew)} since your last visit</span></span>` : "";
    const cal = (scheduleCache.get(key) || []).filter((x) => x.state !== "post" && canCalendar(x)).length;
    const calBtn = LEAGUES[team.league]?.espn ? `<button type="button" class="mt-cal" data-ics-team="${esc(key)}" aria-label="${esc(`Add ${team.name}'s season to my calendar`)}">${ICON.cal}<span>${cal ? `Add ${cal} games to calendar` : "Add season to calendar"}</span></button>` : "";
    return `<div class="mt-item"><button type="button" class="mt-card" data-team-key="${esc(key)}" ${attr} style="--tc:${hex(team.color)}">
        ${logoHTML(team, { size: 48, eager: true })}<span class="mt-info">${isNew ? `<em class="mt-new-label">${esc(isNew)}</em>` : ""}<b>${esc(team.short || team.name)}</b>${line}</span>${newTag}
      </button>${calBtn}</div>`;
  }
  // "Find your team": search every team and follow it right here, without leaving the page.
  function mtFinderHTML() {
    return `<div class="mt-find sched-find">
        <div class="sched-find-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <label class="sr-only" for="mtFind">Find a team to follow</label>
          <input id="mtFind" type="search" placeholder="Search for a team to follow" autocomplete="off" spellcheck="false" enterkeyhint="go"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="mtSuggest" />
        </div>
        <ul class="sched-suggest" id="mtSuggest" role="listbox" aria-label="Teams to follow" hidden></ul>
      </div>`;
  }
  function renderMtSuggest() {
    const box = $("#mtSuggest"), input = $("#mtFind");
    if (!box || !input) return;
    const q = input.value.trim();
    const nq = norm(q);
    const list = q ? state.teams
      .filter((tm) => !state.favs.has(tm.key) && matchesQuery(teamText(tm), q))
      .map((tm) => ({ tm, starts: norm(tm.name).startsWith(nq) || norm(tm.short || "").startsWith(nq) ? 1 : 0 }))
      .sort((a, b) => b.starts - a.starts || a.tm.name.length - b.tm.name.length || a.tm.name.localeCompare(b.tm.name))
      .slice(0, 6).map((x) => x.tm) : [];
    box.innerHTML = list.length
      ? list.map((tm, i) => `<li role="option" id="mts-${i}" class="sug" data-follow="${esc(tm.key)}" aria-selected="${i === 0}">
          ${logoHTML(tm, { size: 32, eager: true })}<span class="sug-name">${esc(tm.name)}<small>${esc(LEAGUES[tm.league].short)}</small></span>
          <span class="sug-n">Follow</span></li>`).join("")
      : q ? `<li class="sug-empty" role="presentation">No team matches “${esc(q)}”</li>` : "";
    box.hidden = !q;
    input.setAttribute("aria-expanded", String(!!q && list.length > 0));
  }
  document.addEventListener("input", (e) => { if (e.target.id === "mtFind") renderMtSuggest(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.id !== "mtFind") return;
    if (e.key === "Enter") { e.preventDefault(); $("#mtSuggest .sug")?.click(); }
    else if (e.key === "Escape") { e.target.value = ""; renderMtSuggest(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest?.(".mt-find")) { const b = $("#mtSuggest"); if (b) b.hidden = true; } });

  document.addEventListener("click", (e) => {
    const card = e.target.closest?.(".mt-card");
    if (card && newSinceVisit.delete(card.dataset.teamKey)) { card.querySelector(".mt-new")?.remove(); card.querySelector(".mt-new-label")?.remove(); }
  });

  function myTeamsHTML() {
    const favs = [...state.favs].filter((k) => teamByKey.has(k));
    const head = secHead("My Teams", favs.length ? plural(favs.length, "team") : "", { color: "var(--paid)" });
    const pickHTML = (k) => {
      const tm = teamByKey.get(k);
      return `<button type="button" class="mt-pick" data-follow="${esc(k)}" aria-label="Follow ${esc(tm.name)}">${logoHTML(tm, { size: 32, eager: true })}<span>${esc(tm.short || tm.name)}</span></button>`;
    };
    if (favs.length) {
      // Once a team is followed the quick picks go away; "Add more teams" leads to the full list.
      return `<section class="myteams" aria-label="My Teams">${head}
        <div class="mt-row">${favs.map(myTeamCardHTML).join("")}
          <a class="mt-add" href="#teams">${ICON.star}<span>Add more teams</span></a></div>${mtFinderHTML()}</section>`;
    }
    const picks = quickPickKeys().slice(0, 12);
    if (!picks.length) return "";
    return `<section class="myteams" aria-label="My Teams">${head}
      <p class="mt-dek">Your teams. Your games. Never miss a tip-off. Select your favorites and keep their upcoming matchups front and center.</p>
      ${mtFinderHTML()}
      <div class="mt-picks" role="group" aria-label="Popular teams to follow">${picks.map(pickHTML).join("")}<a class="mt-pick mt-more" href="#teams"><span>More teams</span> <span aria-hidden="true">→</span></a></div>
    </section>`;
  }

  // ---------- "next section" pill ----------
  // A small floating button names the next key section below the screen (My Teams, then Schedule)
  // and scrolls there when tapped. It hides once those sections are on screen or passed.
  // My Teams, the Schedule, then the two rows that follow the Schedule (whichever have games today).
  function nextTargets() {
    const list = [[$(".myteams"), "My Teams"], [$("#schedule"), "Schedule"]];
    let el = $("#schedule")?.nextElementSibling, n = 0;
    while (el && n < 2) {
      if (el.matches(".shelf-block")) { list.push([el, el.querySelector("h2")?.textContent.trim() || "More"]); n++; }
      el = el.nextElementSibling;
    }
    const guide = $("#guide");
    if (guide && !guide.hidden) list.push([guide, "How to watch"]);
    return list;
  }
  const pill = document.createElement("button");
  pill.type = "button"; pill.className = "next-pill"; pill.hidden = true;
  document.body.append(pill);
  let pillTarget = null, pillScrollT = 0;
  function updatePill() {
    pillTarget = null;
    if (state.view === "home" && !state.q && $("#modal").hidden && scrollY > 150) {
      for (const [el, label] of nextTargets()) {
        if (el && el.getBoundingClientRect().top > innerHeight - 80) { pillTarget = el; pill.innerHTML = `<span aria-hidden="true">↓</span> ${esc(label)}`; pill.setAttribute("aria-label", `Jump to ${label}`); break; }
      }
    }
    pill.hidden = !pillTarget;
  }
  let pillRaf = 0;
  const queuePill = () => { if (!pillRaf) pillRaf = requestAnimationFrame(() => { pillRaf = 0; updatePill(); }); };
  addEventListener("scroll", () => {
    queuePill();
    if (matchMedia("(pointer: coarse)").matches) {
      pill.classList.add("is-scrolling");
      clearTimeout(pillScrollT); pillScrollT = setTimeout(() => pill.classList.remove("is-scrolling"), 500);
    }
  }, { passive: true });
  addEventListener("resize", queuePill);
  pill.addEventListener("click", () => {
    if (!pillTarget) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const down = pillTarget.getBoundingClientRect().top > 0;
    const head = innerWidth <= 760 && down ? 0 : ($("#topbar")?.offsetHeight || 0);
    const y = pillTarget.getBoundingClientRect().top + scrollY - head - 8;
    scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  });

  // ---------- light sweep linking My Teams to their days ----------
  // An amber ray runs around a team's card and the Schedule days it plays: once when the Schedule
  // first comes into view, and whenever a card is hovered or focused. "Reduce motion" gets a still outline.
  function beam(keys) {
    const want = new Set(keys);
    const els = [
      ...$$(".mt-card").filter((c) => want.has(c.dataset.teamKey)),
      ...$$(".sched-day[data-teams]").filter((d) => d.dataset.teams.split(" ").some((k) => want.has(k))),
    ];
    for (const el of els) {
      el.classList.remove("beam"); void el.offsetWidth; // restart if already running
      el.classList.add("beam");
      clearTimeout(el._beamT);
      el._beamT = setTimeout(() => el.classList.remove("beam"), 3400);
    }
  }
  // A team you just followed gets the sweep as soon as you're back on the page (pop-up closed).
  const pendingBeam = new Set();
  function flushBeam() {
    if (!pendingBeam.size || state.view !== "home" || !$("#modal").hidden) return;
    const keys = [...pendingBeam]; pendingBeam.clear();
    setTimeout(() => beam(keys), 350);
  }
  let beamedOnce = false;
  const beamWatch = new IntersectionObserver((entries) => {
    if (beamedOnce || !entries.some((e) => e.isIntersecting) || !state.favs.size) return;
    beamedOnce = true; beamWatch.disconnect();
    beam([...state.favs]);
  }, { threshold: 0.4 });
  const watchSchedule = () => { const s = $("#schedule .sched-days"); if (s && !beamedOnce) { beamWatch.disconnect(); beamWatch.observe(s); } };
  for (const type of ["pointerenter", "focusin"]) {
    document.addEventListener(type, (e) => {
      const card = e.target.closest?.(".mt-card");
      if (card && (type === "focusin" || e.pointerType === "mouse")) beam([card.dataset.teamKey]);
    }, true);
  }

  function teamTileHTML(t) {
    teamByKey.set(t.key, t);
    const fav = state.favs.has(t.key) ? `<svg class="fav" viewBox="0 0 24 24" aria-label="My team"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>` : "";
    return `<button type="button" class="team-tile" data-team="${esc(t.key)}" style="--tc:${hex(t.color)}" aria-label="${esc(t.name)}: schedule and where to watch">
      ${fav}${logoHTML(t)}
      <span class="tname">${esc(t.name)}</span>
      <span class="tleague">${esc(LEAGUES[t.league].short)}</span>
    </button>`;
  }
  const legendHTML = () => `<div class="legend" aria-label="Price key">
    <span><i style="background:var(--free)"></i>Free · stream or antenna</span>
    <span><i style="background:var(--paid)"></i>Streaming subscription</span>
    <span><i style="background:var(--tv)"></i>Cable or live-TV service</span>
    ${hasServices() ? '<span><i style="background:var(--mine)"></i>Yours · in your services</span>' : '<button type="button" class="legend-cta" data-open-services>Pick your services to see what you can already watch →</button>'}
  </div>`;
  /** Banner over the games while the My services filter is on. */
  function mineBarHTML() {
    return `<div class="mine-bar">${ICON.tv}<p><strong>My Viewing Options:</strong> See the games you can watch with the services you already have.</p>
      <button type="button" class="btn btn-ghost" data-open-services>Edit</button></div>`;
  }
  const emptyHTML = (title, body) => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;

  // ---------- home ----------
  /** Games you can still watch for free: not finished, at least one free option. */
  const freeGames = () => state.games
    .filter((g) => !g.tba && g.state !== "post" && priceInfo(g.platforms).kind === "free")
    .sort((a, b) => a.date - b.date);

  function renderStats() {
    // Today only: what's on today, and how much of it is free and still to come.
    const today = dayKey(new Date());
    const todays = state.games.filter((g) => !g.tba && dayKey(g.date) === today);
    const freeToday = todays.filter((g) => g.state !== "post" && priceInfo(g.platforms).kind === "free");
    const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
    set("games", state.loading ? "—" : todays.length.toLocaleString());
    set("free", state.loading ? "—" : freeToday.length.toLocaleString());
    set("platforms", regionPlatforms().length.toString());
    set("leagues", Object.keys(LEAGUES).length.toString());
  }

  function renderHome() {
    const el = $("#view-home");
    if (state.loading) {
      el.innerHTML = `<div class="skel-feature" aria-busy="true" aria-label="Loading schedule"><div class="skel"></div><div class="skel"></div></div>
        ${secHead("Today")}<div class="skel-row">${'<div class="skel"></div>'.repeat(5)}</div>`;
      return;
    }

    const base = state.games.filter(upcoming).sort((a, b) => a.date - b.date);
    const filtered = base.filter((g) => passesFilters(g));
    let html = "";

    if (state.q) {
      const teams = state.teams.filter((t) => (state.league === "all" || t.league === state.league) && matchesQuery(teamText(t), state.q)).slice(0, 24);
      const plats = PLATFORMS.filter((p) => p.id !== "local" && matchesQuery(norm(p.name), state.q));
      const bits = [plural(filtered.length, "game"), teams.length && plural(teams.length, "team"), plats.length && plural(plats.length, "platform")].filter(Boolean);
      html += `<div class="page-head"><h2>“${esc(state.q)}”</h2><p class="dek">${esc(bits.join(" · "))}</p></div>`;
      // Games first, today at the top, as schedule rows; then later days; then teams and services.
      const today = dayKey(new Date());
      const listed = filtered.filter((g) => !g.tba && g.away);
      const todays = listed.filter((g) => dayKey(g.date) === today).sort(byPhase);
      const later = listed.filter((g) => dayKey(g.date) > today).sort((x, y) => x.date - y.date);
      const LATER_CAP = 40;
      if (listed.length) {
        html += secHead("Today", plural(todays.length, "game"));
        html += todays.length
          ? `<div class="sched-list">${todays.map(schedRowHTML).join("")}</div>`
          : `<div class="notice">No games matching “${esc(state.q)}” today.${later.length ? " Here's what's coming up." : ""}</div>`;
        if (later.length) {
          const days = new Map();
          for (const g of later.slice(0, LATER_CAP)) { const k = dayKey(g.date); if (!days.has(k)) days.set(k, []); days.get(k).push(g); }
          html += secHead("Coming up", later.length > LATER_CAP ? `Next ${LATER_CAP} of ${later.length} games` : plural(later.length, "game"));
          html += `<div class="sched-list">${[...days].map(([k, gs]) => `<h3 class="sched-dayhead">${esc(dayLabel(new Date(k), "long"))}</h3>${gs.map(schedRowHTML).join("")}`).join("")}</div>`;
        }
      }
      const announced = filtered.filter((g) => g.tba || !g.away);
      if (announced.length) html += `${secHead("Announced events")}<div class="grid" style="padding-top:12px">${announced.map(cardHTML).join("")}</div>`;
      if (teams.length) {
        html += `${secHead("Teams", "Tap for full schedule")}
          <div class="row"><div class="shelf teams-shelf">${teams.map(teamTileHTML).join("")}</div></div>`;
      }
      if (plats.length) html += `${secHead("Platforms")}<div class="grid plat-grid">${plats.map(platformCardHTML).join("")}</div>`;
      if (filtered.length) {
        // shown above
      } else if (!teams.length && !plats.length) {
        html += emptyHTML("No matches", "Try a team like “UConn”, “Liberty” or “Lunar Owls”, or a service like “ESPN+”.");
      } else {
        html += `<div class="notice">No games in the next ${DAYS_AHEAD} days match. Open a team above to see its full season schedule.</div>`;
      }
      el.innerHTML = html;
      return;
    }

    const real = filtered.filter((g) => !g.tba);
    if (state.price === "mine") html += mineBarHTML();
    const hero = pickHero(filtered);
    if (hero) html += featureHTML(hero, real);

    const lg = state.league !== "all" ? LEAGUES[state.league] : null;
    if (lg && !real.length) {
      html += `<div class="notice"><strong>${esc(lg.name)}:</strong> no games in the next ${DAYS_AHEAD} days. ${esc(lg.season)} Announced events and the usual channels are below.</div>`;
    }
    if (state.liveFailed) {
      html += `<div class="notice">Live schedules couldn't load right now. Showing announced events only. <button type="button" class="btn btn-ghost" data-retry>Try again</button></div>`;
    }
    html += legendHTML();

    const today = dayKey(new Date());
    html += shelfHTML("Live Now", real.filter((g) => g.state === "in"), "", { color: "var(--live)", live: true });
    html += myTeamsHTML();
    schedGames = real.filter((g) => dayKey(g.date) >= today);
    if (lastNight) { const have = new Set(schedGames.map((g) => g.id)); schedGames = schedGames.concat(lastNight.filter((g) => !have.has(g.id) && passesFilters(g))); }
    html += scheduleHTML();
    html += shelfHTML("Top 25 Matchups", real.filter((g) => g.state === "pre" && g.home.rank && g.away?.rank), "Both teams ranked", { color: "var(--accent)" });
    if (state.price !== "paid") html += shelfHTML("Free to Watch", real.filter((g) => g.state === "pre" && priceInfo(g.platforms).kind === "free"), "No subscription needed", { color: "var(--free)" });
    html += shelfHTML("Ranked Teams in Action", real.filter((g) => g.state === "pre" && !!g.home.rank !== !!g.away?.rank), "One team in the Top 25");
    // Everything else folds behind one "More to watch" button.
    const announced = filtered.filter((g) => g.tba);
    const LEAGUE_ORDER = ["unrivaled", "wnba", "upshot", "fiba", "ncaa"];
    const allAnnounced = LEAGUE_ORDER.flatMap((id) => announced.filter((g) => g.league === id));
    let more = "";
    more += shelfHTML("Showcase Events", real.filter((g) => g.state !== "post" && showcaseName(g)), "Marquee neutral-site games", { color: "var(--event)" });
    more += shelfHTML("On National TV", real.filter((g) => g.state === "pre" && g.platforms.some((p) => NATIONAL.has(p.id))), "", { color: "var(--tv)" });
    more += shelfHTML("Coming Up", allAnnounced, "Announced seasons & events").replace('<div class="shelf-block"', '<div class="shelf-block" data-brand-league="mixed"');
    if (more) html += `<div class="more-watch"><button type="button" class="more-watch-btn" data-more-watch aria-expanded="false">More to watch <span aria-hidden="true">▾</span></button><div class="more-watch-body">${more}</div></div>`;

    if (lg) {
      const plats = leaguePlatformIds(lg).map((id) => platformById(id, state.region)).filter(Boolean)
        .filter((p) => priceFilterPlatform(p));
      if (plats.length) html += `${secHead(`Where ${lg.name} airs`, "Usual channels & services", { color: lg.color })}<div class="grid plat-grid">${plats.map(platformCardHTML).join("")}</div>`;
    }
    if (!filtered.length) html += state.price === "mine"
      ? emptyHTML("None of your services carry these games", "Add a service, try All leagues, or switch the filter back to All.")
      : emptyHTML("No games match these filters", "Try All leagues, or switch the price filter back to All.");
    el.innerHTML = html;
  }

  // ---------- Last night's finals: the Schedule's "Yesterday" tab and the ticker ----------
  // Loaded after the page appears (two small requests), so it never slows the first screen.
  let lastNight = null;            // null = not loaded yet; [] = loaded, no finals
  let lastNightLoading = false;
  function loadLastNight() {
    if (lastNight || lastNightLoading) return;
    lastNightLoading = true;
    const d = new Date(); d.setDate(d.getDate() - 1);
    const day = ymd(d);
    const jobs = ["ncaa", "wnba"].map((lg) =>
      getJSON(`${ESPN}/${LEAGUES[lg].espn}/scoreboard?dates=${day}&limit=300${lg === "ncaa" ? "&groups=50" : ""}`)
        .then((j) => (j.events || []).map((e) => parseEspnEvent(e, lg)).filter(Boolean))
        .catch(() => []));
    Promise.all(jobs).then((lists) => {
      lastNight = lists.flat().filter((g) => g.state === "post" && g.away);
      lastNightLoading = false;
      if (state.view === "home" && !state.q) {
        const have = new Set(schedGames.map((g) => g.id));
        schedGames = schedGames.concat(lastNight.filter((g) => !have.has(g.id) && passesFilters(g)));
        refreshSchedule();
      }
      renderTicker();
    });
  }
  // What makes a result worth a spot: your team, an upset, a close finish, or a ranked team.
  function lastNightTag(g) {
    const a = g.away, h = g.home;
    const sa = Number(a.score), sh = Number(h.score);
    if (!Number.isFinite(sa) || !Number.isFinite(sh)) return null;
    const [w, l] = sa > sh ? [a, h] : [h, a];
    const mine = [a, h].some((tm) => state.favs.has(`${g.league}:${tm.id}`));
    const upset = l.rank && (!w.rank || w.rank > l.rank);
    const ot = /OT/i.test(g.statusText || "");
    const thriller = ot || Math.abs(sa - sh) <= 3;
    const ranked = a.rank || h.rank;
    if (mine) return { k: "you", label: "Your team", score: 4 };
    if (upset) return { k: "up", label: "Upset", score: 3 };
    if (thriller) return { k: "thr", label: ot ? "Thriller · OT" : "Thriller", score: 2 };
    if (ranked) return { k: "rk", label: "Top 25", score: 1 };
    return null;
  }
  // ---------- schedule (the TV listings) ----------
  // One day at a time, in tip-off order, each game on one row with its channels and price. Replaces the
  // stack of one-row-per-day shelves, so the whole week is a tab away instead of ten rows down.
  let schedGames = [];   // filtered games from today on, set by renderHome
  let schedDay = null;   // dayKey of the selected day (null = first day with games)
  let schedAll = false;  // show the whole day, not just the first SCHED_CAP games
  const SCHED_CAP = 20;
  const clock = (g) => (g.timeValid === false ? "TBA" : g.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  /** The one price mark a game gets in a list: Free, Yours (in the viewer's services) or Paid. */
  function priceTag(g) {
    if (g.state === "post") return "";
    const k = priceInfo(g.platforms).kind;
    if (k === "free") return `<span class="access free">Free</span>`;
    if (includedForMe(g)) return `<span class="access mine">${ICON.check}Yours</span>`;
    return k === "paid" ? `<span class="access paid">Paid</span>` : "";
  }
  function schedRowHTML(g) {
    gameById.set(g.id, g);
    const lg = LEAGUES[g.league];
    const showScore = g.state !== "pre";
    const team = (t, other) => `<span class="srow-team${g.state === "post" && other.winner ? " lost" : ""}">${logoHTML(t)}<span class="srow-name">${t.rank ? `<span class="rk">${t.rank}</span>` : ""}${esc(t.short || t.name)}</span>${showScore && t.score !== "" ? `<span class="sc">${esc(t.score)}</span>` : ""}</span>`;
    const time = g.state === "in" ? `<span class="srow-live">Live</span>` : g.state === "post" ? "Final" : esc(clock(g));
    const sub = g.state === "in" ? esc(g.statusText) : esc(lg.short);
    return `<button type="button" class="srow${g.state === "post" ? " is-final" : ""}" data-game="${esc(g.id)}" aria-label="${esc(`${matchupLabel(g)}, ${g.state === "pre" ? clock(g) : g.statusText}`)}">
      <span class="srow-time">${time}<small style="--c:${lg.color}">${sub}</small></span>
      <span class="srow-match">${team(g.away, g.home)}${team(g.home, g.away)}${eventTag(g)}</span>
      <span class="srow-ch">${priceTag(g)}${platformTags(g.platforms, 3)}</span>
    </button>`;
  }
  // Finding a team: "Find a team" picks one or more teams (schedTeams). Their games get their own
  // tab listing every game in the next 10 days, and on each day's tab they're pinned to the top,
  // along with the viewer's starred teams, above everything else that's on.
  let schedTeams = [];      // team keys picked in "Find a team" (this visit only)
  let schedQuery = "";      // what's typed in the box
  let sugIndex = -1;        // highlighted suggestion
  const TEAM_TAB = "team";  // schedDay value for the picked teams' tab
  // Conference filter, like ESPN's schedule: "" = everything, "top25" = a ranked team plays, or a conference id.
  let schedConf = (() => { try { return localStorage.getItem("fc-conf") || ""; } catch { return ""; } })();
  const CONFERENCES = typeof ESPN_CONFERENCES !== "undefined" ? ESPN_CONFERENCES : [];
  const confLabel = (id) => (id === "top25" ? "Top 25" : CONFERENCES.find((c) => c.id === id)?.label || "");
  const inConf = (g, id = schedConf) => !id
    || (g.league === "ncaa" && g.away && (id === "top25" ? !!(g.home.rank || g.away.rank) : g.home.conf === id || g.away.conf === id));
  function confSelectHTML() {
    if (state.league !== "all" && state.league !== "ncaa") return "";
    const college = schedGames.filter((g) => g.league === "ncaa" && g.away);
    if (!college.length || !CONFERENCES.length) return "";
    const count = (id) => college.filter((g) => inConf(g, id)).length;
    const confs = CONFERENCES.map((c) => ({ ...c, n: count(c.id) })).filter((c) => c.n || c.id === schedConf);
    const opt = (value, label, n) => `<option value="${esc(value)}"${value === schedConf ? " selected" : ""}>${esc(label)}${n != null ? ` (${n})` : ""}</option>`;
    return `<label class="sched-conf">
        <span class="sr-only">Filter the schedule by conference</span>
        <select id="schedConf">
          ${opt("", "All conferences")}
          ${opt("top25", "Top 25", count("top25"))}
          <optgroup label="Conferences">${confs.map((c) => opt(c.id, c.label, c.n)).join("")}</optgroup>
        </select>
      </label>`;
  }
  const gameTeamKey = (g, t) => (t?.id ? `${g.league}:${t.id}` : "");
  const playsIn = (g, keys) => keys.size > 0 && [g.away, g.home].some((t) => keys.has(gameTeamKey(g, t)));
  const teamName = (key) => teamByKey.get(key)?.name || key;
  const shortTeam = (key) => { const t = teamByKey.get(key); return t?.short || t?.name || key; };
  const listNames = (names) => (names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and "));
  const phaseOrder = { in: 0, pre: 1, post: 2 };
  // Live games first, then what's still to come in tip-off order; finished games drop to the end.
  const byPhase = (a, b) => phaseOrder[a.state] - phaseOrder[b.state] || a.date - b.date || notability(b) - notability(a);

  function scheduleHTML() {
    if (!schedGames.some((g) => g.away)) return "";
    return `<section class="sched-sec" id="schedule" aria-labelledby="schedTitle">
      ${secHead("Schedule", `Times in ${tzName()}`).replace("<h2>", '<h2 id="schedTitle">')}
      <div class="sched-tools">
      <div class="sched-find">
        <div class="sched-find-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <label class="sr-only" for="schedFind">Find a team in the schedule</label>
          <input id="schedFind" type="search" placeholder="Find a team, like Oklahoma or Liberty" autocomplete="off" spellcheck="false" enterkeyhint="search"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="schedSuggest" value="${esc(schedQuery)}" />
        </div>
        <ul class="sched-suggest" id="schedSuggest" role="listbox" aria-label="Teams" hidden></ul>
      </div>
      ${confSelectHTML()}
      </div>
      <div id="schedBody">${schedBodyHTML()}</div>
    </section>`;
  }

  function schedBodyHTML() {
    const pool = schedGames.filter((g) => inConf(g));
    const byDay = new Map();
    for (const g of pool) {
      if (!g.away) continue;
      const k = dayKey(g.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(g);
    }
    const days = [...byDay.keys()].sort((a, b) => a - b);
    const picked = new Set(schedTeams);
    const lead = new Set([...schedTeams, ...state.favs]); // whose games go first on each day
    if (schedDay === TEAM_TAB && !picked.size) schedDay = null;
    if (schedDay !== TEAM_TAB && !byDay.has(schedDay)) { schedDay = days.find((d) => d >= dayKey(new Date())) ?? days[0]; schedAll = false; }
    if (!days.length && schedDay !== TEAM_TAB) {
      return `<div class="notice sched-empty">No ${esc(confLabel(schedConf))} games in the next ${DAYS_AHEAD} days${state.price !== "all" ? " with these filters" : ""}. <button type="button" class="inline-link" data-sched-conf-clear>Show all conferences</button></div>`;
    }

    // Tabs: the picked teams' tab first, then one per day, dotted where lead teams play.
    const teamGames = picked.size ? pool.filter((g) => g.away && playsIn(g, picked)).sort((a, b) => a.date - b.date) : [];
    const teamLabel = schedTeams.length === 1 ? shortTeam(schedTeams[0]) : `${schedTeams.length} teams`;
    let tabs = picked.size
      ? `<button type="button" class="sched-day sched-day-team" data-sched-day="${TEAM_TAB}" aria-pressed="${schedDay === TEAM_TAB}"><b>${esc(teamLabel)}</b><span>All games · ${teamGames.length}</span></button>` : "";
    tabs += days.map((k) => {
      const d = new Date(k);
      const label = dayLabel(d);
      const name = label === "Today" || label === "Tomorrow" || label === "Yesterday" ? label : d.toLocaleDateString(undefined, { weekday: "short" });
      const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const dot = byDay.get(k).some((g) => playsIn(g, lead));
      const favsHere = [...state.favs].filter((f) => byDay.get(k).some((g) => playsIn(g, new Set([f])))).join(" ");
      return `<button type="button" class="sched-day${dot ? " has-dot" : ""}" data-sched-day="${k}"${favsHere ? ` data-teams="${esc(favsHere)}"` : ""} aria-pressed="${k === schedDay}"${dot ? ` aria-label="${esc(`${label}, ${date}, ${byDay.get(k).length} games, includes your teams`)}"` : ""}><b>${esc(name)}</b><span>${esc(date)} · ${byDay.get(k).length}</span></button>`;
    }).join("");

    // Chips for the picked teams, each removable.
    const chips = schedTeams.length ? `<div class="sched-picks" aria-label="Teams you picked">${schedTeams.map((k) =>
      `<button type="button" class="pick-chip" data-sched-remove="${esc(k)}" aria-label="Remove ${esc(teamName(k))}">${logoHTML(teamByKey.get(k))}${esc(shortTeam(k))}<svg class="pick-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>`).join("")}
      <button type="button" class="pick-clear" data-sched-clear>Clear</button></div>` : "";

    let body;
    if (schedDay === TEAM_TAB) {
      const names = listNames(schedTeams.map(shortTeam));
      const stars = schedTeams.filter((k) => !state.favs.has(k)).map((k) => favButton(k).replace("Add to My Teams", `Star ${esc(shortTeam(k))}`)).join("");
      const season = schedTeams.length === 1 ? `<button type="button" class="btn btn-ghost" data-team="${esc(schedTeams[0])}">Full season schedule</button>` : "";
      const answers = schedTeams.slice(0, 3).map(teamTodayHTML).join("");
      const head = `${answers}<div class="sched-team-head">
          <p><strong>${esc(names)}</strong>${schedConf ? ` <span class="sched-conf-note">(${esc(confLabel(schedConf))} games only)</span>` : ""}: ${teamGames.length ? `${plural(teamGames.length, "game")} in the next ${DAYS_AHEAD} days` : `no games in the next ${DAYS_AHEAD} days${state.price !== "all" || state.league !== "all" ? " with these filters" : ""}`}</p>
          <div class="sched-team-actions">${stars}${season}</div>
        </div>`;
      const groups = new Map();
      for (const g of teamGames) { const k = dayKey(g.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
      const list = [...groups].map(([k, gs]) => `<h3 class="sched-dayhead">${esc(dayLabel(new Date(k), "long"))}</h3>${gs.map(schedRowHTML).join("")}`).join("");
      body = head + `<div class="sched-list">${list}</div>`;
    } else {
      const all = byDay.get(schedDay).sort(byPhase);
      const mine = all.filter((g) => playsIn(g, lead));
      const rest = all.filter((g) => !playsIn(g, lead));
      const shown = schedAll ? rest : rest.slice(0, SCHED_CAP);
      const whose = schedTeams.length && state.favs.size ? "Your teams" : schedTeams.length ? listNames(schedTeams.map(shortTeam)) : "Your teams";
      const list = mine.length
        ? `<p class="sched-group">${esc(whose)}</p>${mine.map(schedRowHTML).join("")}<p class="sched-group">All games</p>${shown.map(schedRowHTML).join("")}`
        : shown.map(schedRowHTML).join("");
      const more = rest.length > shown.length
        ? `<button type="button" class="btn btn-ghost sched-more" data-sched-all>Show all ${all.length} games ${(() => { const d = dayLabel(new Date(schedDay), "long"); return d === "Today" || d === "Tomorrow" || d === "Yesterday" ? d.toLowerCase() : `on ${esc(d)}`; })()}</button>` : "";
      body = `<div class="sched-list">${list}</div>${more}`;
    }
    return `${chips}<div class="sched-days" role="group" aria-label="Choose a day">${tabs}</div>${body}`;
  }

  /** "Is my team on today, and where?" answered in one line, with a button to the game. */
  function teamTodayHTML(key) {
    const keys = new Set([key]);
    const games = schedGames.filter((g) => g.away && playsIn(g, keys)).sort((x, y) => x.date - y.date);
    const today = dayKey(new Date());
    const name = esc(shortTeam(key));
    const vs = (g) => {
      const home = gameTeamKey(g, g.home) === key;
      const opp = home ? g.away : g.home;
      return `${home || g.neutral ? "vs." : "at"} ${esc(opp.short || opp.name)}`;
    };
    const where = (g) => (g.platforms.length ? `on ${esc(g.platforms.slice(0, 2).map((p) => p.name).join(" & "))}` : "channel not announced yet");
    const btn = (g, label = "Where to watch") => `<button type="button" class="btn btn-primary" data-game="${esc(g.id)}">${ICON.play}${label}</button>`;
    const todays = games.filter((g) => dayKey(g.date) === today);
    const g = todays.find((x) => x.state !== "post") || todays[0];
    let text, action = "";
    if (g && g.state === "in") { text = `<strong>${name} is playing now</strong> ${vs(g)} · ${where(g)}`; action = btn(g); }
    else if (g && g.state === "pre") { text = `<strong>${name} plays today</strong> ${vs(g)} · ${esc(clock(g))} ${where(g)}`; action = btn(g); }
    else {
      const next = games.find((x) => dayKey(x.date) > today);
      const played = g ? `${name} played today ${vs(g)}${g.home.score !== "" ? ` (final ${esc(g.away.score)}–${esc(g.home.score)})` : ""}. ` : `<strong>${name} doesn't play today.</strong> `;
      if (next) { text = `${played}Next: ${esc(dayLabel(next.date))} ${vs(next)} · ${esc(clock(next))} ${where(next)}`; action = btn(next); }
      else text = `${played}No games in the next ${DAYS_AHEAD} days.`;
    }
    return `<div class="team-today"><p>${text}</p>${action}</div>`;
  }

  /** Redraw just the schedule's tabs and list, so the page doesn't jump and the search box keeps focus. */
  function refreshSchedule(focusSel) {
    const el = $("#schedBody");
    if (!el) return render();
    el.innerHTML = schedBodyHTML();
    if (focusSel) $(focusSel)?.focus({ preventScroll: true });
  }

  function setConf(value) {
    schedConf = value; schedAll = false;
    try { value ? localStorage.setItem("fc-conf", value) : localStorage.removeItem("fc-conf"); } catch { /* storage unavailable */ }
    refreshSchedule();
    const sel = $("#schedConf");
    if (sel) sel.value = value;
    fx("show", $$("#schedBody .srow").slice(0, 8), { y: 8, step: 0.03 });
  }
  document.addEventListener("change", (e) => { if (e.target.id === "schedConf") setConf(e.target.value); });

  // ----- "Find a team" suggestions -----
  function teamSuggestions(q) {
    if (!q.trim()) return [];
    const nq = norm(q.trim());
    const counts = new Map();
    for (const g of schedGames) if (g.away) for (const t of [g.away, g.home]) { const k = gameTeamKey(g, t); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
    return state.teams
      .filter((t) => (state.league === "all" || t.league === state.league) && matchesQuery(teamText(t), q))
      .map((t) => ({ t, n: counts.get(t.key) || 0, starts: norm(t.name).startsWith(nq) || norm(t.short || "").startsWith(nq) ? 1 : 0, picked: schedTeams.includes(t.key) }))
      .sort((a, b) => b.starts - a.starts || (b.n > 0) - (a.n > 0) || a.t.name.length - b.t.name.length || a.t.name.localeCompare(b.t.name))
      .slice(0, 6);
  }
  function renderSuggest() {
    const box = $("#schedSuggest"), input = $("#schedFind");
    if (!box || !input) return;
    const list = teamSuggestions(schedQuery);
    if (sugIndex >= list.length) sugIndex = list.length - 1;
    box.innerHTML = list.length
      ? list.map(({ t, n, picked }, i) => `<li role="option" id="sug-${i}" class="sug" data-sched-pick="${esc(t.key)}" aria-selected="${i === sugIndex}">
          ${logoHTML(t)}<span class="sug-name">${esc(t.name)}<small>${esc(LEAGUES[t.league].short)}</small></span>
          <span class="sug-n">${picked ? "Added" : n ? plural(n, "game") : "No games"}</span></li>`).join("")
      : schedQuery.trim() ? `<li class="sug-empty" role="presentation">No team matches “${esc(schedQuery.trim())}”</li>` : "";
    const open = !!schedQuery.trim();
    box.hidden = !open;
    input.setAttribute("aria-expanded", String(open && list.length > 0));
    if (sugIndex >= 0 && list.length) input.setAttribute("aria-activedescendant", `sug-${sugIndex}`); else input.removeAttribute("aria-activedescendant");
  }
  function closeSuggest() {
    sugIndex = -1;
    const box = $("#schedSuggest");
    if (box) box.hidden = true;
    $("#schedFind")?.setAttribute("aria-expanded", "false");
    $("#schedFind")?.removeAttribute("aria-activedescendant");
  }
  function pickTeam(key) {
    if (!schedTeams.includes(key)) schedTeams.push(key);
    schedQuery = ""; sugIndex = -1;
    const input = $("#schedFind");
    if (input) input.value = "";
    closeSuggest();
    schedDay = TEAM_TAB; schedAll = false;
    refreshSchedule();
    fx("show", $$("#schedBody .srow, #schedBody .sched-team-head"), { y: 8, step: 0.03 });
  }
  document.addEventListener("input", (e) => {
    if (e.target.id !== "schedFind") return;
    schedQuery = e.target.value; sugIndex = schedQuery.trim() ? 0 : -1;
    renderSuggest();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.id !== "schedFind") return;
    const n = $$("#schedSuggest .sug").length;
    if (e.key === "ArrowDown" && n) { e.preventDefault(); sugIndex = (sugIndex + 1) % n; renderSuggest(); }
    else if (e.key === "ArrowUp" && n) { e.preventDefault(); sugIndex = (sugIndex - 1 + n) % n; renderSuggest(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const opt = $$("#schedSuggest .sug")[Math.max(0, sugIndex)];
      if (opt) pickTeam(opt.dataset.schedPick);
    } else if (e.key === "Escape" && (schedQuery || !$("#schedSuggest").hidden)) {
      e.preventDefault(); e.stopPropagation();
      schedQuery = ""; e.target.value = ""; closeSuggest();
    }
  });
  // Close the suggestions when focus or a click goes elsewhere.
  document.addEventListener("focusout", (e) => {
    if (e.target.id === "schedFind" && !e.relatedTarget?.closest?.(".sched-find")) setTimeout(() => { if (!$(".sched-find")?.contains(document.activeElement)) closeSuggest(); }, 120);
  });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".sched-find")) closeSuggest(); });

  function sortForShelf(games) {
    return [...games].sort((a, b) => notability(b) - notability(a) || a.date - b.date);
  }

  function pickHero(games) {
    const now = Date.now();
    const cands = games.filter((g) => !g.tba && g.away && g.state !== "post" && g.date - now < 4 * 86400000);
    if (!cands.length) return games.find((g) => g.tba) || null;
    const score = (g) =>
      (g.state === "in" ? 6 : 0) +
      (g.home.rank ? 4 - g.home.rank / 10 : 0) + (g.away.rank ? 4 - g.away.rank / 10 : 0) +
      (g.platforms.some((p) => BROADCAST.has(p.id)) ? 3 : 0) +
      (g.platforms.some((p) => NATIONAL.has(p.id)) ? 2 : 0) -
      (g.date - now) / 86400000;
    return [...cands].sort((a, b) => score(b) - score(a))[0];
  }

  function featureHTML(g, real) {
    gameById.set(g.id, g);
    const lg = LEAGUES[g.league];
    const pi = priceInfo(g.platforms);
    const rk = (t) => (t.rank ? `#${t.rank} ` : "");
    const title = g.away ? `${rk(g.away)}${g.away.short} ${g.neutral ? "vs." : "at"} ${rk(g.home)}${g.home.short}` : g.title;
    // Each team: logo, and while the game is live its score right underneath (leader bright, trailer dimmer).
    const live = g.state === "in" && g.away && g.away.score != null && g.home.score != null && g.away.score !== "" && g.home.score !== "";
    const lead = live ? Math.sign(Number(g.away.score) - Number(g.home.score)) : 0;
    const side = (tm, trailing) => `<div class="hero-team">${logoHTML(tm, { size: 170, eager: true })}${live ? `<span class="hero-score${trailing ? " trail" : ""}" aria-label="${esc(tm.short || tm.name)} ${esc(tm.score)}">${esc(tm.score)}</span>` : ""}</div>`;
    const logos = g.away ? `${side(g.away, lead < 0)}<span class="vs">${g.neutral ? "VS" : "@"}</span>${side(g.home, lead > 0)}` : "";
    const yours = includedForMe(g) ? g.platforms.filter((p) => myCoverage().has(p.id)) : [];
    const verdict = pi.kind === "free" ? `Free on ${pi.free.map((p) => p.name).join(", ")}`
      : yours.length ? `Yours on ${yours.map((p) => p.name).join(", ")}`
        : pi.kind === "paid" ? "Subscription needed" : "Broadcast TBA";
    const verdictCls = pi.kind === "free" ? "free" : yours.length ? "mine" : pi.kind === "paid" ? "paid" : "tba";
    const hero = `<article class="hero">
      <div class="hero-bg" style="${artBackground(g)}"></div>
      <div class="hero-logos">${logos}</div>
      <div class="hero-content">
        <span class="eyebrow" style="--c:${lg.color}"><span class="league-tag">${esc(lg.name)}</span>${g.state === "in" ? `<span class="pill live">Live</span>` : "<span>· Featured</span>"}</span>
        <h2>${esc(title)}</h2>
        ${eventTag(g, "event-tag hero-event")}
        <div class="meta">${esc(g.state === "in" ? g.statusText : whenLabel(g, "long"))}${g.note && !showcaseName(g) ? " · " + esc(g.note) : ""}${!g.away && g.subtitle ? " · " + esc(g.subtitle) : ""}</div>
        <div class="platform-row hero-platforms"><span class="pill hero-verdict ${verdictCls}">${esc(verdict)}</span>${platformTags(g.platforms, 4)}</div>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-game="${esc(g.id)}">${ICON.play}Where to watch</button>
          ${bigGames().length > 1 ? `<button type="button" class="btn btn-ghost hero-more" data-open-big>More big games <span class="hero-more-n">${bigGames().length}</span> <span aria-hidden="true">→</span></button>` : ""}
        </div>
      </div>
    </article>`;

    // Up Next rail: the most notable games in the next ~36 hours, in time order.
    const now = Date.now();
    let next = real.filter((g2) => g2.id !== g.id && g2.state !== "post" && g2.date - now < 36 * 3600000);
    next = sortForShelf(next).slice(0, 6).sort((a, b) => a.date - b.date);
    let rail = "";
    if (next.length) {
      rail = `<aside class="rail" aria-label="Up next">
        <div class="rail-head"><h2>Up Next</h2><span>Your local time</span></div>
        <ul class="rail-list">${next.map((x) => {
          gameById.set(x.id, x);
          const ch = x.platforms[0];
          return `<li><button type="button" class="rail-item" data-game="${esc(x.id)}" aria-label="${esc(matchupLabel(x))}, ${esc(whenLabel(x))}">
            <span class="rail-time">${x.state === "in" ? '<span style="color:var(--live)">Live</span>' : esc(clock(x))}<small>${esc(x.state === "in" ? x.statusText : dayLabel(x.date))}</small></span>
            <span style="min-width:0"><span class="rail-match" style="display:block">${x.away.rank ? `<span class="rk">${x.away.rank}</span>` : ""}${esc(x.away.short)} ${x.neutral ? "vs" : "@"} ${x.home.rank ? `<span class="rk">${x.home.rank}</span>` : ""}${esc(x.home.short)}</span>
            <span class="rail-sub">${ch ? `<span class="ptag ${ch.access}">${esc(ch.name)}</span>` : '<span class="ptag more">TBA</span>'}</span></span>
          </button></li>`;
        }).join("")}</ul>
      </aside>`;
    }
    return `<div class="feature"${rail ? "" : ' style="grid-template-columns:minmax(0,1fr)"'}>${hero}${rail}</div>`;
  }

  // ---------- teams ----------
  function renderTeams() {
    const el = $("#view-teams");
    let teams = state.teams.filter((t) => state.league === "all" || t.league === state.league);
    if (state.q) teams = teams.filter((t) => matchesQuery(teamText(t), state.q));
    const favs = teams.filter((t) => state.favs.has(t.key));
    const order = ["wnba", "unrivaled", "upshot", "fiba", "ncaa"];
    let html = `<div class="page-head"><h1>Every team, every channel</h1>
      <p class="dek">Follow your favorite teams across the WNBA, women's college basketball, Unrivaled, UpShot, and international basketball. Explore complete game schedules, find out where to watch, and see which broadcasts are free or require a subscription. Star your favorite teams to keep their upcoming games front and center on your home page.</p></div>`;
    if (favs.length) html += `${secHead("My Teams", plural(favs.length, "team"), { color: "var(--paid)" })}<div class="grid team-grid">${favs.map(teamTileHTML).join("")}</div>`;
    for (const lg of order) {
      const list = teams.filter((t) => t.league === lg).sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) continue;
      let az = "";
      if (lg === "ncaa" && list.length > 40) {
        const letters = [...new Set(list.map((t) => t.name[0].toUpperCase()))];
        az = `<nav class="az" aria-label="Jump to letter">${letters.map((l) => `<a href="#ncaa-${l}" data-anchor>${l}</a>`).join("")}</nav>`;
      }
      let lastLetter = "";
      const tiles = list.map((t) => {
        const l = t.name[0].toUpperCase();
        const anchor = lg === "ncaa" && az && l !== lastLetter ? ` id="ncaa-${l}"` : "";
        lastLetter = l;
        return anchor ? teamTileHTML(t).replace("<button", `<button${anchor}`) : teamTileHTML(t);
      }).join("");
      html += `<div data-brand-league="${lg}">${secHead(LEAGUES[lg].name, plural(list.length, "team"), { color: LEAGUES[lg].color })}${az}<div class="grid team-grid" style="padding-top:12px">${tiles}</div></div>`;
    }
    if (!teams.length) html += emptyHTML("No teams match", "Check the spelling, or set the league filter to All.");
    el.innerHTML = html;
  }

  // ---------- platforms ----------
  function platformCardHTML(p) {
    const leagues = Object.values(LEAGUES).filter((l) => leaguePlatformIds(l).includes(p.id));
    const count = state.games.filter((g) => !g.tba && upcoming(g) && g.platforms.some((x) => x.id === p.id)).length;
    return `<button type="button" class="plat" data-platform="${esc(p.name)}" aria-label="${esc(p.name)}, ${esc(ACCESS_LABEL[p.access])}, ${esc(p.price)}. ${count ? `See ${count} upcoming games` : "No listed games this week"}">
      <div class="plat-top"><h3>${esc(p.name)}</h3><span class="plat-badges">${p.access !== "free" && myCoverage().has(p.id) ? `<span class="access mine">${ICON.check}Yours</span>` : ""}<span class="access ${p.access}">${esc(ACCESS_LABEL[p.access])}</span></span></div>
      <div class="price">${esc(p.price)}</div>
      <p>${esc(p.note)}</p>
      ${leagues.length ? `<div class="leagues">${leagues.map((l) => `<span class="ltag" style="--c:${l.color}">${esc(l.short)}</span>`).join("")}</div>` : ""}
      <div class="count">${count ? `<span><b>${count}</b> ${count === 1 ? "game" : "games"} in the next ${DAYS_AHEAD} days</span><span aria-hidden="true">→</span>` : `<span>No listed games in the next ${DAYS_AHEAD} days</span>`}</div>
    </button>`;
  }

  function renderPlatforms() {
    const el = $("#view-platforms");
    let list = regionPlatforms();
    if (state.league !== "all") list = list.filter((p) => leaguePlatformIds(LEAGUES[state.league]).includes(p.id));
    if (state.q) list = list.filter((p) => matchesQuery(norm(`${p.name} ${p.note}`), state.q));
    list = list.filter(priceFilterPlatform);
    const groups = [
      ["Free to watch", "No subscription needed", (p) => isFreeAccess(p.access), "var(--free)"],
      ["Streaming subscriptions", "Monthly or seasonal plans", (p) => p.access === "paid", "var(--paid)"],
      ["Cable & live-TV networks", state.region === "ca" ? "A TV provider or the network's own streaming plan" : "Cable or a live-TV streaming service", (p) => p.access === "tv", "var(--tv)"],
    ];
    const ca = state.region === "ca";
    let html = `<div class="page-head"><h1>Streaming services &amp; prices${ca ? " in Canada" : ""}</h1>
      <p class="dek">Explore the TV channels and streaming services bringing women's basketball to fans across the U.S. and Canada. Compare subscription prices, discover free viewing options, and see how many games each service carries this week. Switch between the U.S. and Canada to find options available in your country, then select any service to view its upcoming games.</p>
      <button type="button" class="btn btn-ghost page-cta" data-open-services>${ICON.tv}${hasServices() ? "Edit my viewing options" : "My Viewing Options"}</button></div>`;
    if (state.price === "mine") html += mineBarHTML();
    for (const [title, sub, fn, color] of groups) {
      const g = list.filter(fn);
      if (!g.length) continue;
      html += `${secHead(title, sub, { color })}<div class="grid plat-grid">${g.map(platformCardHTML).join("")}</div>`;
    }
    if (!list.length) html += emptyHTML("No platforms match", "Clear the search or reset the filters.");
    html += ca
      ? `<div class="notice">Prices are approximate Canadian list prices in CAD and change often. TSN is the main home for women's basketball in Canada: the WNBA, NCAA and FIBA. ESPN, FOX, CBS and other U.S. networks aren't available in Canada, so some college games have no Canadian broadcast.</div>`
      : `<div class="notice">Prices are approximate U.S. list prices and change often. Many services offer free trials. A live-TV streaming service (YouTube TV, Hulu + Live TV, Sling TV, Fubo or DirecTV Stream) can replace cable for ESPN, FS1, TNT and conference networks.</div>`;
    el.innerHTML = html;
  }

  // ---------- render orchestration ----------
  let revealNext = true;    // animate the next drawn view in (first load, switching tabs)
  let guideRevealed = false;
  function render() {
    for (const v of ["home", "teams", "platforms"]) $("#view-" + v).hidden = v !== state.view;
    const showHomeExtras = state.view === "home" && !state.q;
    $$("[data-home-only]").forEach((el) => { el.hidden = !showHomeExtras; });
    $$("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === state.view;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    renderChips();
    renderStats();
    const findEl = document.activeElement?.id === "schedFind" ? document.activeElement : null;
    const caret = findEl ? findEl.selectionStart : 0;
    if (state.view === "home") renderHome();
    if (findEl && $("#schedFind")) { const f = $("#schedFind"); f.focus({ preventScroll: true }); f.setSelectionRange(caret, caret); renderSuggest(); }
    else if (state.view === "teams") renderTeams();
    else renderPlatforms();
    if ($("#modal").hidden) document.title = VIEW_TITLES[state.view];
    if (!state.loading && state.view === "home") requestAnimationFrame(() => { watchSchedule(); flushBeam(); ensureFavSchedules(); loadLastNight(); });
    queuePill();
    if (revealNext && !state.loading) {
      revealNext = false;
      fx("reveal", $("#view-" + state.view));
      if (!guideRevealed && state.view === "home") { guideRevealed = true; fx("reveal", $("#guide")); }    }
    requestAnimationFrame(() => { updateAllArrows(); updateBrand(); });
    renderTicker();
  }

  function renderChips() {
    const chips = [["all", "All leagues", ""], ...Object.values(LEAGUES).map((l) => [l.id, l.name, l.color])];
    $("#leagueChips").innerHTML = chips.map(([id, name, c]) =>
      `<button type="button" class="chip" data-league="${id}" aria-pressed="${state.league === id}"${c ? ` style="--c:${c}"` : ""}>${c ? '<span class="dot" aria-hidden="true"></span>' : ""}${esc(name)}</button>`).join("");
    $$("#priceSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.price === state.price)));
    $$("#regionSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.region === state.region)));
    const ft = $("#filterToggle");
    if (ft) {
      const bits = [state.price !== "all" && { free: "Free", paid: "Paid", mine: "Mine" }[state.price], state.region === "ca" && "CA"].filter(Boolean);
      ft.querySelector("span").textContent = bits.length ? `Filters · ${bits.join(", ")}` : "Filters";
      ft.classList.toggle("is-set", bits.length > 0);
    }
    fx("thumb", $("#priceSeg")); fx("thumb", $("#regionSeg"));
    document.documentElement.dataset.region = state.region;
  }

  function updateArrows(row) {
    const shelf = row.querySelector(".shelf");
    if (!shelf) return;
    const max = shelf.scrollWidth - shelf.clientWidth;
    row.querySelector(".shelf-arrow.prev")?.classList.toggle("can", shelf.scrollLeft > 4);
    row.querySelector(".shelf-arrow.next")?.classList.toggle("can", shelf.scrollLeft < max - 4);
  }
  const updateAllArrows = () => $$(".row").forEach(updateArrows);
  document.addEventListener("scroll", (e) => {
    if (e.target.classList?.contains("shelf")) updateArrows(e.target.parentElement);
  }, true);
  const placeThumbs = () => { fx("thumb", $("#priceSeg"), { animate: false }); fx("thumb", $("#regionSeg"), { animate: false }); };
  window.addEventListener("resize", () => requestAnimationFrame(() => { updateAllArrows(); placeThumbs(); }));
  document.fonts?.ready.then(placeThumbs);

  // ---------- league-aware logo ----------
  // The header pin (and tab icon) switch to a league's own ball. Leagues without one use the main ball.
  const BRAND = {
    default: { pin: "assets/brand/tipoff-pin.png", icon: "assets/brand/favicon-64.png?v=4" },
    ncaa: { pin: "assets/brand/tipoff-pin-ncaa.png", icon: "assets/brand/favicon-ncaa.png?v=2" },
    unrivaled: { pin: "assets/brand/tipoff-pin-unrivaled.png", icon: "assets/brand/favicon-unrivaled.png?v=2" },
    fiba: { pin: "assets/brand/tipoff-pin-fiba.png", icon: "assets/brand/favicon-fiba.png?v=2" },
    upshot: { pin: "assets/brand/tipoff-pin-fiba.png", icon: "assets/brand/favicon-fiba.png?v=2" }, // shares the panelled ball
  };
  for (const b of Object.values(BRAND)) { const i = new Image(); i.src = b.pin; } // preload so swaps are instant
  let brandModalLeague = null, brandNow = "default", brandTimer;

  function scrollLeague() {
    const probe = innerHeight * 0.42;
    for (const el of $$("[data-brand-league]")) {
      if (el.closest("[hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (!r.height) continue; // hidden at this screen size (phone-only / desktop-only rows)
      if (r.top <= probe && r.bottom >= probe) {
        if (el.dataset.brandLeague !== "mixed") return el.dataset.brandLeague;
        // A row with several leagues (phones' single "Coming up" row): follow the card nearest the middle.
        let best = null, bestD = Infinity;
        for (const c of $$("[data-card-league]", el)) {
          const cr = c.getBoundingClientRect();
          const d = Math.abs(cr.left + cr.width / 2 - innerWidth / 2);
          if (d < bestD) { bestD = d; best = c.dataset.cardLeague; }
        }
        return best;
      }
    }
    return null;
  }
  function updateBrand() {
    const league = (!$("#modal").hidden && brandModalLeague) || (state.league !== "all" ? state.league : scrollLeague());
    const key = BRAND[league] ? league : "default";
    if (key === brandNow) return;
    brandNow = key;
    const pin = $("#topbar [data-brand-pin]");
    const icon = $('link[rel="icon"]');
    if (icon) icon.href = BRAND[key].icon;
    pin.dataset.league = key;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { pin.src = BRAND[key].pin; return; }
    clearTimeout(brandTimer);
    pin.classList.add("swapping");
    brandTimer = setTimeout(() => { pin.src = BRAND[key].pin; pin.classList.remove("swapping"); }, 160);
  }
  let brandRaf = 0;
  // Capture phase so sideways scrolling inside a row counts too, not just scrolling the page.
  document.addEventListener("scroll", () => {
    if (brandRaf) return;
    brandRaf = requestAnimationFrame(() => { brandRaf = 0; updateBrand(); });
  }, { passive: true, capture: true });

  // ---------- modal ----------
  let lastFocus = null;
  let closeToken = 0;
  function openModal(html, title) {
    closeToken++;
    modalFresh = $("#modal").hidden;
    // Undo any closing animation still on the pop-up, so it always opens fully visible.
    fx("stopOut");
    for (const el of [$(".modal-sheet"), $(".modal-backdrop")]) { el.style.removeProperty("opacity"); el.style.removeProperty("transform"); }
    if ($("#modal").hidden) lastFocus = document.activeElement;
    $("#modalBody").innerHTML = html;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal-sheet").scrollTop = 0;
    if (title) document.title = `${title} | ${SITE}`;
    $(".modal-close").focus({ preventScroll: true });
  }
  function closeModal() {
    if ($("#modal").hidden) return;
    const token = ++closeToken;
    const out = fx("modalOut", $(".modal-sheet"), $(".modal-backdrop"));
    if (out) out.then(() => { if (token === closeToken) finishClose(); });
    else finishClose();
  }
  function finishClose() {
    if ($("#modal").hidden) return;
    $("#modal").hidden = true;
    document.body.style.overflow = "";
    document.title = VIEW_TITLES[state.view];
    brandModalLeague = null; modalKind = null; updateBrand();
    if (modalPushed && location.hash === modalUrlHash) {
      modalPushed = false; skipNextRoute = true;
      setTimeout(() => { skipNextRoute = false; }, 600);
      history.back();
    } else {
      modalPushed = false;
      setHash(state.view === "home" ? "" : state.view);
    }
    if (lastFocus && document.contains(lastFocus) && !lastFocus.closest("#ticker")) lastFocus.focus({ preventScroll: true });
    else if (lastFocus?.closest?.("#ticker")) lastFocus.blur();
    lastFocus = null;
    flushBeam();
    queuePill();
  }
  // Keep keyboard focus inside the dialog.
  $("#modal").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = $$('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])', $(".modal-sheet")).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function setHash(h) {
    const url = location.pathname + location.search + (h ? "#" + h : "");
    history.replaceState(null, "", url);
  }
  // Pop-ups get their own step in the browser history, so the phone's Back button (or swipe) closes
  // them instead of leaving the site. Switching from one pop-up to another reuses the same step.
  let modalPushed = false;    // the open pop-up owns a history step that Back should undo
  let modalFresh = false;     // this open started from a closed pop-up
  let modalUrlHash = "";      // the address the pop-up set, to tell if someone navigated away meanwhile
  let openVia = "";           // "nav": the address already changed (a link, Back/Forward); "load": arrived on this link
  let skipNextRoute = false;  // ignore the hashchange caused by our own history.back()
  function modalHash(h) {
    const url = location.pathname + location.search + "#" + h;
    if (openVia) { modalPushed = openVia === "nav"; openVia = ""; history.replaceState(null, "", url); }
    else if (($("#modal").hidden || modalFresh) && !modalPushed) { history.pushState(null, "", url); modalPushed = true; }
    else history.replaceState(null, "", url);
    modalUrlHash = location.hash;
  }

  function watchListHTML(platforms, expected, regionNote = "") {
    const noteHTML = regionNote ? `<p class="region-note"><span class="region-flag">Canada</span>${esc(regionNote)}</p>` : "";
    if (!platforms.length) return state.region === "ca"
      ? `<div class="verdict unknown">${ICON.info}<div>No Canadian broadcast listed<small>${esc(regionNote || "We haven't found a channel for this one in Canada yet.")}</small></div></div>`
      : `<div class="verdict unknown">${ICON.info}<div>No broadcast listed yet<small>Channels are often added a few days before tip-off. Check back closer to game day.</small></div></div>`;
    const pi = priceInfo(platforms);
    const cov = myCoverage();
    const mineList = pi.kind !== "free" && hasServices() ? platforms.filter((p) => cov.has(p.id)) : [];
    const pickPrompt = hasServices() ? "" : ` <button type="button" class="inline-link" data-open-services>Pick your services</button> to see if you already have one.`;
    const verdict = mineList.length
      ? `<div class="verdict mine">${ICON.check}<div>Included in your services<small>Watch on ${esc(mineList.map((p) => p.name).join(", "))}. <button type="button" class="inline-link" data-open-services>Edit my services</button></small></div></div>`
      : pi.kind === "free"
      ? `<div class="verdict free">${ICON.check}<div>You can watch this for free<small>On ${esc(pi.free.map((p) => p.name).join(", "))}.${pi.free.some((p) => p.access === "antenna") ? " Broadcast channels are free with an antenna, and often stream free in their apps." : ""}</small></div></div>`
      : pi.kind === "paid"
        ? `<div class="verdict paid">${ICON.card}<div>Subscription needed<small>No free option is listed for this ${expected ? "event" : "game"}. Many services offer a free trial.${hasServices() ? " None of your services carry it." : pickPrompt}</small></div></div>`
        : `<div class="verdict unknown">${ICON.info}<div>Check the broadcaster<small>We don't have pricing for this channel yet.</small></div></div>`;
    const rows = platforms.map((p) => `<div class="watch">
        <div class="wn">${esc(p.name)} <span class="access ${p.access}">${esc(p.access === "unknown" ? "Unknown" : ACCESS_LABEL[p.access])}</span>${p.access !== "free" && cov.has(p.id) ? `<span class="access mine">${ICON.check}You have this</span>` : ""}</div>
        <div class="wp">${esc(p.price)}</div>
        <div class="wnote">${esc(p.note)}</div>
        ${p.url ? `<a class="wlink" href="${esc(p.url)}" target="_blank" rel="noopener">Go to ${esc(p.name)} ${ICON.ext}</a>` : ""}
      </div>`).join("");
    return verdict + noteHTML + `<h3>Where to watch${state.region === "ca" ? " in Canada" : ""}</h3><div class="watch-list">${rows}</div>`;
  }

  // ---------- my services picker ----------
  const upcomingReal = () => state.games.filter((g) => !g.tba && g.state !== "post");
  /** How many upcoming games a set of services unlocks (free streams included). */
  function countWatchable(ids) {
    const cov = new Set(servicesFor(state.region).filter((s) => ids.has(s.id)).flatMap((s) => s.covers));
    return upcomingReal().filter((g) => canWatch(g, cov)).length;
  }
  function servicesHTML() {
    const list = servicesFor(state.region);
    const games = upcomingReal();
    const row = (s) => {
      const cov = new Set(s.covers);
      const n = games.filter((g) => g.platforms.some((p) => cov.has(p.id))).length;
      return `<label class="svc">
        <input type="checkbox" name="svc" value="${esc(s.id)}"${state.mine.has(s.id) ? " checked" : ""} />
        <span class="svc-box" aria-hidden="true">${ICON.check}</span>
        <span class="svc-text"><b>${esc(s.name)}</b><small>${esc(s.hint)}</small></span>
        <span class="svc-n">${n ? plural(n, "game") : "No games"}<small>next ${DAYS_AHEAD} days</small></span>
      </label>`;
    };
    const group = (id, title) => {
      const items = list.filter((s) => s.group === id);
      return items.length ? `<fieldset class="svc-group"><legend>${title}</legend>${items.map(row).join("")}</fieldset>` : "";
    };
    const n = countWatchable(state.mine);
    return `<div class="m-hero picker-hero svc-hero">
        <p class="kicker">My Viewing Options</p>
        <h2 class="m-title" id="modalTitle" style="text-align:left">See the games you can watch with the services you already have.</h2>
        <p class="picker-dek">Tick the TV and streaming services you already have, and The Tip-Off will show the games you can watch without paying for anything new. Free streams like YouTube are always included. Your picks are saved on this device only.</p>
      </div>
      <form class="m-body picker-body" id="svcForm">
        ${group("tv", state.region === "ca" ? "TV" : "TV &amp; live TV")}
        ${group("stream", "Streaming")}
        <div class="svc-actions">
          <button type="submit" class="btn btn-primary" data-svc-count>${svcButtonLabel(n)}</button>
          <button type="button" class="btn btn-ghost" data-svc-clear>Clear all</button>
        </div>
        <p class="m-small">Coverage is approximate. Channel lineups vary by plan, and blackouts can apply. ${state.region === "ca" ? "Showing Canadian services. Switch to US for U.S. services." : "Showing U.S. services. Switch to CA for Canadian services."}</p>
      </form>`;
  }
  const svcButtonLabel = (n) => `Show my ${plural(n, "game")}`;
  function openServices() {
    if (state.loading) { state.pendingOpen = { type: "services" }; return true; }
    brandModalLeague = null;
    openModal(servicesHTML(), "My Viewing Options: Women's Basketball Games You Can Watch");
    fx("sequence", $$("#svcForm .svc"));
    modalKind = "services";
    modalHash("services");
    updateBrand();
    return true;
  }
  const checkedServices = () => new Set($$('#svcForm input[name="svc"]:checked').map((i) => i.value));
  document.addEventListener("change", (e) => {
    if (e.target.name !== "svc") return;
    const btn = $("[data-svc-count]");
    if (!btn) return;
    const from = Number(btn.dataset.n ?? countWatchable(state.mine)), to = countWatchable(checkedServices());
    btn.dataset.n = to;
    fx("pop", e.target.nextElementSibling, 1.18);
    if (window.FX) fx("count", from, to, (n) => { btn.textContent = svcButtonLabel(n); });
    else btn.textContent = svcButtonLabel(to);
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "svcForm") return;
    e.preventDefault();
    const picked = checkedServices();
    for (const s of servicesFor(state.region)) picked.has(s.id) ? state.mine.add(s.id) : state.mine.delete(s.id);
    saveMine();
    if (hasServices()) state.price = "mine";
    else if (state.price === "mine") state.price = "all";
    closeModal();
    if (state.view === "teams") location.hash = "#home"; else render();
    toast(hasServices() ? "Showing games you can watch" : "Services cleared");
  });

  // ---------- add to calendar ----------
  const GAME_HOURS = 2; // calendar events block two hours from tip-off
  const siteURL = () => location.origin + location.pathname;
  const calStamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const canCalendar = (g) => !g.tba && g.timeValid !== false && g.state !== "post";
  function calEvent(g) {
    const matchup = g.away ? `${g.away.short} ${g.neutral ? "vs." : "at"} ${g.home.short}` : g.title;
    const chans = g.platforms.map((p) => p.name);
    const where = g.platforms.length
      ? g.platforms.map((p) => `${p.name} (${p.access === "unknown" ? "check provider" : ACCESS_LABEL[p.access]})`).join(", ")
      : "Channel not announced yet";
    const url = `${siteURL()}#game/${encodeURIComponent(g.id)}`;
    return {
      uid: g.id, url, start: g.date, end: new Date(+g.date + GAME_HOURS * 3600000),
      title: `${matchup}${chans.length ? ` · ${chans.slice(0, 2).join(", ")}` : ""}`,
      location: [g.venue, g.city].filter(Boolean).join(", "),
      details: `${LEAGUES[g.league].name}${showcaseName(g) ? ` · ${showcaseName(g)}` : ""}\nWhere to watch${state.region === "ca" ? " in Canada" : ""}: ${where}\n\nChannels can change close to game day. Latest: ${url}`,
    };
  }
  function googleCalURL(e) {
    const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${calStamp(e.start)}/${calStamp(e.end)}`, details: e.details, location: e.location });
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  function outlookCalURL(e) {
    const q = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: e.title, startdt: e.start.toISOString(), enddt: e.end.toISOString(), body: e.details, location: e.location });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
  }
  const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
  /** iCalendar lines may be at most 75 bytes; longer ones continue on a line starting with a space. */
  function icsFold(line) {
    const enc = new TextEncoder();
    let out = "", n = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (n + b > 74) { out += "\r\n "; n = 1; }
      out += ch; n += b;
    }
    return out;
  }
  function icsFile(events, calName) {
    const stamp = calStamp(new Date());
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tip-Off//Women's Basketball//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEsc(calName)}`];
    for (const e of events) {
      lines.push("BEGIN:VEVENT", `UID:${icsEsc(e.uid)}@the-tip-off`, `DTSTAMP:${stamp}`, `DTSTART:${calStamp(e.start)}`, `DTEND:${calStamp(e.end)}`,
        `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(e.details)}`, `URL:${e.url}`);
      if (e.location) lines.push(`LOCATION:${icsEsc(e.location)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }
  function downloadICS(games, calName, fileName) {
    const blob = new Blob([icsFile(games.map(calEvent), calName)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".ics";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  /** "Add to calendar" menu for one game: Google and Outlook links, or an .ics file for Apple Calendar and others. */
  function calMenuHTML(g) {
    if (!canCalendar(g)) return "";
    const e = calEvent(g);
    return `<details class="cal-menu">
      <summary class="btn btn-ghost">${ICON.cal}Add to calendar</summary>
      <div class="cal-pop" role="menu">
        <a role="menuitem" href="${esc(googleCalURL(e))}" target="_blank" rel="noopener">Google Calendar ${ICON.ext}</a>
        <a role="menuitem" href="${esc(outlookCalURL(e))}" target="_blank" rel="noopener">Outlook.com ${ICON.ext}</a>
        <button type="button" role="menuitem" data-ics="${esc(g.id)}">Apple Calendar or other <small>.ics file</small></button>
      </div>
    </details>`;
  }
  document.addEventListener("toggle", (e) => {
    if (e.target.classList?.contains("cal-menu") && e.target.open) fx("grow", e.target.querySelector(".cal-pop"));
  }, true);
  // Close an open calendar menu when clicking anywhere else.
  document.addEventListener("click", (e) => {
    for (const d of $$(".cal-menu[open]")) if (!d.contains(e.target) || e.target.closest(".cal-pop a, .cal-pop button")) d.open = false;
  });

  // ---------- free-games picker ----------
  let freeLeague = "all";
  let modalKind = null; // "free" while the picker is showing
  function freePickerHTML() {
    const all = freeGames();
    const leagues = Object.values(LEAGUES).filter((l) => all.some((g) => g.league === l.id));
    if (freeLeague !== "all" && !leagues.some((l) => l.id === freeLeague)) freeLeague = "all";
    const games = all.filter((g) => freeLeague === "all" || g.league === freeLeague);
    const byDay = new Map();
    for (const g of games) {
      const k = dayKey(g.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(g);
    }
    const chips = leagues.length > 1
      ? `<div class="picker-chips" role="group" aria-label="Filter free games by league">
          <button type="button" class="chip" data-free-league="all" aria-pressed="${freeLeague === "all"}">All <em>${all.length}</em></button>
          ${leagues.map((l) => `<button type="button" class="chip" data-free-league="${l.id}" aria-pressed="${freeLeague === l.id}" style="--c:${l.color}"><span class="dot" aria-hidden="true"></span>${esc(l.short)} <em>${all.filter((g) => g.league === l.id).length}</em></button>`).join("")}
        </div>` : "";
    const days = [...byDay].map(([k, list]) => `<h3>${esc(dayLabel(new Date(k), "long"))} <span class="picker-count">${plural(list.length, "game")}</span></h3>
        <div class="sched">${list.map(schedItemHTML).join("")}</div>`).join("");
    return `<div class="m-hero picker-hero">
        <h2 class="m-title" id="modalTitle" style="text-align:left">${plural(all.length, "free game")}</h2>
        <p class="picker-dek">No subscription needed. These games are on free streams or broadcast channels you can watch with an antenna. Times in ${esc(tzName())}.</p>
        ${chips}
      </div>
      <div class="m-body picker-body">${games.length ? days : `<div class="notice" style="margin:0">No free games in the next ${DAYS_AHEAD} days right now. Check back soon, since channels are added closer to game day.</div>`}
        <p class="m-small">Free means at least one option needs no subscription. Tap a game to see every way to watch it.</p>
      </div>`;
  }
  // ---------- big-games picker ----------
  /**
   * A big game is Top 25 vs. Top 25, or a ranked team on national TV. Ranked-vs-unranked games off
   * national TV, and unranked-vs-unranked games, don't count. College is the only league with rankings,
   * so other leagues (the WNBA) count on national TV alone. National TV is judged on the U.S. listing,
   * since that's what marks a game as marquee, so the list is the same whichever region is selected.
   */
  const onNationalTV = (g) => (g.us || g.platforms).some((p) => NATIONAL.has(p.id));
  function bigTier(g) {
    if (!g.away) return null;
    const a = g.away.rank, h = g.home.rank;
    if (a && h && a <= 10 && h <= 10) return { id: "top10", label: "Top 10 clash" };
    if (a && h) return { id: "both", label: "Both ranked" };
    if (showcaseName(g)) return { id: "event", label: showcaseName(g) };
    if (onNationalTV(g) && (a || h || g.league !== "ncaa")) return { id: "tv", label: "National TV" };
    return null;
  }
  const bigGames = () => state.games
    .filter((g) => !g.tba && g.state !== "post" && bigTier(g))
    .sort((a, b) => a.date - b.date);
  function bigPickerHTML() {
    const games = bigGames();
    const byDay = new Map();
    for (const g of games) {
      const k = dayKey(g.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(g);
    }
    // Within each day: biggest matchups first, then by tip-off time.
    const order = { top10: 0, both: 1, event: 2, tv: 3 };
    const bestRank = (g) => Math.min(g.home.rank || 99, g.away.rank || 99);
    for (const list of byDay.values()) list.sort((x, y) => order[bigTier(x).id] - order[bigTier(y).id] || bestRank(x) - bestRank(y) || x.date - y.date);
    const days = [...byDay].map(([k, list]) => `<h3>${esc(dayLabel(new Date(k), "long"))} <span class="picker-count">${plural(list.length, "game")}</span></h3>
        <div class="sched">${list.map((g) => schedItemHTML(g, { tag: true })).join("")}</div>`).join("");
    return `<div class="m-hero picker-hero big-hero">
        <h2 class="m-title" id="modalTitle" style="text-align:left">${plural(games.length, "big game")}</h2>
        <p class="picker-dek">Top 25 matchups (both teams ranked), showcase events and ranked teams on national TV over the next ${DAYS_AHEAD} days, so you can catch the best teams and star players. Biggest matchups are listed first each day. Times in ${esc(tzName())}.</p>
      </div>
      <div class="m-body picker-body">${games.length ? days : `<div class="notice" style="margin:0">No big games in the next ${DAYS_AHEAD} days right now. Check back soon.</div>`}
        <p class="m-small">Rankings are the AP Top 25 for college. More games with a ranked team are in the Ranked Teams in Action row on the home page. Tap a game to see every way to watch it.</p>
      </div>`;
  }
  // ---------- a row's "See all" list ----------
  let openRowKey = null;
  function rowPickerHTML(key) {
    const row = rowLists.get(key);
    if (!row) return "";
    const byDay = new Map();
    for (const g of [...row.games].sort((x, y) => x.date - y.date)) {
      const k = g.tba ? "tba" : dayKey(g.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(g);
    }
    const days = [...byDay].map(([k, list]) => `<h3>${k === "tba" ? "Dates to be announced" : esc(dayLabel(new Date(k), "long"))} <span class="picker-count">${plural(list.length, "game")}</span></h3>
        <div class="sched">${list.map(schedItemHTML).join("")}</div>`).join("");
    return `<div class="m-hero picker-hero row-hero"${row.color ? ` style="--c:${row.color}"` : ""}>
        <h2 class="m-title" id="modalTitle" style="text-align:left">${esc(row.title)}</h2>
        <p class="picker-dek">${plural(row.games.length, "game")}${row.sub ? ` · ${esc(row.sub)}` : ""}. Times in ${esc(tzName())}.</p>
      </div>
      <div class="m-body picker-body">${days}
        <p class="m-small">Tap a game to see every way to watch it.</p>
      </div>`;
  }
  function openRow(key, { keepScroll = false } = {}) {
    if (state.loading) { state.pendingOpen = { type: "row", id: key }; return true; }
    if (!rowLists.has(key) && !$("#view-home").innerHTML) renderHome();
    const html = rowPickerHTML(key);
    if (!html) return false;
    const sheet = $(".modal-sheet"), y = keepScroll ? sheet.scrollTop : 0;
    brandModalLeague = null;
    openModal(html, `${rowLists.get(key).title}: Women's Basketball Games`);
    if (!keepScroll) fx("sequence", $$("#modalBody .sched-item"));
    modalKind = "row"; openRowKey = key;
    if (keepScroll) sheet.scrollTop = y;
    modalHash("row/" + key);
    updateBrand();
    return true;
  }

  function openBigPicker({ keepScroll = false } = {}) {
    if (state.loading) { state.pendingOpen = { type: "big" }; return true; }
    const sheet = $(".modal-sheet"), y = keepScroll ? sheet.scrollTop : 0;
    brandModalLeague = null;
    openModal(bigPickerHTML(), "Big Women's Basketball Games This Week");
    if (!keepScroll) fx("sequence", $$("#modalBody .sched-item"));
    modalKind = "big";
    if (keepScroll) sheet.scrollTop = y;
    modalHash("big");
    updateBrand();
    return true;
  }

  function openFreePicker({ keepScroll = false } = {}) {
    if (state.loading) { state.pendingOpen = { type: "free" }; return true; }
    const sheet = $(".modal-sheet"), y = keepScroll ? sheet.scrollTop : 0;
    brandModalLeague = null;
    openModal(freePickerHTML(), "Free Women's Basketball Games to Watch");
    if (!keepScroll) fx("sequence", $$("#modalBody .sched-item"));
    modalKind = "free";
    if (keepScroll) sheet.scrollTop = y;
    modalHash("free");
    updateBrand();
    return true;
  }

  function openGame(id, { back = false } = {}) {
    const g = gameById.get(id) || state.games.find((x) => x.id === id);
    if (!g) return false;
    gameById.set(g.id, g);
    const lg = LEAGUES[g.league];
    let top;
    if (g.away) {
      const side = (t) => `<div class="m-team">${logoHTML(t)}<div class="nm">${t.rank ? `<span class="rk">#${t.rank}</span> ` : ""}${esc(t.name)}</div>${g.state !== "pre" && t.score !== "" ? `<div class="sc">${esc(t.score)}</div>` : ""}</div>`;
      top = `<h2 class="sr-only" id="modalTitle">${esc(matchupLabel(g))}</h2><div class="m-matchup">${side(g.away)}<div class="m-vs" aria-hidden="true">${g.neutral ? "VS" : "@"}</div>${side(g.home)}</div>`;
    } else {
      top = `<h2 class="m-title" id="modalTitle">${esc(g.title)}</h2><div class="m-when">${esc(g.subtitle || "")}</div>`;
    }
    const when = g.state === "in" ? `<span class="pill live">Live</span> ${esc(g.statusText)}` : g.state === "post" ? esc(g.statusText || "Final") : esc(whenLabel(g, "long"));
    const place = [g.venue, g.city].filter(Boolean).join(" · ");
    // Follow/unfollow both teams right from the game (also how My Teams cards lead to unfollowing).
    const followRow = g.away ? [g.away, g.home].filter((t) => t.id && teamByKey.has(`${g.league}:${t.id}`))
      .map((t) => favButton(`${g.league}:${t.id}`, t.short || t.name)).join("") : "";
    const teamBtns = g.away ? [g.away, g.home].filter((t) => t.id).map((t) => `<button type="button" class="btn btn-ghost" data-team="${esc(`${g.league}:${t.id}`)}">${esc(t.short)} schedule</button>`).join("") : "";
    const html = `<div class="m-hero" style="${artBackground(g)}">
        <span class="eyebrow" style="--c:${lg.color};justify-content:center"><span class="league-tag">${esc(lg.name)}</span></span>
        ${showcaseName(g) ? `<div class="m-event">${eventTag(g)}</div>` : ""}
        ${top}
        <div class="m-when"><strong>${when}</strong>${place ? esc(place) : ""}${g.note && !showcaseName(g) ? `<div>${esc(g.note)}</div>` : ""}</div>
      </div>
      <div class="m-body">
        ${back === "free" ? `<button type="button" class="btn btn-ghost picker-back" data-open-free>${ICON.left}All free games</button>` : ""}
        ${back === "big" ? `<button type="button" class="btn btn-ghost picker-back" data-open-big>${ICON.left}All big games</button>` : ""}
        ${back === "row" && rowLists.has(openRowKey) ? `<button type="button" class="btn btn-ghost picker-back" data-open-row="${esc(openRowKey)}">${ICON.left}All ${esc(rowLists.get(openRowKey).title)}</button>` : ""}
        ${followRow ? `<div class="m-follow" role="group" aria-label="My Teams">${followRow}</div>` : ""}
        ${watchListHTML(g.platforms, g.expected, g.regionNote)}
        ${g.expected ? `<p class="m-small">These are the channels expected under the league's TV deal. Exact channels for each game are confirmed closer to the date.</p>` : ""}
        <div class="m-foot">
          ${calMenuHTML(g)}
          <button type="button" class="btn btn-ghost" data-share>${ICON.share}Share</button>
          ${g.link ? `<a class="btn btn-ghost" href="${esc(g.link)}" target="_blank" rel="noopener">Game details ${ICON.ext}</a>` : ""}
          ${teamBtns}
        </div>
        <p class="m-small">Prices are approximate. Blackouts and regional restrictions may apply.</p>
      </div>`;
    brandModalLeague = g.league;
    openModal(html, `${matchupLabel(g)}: Where to Watch`);
    fx("sequence", $$("#modalBody .verdict, #modalBody .watch"));
    modalKind = null;
    updateBrand();
    modalHash("game/" + encodeURIComponent(g.id));
    return true;
  }

  /** The follow/unfollow toggle. With a team name it reads "Follow UConn" / "Following UConn". */
  function favButton(key, name = "") {
    const on = state.favs.has(key);
    const label = name ? (on ? `Following ${name}` : `Follow ${name}`) : (on ? "In My Teams" : "Add to My Teams");
    const aria = on ? `${name || "This team"} is in My Teams. Tap to unfollow.` : `Add ${name || "this team"} to My Teams`;
    return `<button type="button" class="btn btn-ghost ${on ? "is-on" : ""}" data-fav="${esc(key)}"${name ? ` data-fav-name="${esc(name)}"` : ""} aria-pressed="${on}" aria-label="${esc(aria)}">${ICON.star}${esc(label)}</button>`;
  }

  async function openTeam(key) {
    const t = teamByKey.get(key) || state.teams.find((x) => x.key === key);
    if (!t) return false;
    const lg = LEAGUES[t.league];
    const head = `<div class="m-hero" style="background: ${tint(hex(t.color), 45)}">
        <div class="m-matchup"><div class="m-team" style="width:auto">${logoHTML(t)}<h2 class="nm" id="modalTitle" data-team-title="${esc(key)}" style="font-size:26px;margin:0">${esc(t.name)}</h2>
        <span class="eyebrow" style="--c:${lg.color}"><span class="league-tag">${esc(lg.name)}</span></span></div></div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">${favButton(key)}<button type="button" class="btn btn-ghost" data-share>${ICON.share}Share</button></div>
      </div>`;
    const docTitle = `${t.name} Schedule & Where to Watch`;
    brandModalLeague = t.league;
    modalHash("team/" + encodeURIComponent(key));

    if (!t.espnId) {
      const plats = state.region === "ca"
        ? lg.platformsCA.map((id) => platformById(id, "ca")).filter(Boolean)
        : dedupePlatforms(lg.platforms.map((id) => PLATFORMS.find((p) => p.id === id).name));
      const caNote = state.region === "ca" && t.league === "unrivaled" ? "Unrivaled hasn't announced a Canadian broadcaster for 2027. TSN+ carried it in Canada in 2025." : "";
      const events = state.games.filter((g) => g.league === t.league);
      openModal(head + `<div class="m-body">
        <p class="m-small" style="margin:0 0 16px;font-size:14px;color:var(--muted)">${esc(lg.season)} Game-by-game schedules aren't published in a feed yet, so here's where ${esc(lg.name)} games usually air.</p>
        ${watchListHTML(plats, true, caNote)}
        ${events.length ? `<h3>Announced</h3><div class="sched">${events.map(schedItemHTML).join("")}</div>` : ""}
      </div>`, docTitle);
      updateBrand();
      return true;
    }

    queueMicrotask(updateBrand);
    openModal(head + `<div class="m-body"><h3>Schedule</h3><div class="skel" style="height:64px;margin-bottom:8px"></div><div class="skel" style="height:64px;margin-bottom:8px"></div><div class="skel" style="height:64px"></div></div>`, docTitle);
    let games = scheduleCache.get(key);
    if (!games) {
      try {
        const j = await getJSON(`${ESPN}/${lg.espn}/teams/${t.espnId}/schedule`);
        games = (j.events || []).map((e) => parseEspnEvent(e, t.league)).filter(Boolean);
        scheduleCache.set(key, games);
      } catch { games = null; }
    }
    if ($("#modal").hidden || $("#modalTitle")?.dataset.teamTitle !== key) return true; // user moved on
    const body = $(".m-body");
    if (!games) {
      body.innerHTML = `<div class="notice" style="margin:0">Couldn't load this schedule. <button type="button" class="btn btn-ghost" data-team="${esc(key)}">Try again</button></div>`;
      return true;
    }
    const future = games.filter((g) => g.state !== "post").sort((a, b) => a.date - b.date);
    const past = games.filter((g) => g.state === "post").sort((a, b) => b.date - a.date);
    const pool = future.length ? future : past;
    const counts = new Map();
    for (const g of pool) for (const p of g.platforms) {
      const k = p.id === "local" ? "local:" + p.name : p.id;
      const c = counts.get(k) || { p, n: 0 }; c.n++; counts.set(k, c);
    }
    const freeGames = pool.filter((g) => priceInfo(g.platforms).kind === "free").length;
    const summary = [...counts.values()].sort((a, b) => b.n - a.n).map(({ p, n }) => `<span class="ptag ${p.access}">${esc(p.name)} <em>${n}</em></span>`).join("");
    const word = future.length ? "upcoming" : "listed";
    let html = "";
    if (pool.length) {
      html += freeGames
        ? `<div class="verdict free">${ICON.check}<div>${freeGames} of ${pool.length} ${word} games are free to watch<small>Based on channels announced so far. More are added closer to game day.</small></div></div>`
        : `<div class="verdict paid">${ICON.card}<div>All ${pool.length} ${word} games need a subscription<small>Based on channels announced so far. More are added closer to game day.</small></div></div>`;
      html += `<h3>Channels this season</h3><div class="summary-chips">${summary || '<span class="ptag more">No channels announced yet</span>'}</div>`;
    }
    const calGames = future.filter(canCalendar);
    if (calGames.length) {
      html += `<div class="team-cal"><button type="button" class="btn btn-ghost" data-ics-team="${esc(key)}">${ICON.cal}Add ${calGames.length === 1 ? "this game" : `all ${calGames.length} games`} to my calendar</button>
        <span>Downloads a calendar file with each game's time and channels. Open it to add the games to Apple Calendar or Outlook, or import it into Google Calendar.</span></div>`;
    }
    if (future.length) html += `<h3>Upcoming · times in ${esc(tzName())}</h3><div class="sched">${future.map(schedItemHTML).join("")}</div>`;
    else html += `<div class="notice" style="margin:18px 0 0">No upcoming games listed. ${esc(lg.season)}</div>`;
    if (past.length) html += `<details class="past"><summary>Past results (${past.length})</summary><div class="sched" style="margin-top:10px">${past.map(schedItemHTML).join("")}</div></details>`;
    body.innerHTML = html;
    return true;
  }

  function tzName() {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "your time zone";
    } catch { return "your time zone"; }
  }

  function schedItemHTML(g, { tag = false } = {}) {
    gameById.set(g.id, g);
    const rk = (x) => (x.rank ? `<span class="rk">${x.rank}</span>` : "");
    const tier = tag ? bigTier(g) : null;
    const d = g.date;
    const dateStr = g.tba ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const opp = g.away ? `${rk(g.away)}${esc(g.away.short)} ${g.neutral ? "vs" : "@"} ${rk(g.home)}${esc(g.home.short)}` : esc(g.title);
    const res = g.state === "post" ? `<span class="res">Final · ${esc(g.away.short)} ${esc(g.away.score)}, ${esc(g.home.short)} ${esc(g.home.score)}</span>` : "";
    const k = priceInfo(g.platforms).kind;
    const badge = g.state === "post" ? "" : k === "free" ? `<span class="access free">Free</span>`
      : includedForMe(g) ? `<span class="access mine">${ICON.check}Yours</span>` : k === "paid" ? `<span class="access paid">Paid</span>` : "";
    return `<button type="button" class="sched-item" data-game="${esc(g.id)}">
      <div class="d"><b>${esc(dateStr)}</b>${esc(timeLabel(g))}</div>
      <div class="o"><span>${opp}${tier && tier.id !== "event" ? ` <span class="big-tag ${tier.id}">${esc(tier.label)}</span>` : ""}</span>${showcaseName(g) ? `<span>${eventTag(g)}</span>` : ""}${res}<div class="platform-row">${badge}${platformTags(g.platforms, 4)}</div></div>
    </button>`;
  }

  // ---------- bottom ticker ----------
  let tickerSig = "";
  function tickerGames() {
    const now = Date.now();
    const today = dayKey(new Date());
    const games = state.games.filter((g) => !g.tba && g.away && (state.league === "all" || g.league === state.league));
    const live = games.filter((g) => g.state === "in");
    const finals = games.filter((g) => g.state === "post" && dayKey(g.date) === today).sort((a, b) => b.date - a.date);
    const soon = games.filter((g) => g.state === "pre" && g.date - now < 30 * 3600000).sort((a, b) => a.date - b.date);
    // Last night's finals worth a look: your teams, upsets, thrillers, Top 25.
    const ids = new Set(games.map((g) => g.id));
    const yest = (lastNight || []).filter((g) => !ids.has(g.id) && (state.league === "all" || g.league === state.league))
      .map((g) => ({ g, tag: lastNightTag(g) })).filter((x) => x.tag)
      .sort((x, y) => y.tag.score - x.tag.score).slice(0, 15).map((x) => x.g);
    return [...live, ...finals.slice(0, 20), ...yest, ...soon.slice(0, 30)];
  }
  const tickerTeam = (t, bold) => `${t.rank ? `<span class="rk">${t.rank}</span> ` : ""}<span class="${bold ? "w" : ""}">${esc(t.abbr || t.short)}</span>`;

  function tickerGameHTML(g, focusable) {
    gameById.set(g.id, g);
    const tab = focusable ? "" : ' tabindex="-1"';
    const lgTag = state.league === "all" ? `<span class="t-tag" style="--c:${LEAGUES[g.league].color}">${esc(LEAGUES[g.league].short)}</span>` : "";
    if (g.state === "pre") {
      const when = (dayKey(g.date) === dayKey(new Date()) ? "" : g.date.toLocaleDateString(undefined, { weekday: "short" }) + " ") + timeLabel(g);
      const ch = g.platforms[0];
      return `<button type="button" class="t-item" data-game="${esc(g.id)}"${tab} aria-label="${esc(matchupLabel(g))}, ${esc(when)}">${lgTag}<b>${esc(when)}</b>
        ${tickerTeam(g.away)} ${g.neutral ? "vs" : "@"} ${tickerTeam(g.home)}
        ${ch ? `<span class="t-ch ${ch.access}">${esc(ch.name)}</span>` : ""}</button>`;
    }
    const yesterday = g.state === "post" && dayKey(g.date) < dayKey(new Date());
    const tag = yesterday ? lastNightTag(g) : null;
    const status = g.state === "in" ? `<span class="t-live">${esc(g.statusText || "Live")}</span>`
      : yesterday ? `<span class="t-final">Last night${tag && tag.k !== "rk" ? ` · ${esc(tag.label)}` : ""}</span>` : `<span class="t-final">Final</span>`;
    const fin = g.state === "post";
    return `<button type="button" class="t-item" data-game="${esc(g.id)}"${tab} aria-label="${esc(matchupLabel(g))}: ${esc(g.away.score)} to ${esc(g.home.score)}">${lgTag}${status}
      ${tickerTeam(g.away, fin && g.away.winner)} <b>${esc(g.away.score)}</b>
      ${tickerTeam(g.home, fin && g.home.winner)} <b>${esc(g.home.score)}</b></button>`;
  }
  function tickerNewsHTML(n, focusable) {
    return `<a class="t-item t-news" href="${esc(n.url)}" target="_blank" rel="noopener"${focusable ? "" : ' tabindex="-1"'}>
      <span class="t-tag" style="--c:${LEAGUES[n.league].color}">${esc(LEAGUES[n.league].short)}</span>${esc(n.headline)} <span class="t-arrow" aria-hidden="true">↗</span></a>`;
  }
  function renderTicker() {
    const ticker = $("#ticker");
    if (state.loading) { ticker.hidden = true; return; }
    const games = tickerGames();
    const news = (state.news || []).filter((n) => state.league === "all" || n.league === state.league);
    const sig = state.league + "|" + games.map((g) => `${g.id}:${g.state}:${g.away.score}-${g.home.score}:${g.statusText}`).join(",") + "|" + news.map((n) => n.id).join(",");
    if (sig === tickerSig) return;
    tickerSig = sig;
    ticker.hidden = false;
    const items = [];
    let ni = 0;
    games.forEach((g, i) => {
      items.push({ g });
      if ((i + 1) % 4 === 0 && ni < news.length) items.push({ n: news[ni++] });
    });
    while (ni < news.length && items.length < 12) items.push({ n: news[ni++] });
    const track = $("#tickerTrack");
    if (!items.length) {
      const lg = state.league !== "all" ? LEAGUES[state.league] : null;
      track.innerHTML = `<div class="ticker-group"><span class="t-empty">${lg ? `No ${esc(lg.name)} games or headlines right now. ${esc(lg.season)}` : "No games or headlines right now."}</span></div>`;
      track.style.animation = "none";
      return;
    }
    track.style.animation = "";
    const group = (focusable) => items.map((it) => (it.g ? tickerGameHTML(it.g, focusable) : tickerNewsHTML(it.n, focusable))).join("");
    track.innerHTML = `<div class="ticker-group">${group(true)}</div><div class="ticker-group" aria-hidden="true">${group(false)}</div>`;
    const width = track.firstElementChild.getBoundingClientRect().width;
    track.style.setProperty("--dur", Math.max(20, width / 55) + "s");
  }
  function setTickerPaused(paused) {
    $("#ticker").classList.toggle("paused", paused);
    const b = $("#tickerPause");
    b.setAttribute("aria-pressed", String(paused));
    b.setAttribute("aria-label", paused ? "Play ticker" : "Pause ticker");
    try { localStorage.setItem("fc-ticker-paused", paused ? "1" : "0"); } catch { /* storage unavailable */ }
  }
  $("#tickerPause").addEventListener("click", () => setTickerPaused(!$("#ticker").classList.contains("paused")));
  try { if (localStorage.getItem("fc-ticker-paused") === "1") setTickerPaused(true); } catch { /* storage unavailable */ }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }
  async function shareCurrent() {
    const url = location.href;
    const title = document.title;
    try {
      if (navigator.share && matchMedia("(hover: none)").matches) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch { /* user cancelled or clipboard blocked */ }
  }

  // ---------- routing ----------
  // #home | #teams | #platforms | #team/<key> | #game/<id>
  let keepQueryOnRoute = false;
  function route(e) {
    if (e && skipNextRoute) { skipNextRoute = false; return; }
    openVia = e ? "nav" : "load";
    const h = decodeURIComponent((location.hash || "").slice(1));
    const [head, ...rest] = h.split("/");
    const arg = rest.join("/");
    if (head === "row") {
      if (!$("#view-" + state.view).innerHTML) render();
      if (!openRow(arg)) setHash(state.view === "home" ? "" : state.view);
      return;
    }
    if (head === "free" || head === "big" || head === "services") {
      if (!$("#view-" + state.view).innerHTML) render();
      ({ free: openFreePicker, big: openBigPicker, services: openServices })[head]();
      return;
    }
    if (head === "team" || head === "game") {
      state.pendingOpen = { type: head, id: arg };
      if (!state.loading) processPendingOpen();
      if (!$("#view-" + state.view).innerHTML) render();
      return;
    }
    openVia = "";
    const next = ["home", "teams", "platforms"].includes(head) ? head : "home";
    if (!$("#modal").hidden) {
      modalPushed = false;
      if (next === state.view) return void closeModal(); // Back from a pop-up: close it, keep the page as it was
      $("#modal").hidden = true; document.body.style.overflow = "";
    }
    if (next !== state.view && !keepQueryOnRoute) { state.q = ""; $("#search").value = ""; }
    keepQueryOnRoute = false;
    const changed = next !== state.view;
    state.view = next;
    if (changed) revealNext = true;
    render();
    if (changed) window.scrollTo({ top: 0 });
  }
  function processPendingOpen() {
    const p = state.pendingOpen;
    state.pendingOpen = null;
    if (!p) return;
    if (p.type === "free") { openFreePicker(); return; }
    if (p.type === "big") { openBigPicker(); return; }
    if (p.type === "services") { openServices(); return; }
    if (p.type === "row") { if (!openRow(p.id)) setHash(state.view === "home" ? "" : state.view); return; }
    const ok = p.type === "team" ? teamByKey.has(p.id) && (openTeam(p.id), true) : openGame(p.id);
    if (!ok) { openVia = ""; setHash(state.view === "home" ? "" : state.view); toast(p.type === "game" ? "That game is no longer listed" : "Team not found"); }
  }

  // ---------- events ----------
  let searchTimer;
  function setRegion(r) {
    if (r === state.region || !REGIONS[r]) return;
    state.region = r;
    if (state.price === "mine" && !hasServices()) state.price = "all"; // services are picked per country
    try { localStorage.setItem("fc-region", r); } catch { /* storage unavailable */ }
    const url = new URL(location.href);
    if (url.searchParams.has("region")) { url.searchParams.set("region", r); history.replaceState(null, "", url.pathname + url.search + url.hash); }
    render();
    fx("swapIn", $("#view-" + state.view));
    if (!$("#modal").hidden) route(); // redraw an open game or team with the new region's channels
    toast(`Showing where to watch in ${REGIONS[r].name}`);
  }

  function setQuery(q) {
    if (!state.q && q.trim()) window.scrollTo({ top: 0 });
    state.q = q.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const url = new URL(location.href);
      if (state.q) url.searchParams.set("q", state.q); else url.searchParams.delete("q");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      render();
    }, 140);
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-game],[data-team],[data-league],[data-price],[data-platform],[data-close],[data-scroll],[data-fav],[data-follow],[data-share],[data-retry],[data-anchor],[data-open-free],[data-open-row],[data-free-league],[data-region],[data-open-big],[data-open-services],[data-ics],[data-ics-team],[data-svc-clear],[data-sched-day],[data-sched-all],[data-sched-pick],[data-sched-remove],[data-sched-clear],[data-sched-conf-clear]");
    if (!t) return;
    if (t.dataset.openServices !== undefined) { ev.preventDefault(); return void openServices(); }
    if (t.dataset.schedDay) {
      const prev = schedDay;
      schedDay = t.dataset.schedDay === TEAM_TAB ? TEAM_TAB : Number(t.dataset.schedDay); schedAll = false;
      refreshSchedule(`[data-sched-day="${schedDay}"]`);
      if (prev !== schedDay) {
        // The team tab sits first, so it counts as "to the left" of every day.
        const pos = (v) => (v === TEAM_TAB ? -Infinity : v);
        fx("slideRows", $$("#schedule .srow"), pos(schedDay) > pos(prev) ? 1 : -1);
        fx("pop", $(`[data-sched-day="${schedDay}"]`), 1.05);
      }
      return;
    }
    if (t.dataset.schedPick) return void pickTeam(t.dataset.schedPick);
    if (t.dataset.schedConfClear !== undefined) return void setConf("");
    if (t.dataset.schedRemove) {
      schedTeams = schedTeams.filter((k) => k !== t.dataset.schedRemove);
      refreshSchedule();
      $("#schedFind")?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.schedClear !== undefined) {
      schedTeams = []; if (schedDay === TEAM_TAB) schedDay = null;
      refreshSchedule();
      $("#schedFind")?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.schedAll !== undefined) {
      const before = $$("#schedule .srow").length;
      schedAll = true; refreshSchedule();
      fx("show", $$("#schedule .srow").slice(before), { y: 8, step: 0.03 });
      return;
    }
    if (t.dataset.svcClear !== undefined) {
      $$('#svcForm input[name="svc"]').forEach((i) => { i.checked = false; });
      $("[data-svc-count]").textContent = svcButtonLabel(countWatchable(new Set()));
      return;
    }
    if (t.dataset.ics) {
      const g = gameById.get(t.dataset.ics);
      if (g) { downloadICS([g], SITE, `${matchupLabel(g)} ${ymd(g.date)}`); toast("Calendar file downloaded"); }
      return;
    }
    if (t.dataset.icsTeam) {
      const team = teamByKey.get(t.dataset.icsTeam);
      const key = t.dataset.icsTeam;
      const save = () => {
        const games = (scheduleCache.get(key) || []).filter((g) => g.state !== "post" && canCalendar(g)).sort((a, b) => a.date - b.date);
        if (team && games.length) { downloadICS(games, `${team.name} · ${SITE}`, `${team.name} schedule`); toast(`${plural(games.length, "game")} saved to a calendar file`); }
        else toast("No upcoming games to add yet");
      };
      if (scheduleCache.has(key) || !team) return void save();
      getJSON(`${ESPN}/${LEAGUES[team.league].espn}/teams/${team.espnId}/schedule`)
        .then((j) => scheduleCache.set(key, (j.events || []).map((e) => parseEspnEvent(e, team.league)).filter(Boolean)))
        .catch(() => scheduleCache.set(key, []))
        .finally(save);
      return;
    }
    if (t.dataset.price === "mine" && !hasServices()) return void openServices();
    if (t.dataset.close !== undefined) return closeModal();
    if (t.dataset.share !== undefined) return shareCurrent();
    if (t.dataset.retry !== undefined) { t.disabled = true; return refreshLive(true); }
    if (t.dataset.anchor !== undefined) {
      ev.preventDefault();
      const target = document.getElementById(t.getAttribute("href").slice(1));
      if (target) { target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
      return;
    }
    if (t.dataset.region) return void setRegion(t.dataset.region);
    if (t.dataset.openFree !== undefined) { ev.preventDefault(); return void openFreePicker(); }
    if (t.dataset.openBig !== undefined) { ev.preventDefault(); return void openBigPicker(); }
    if (t.dataset.openRow) { ev.preventDefault(); return void openRow(t.dataset.openRow); }
    if (t.dataset.freeLeague) { freeLeague = t.dataset.freeLeague; return void openFreePicker({ keepScroll: true }); }
    if (t.dataset.game) { ev.preventDefault(); return void openGame(t.dataset.game, { back: t.closest("#modal") ? modalKind : null }); }
    if (t.dataset.team) { ev.preventDefault(); return void openTeam(t.dataset.team); }
    if (t.dataset.league || t.dataset.price) {
      if (t.dataset.league) state.league = t.dataset.league;
      if (t.dataset.price) state.price = t.dataset.price;
      if (t.tagName === "A") { // footer links: go to the games view, then scroll up
        ev.preventDefault();
        state.q = ""; $("#search").value = "";
        if (state.view !== "home") { state.view = "home"; setHash(""); }
        render(); window.scrollTo({ top: 0 });
        return;
      }
      render();
      fx("swapIn", $("#view-" + state.view));
      return;
    }
    if (t.dataset.platform) {
      closeModal();
      $("#search").value = t.dataset.platform;
      state.q = t.dataset.platform;
      if (state.view !== "home") { keepQueryOnRoute = true; location.hash = "#home"; }
      else { render(); window.scrollTo({ top: 0 }); }
      return;
    }
    if (t.dataset.follow) {
      const mt = $("#mtFind"); if (mt) mt.value = "";
      const key = t.dataset.follow;
      state.favs.add(key); saveFavs();
      toast(`Following ${teamByKey.get(key)?.short || "team"}`);
      render();
      fx("show", $$(".myteams .mt-card, .myteams .mt-add"), { y: 8, step: 0.04 });
      pendingBeam.add(key); flushBeam();
      return;
    }
    if (t.dataset.fav) {
      const k = t.dataset.fav;
      state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k);
      state.favs.has(k) ? pendingBeam.add(k) : pendingBeam.delete(k);
      saveFavs();
      t.outerHTML = favButton(k, t.dataset.favName || "");
      fx("pop", $(`[data-fav="${CSS.escape(k)}"] svg`), 1.4);
      $(`[data-fav="${CSS.escape(k)}"]`)?.focus();
      toast(state.favs.has(k) ? "Added to My Teams" : "Removed from My Teams");
      render();
      return;
    }
    if (t.dataset.scroll) {
      const shelf = t.parentElement.querySelector(".shelf");
      shelf.scrollBy({ left: Number(t.dataset.scroll) * shelf.clientWidth * 0.85, behavior: "smooth" });
    }
  });

  // Phones: the search button opens the search box across the header row (CSS hides it otherwise).
  function openSearch() {
    $("#topbar").classList.add("searching");
    $("[data-search-open]").setAttribute("aria-expanded", "true");
    $("#search").focus();
  }
  function closeSearch({ focusButton = true } = {}) {
    $("#topbar").classList.remove("searching");
    $("[data-search-open]").setAttribute("aria-expanded", "false");
    if ($("#search").value) { $("#search").value = ""; setQuery(""); }
    if (focusButton) $("[data-search-open]").focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-search-open]")) openSearch();
    else if (e.target.closest("[data-search-close]")) closeSearch();
  });
  // Leaving an empty search box (tapping elsewhere, or focus moving on) folds it back into the button.
  document.addEventListener("pointerdown", (e) => {
    if ($("#topbar").classList.contains("searching") && !$("#search").value && !e.target.closest("#topbar")) closeSearch({ focusButton: false });
  }, { passive: true });
  $("#search").addEventListener("blur", () => setTimeout(() => {
    if (!$("#search").value && !$(".search").contains(document.activeElement)) closeSearch({ focusButton: false });
  }, 150));

  // Top search: as you type it suggests teams; picking one jumps into the Schedule with that team's
  // games (today's answer first). "Search everything" (or Enter with no team) shows the results page.
  let headIndex = -1;
  const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  function renderHeadSuggest() {
    const box = $("#headSuggest"), input = $("#search"), q = input.value.trim();
    const list = teamSuggestions(q);
    const all = list.length; // index of the "search everything" option
    if (headIndex > all) headIndex = all;
    box.innerHTML = q ? list.map(({ t: team, n }, i) => `<li role="option" id="hs-${i}" class="sug" data-head-pick="${esc(team.key)}" aria-selected="${i === headIndex}">
        ${logoHTML(team)}<span class="sug-name">${esc(team.name)}<small>${esc(LEAGUES[team.league].short)}</small></span>
        <span class="sug-n">${n ? plural(n, "game") : "No games"}</span></li>`).join("")
      + `<li role="option" id="hs-${all}" class="sug sug-all" data-head-search aria-selected="${headIndex === all}">${SEARCH_ICON}<span class="sug-name">Search everything for “${esc(q)}”</span><span class="sug-n">Games &amp; services</span></li>` : "";
    box.hidden = !q;
    input.setAttribute("aria-expanded", String(!!q));
    if (q && headIndex >= 0) input.setAttribute("aria-activedescendant", `hs-${headIndex}`); else input.removeAttribute("aria-activedescendant");
  }
  function closeHeadSuggest() {
    headIndex = -1;
    $("#headSuggest").hidden = true;
    $("#search").setAttribute("aria-expanded", "false");
    $("#search").removeAttribute("aria-activedescendant");
  }
  function runSearch() {
    closeHeadSuggest();
    setQuery($("#search").value);
    $("#main").focus({ preventScroll: true });
  }
  function goToTeam(key) {
    closeHeadSuggest();
    $("#search").value = "";
    $("#search").blur();
    $("#topbar").classList.remove("searching");
    $("[data-search-open]").setAttribute("aria-expanded", "false");
    if (state.q) {
      state.q = "";
      const url = new URL(location.href); url.searchParams.delete("q");
      history.replaceState(null, "", url.pathname + url.search);
    }
    if (state.view !== "home") { state.view = "home"; setHash(""); }
    schedTeams = [key]; schedDay = TEAM_TAB; schedAll = false;
    render();
    requestAnimationFrame(() => {
      const s = $("#schedule");
      if (!s) return;
      s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      fx("show", $$("#schedBody .team-today, #schedBody .srow").slice(0, 6), { y: 10, step: 0.04 });
    });
  }
  document.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-head-pick]");
    if (pick) return void goToTeam(pick.dataset.headPick);
    if (e.target.closest("[data-head-search]")) runSearch();
  });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".search")) closeHeadSuggest(); }, { passive: true });

  $("#search").addEventListener("input", (e) => {
    headIndex = e.target.value.trim() ? 0 : -1;
    renderHeadSuggest();
    if (!e.target.value.trim() && state.q) setQuery(""); // clearing the box goes back to the home page
  });
  $("#search").addEventListener("keydown", (e) => {
    const n = $$("#headSuggest .sug").length;
    const open = !$("#headSuggest").hidden && n;
    if (open && e.key === "ArrowDown") { e.preventDefault(); headIndex = (headIndex + 1) % n; renderHeadSuggest(); return; }
    if (open && e.key === "ArrowUp") { e.preventDefault(); headIndex = (headIndex - 1 + n) % n; renderHeadSuggest(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = open ? $$("#headSuggest .sug")[Math.max(0, headIndex)] : null;
      if (opt?.dataset.headPick) goToTeam(opt.dataset.headPick); else if (e.target.value.trim()) runSearch();
      return;
    }
    if (e.key === "Escape" && open) { e.preventDefault(); closeHeadSuggest(); return; }
    if (e.key === "Escape" && e.target.value) { e.preventDefault(); e.target.value = ""; setQuery(""); }
    else if (e.key === "Escape" && $("#topbar").classList.contains("searching")) { e.preventDefault(); closeSearch(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) return closeModal();
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if (e.key === "/" && !typing && $("#modal").hidden) { e.preventDefault(); $("#search").focus(); }
  });
  window.addEventListener("hashchange", route);

  // Phones: price and region live behind one "Filters" button so the header is a row shorter.
  $("#filterToggle")?.addEventListener("click", () => {
    const f = $("#filters"), open = !f.classList.contains("open");
    f.classList.toggle("open", open);
    $("#filterToggle").setAttribute("aria-expanded", String(open));
    if (open) { fx("thumb", $("#priceSeg"), { animate: false }); fx("thumb", $("#regionSeg"), { animate: false }); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-more-watch]");
    if (!b) return;
    const box = b.closest(".more-watch"), open = !box.classList.contains("open");
    box.classList.toggle("open", open);
    b.setAttribute("aria-expanded", String(open));
    b.firstChild.textContent = open ? "Show less " : "More to watch ";
    if (open) fx("show", $$(".more-watch-body .shelf-block", box), { y: 8, step: 0.05 });
  });

  // Phones: slide the header away while scrolling down, bring it back when scrolling up.
  let lastY = scrollY;
  window.addEventListener("scroll", () => {
    const y = scrollY, bar = $("#topbar");
    const tuck = innerWidth <= 760 && y > lastY && y > 200 && document.activeElement !== $("#search");
    if (Math.abs(y - lastY) > 6) { bar.classList.toggle("tucked", tuck); lastY = y; }
  }, { passive: true });

  // ---------- boot ----------
  $("#year").textContent = new Date().getFullYear();
  const initialQ = new URLSearchParams(location.search).get("q") || "";
  $("#search").value = initialQ; // also overrides any value the browser restored
  if (initialQ) $("#topbar").classList.add("searching"); // a ?q= link shows its search on phones too
  state.q = initialQ.trim();
  {
    const h = decodeURIComponent((location.hash || "").slice(1)).split("/")[0];
    if (["teams", "platforms"].includes(h)) state.view = h;
  }
  state.teams = loadTeams();
  route();

  async function refreshLive(initial = false) {
    const [{ games, failed }, news] = await Promise.all([loadScoreboards(), initial || !state.news.length ? loadNews() : Promise.resolve(state.news)]);
    if (failed && state.games.some((g) => !g.tba)) return; // keep last good data on a failed refresh
    state.liveFailed = failed;
    state.games = [...games, ...curatedGames()];
    state.news = news;
    const wasLoading = state.loading;
    state.loading = false;
    if ($("#modal").hidden || wasLoading) render(); else { renderTicker(); renderStats(); if (modalKind === "free") openFreePicker({ keepScroll: true }); if (modalKind === "row") openRow(openRowKey, { keepScroll: true }); if (modalKind === "big") openBigPicker({ keepScroll: true }); }
    if (wasLoading) processPendingOpen();
  }
  refreshLive(true);

  setInterval(() => { if (!document.hidden && !state.loading) refreshLive(); }, 120000);
  setInterval(async () => {
    if (document.hidden || state.loading) return;
    const news = await loadNews();
    if (news.length) { state.news = news; renderTicker(); }
  }, 15 * 60000);
})();
