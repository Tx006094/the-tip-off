/*
 * The Tip-Off — motion layer, built on Motion (motion.dev, js/vendor/motion-14.4.0.js).
 *
 * Every animation on the site comes from here, so they share one timing and one feel.
 * The site never depends on it: if Motion hasn't loaded yet, or the visitor has turned on
 * "Reduce motion", every helper does nothing and content simply appears. Content is never
 * hidden in CSS; a helper sets its own starting point right before it animates.
 *
 * Rules: transform and opacity only, 0.15–0.45s, nothing loops, nothing blocks a click, and
 * nothing replays on the automatic two-minute refresh (app.js decides when to call these).
 */
(() => {
  "use strict";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const phone = matchMedia("(max-width: 760px)");
  /** Motion, or null when it hasn't loaded or the visitor prefers reduced motion. */
  const M = () => (!reduce.matches && window.Motion) || null;

  // ---------- shared settings ----------
  const EASE = [0.2, 0.8, 0.2, 1];               // same curve as --ease in styles.css
  const DUR = { fast: 0.16, base: 0.28, slow: 0.42 };
  const SPRING = { type: "spring", stiffness: 520, damping: 34 };
  const STEP = 0.05;                             // delay between items in a sequence
  const MAX_STEPS = 8;                           // items after the 8th arrive together
  const rise = () => (phone.matches ? 10 : 16);  // how far things travel as they appear

  const clear = (el, props = ["opacity", "transform"]) => props.forEach((p) => el.style.removeProperty(p));
  // Motion writes the final values onto the element as it finishes; clear them a tick later so the
  // stylesheet (hover lifts, the pop-up's opening animation) is back in charge.
  const done = (anim, el, props) => anim.finished.then(() => setTimeout(() => clear(el, props), 0)).catch(() => {});

  /** Fade and rise a list of elements into place, one after another. */
  function show(els, { delay = 0, x = 0, y = rise(), step = STEP, duration = DUR.slow } = {}) {
    const m = M();
    if (!m) return;
    els.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = `translate(${x}px, ${y}px)`;
      const a = m.animate(el, { opacity: [0, 1], transform: [`translate(${x}px, ${y}px)`, "translate(0px, 0px)"] },
        { duration, delay: delay + Math.min(i, MAX_STEPS) * step, ease: EASE });
      done(a, el);
    });
  }

  // ---------- 1 + 2: first-load entrance and scroll reveals ----------
  // [container, the children that animate (null = the container itself), how many]
  const GROUPS = [
    [".feature", ":scope > *", 2],
    [".legend", null],
    [".mine-bar", null],
    [".sec-head", null],
    [".sched-days", ".sched-day", 10],
    [".sched-list", ".srow", MAX_STEPS],
    [".shelf", ".card, .team-tile", 6],
    [".grid", ".card, .team-tile, .plat", MAX_STEPS],
    [".page-head", ":scope > *", 4],
    [".guide-head", ":scope > *", 3],
    [".league-guide", ".lg-card", 5],
    [".guide-cols", ":scope > div", 2],
    [".notice", null],
  ];
  /**
   * Reveal everything in `root` as it scrolls into view, once. Called right after a view is drawn,
   * before the browser paints it, so nothing flashes: what's already on screen plays as the entrance.
   */
  function reveal(root) {
    const m = M();
    if (!m || !root) return;
    const taken = new Set();
    for (const [sel, kids, max] of GROUPS) {
      for (const box of root.querySelectorAll(sel)) {
        if (taken.has(box) || box.closest("[hidden]")) continue;
        taken.add(box);
        const els = kids ? [...box.querySelectorAll(kids)].slice(0, max) : [box];
        if (!els.length) continue;
        els.forEach((el) => { el.style.opacity = "0"; });
        m.inView(box, () => { show(els); }, { margin: "0px 0px -6% 0px" });
      }
    }
  }

  // ---------- 3: press feedback ----------
  // A quick shrink on press and a springy return, on anything you tap. Uses the CSS `scale`
  // property (via --press) so it stacks with the cards' hover lift instead of replacing it.
  const PRESSABLE = ".btn, .chip, .see-all, .segmented button, .sched-day, .stat-link, .card, .srow, .sched-item, .team-tile, .plat, .rail-item, .svc, .t-item";
  const BIG = ".card, .srow, .sched-item, .team-tile, .plat, .svc, .rail-item";
  document.addEventListener("pointerdown", (e) => {
    const m = M();
    const el = e.target.closest?.(PRESSABLE);
    if (!m || !el || e.button > 0) return;
    m.animate(el, { "--press": el.matches(BIG) ? 0.985 : 0.95 }, { duration: 0.1, ease: "easeOut" });
    const release = () => {
      ["pointerup", "pointercancel", "pointerleave"].forEach((t) => el.removeEventListener(t, release));
      m.animate(el, { "--press": 1 }, SPRING);
    };
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => el.addEventListener(t, release));
  }, { passive: true });

  // ---------- 4: pop-ups ----------
  /** Rows in a pop-up arrive one after another when it opens. */
  function sequence(els, opts = {}) { show(els.slice(0, MAX_STEPS), { delay: 0.06, y: 10, duration: DUR.base, ...opts }); }
  /** The closing animation; resolves when the pop-up can be hidden. */
  let outAnims = [];
  function modalOut(sheet, backdrop) {
    const m = M();
    if (!m) return null;
    const a = m.animate(sheet, { opacity: 0, transform: `translateY(${phone.matches ? 48 : 18}px)` }, { duration: DUR.fast, ease: "easeIn" });
    const b = m.animate(backdrop, { opacity: 0 }, { duration: DUR.fast, ease: "easeIn" });
    outAnims = [a, b];
    return Promise.all([a.finished, b.finished]).catch(() => {});
  }
  /** A pop-up reopened mid-close: stop the closing animation where it is. */
  function stopOut() { outAnims.forEach((x) => { try { x.cancel(); } catch { /* already finished */ } }); outAnims = []; }

  // ---------- 5: smooth transitions ----------
  /**
   * The highlight behind the selected option in a switch (All / Free / Paid / Mine, US / CA).
   * It slides to the new choice; on first draw or a resize it just moves there.
   */
  function thumb(seg, { animate = true } = {}) {
    if (!seg) return;
    const on = seg.querySelector('[aria-pressed="true"]');
    if (!on) return;
    let th = seg.querySelector(".seg-thumb");
    const fresh = !th;
    if (fresh) {
      th = document.createElement("span");
      th.className = "seg-thumb";
      th.setAttribute("aria-hidden", "true");
      seg.prepend(th);
    }
    const left = on.offsetLeft + "px", width = on.offsetWidth + "px";
    const m = M();
    if (m && animate && !fresh && (th.style.left !== left || th.style.width !== width)) {
      m.animate(th, { left, width }, SPRING).finished.then(() => { th.style.left = left; th.style.width = width; }).catch(() => {});
    } else {
      th.style.left = left; th.style.width = width;
    }
  }
  /** After a filter change, the new content settles in instead of snapping. */
  function swapIn(el) {
    const m = M();
    if (!m || !el) return;
    done(m.animate(el, { opacity: [0.25, 1], transform: ["translateY(8px)", "translateY(0px)"] }, { duration: DUR.base, ease: EASE }), el);
  }
  /** A new schedule day slides in from the side of the tab you picked. */
  function slideRows(rows, dir) { show(rows.slice(0, MAX_STEPS), { x: 28 * dir, y: 0, step: 0.03, duration: DUR.base }); }

  // ---------- 6: small touches ----------
  /** A quick pop: the star when you add a team, a box when you tick it, a tab you pick. */
  function pop(el, to = 1.3) {
    const m = M();
    if (!m || !el) return;
    done(m.animate(el, { transform: ["scale(1)", `scale(${to})`, "scale(1)"] }, { duration: 0.34, ease: EASE }), el, ["transform"]);
  }
  /** Roll a number from one value to another, calling `write` with each whole number. */
  function count(from, to, write) {
    const m = M();
    if (!m || from === to) return write(to);
    m.animate(from, to, { duration: DUR.slow, ease: EASE, onUpdate: (v) => write(Math.round(v)) });
  }
  /** A menu grows out of the button that opened it. */
  function grow(el) {
    const m = M();
    if (!m || !el) return;
    done(m.animate(el, { opacity: [0, 1], transform: ["translateY(6px) scale(.96)", "translateY(0px) scale(1)"] }, { duration: DUR.fast, ease: EASE }), el);
  }

  // ---------- a one-time hint that rows scroll sideways ----------
  // On touch screens (no arrow buttons) the first row that has more cards than fit slides left a
  // little and springs back when it comes into view. Once per visit; skipped if the visitor has
  // already scrolled that row, and never with "Reduce motion".
  const touch = matchMedia("(hover: none), (max-width: 760px)");
  function nudge(shelves) {
    const m = M();
    if (!m || !touch.matches) return;
    try { if (sessionStorage.getItem("fc-nudged")) return; } catch { /* storage unavailable */ }
    const shelf = shelves.find((s) => s.scrollWidth > s.clientWidth + 8);
    if (!shelf) return;
    try { sessionStorage.setItem("fc-nudged", "1"); } catch { /* storage unavailable */ }
    m.inView(shelf, () => {
      setTimeout(() => {
        if (shelf.scrollLeft > 4 || !shelf.isConnected) return;
        const cards = [...shelf.children].slice(0, 4);
        cards.forEach((c) => done(m.animate(c, { transform: ["translateX(0px)", "translateX(-56px)", "translateX(0px)"] },
          { duration: 1.1, ease: EASE, times: [0, 0.4, 1] }), c, ["transform"]));
      }, 900); // after the row's own entrance has finished
    }, { amount: 0.6 });
  }

  window.FX = { nudge, reveal, show, sequence, modalOut, stopOut, thumb, swapIn, slideRows, pop, count, grow };
})();
