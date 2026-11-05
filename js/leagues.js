/*
 * League catalog.
 * - WNBA and NCAA D1 schedules load live from ESPN's public scoreboard feed.
 * - UpShot, Unrivaled and FIBA/Olympic games aren't in that feed, so they are listed here by hand.
 *   Update `events` below as schedules are announced.
 */

const LEAGUES = {
  wnba: {
    id: "wnba", name: "WNBA", short: "WNBA", color: "#ff6a13",
    espn: "wnba",
    season: "Regular season runs May–September. Playoffs and Finals in the fall.",
    // Platforms that regularly carry games (national deal from 2026 + local/League Pass).
    platforms: ["abc", "espn", "espn2", "espnunl", "nbc", "peacock", "prime", "cbs", "ion", "leaguepass", "local"],
    // Canada: Bell Media (TSN, CTV, Crave) multi-year deal from 2026, plus Prime Video exclusives.
    platformsCA: ["tsn", "tsnplus", "ctv", "crave", "prime", "leaguepass"],
  },
  ncaa: {
    id: "ncaa", name: "Division I College", short: "NCAA D1", color: "#3b82f6",
    espn: "womens-college-basketball",
    season: "Season runs November–April. March Madness ends in early April.",
    platforms: ["espnplus", "espn", "espn2", "espnu", "abc", "secn", "secnplus", "accn", "accnx", "btn", "b1gplus", "fox", "fs1", "cbs", "cbssn", "nbc", "peacock", "flo", "youtube"],
    // Canada: TSN holds NCAA rights and carries ESPN's college games, mostly on TSN+.
    platformsCA: ["tsn", "tsnplus", "flo", "youtube"],
  },
  fiba: {
    id: "fiba", name: "Olympic / FIBA", short: "FIBA", color: "#22c55e",
    season: "International windows run year-round. The next Olympics is LA 2028.",
    platforms: ["courtside", "youtube", "espnplus", "nbc", "peacock"],
    // Canada: Bell Media has exclusive FIBA and Canada Basketball rights; CBC has the Olympics through 2032.
    platformsCA: ["tsn", "tsnplus", "cbc"],
  },
  upshot: {
    id: "upshot", name: "UpShot League", short: "UpShot", color: "#e11d48",
    season: "Spring/summer pro league in the Southeast. Season 1 tipped off May 15, 2026.",
    platforms: ["youtube", "scripps", "local"],
    platformsCA: ["youtube"],
  },
  unrivaled: {
    id: "unrivaled", name: "Unrivaled", short: "Unrivaled", color: "#a855f7",
    season: "3-on-3 winter league. Season three tips off January 8, 2027, on a multi-city tour.",
    platforms: ["tnt", "trutv", "hbomax"],
    platformsCA: [], // no Canadian broadcaster announced for 2027
  },
};

/* Teams for leagues that don't come from ESPN. */
const CURATED_TEAMS = {
  upshot: [
    { name: "Charlotte Crown", color: "6d28d9" },
    { name: "Greensboro Groove", color: "0ea5e9" },
    { name: "Jacksonville Waves", color: "14b8a6" },
    { name: "Savannah Steel", color: "64748b" },
  ],
  unrivaled: [
    { name: "Breeze BC", color: "38bdf8" },
    { name: "Hive BC", color: "facc15" },
    { name: "Laces BC", color: "f472b6" },
    { name: "Lunar Owls BC", color: "312e81" },
    { name: "Mist BC", color: "5eead4" },
    { name: "Phantom BC", color: "111827" },
    { name: "Rose BC", color: "be123c" },
    { name: "Vinyl BC", color: "7c2d12" },
  ],
  fiba: [
    { name: "USA", color: "1d4ed8" },
    { name: "Australia", color: "15803d" },
    { name: "France", color: "1e3a8a" },
    { name: "Spain", color: "b91c1c" },
    { name: "Canada", color: "dc2626" },
    { name: "Japan", color: "e11d48" },
    { name: "Belgium", color: "111827" },
    { name: "China", color: "dc2626" },
    { name: "Germany", color: "0f172a" },
    { name: "Nigeria", color: "16a34a" },
  ],
};

/*
 * Hand-entered events. `date` is ISO. `tba: true` means the exact matchups or time
 * aren't announced yet; platforms are the expected carriers based on the league's deal.
 */
const CURATED_EVENTS = [
  {
    id: "unr-2027-open", league: "unrivaled", tba: true,
    date: "2027-01-08T19:00:00-05:00",
    title: "Unrivaled 2027 Opening Night",
    subtitle: "Los Angeles · matchups TBA",
    home: "Unrivaled", away: null,
    platforms: ["tnt", "trutv", "hbomax"],
    expected: true,
    link: "https://www.unrivaled.basketball",
  },
  {
    id: "unr-2027-final-reg", league: "unrivaled", tba: true,
    date: "2027-03-05T19:00:00-05:00",
    title: "Unrivaled Regular-Season Finale",
    subtitle: "Four games · matchups TBA",
    home: "Unrivaled", away: null,
    platforms: ["tnt", "trutv", "hbomax"],
    expected: true,
    link: "https://www.unrivaled.basketball",
  },
  {
    id: "upshot-s2", league: "upshot", tba: true,
    date: "2027-05-14T19:00:00-04:00",
    title: "UpShot League Season 2",
    subtitle: "Opening date and schedule TBA",
    home: "UpShot League", away: null,
    platforms: ["youtube", "scripps", "local"],
    expected: true,
    link: "https://en.wikipedia.org/wiki/UpShot_League",
  },
  {
    id: "wnba-2027", league: "wnba", tba: true,
    date: "2027-05-14T19:00:00-04:00",
    title: "WNBA 2027 Season Tip-Off",
    subtitle: "Schedule TBA. Live games show here once it's out.",
    home: "WNBA", away: null,
    platforms: ["abc", "espn", "nbc", "peacock", "prime", "cbs", "ion", "leaguepass"],
    expected: true,
    link: "https://www.wnba.com/schedule",
  },
  {
    id: "la28", league: "fiba", tba: true,
    date: "2028-07-15T12:00:00-07:00",
    title: "LA 2028 Olympic Women's Basketball",
    subtitle: "Olympic tournament in Los Angeles",
    home: "USA", away: null,
    platforms: ["nbc", "peacock"],
    expected: true,
    link: "https://la28.org",
  },
  {
    id: "fiba-windows", league: "fiba", tba: true,
    date: "2027-02-01T12:00:00Z",
    title: "FIBA Women's International Windows",
    subtitle: "Qualifiers & continental cups · dates TBA",
    home: "FIBA", away: null,
    platforms: ["courtside", "youtube"],
    expected: true,
    link: "https://www.fiba.basketball",
  },
];
