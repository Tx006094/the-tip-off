"""Adds new TheIXPodcast episodes to the top of watch.html.

Reads the channel's Videos page (youtube.com/@theixpodcast/videos), finds any video IDs not already in the
VIDEOS list in watch.html, and puts them at the top. Existing entries (and any titles edited by hand) are left
alone, and older videos left off the page stay off. Keeps the newest 12. If YouTube can't be reached or the page changes shape, it changes nothing.
"""
import json
import pathlib
import re
import sys
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
    if not new:
        print("No new episodes.")
        return 0
    # newest first, in the channel's order
    add = [f"      {{ id: {json.dumps(v)}, title: {json.dumps(t, ensure_ascii=False)} }}," for v, t in new]
    lines = (add + lines)[:KEEP]
    s = s[: m.start(2)] + "\n".join(lines) + s[m.end(2):]
    PAGE.write_text(s, encoding="utf-8")
    print("Added:", ", ".join(t for _, t in new))
    return 0


if __name__ == "__main__":
    sys.exit(main())
