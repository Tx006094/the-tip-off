/*
 * Platform catalog: where games air, and whether you have to pay.
 *
 * access:
 *   "free"     – free to stream, no subscription (may need a free account)
 *   "antenna"  – free over-the-air broadcast (antenna), often also on a free app
 *   "paid"     – needs a streaming subscription
 *   "tv"       – a cable network: needs cable/satellite OR a live-TV streaming service
 *
 * regions: where the service is available ("us", "ca"). Defaults to ["us"].
 * ca:      optional overrides (price, note, url) shown to Canadian viewers.
 *
 * Prices are approximate list prices (USD for the U.S., CAD for Canada) and change often.
 * Always confirm on the provider site.
 */

const LIVE_TV_OPTIONS =
  "Cable/satellite, or a live-TV streaming service like YouTube TV, Hulu + Live TV, Sling TV, Fubo or DirecTV Stream";

const PLATFORMS = [
  // ---------- Free ----------
  { id: "abc", name: "ABC", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air. Also streams in the ESPN app with a TV login or ESPN Unlimited.",
    url: "https://abc.com", match: [/^abc$/i] },
  { id: "cbs", name: "CBS", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air. Also streams on Paramount+ (paid).",
    url: "https://www.cbs.com", match: [/^cbs$/i] },
  { id: "nbc", name: "NBC", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air. Also streams on Peacock (paid).",
    url: "https://www.nbc.com", match: [/^nbc$/i] },
  { id: "fox", name: "FOX", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air. Some games also stream free on Tubi or the FOX Sports app with a TV login.",
    url: "https://www.foxsports.com", match: [/^fox$/i] },
  { id: "ion", name: "ION", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air. Home of WNBA Friday Night Spotlight.",
    url: "https://iontelevision.com", match: [/^ion/i] },
  { id: "cw", name: "The CW", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air and in the free CW app.",
    url: "https://www.cwtv.com", match: [/^(the )?cw\b/i] },
  { id: "youtube", name: "YouTube", access: "free", price: "Free",
    note: "Free to stream on the league or school channel.",
    url: "https://www.youtube.com", match: [/^youtube$/i], regions: ["us", "ca"] },
  { id: "victory", name: "Victory+", access: "free", price: "Free (ad-supported)",
    note: "Free ad-supported sports streaming app with a premium no-ads option.",
    url: "https://www.victoryplus.com", match: [/victory\+/i] },
  { id: "scripps", name: "Scripps Sports", access: "free", price: "Free (FAST channel)",
    note: "Free ad-supported streaming channel plus local over-the-air stations.",
    url: "https://scrippssports.com", match: [/scripps/i] },
  { id: "summit", name: "Summit League Network", access: "free", price: "Free",
    note: "The Summit League's free streaming network.",
    url: "https://thesummitleague.org", match: [/summit league network/i], regions: ["us", "ca"] },
  { id: "nec", name: "NEC Front Row", access: "free", price: "Free",
    note: "The Northeast Conference's free streaming platform.",
    url: "https://northeastconference.org", match: [/nec front row/i], regions: ["us", "ca"] },
  { id: "swac", name: "SWAC TV", access: "free", price: "Free",
    note: "The SWAC's streaming network. Most games are free.",
    url: "https://swac.org", match: [/swac tv/i], regions: ["us", "ca"] },
  { id: "meac", name: "MEAC Network", access: "free", price: "Free",
    note: "The MEAC's digital network. Most games are free.",
    url: "https://meacsports.com", match: [/meac/i], regions: ["us", "ca"] },
  { id: "local", name: "Local TV", access: "antenna", price: "Free with antenna",
    note: "A local broadcast station. Free over-the-air in that team's market.",
    url: null, match: [] },

  // ---------- Paid streaming ----------
  { id: "espnplus", name: "ESPN+", access: "paid", price: "~$12.99/mo",
    note: "Included in ESPN Select and ESPN Unlimited plans. Also in the Disney+/Hulu bundle.",
    url: "https://plus.espn.com", match: [/^espn\+$/i, /espn select/i] },
  { id: "espnunl", name: "ESPN Unlimited", access: "paid", price: "~$29.99/mo",
    note: "ESPN's direct-to-consumer plan. Streams ESPN, ESPN2, ESPNU, SECN, ACCN, ABC and ESPN+.",
    url: "https://www.espn.com/espn/unlimited", match: [/espn unlimited/i] },
  { id: "prime", name: "Prime Video", access: "paid", price: "Included w/ Prime (~$14.99/mo)",
    note: "Included with an Amazon Prime membership.",
    url: "https://www.amazon.com/primevideo", match: [/prime video/i, /^amazon/i], regions: ["us", "ca"],
    ca: { price: "Included w/ Prime (~$9.99/mo CAD)", note: "Included with Amazon Prime in Canada. Has exclusive Canadian rights to select WNBA games.", url: "https://www.amazon.ca/primevideo" } },
  { id: "peacock", name: "Peacock", access: "paid", price: "~$10.99/mo",
    note: "NBC's streaming service. Carries NBC games and exclusives.",
    url: "https://www.peacocktv.com", match: [/peacock/i] },
  { id: "paramount", name: "Paramount+", access: "paid", price: "~$7.99/mo",
    note: "Streams CBS and CBS Sports Network events.",
    url: "https://www.paramountplus.com", match: [/paramount/i] },
  { id: "hbomax", name: "HBO Max", access: "paid", price: "~$10.99/mo",
    note: "Streams TNT Sports games, including Unrivaled.",
    url: "https://www.hbomax.com", match: [/hbo ?max/i, /^max$/i] },
  { id: "leaguepass", name: "WNBA League Pass", access: "paid", price: "Season pass (free trial often offered)",
    note: "Out-of-market WNBA games. Local and national games are usually blacked out.",
    url: "https://www.wnba.com/leaguepass", match: [/league pass/i], regions: ["us", "ca"],
    ca: { note: "Out-of-market WNBA games. In Canada, Toronto Tempo games and games on TSN or Prime Video are usually blacked out." } },
  { id: "b1gplus", name: "B1G+", access: "paid", price: "~$14.99/mo",
    note: "Big Ten's streaming service for non-televised games.",
    url: "https://www.bigtenplus.com", match: [/b1g\+|big ten plus/i] },
  { id: "flo", name: "FloSports", access: "paid", price: "~$29.99/mo",
    note: "FloHoops subscription. Carries CAA and other conference games.",
    url: "https://www.flosports.tv", match: [/flo(sports|hoops)?/i], regions: ["us", "ca"],
    ca: { price: "~$29.99/mo USD", note: "FloHoops subscription, also sold in Canada. Carries CAA and other conference games." } },
  { id: "mwplus", name: "MW+", access: "paid", price: "See provider",
    note: "Mountain West streaming for games not on national TV.",
    url: "https://themw.com", match: [/^mw\+$/i] },
  { id: "midco", name: "Midco Sports Plus", access: "paid", price: "See provider",
    note: "Midco's regional sports streaming service.",
    url: "https://www.midcosportsplus.com", match: [/midco/i] },
  { id: "patriot", name: "Patriot League Network", access: "paid", price: "Included with ESPN+",
    note: "Patriot League games stream on ESPN+.",
    url: "https://patriotleague.org", match: [/patriot league/i] },
  { id: "courtside", name: "Courtside 1891", access: "paid", price: "Pay-per-event or pass",
    note: "FIBA's official streaming platform for international games.",
    url: "https://www.courtside1891.basketball", match: [/courtside/i] },

  // ---------- Cable / live TV ----------
  { id: "espn", name: "ESPN", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ". Or stream with ESPN Unlimited.",
    url: "https://www.espn.com/watch", match: [/^espn$/i] },
  { id: "espn2", name: "ESPN2", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ". Or stream with ESPN Unlimited.",
    url: "https://www.espn.com/watch", match: [/^espn ?2$/i] },
  { id: "espnu", name: "ESPNU", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ". Or stream with ESPN Unlimited.",
    url: "https://www.espn.com/watch", match: [/^espnu$/i] },
  { id: "espnews", name: "ESPNews", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ".",
    url: "https://www.espn.com/watch", match: [/espnews/i] },
  { id: "secn", name: "SEC Network", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ". Or stream with ESPN Unlimited.",
    url: "https://www.espn.com/watch", match: [/^sec ?n(etwork)?$/i, /^secn$/i] },
  { id: "secnplus", name: "SEC Network+", access: "tv", price: "TV login or ESPN plan",
    note: "Streams in the ESPN app with a TV provider login that includes SEC Network, or an ESPN plan.",
    url: "https://www.espn.com/watch", match: [/^secn\+$|sec network\+/i] },
  { id: "accn", name: "ACC Network", access: "tv", price: "Live TV or ESPN Unlimited",
    note: LIVE_TV_OPTIONS + ". Or stream with ESPN Unlimited.",
    url: "https://www.espn.com/watch", match: [/^acc ?n(etwork)?$/i] },
  { id: "accnx", name: "ACCNX", access: "tv", price: "TV login or ESPN plan",
    note: "Streams in the ESPN app with a TV provider login that includes ACC Network, or an ESPN plan.",
    url: "https://www.espn.com/watch", match: [/accnx|acc network extra/i] },
  { id: "btn", name: "Big Ten Network", access: "tv", price: "Live TV subscription",
    note: LIVE_TV_OPTIONS + ".",
    url: "https://btn.com", match: [/^btn$|big ten network/i] },
  { id: "fs1", name: "FS1", access: "tv", price: "Live TV subscription",
    note: LIVE_TV_OPTIONS + ". Or the Fox One streaming service.",
    url: "https://www.foxsports.com", match: [/^fs ?1$/i, /fox one/i] },
  { id: "cbssn", name: "CBS Sports Network", access: "tv", price: "Live TV subscription",
    note: LIVE_TV_OPTIONS + ". Some events also stream on Paramount+.",
    url: "https://www.cbssports.com", match: [/cbssn|cbs sports network/i] },
  { id: "tnt", name: "TNT", access: "tv", price: "Live TV or HBO Max",
    note: LIVE_TV_OPTIONS + ". Also streams on HBO Max.",
    url: "https://www.tntdrama.com", match: [/^tnt$/i] },
  { id: "trutv", name: "truTV", access: "tv", price: "Live TV or HBO Max",
    note: LIVE_TV_OPTIONS + ". Also streams on HBO Max.",
    url: "https://www.trutv.com", match: [/trutv/i] },
  { id: "nbatv", name: "NBA TV", access: "tv", price: "Live TV subscription",
    note: LIVE_TV_OPTIONS + ".",
    url: "https://www.nba.com/watch", match: [/nba ?tv/i] },
  { id: "usa", name: "USA Network", access: "tv", price: "Live TV subscription",
    note: LIVE_TV_OPTIONS + ".",
    url: "https://www.usanetwork.com", match: [/^usa( net(work)?)?$/i] },
  { id: "rsn", name: "Regional Sports Network", access: "tv", price: "Live TV / regional plan",
    note: "A regional sports network. Usually needs cable or that network's own streaming plan.",
    url: null, match: [/spectrum sports|monumental|nbc sports (bay|chicago|ca)|bally|fanduel sports|marquee|yes network|msg|sportsnet|mass ?mutual|nesn|altitude|root sports|space city|chsn/i] },
];

