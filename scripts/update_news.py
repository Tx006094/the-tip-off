"""Save the latest Unrivaled and UpShot League headlines to js/news-data.js for the ticker and Latest headlines.

unrivaled.basketball has no RSS feed and doesn't allow browser requests from other sites,
so this reads its /news page (allowed by its robots.txt) and keeps only headline + link.
upshotleague.com is a WordPress site: its "League UPdates" section is the site's posts, read from the
standard WordPress posts feed (/wp-json/wp/v2/posts) with each post's photo.
Run it whenever you want fresh headlines (daily is plenty):

    python3 scripts/update_news.py

If one site can't be read or its layout changes, that league keeps its previous headlines.
"""
import datetime as dt
import html
import json
import pathlib
import re
import sys
import urllib.request

SITE = "https://www.unrivaled.basketball"
MAX_ITEMS = 8
UPSHOT = "https://upshotleague.com"
UA = {"User-Agent": "TheTipOff-headlines/1.0 (personal, non-commercial)"}
DEST = pathlib.Path(__file__).resolve().parent.parent / "js" / "news-data.js"

# A news tile: <a href="/news/slug"><span class="thumbnail-title ...">Headline</span></a><span ...>5 days ago</span>
TILE = re.compile(
    r'<a[^>]*href="(/news/[^"]+)"[^>]*>\s*<span[^>]*class="[^"]*thumbnail-title[^"]*"[^>]*>(.*?)</span>\s*</a>'
    r'\s*(?:<span[^>]*>(.*?)</span>)?',
    re.S,
)
AGO = re.compile(r"(\d+|an?|one)\s+(minute|hour|day|week|month|year)s?\s+ago", re.I)
UNIT_DAYS = {"minute": 1 / 1440, "hour": 1 / 24, "day": 1, "week": 7, "month": 30, "year": 365}


def approx_date(label, now):
    """Turn '5 days ago' into an approximate UTC timestamp. Returns None if unknown."""
    if not label:
        return None
    label = html.unescape(re.sub(r"<[^>]+>", "", label)).strip()
    if label.lower() in ("today", "just now"):
        return now
    if label.lower() == "yesterday":
        return now - dt.timedelta(days=1)
    m = AGO.search(label)
    if m:
        n = 1 if m.group(1).lower() in ("a", "an", "one") else int(m.group(1))
        return now - dt.timedelta(days=n * UNIT_DAYS[m.group(2).lower()])
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"):
        try:
            return dt.datetime.strptime(label, fmt).replace(tzinfo=dt.timezone.utc)
        except ValueError:
            pass
    return None


def fetch_unrivaled(now):
    req = urllib.request.Request(SITE + "/news", headers=UA)
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    items, seen = [], set()
    for href, title, when in TILE.findall(page):
        title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
        if not title or href in seen:
            continue
        seen.add(href)
        published = approx_date(when, now)
        items.append({
            "id": "unr-" + href.rsplit("-", 1)[-1],
            "league": "unrivaled",
            "headline": title,
            "url": SITE + href,
            "published": published.isoformat() if published else None,
        })
        if len(items) >= MAX_ITEMS:
            break
    return items


def fetch_upshot(now):
    url = f"{UPSHOT}/wp-json/wp/v2/posts?per_page={MAX_ITEMS}&_embed=wp:featuredmedia&_fields=id,date_gmt,link,title,_links,_embedded"
    posts = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8"))
    items = []
    for p in posts:
        title = html.unescape(re.sub(r"<[^>]+>", "", p.get("title", {}).get("rendered", ""))).strip()
        link = p.get("link", "")
        if not title or not link.startswith(UPSHOT):
            continue
        # UpShot writes some headlines in all caps; make those read like the others.
        if title.isupper():
            small = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}
            words = title.lower().split()
            title = " ".join(w if k and w in small else w[:1].upper() + w[1:] for k, w in enumerate(words))
            title = re.sub(r"\bUpshot\b", "UPSHOT", title)
        img = ""
        try:
            sizes = p["_embedded"]["wp:featuredmedia"][0]["media_details"]["sizes"]
            img = (sizes.get("medium") or sizes.get("et-pb-image--responsive--phone") or {}).get("source_url", "")
        except (KeyError, IndexError, TypeError):
            pass
        published = dt.datetime.fromisoformat(p["date_gmt"]).replace(tzinfo=dt.timezone.utc) if p.get("date_gmt") else None
        items.append({
            "id": f"ups-{p.get('id')}",
            "league": "upshot",
            "headline": title,
            "url": link,
            "published": published.isoformat() if published else None,
            "img": img if img.startswith(UPSHOT + "/wp-content/") else "",
        })
    return items


def previous(league):
    """Headlines already saved for one league, kept when its site can't be read today."""
    try:
        text = DEST.read_text(encoding="utf-8")
        data = json.loads(text[text.index("{"): text.rindex("}") + 1])
        return [a for a in data.get("articles", []) if a.get("league") == league]
    except Exception:
        return []


def main():
    now = dt.datetime.now(dt.timezone.utc)
    items = []
    for name, league, fetch in (("Unrivaled", "unrivaled", fetch_unrivaled), ("UpShot League", "upshot", fetch_upshot)):
        try:
            got = fetch(now)
        except Exception as e:  # network error or a changed site: keep that league's last headlines
            got = []
            print(f"Couldn't read {name}: {e}")
        if not got:
            got = previous(league)
            print(f"{name}: no new headlines found, kept {len(got)} saved ones.")
        else:
            print(f"{name}: {len(got)} headlines")
            for it in got:
                print(" -", it["headline"])
        items += got

    if not items:
        sys.exit("Found no headlines at all. Kept the existing file.")

    payload = {"updated": now.isoformat(), "articles": items}
    DEST.write_text(
        "/* Generated by scripts/update_news.py — do not edit by hand. */\n"
        "const SITE_NEWS = " + json.dumps(payload, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"Saved {len(items)} headlines -> {DEST}")


if __name__ == "__main__":
    main()
