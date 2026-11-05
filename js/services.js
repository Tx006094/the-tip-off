/*
 * "My services": the subscriptions and setups a viewer can tick, and which channels each one unlocks.
 *
 * A game counts as watchable when any of its channels is a free stream (always included), or is
 * covered by one of the viewer's services. `covers` lists platform ids from js/platforms.js.
 * Coverage is approximate: channel lineups vary by plan and blackouts may apply.
 */

const ANTENNA_US = ["abc", "cbs", "nbc", "fox", "ion", "cw", "local"];
const CABLE_US = ["espn", "espn2", "espnu", "espnews", "secn", "secnplus", "accn", "accnx", "btn", "fs1", "cbssn", "tnt", "trutv", "nbatv", "usa", "rsn"];

const SERVICES = [
  // ---------- United States ----------
  { id: "antenna", group: "tv", regions: ["us"], name: "TV antenna",
    hint: "ABC, CBS, NBC, FOX, ION, The CW and local stations, free over the air.",
    covers: ANTENNA_US },
  { id: "cable", group: "tv", regions: ["us"], name: "Cable, satellite or live-TV streaming",
    hint: "YouTube TV, Hulu + Live TV, Fubo, DirecTV Stream or Sling. Includes ESPN, FS1, conference networks and local channels. Lineups vary by plan.",
    covers: [...ANTENNA_US, ...CABLE_US] },
  { id: "espnunl", group: "stream", regions: ["us"], name: "ESPN Unlimited",
    hint: "ESPN, ESPN2, ESPNU, SEC Network, ACC Network, ABC and ESPN+.",
    covers: ["espnunl", "espn", "espn2", "espnu", "espnews", "secn", "secnplus", "accn", "accnx", "abc", "espnplus", "patriot"] },
  { id: "espnplus", group: "stream", regions: ["us"], name: "ESPN+",
    hint: "Also counts ESPN Select. The most Division I women's college games of any service.",
    covers: ["espnplus", "patriot"] },
  { id: "prime", group: "stream", regions: ["us", "ca"], name: "Prime Video",
    hint: "Included with Amazon Prime.", covers: ["prime"] },
  { id: "peacock", group: "stream", regions: ["us"], name: "Peacock",
    hint: "Includes live NBC games.", covers: ["peacock", "nbc"] },
  { id: "paramount", group: "stream", regions: ["us"], name: "Paramount+",
    hint: "Includes live CBS games.", covers: ["paramount", "cbs"] },
  { id: "hbomax", group: "stream", regions: ["us"], name: "HBO Max",
    hint: "Streams TNT and truTV games, including Unrivaled.", covers: ["hbomax", "tnt", "trutv"] },
  { id: "foxone", group: "stream", regions: ["us"], name: "Fox One",
    hint: "Streams FOX, FS1 and Big Ten Network.", covers: ["fox", "fs1", "btn"] },
  { id: "leaguepass", group: "stream", regions: ["us", "ca"], name: "WNBA League Pass",
    hint: "Out-of-market WNBA games. Blackouts apply.", covers: ["leaguepass"] },
  { id: "b1gplus", group: "stream", regions: ["us"], name: "B1G+",
    hint: "Big Ten games that aren't on TV.", covers: ["b1gplus"] },
  { id: "flo", group: "stream", regions: ["us", "ca"], name: "FloSports",
    hint: "CAA and other conference games.", covers: ["flo"] },
  { id: "courtside", group: "stream", regions: ["us"], name: "Courtside 1891",
    hint: "FIBA's international games.", covers: ["courtside"] },

  // ---------- Canada ----------
  { id: "ca-antenna", group: "tv", regions: ["ca"], name: "TV antenna",
    hint: "CTV and CBC, free over the air.", covers: ["ctv", "cbc"] },
  { id: "ca-tv", group: "tv", regions: ["ca"], name: "TV provider with TSN",
    hint: "Bell, Rogers, Telus, Videotron and others. Includes TSN, CTV and CBC.",
    covers: ["tsn", "ctv", "cbc"] },
  { id: "tsnsub", group: "stream", regions: ["ca"], name: "TSN streaming plan",
    hint: "TSN channels plus TSN+.", covers: ["tsn", "tsnplus"] },
  { id: "tsnplus", group: "stream", regions: ["ca"], name: "TSN+ add-on",
    hint: "TSN's streaming-only games, including most NCAA games.", covers: ["tsnplus"] },
  { id: "crave", group: "stream", regions: ["ca"], name: "Crave",
    hint: "Streams CTV's select Toronto Tempo games.", covers: ["crave", "ctv"] },
];

const servicesFor = (region) => SERVICES.filter((s) => s.regions.includes(region));