// ---------- Canada ----------
PLATFORMS.push(
  { id: "ctv", name: "CTV", access: "antenna", price: "Free with antenna",
    note: "Free over-the-air across Canada. Airs select Toronto Tempo games, which also stream on Crave.",
    url: "https://www.ctv.ca", match: [/^ctv$/i], regions: ["ca"] },
  { id: "cbc", name: "CBC / CBC Gem", access: "antenna", price: "Free",
    note: "Canada's Olympic broadcaster through 2032. Free over-the-air on CBC and free to stream on CBC Gem.",
    url: "https://www.cbc.ca/sports", match: [/^cbc/i], regions: ["ca"] },
  { id: "tsn", name: "TSN", access: "tv", price: "TV provider or TSN plan (~$29.99/mo)",
    note: "On Bell, Rogers, Telus, Videotron and other TV providers, or stream it with a TSN subscription. Home of the WNBA, NCAA and FIBA in Canada.",
    url: "https://www.tsn.ca", match: [/^tsn ?\d?$/i], regions: ["ca"] },
  { id: "tsnplus", name: "TSN+", access: "paid", price: "In TSN plan (~$29.99/mo) or ~$8/mo add-on",
    note: "TSN's streaming-only games. Included with a TSN subscription. TV subscribers who already get TSN can add it for about $8 a month.",
    url: "https://www.tsn.ca/subscribe", match: [/^tsn\+$/i], regions: ["ca"] },
  { id: "crave", name: "Crave", access: "paid", price: "Crave subscription",
    note: "Bell's streaming service. Streams CTV's select Toronto Tempo games.",
    url: "https://www.crave.ca", match: [/^crave$/i], regions: ["ca"] },
);

