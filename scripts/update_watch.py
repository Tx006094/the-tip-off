"""Adds new TheIXPodcast episodes to the top of watch.html.

Reads the channel's Videos page (youtube.com/@theixpodcast/videos), finds any video IDs not already in the
VIDEOS list in watch.html, and puts them at the top. Existing entries (and any titles edited by hand) are left
alone, and older videos left off the page stay off. Videos deleted from YouTube are dropped; each episode's length, date and description are filled in once. Keeps the newest 12. If YouTube can't be reached or the page changes shape, it changes nothing.
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

CHANNEL = "https://www.youtube.com/@theixpodcast/videos"
PAGE = pathlib.Path(__file__).resolve().parent.parent / "watch.html"
KEEP = 12


def latest_videos():
    req = urllib.request.Request(CHANNEL, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        return []
    found = []

    def walk(o):
        if isinstance(o, dict):
            if "lockupViewModel" in o:
                l = o["lockupViewModel"]
                t = l.get("metadata", {}).get("lockupMetadataViewModel", {}).get("title", {}).get("content", "")
                if l.get("contentId") and t:
                    found.append((l["contentId"], t))
            if "videoRenderer" in o:
                v = o["videoRenderer"]
                t = "".join(r.get("text", "") for r in v.get("title", {}).get("runs", []))
                if v.get("videoId") and t:
                    found.append((v["videoId"], t))
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(json.loads(m.group(1)))
    seen, out = set(), []
    for vid, t in found:
        if vid not in seen:
            seen.add(vid)
            out.append((vid, t))
    return out


def details(vid):
    """Length (seconds), publish date and description from the video's YouTube page, or None."""
    req = urllib.request.Request("https://www.youtube.com/watch?v=" + vid, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"})
    try:
        html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
        m = re.search(r"ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|</script>)", html, re.S)
        d = json.loads(m.group(1))
        v = d["videoDetails"]
        mf = d.get("microformat", {}).get("playerMicroformatRenderer", {})
        desc = re.sub(r"\n?(#\w+\s*)+$", "", v.get("shortDescription", "")).strip()[:2000]
        return {"len": int(v.get("lengthSeconds") or 0), "date": (mf.get("publishDate") or "")[:10], "desc": desc}
    except Exception:
        return None


def entry(vid, title, extra):
    parts = [f"id: {json.dumps(vid)}", f"title: {json.dumps(title, ensure_ascii=False)}"]
    for k in ("len", "date", "desc"):
        if extra.get(k):
            parts.append(f"{k}: {json.dumps(extra[k], ensure_ascii=False)}")
    return "      { " + ", ".join(parts) + " },"


def gone(vid):
    """True only when YouTube clearly says the video no longer exists (deleted). Network trouble counts as still there."""
    url = "https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=" + vid
    try:
        urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15)
        return False
    except urllib.error.HTTPError as e:
        return e.code in (400, 404)
    except Exception:
        return False


def main():
    try:
        videos = latest_videos()
    except Exception as e:  # network trouble: leave the page as it is
        print("Could not reach YouTube:", e)
        return 0
    if not videos:
        print("No videos found; page unchanged.")
        return 0

    s = PAGE.read_text(encoding="utf-8")
    m = re.search(r"(    const VIDEOS = \[\n)(.*?)(\n    \];)", s, re.S)
    if not m:
        print("VIDEOS list not found in watch.html")
        return 1
    lines = [l for l in m.group(2).split("\n") if l.strip()]
    have = set(re.findall(r'id: "([^"]+)"', m.group(2)))
    # only videos newer than the newest one already on the page (older ones were left out on purpose)
    new = []
    for v, t in videos:
        if v in have:
            break
        new.append((v, t))
    # drop episodes that were deleted from YouTube
    kept = [l for l in lines if not (re.search(r'id: "([^"]+)"', l) and gone(re.search(r'id: "([^"]+)"', l).group(1)))]
    removed = len(lines) - len(kept)
    # newest first, in the channel's order
    add = [entry(v, t, {}) for v, t in new]
    lines = (add + kept)[:KEEP]
    # fill in length, date and description for any episode that doesn't have them yet
    filled = 0
    for i, l in enumerate(lines):
        if "len:" in l:
            continue
        vid = re.search(r'id: "([^"]+)"', l).group(1)
        title = json.loads(re.search(r'title: ("(?:[^"\\]|\\.)*")', l).group(1))
        info = details(vid)
        if info:
            lines[i] = entry(vid, title, info); filled += 1
    if not new and not removed and not filled:
        print("No changes.")
        return 0
    s = s[: m.start(2)] + "\n".join(lines) + s[m.end(2):]
    PAGE.write_text(s, encoding="utf-8")
    if new: print("Added:", ", ".join(t for _, t in new))
    if removed: print("Removed deleted videos:", removed)
    if filled: print("Added details for", filled, "episodes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
