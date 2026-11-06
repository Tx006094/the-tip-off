# The Tip-Off — where to watch women's basketball

A free, static website for finding where to stream WNBA, NCAA Division I, Olympic/FIBA, UpShot League and Unrivaled games, and whether each option is **free** or **paid**.

## Run it locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

There's no build step and no backend. You can host it free on GitHub Pages, Netlify or Cloudflare Pages by uploading the folder.

## Where the data comes from

| What | Source | File |
| --- | --- | --- |
| WNBA + NCAA D1 games, scores, broadcasters (next 10 days) | ESPN public scoreboard feed, loaded live in the browser | `js/app.js` |
| A team's full season schedule | ESPN team schedule feed, loaded when you open a team | `js/app.js` |
| WNBA + NCAA team list and logos | Saved copy of ESPN's team list. ESPN blocks loading it from a browser. | `js/teams-data.js` (refresh with `python3 scripts/update_teams.py`) |
| Ticker headlines (WNBA, college) | ESPN public news feed, loaded live | `js/app.js` |
| Ticker headlines (Unrivaled) | Saved from unrivaled.basketball/news, which has no feed and blocks loading from other sites | `js/news-data.js` (refresh with `python3 scripts/update_news.py`) |
| Free vs. paid info and approximate prices for each platform | Entered by hand | `js/platforms.js` |
| UpShot, Unrivaled and FIBA teams and events | Entered by hand, because they aren't in ESPN's feed | `js/leagues.js` |

## US / Canada toggle

The **US · CA** switch in the filter bar changes every channel listing, price and free count to that country.
The site guesses the region from the visitor's time zone and language, remembers their choice, and also
accepts `?region=ca` or `?region=us` in a link.

ESPN's feed only lists U.S. channels, so Canadian listings come from each league's Canadian TV deal
(`canadaListing()` in `js/app.js`, `platformsCA` in `js/leagues.js`, Canadian entries in `js/platforms.js`):

- **WNBA:** TSN carries every Toronto Tempo game. Select Tempo games air on CTV and Crave, and Prime Video has some exclusive games (Bell Media deal from 2026). Other games are listed as League Pass, with a note to check TSN.
- **NCAA D1:** ESPN-family games map to TSN+. Free conference streams and FloSports carry over. FOX, CBS, BTN and other U.S.-only games show "No Canadian broadcast listed".
- **FIBA:** TSN and TSN+ (Bell Media holds the exclusive FIBA and Canada Basketball rights). **Olympics:** CBC and CBC Gem through 2032.
- **UpShot:** YouTube only (whether it's available in Canada isn't confirmed).
- **Unrivaled:** no Canadian broadcaster announced for 2027. Update `canadaListing()` once one is.

Canadian prices are approximate, in CAD. Re-check them each season.

## My services and calendars

- **My services** (`js/services.js`): each service lists the channels it unlocks (`covers`, using ids from `js/platforms.js`). A game counts as watchable when one of its channels is a free stream or is covered by a ticked service. Picks are saved in the browser (`fc-services`) and kept separately for the U.S. and Canada. Open the picker with the *My services* filter button, the footer link, or `#services`.
- **Add to calendar**: each upcoming game popup has Google Calendar and Outlook.com links plus an `.ics` file for Apple Calendar and others. Team popups can save the whole upcoming schedule as one `.ics` file. Events run two hours from tip-off and list the channels.

## Animation

Animations use [Motion](https://motion.dev) 14.4.0 (MIT), stored in `js/vendor/` so the site has no outside dependency. Every effect lives in `js/motion-fx.js` with one shared set of timings; `app.js` calls it through `fx(...)`. The site works the same if Motion fails to load, and visitors with "Reduce motion" turned on get no animation. Nothing is hidden in CSS: an animation sets its own starting point just before it plays. Animations play on first load, when you switch tabs or filters, and on your own taps; never on the automatic two-minute refresh.

## Hosting and launch

The site is hosted on **Cloudflare Pages** at **https://thetipoffguide.com**, published from a GitHub repository. There's no build step: Cloudflare serves the files as they are.

Already in place:

- Canonical link, social share tags and image (`assets/social-card.jpg`, 1200×630), and the live address in the structured data (`index.html`).
- `robots.txt` and `sitemap.xml` at the site root.
- `.github/workflows/update-news.yml`, which refreshes the headlines every morning on GitHub and commits the change. Each commit republishes the site.

Launch steps:

1. Create a free GitHub account and an empty repository (for example `the-tip-off`).
2. Push this folder to it.
3. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, leave the build command empty and set the output directory to `/`.
4. In the Pages project, under **Custom domains**, add `thetipoffguide.com` (and `www.thetipoffguide.com`).
5. Check the live site, then submit `https://thetipoffguide.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
6. Turn off the Mac's headline job (below) so only GitHub updates the headlines.

Shareable links: `#team/ncaa:2579` opens a team, `#game/<id>` opens a game, and `?q=uconn` runs a search.

## Daily headline refresh

GitHub runs `scripts/update_news.py` every morning (`.github/workflows/update-news.yml`, 12:00 UTC) and commits `js/news-data.js` when the headlines change; Cloudflare then republishes the site. To run it by hand, open the repository's **Actions** tab, choose **Update headlines** and click **Run workflow**.

The Mac background job that used to do this was turned off on November 6, 2026. Its settings file was kept at `~/Library/LaunchAgents-disabled/com.fullcourt.update-news.plist`; moving it back to `~/Library/LaunchAgents/` and running `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.fullcourt.update-news.plist` would restore it.

To add a new broadcaster, add an entry to `PLATFORMS` in `js/platforms.js`. The `match` field lists the names ESPN uses for it.