const REGIONS = {
  us: { id: "us", name: "United States", short: "US", currency: "USD" },
  ca: { id: "ca", name: "Canada", short: "CA", currency: "CAD" },
};
const inRegion = (p, region) => (p.regions || ["us"]).includes(region);
/** A platform as a viewer in `region` should see it (Canadian price/notes applied). */
const forRegion = (p, region) => (region === "ca" && p.ca ? { ...p, ...p.ca } : p);
const platformById = (id, region = "us") => {
  const p = PLATFORMS.find((x) => x.id === id);
  return p ? forRegion(p, region) : null;
};

const ACCESS_LABEL = {
  free: "Free",
  antenna: "Free · Antenna",
  paid: "Subscription",
  tv: "Cable / Live TV",
};

const isFreeAccess = (a) => a === "free" || a === "antenna";

/** Map a raw broadcast name (e.g. "ESPN+", "KARE 11") to a platform entry. */
function resolvePlatform(rawName) {
  const name = String(rawName || "").trim();
  if (!name) return null;
  for (const p of PLATFORMS) {
    if (p.match.some((re) => re.test(name))) return { ...p, raw: name };
  }
  // Local stations: call letters (KARE, WTHR), "Channel 13", "CW26", etc.
  if (/^(k|w)[a-z]{2,3}\b/i.test(name) || /channel \d+|\b(tv|cw) ?\d+\b|\bcw\d+/i.test(name)) {
    const local = PLATFORMS.find((p) => p.id === "local");
    return { ...local, name, raw: name };
  }
  return {
    id: "other-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name, raw: name, access: "unknown", price: "Check provider",
    note: "We don't have pricing info for this one yet. Check the provider.",
    url: null,
  };
}
