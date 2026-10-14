/* abozaralizadeh.github.io: scroll scenes and small interactions. No dependencies. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = () => innerWidth <= 820;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Run cb once when el comes near the viewport.
  const onceVisible = (el, cb, margin = "0px 0px -10% 0px") => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { rootMargin: margin });
    io.observe(el);
  };

  /* ------------------------------------------------------------------
     1. Scroll scenes: every [data-scene] gets --p from 0 to 1.
        Tall sections (sticky stages) go 0..1 while pinned.
        Short sections go 0..1 while they pass through the viewport.
     ------------------------------------------------------------------ */
  const scenes = $$("[data-scene]");
  const hstrip = $(".hstrip");
  const track = $(".hstrip-track");
  let vh = innerHeight;
  let docH = 1;

  function sizeHstrip() {
    if (!hstrip) return;
    if (mobile() || reduce) { hstrip.style.height = ""; hstrip._dist = 0; return; }
    const dist = Math.max(0, track.scrollWidth - innerWidth);
    hstrip._dist = dist;
    hstrip.style.height = `${dist + innerHeight}px`;
  }

  function measure() {
    vh = innerHeight;
    sizeHstrip();
    scenes.forEach((s) => {
      const r = s.getBoundingClientRect();
      s._top = r.top + scrollY;
      s._h = s.offsetHeight;
    });
    docH = document.documentElement.scrollHeight - vh;
  }

  const sceneHandlers = {
    hstrip(s, p) { s.style.setProperty("--hx", (p * (s._dist || 0)).toFixed(1)); },
    frames(s, p) { frames.draw(p); },
  };

  const slFill = $("#sl-fill");
  const slPct = $("#sl-pct");

  function tick() {
    const y = scrollY;
    scenes.forEach((s) => {
      const tall = s._h > vh * 1.05;
      const p = tall ? clamp((y - s._top) / (s._h - vh)) : clamp((y + vh - s._top) / (s._h + vh));
      if (p === s._p) return;
      s._p = p;
      s.style.setProperty("--p", p.toFixed(4));
      const h = sceneHandlers[s.dataset.scene];
      if (h) h(s, p);
    });
    updateSteps();
    const total = clamp(y / docH);
    slFill.style.transform = `scaleX(${total.toFixed(4)})`;
    slPct.textContent = `${Math.round(total * 100)}%`;
  }

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { tick(); ticking = false; });
  }, { passive: true });

  let resizeT;
  const remeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { measure(); frames.resize(); scenes.forEach((s) => (s._p = -1)); tick(); }, 120); };
  addEventListener("resize", remeasure);

  /* ------------------------------------------------------------------
     2. Reveal on scroll, counters
     ------------------------------------------------------------------ */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -12% 0px" });
  $$(".reveal").forEach((el) => revealIO.observe(el));

  $$("[data-count]").forEach((el) => {
    if (reduce) return;
    el.textContent = "0";
    onceVisible(el, async () => {
      const target = Number(el.dataset.count);
      const t0 = performance.now();
      const dur = 1400;
      const step = (t) => {
        const k = clamp((t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en");
        if (k < 1) requestAnimationFrame(step); else el.dataset.done = "1";
      };
      requestAnimationFrame(step);
    });
  });

  /* ------------------------------------------------------------------
     3. Chapters: rail highlight and terminal status path
     ------------------------------------------------------------------ */
  const railLinks = $$(".rail a");
  const slPath = $("#sl-path");
  const chapterIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.dataset.chapter;
      railLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.rail === id));
      slPath.textContent = e.target.dataset.path;
    });
  }, { rootMargin: "-50% 0px -50% 0px" });
  $$("[data-chapter]").forEach((el) => chapterIO.observe(el));

  /* ------------------------------------------------------------------
     4. Scrolly steps: sticky figure + steps that activate in the middle
     ------------------------------------------------------------------ */
  const mapYear = $("#map-year");
  const comicCap = $("#comic-cap");

  function activate(box, i) {
    if (box._active === i) return;
    box._active = i;
    const steps = $$(".step", box);
    steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    const step = steps[i];

    if (box.classList.contains("scrolly-map")) {
      const city = Number(step.dataset.city);
      box.style.setProperty("--draw", step.dataset.draw);
      $$(".km", box).forEach((k) => k.classList.toggle("is-on", +k.dataset.show <= +step.dataset.draw));
      $$(".city", box).forEach((c) => {
        const n = Number(c.dataset.city);
        c.classList.toggle("is-on", n <= city);
        c.classList.toggle("is-here", n === city);
      });
      mapYear.textContent = step.dataset.year;
    } else {
      $$("[data-frame]", box).forEach((img) => img.classList.toggle("is-active", Number(img.dataset.frame) === i));
      if (step.dataset.cap && comicCap) comicCap.textContent = step.dataset.cap;
    }
  }

  // The active step is computed from positions on every scroll frame, so it is right even after a jump.
  const stepBoxes = $$("[data-steps]").map((box) => ({ box, steps: $$(".step", box) }));
  stepBoxes.forEach(({ box }) => activate(box, 0));
  function updateSteps() {
    const line = innerHeight * (mobile() ? 0.66 : 0.5);
    for (const { box, steps } of stepBoxes) {
      const r = box.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      let i = 0;
      steps.forEach((st, k) => { if (st.getBoundingClientRect().top < line) i = k; });
      activate(box, i);
    }
  }

  /* ------------------------------------------------------------------
     5. Typing: hero terminal, GenBox screen, pipup terminal
     ------------------------------------------------------------------ */
  async function type(el, text, speed = 28) {
    el.textContent = "";
    el.classList.add("typing");
    for (const ch of text) {
      el.textContent += ch;
      await sleep(speed + (ch === " " ? 20 : 0) + Math.random() * 18);
    }
    el.classList.remove("typing");
  }

  if (!reduce) {
    const outs = $$(".hero .term-out");
    outs.forEach((o) => (o.textContent = ""));
    (async () => {
      await sleep(500);
      for (const o of outs) { await type(o, o.dataset.type, 26); await sleep(350); }
    })();

    $$("[data-typeon]").forEach((el) => {
      const text = el.textContent.trim();
      el.textContent = "";
      onceVisible(el, () => type(el, text, 34));
    });

    $$(".term-box").forEach((box) => {
      const spans = $$("[data-type]", box);
      spans.forEach((s) => (s.textContent = ""));
      onceVisible(box, async () => { for (const s of spans) { await type(s, s.dataset.type, 55); await sleep(300); } });
    });
  }

  /* ------------------------------------------------------------------
     6. Contributions chart: grow on view, hover tooltip
     ------------------------------------------------------------------ */
  const chart = $("#contrib");
  if (chart) {
    const tip = $(".chart-tip", chart), bars = $(".bars", chart);
    const maxOf = () => Number(getComputedStyle(bars).getPropertyValue("--max")) || 757;
    const wire = () => $$(".bar", chart).forEach((b, i) => {
      b.style.setProperty("--i", i);
      const show = () => {
        const r = b.getBoundingClientRect();
        const c = chart.getBoundingClientRect();
        tip.textContent = `${b.dataset.year} · ${Number(b.dataset.val).toLocaleString("en")} contributions`;
        tip.style.left = `${r.left - c.left + r.width / 2}px`;
        const barTop = r.bottom - c.top - (Number(b.dataset.val) / maxOf()) * r.height;
        tip.style.top = `${barTop - 6}px`;
        tip.classList.add("show");
      };
      b.addEventListener("pointerenter", show);
      b.addEventListener("pointerleave", () => tip.classList.remove("show"));
    });
    wire();
    onceVisible(chart, () => chart.classList.add("in"));

    // live numbers: a daily GitHub Action writes data/contributions.json; the static bars stay as fallback
    fetch(`data/contributions.json?d=${new Date().toISOString().slice(0, 10)}`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!d || !Array.isArray(d.years) || !d.years.length) return;
        const ys = d.years, n = ys.length, max = Math.max(1, ...ys.map((y) => y.count));
        bars.style.setProperty("--max", max);
        bars.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
        bars.innerHTML = ys.map((y, i) => {
          const label = i >= n - 2, now = i === n - 1;
          return `<div class="bar${label ? " is-labeled" : ""}${now ? " is-now" : ""}" style="--v:${y.count}" data-year="${y.year}" data-val="${y.count}"><i></i>${label ? `<b>${y.count.toLocaleString("en")}</b>` : ""}</div>`;
        }).join("");
        bars.setAttribute("aria-label", "Contributions per year: " + ys.map((y) => `${y.year} ${y.count}`).join(", ") + ".");
        const axis = $(".bars-axis", chart);
        axis.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
        axis.innerHTML = ys.map((y) => `<span>${y.year}</span>`).join("");
        const tb = $("table tbody", chart);
        if (tb) tb.innerHTML = ys.map((y) => `<tr><td>${y.year}</td><td>${y.count}</td></tr>`).join("");
        const upd = new Date(`${d.updated}T12:00:00Z`);
        const sub = $(".chart-sub", chart);
        if (sub && !isNaN(upd)) sub.textContent = `${ys[n - 1].year} counted up to ${upd.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
        wire();
        if (d.lastYear) $$('[data-live="last-year"]').forEach((el) => {
          el.dataset.count = d.lastYear;
          if (el.dataset.done || reduce) el.textContent = d.lastYear.toLocaleString("en");
        });
      })
      .catch(() => {});
  }

  /* ------------------------------------------------------------------
     7. Spot the impostor
     ------------------------------------------------------------------ */
  const imp = $("#impostor");
  if (imp) $$(".imp", imp).forEach((b) => b.addEventListener("click", () => imp.classList.add("revealed")));

  /* ------------------------------------------------------------------
     7b. Tomorrow News: switch the edition language
     ------------------------------------------------------------------ */
  $$("[data-swap]").forEach((box) => {
    const btns = $$("button", box);
    btns.forEach((b) => b.addEventListener("click", () => {
      $$("img", box).forEach((im) => im.classList.toggle("is-on", im.dataset.lang === b.dataset.lang));
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
  });

  /* ------------------------------------------------------------------
     8. Partyta seats: 24 seats, confirmed at 10
     ------------------------------------------------------------------ */
  const seatBox = $("#seats");
  if (seatBox) {
    const g = $(".ring-seats", seatBox);
    const SEATS = 24, MIN = 10, START = 7;
    const ns = "http://www.w3.org/2000/svg";
    const dots = [];
    for (let i = 0; i < SEATS; i++) {
      const a = (-90 + (360 / SEATS) * i) * (Math.PI / 180);
      const c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", (120 + 98 * Math.cos(a)).toFixed(2));
      c.setAttribute("cy", (120 + 98 * Math.sin(a)).toFixed(2));
      c.setAttribute("r", "9");
      if (i < MIN) c.classList.add("min");
      g.appendChild(c);
      dots.push(c);
    }
    const num = $("#seat-n"), status = $("#seat-status"), btn = $("#seat-btn");
    let n = START;
    const render = () => {
      dots.forEach((d, i) => d.classList.toggle("taken", i < n));
      num.textContent = n;
      const ok = n >= MIN;
      seatBox.classList.toggle("confirmed", ok);
      if (n >= SEATS) { status.textContent = "Full house. See you on the field."; btn.textContent = "Reset the demo"; }
      else if (ok) { status.textContent = `Confirmed, it's on · ${SEATS - n} seats left`; btn.textContent = "Grab a seat"; }
      else { status.textContent = `Needs ${MIN - n} more to confirm`; btn.textContent = "Grab a seat"; }
    };
    btn.addEventListener("click", () => { n = n >= SEATS ? START : n + 1; render(); });
    render();
  }

  /* ------------------------------------------------------------------
     9. Frame-scrubbed video (Partyta opener) on a canvas
     ------------------------------------------------------------------ */
  const frames = (() => {
    const box = $("[data-scene=frames]");
    const api = { draw() {}, resize() {} };
    if (!box) return api;
    const canvas = $("canvas", box);
    const ctx = canvas.getContext("2d");
    const count = Number(box.dataset.frameCount);
    const pattern = box.dataset.frames;
    const imgs = new Array(count);
    let current = -1, wanted = 0;

    const src = (i) => pattern.replace("{n}", String(i + 1).padStart(3, "0"));
    const load = (i) => {
      if (imgs[i]) return imgs[i];
      const im = new Image();
      im.decoding = "async";
      im.src = src(i);
      im.onload = () => { if (i === wanted) paint(i); };
      imgs[i] = im;
      return im;
    };

    function paint(i) {
      const im = imgs[i];
      if (!im || !im.complete || !im.naturalWidth) return;
      const cw = canvas.width, ch = canvas.height;
      // contain: the whole frame is always visible (the promo has text edge to edge), dark bars fill the rest
      const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight);
      ctx.fillStyle = "#0b0a14";
      ctx.fillRect(0, 0, cw, ch);
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
      current = i;
    }

    api.resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      current = -1;
      paint(wanted);
    };

    api.draw = (p) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (Math.abs(canvas.width - Math.round(canvas.clientWidth * dpr)) > 2 || Math.abs(canvas.height - Math.round(canvas.clientHeight * dpr)) > 2) api.resize();
      const i = reduce ? Math.round(count * 0.55) : Math.round(p * (count - 1));
      wanted = i;
      load(i);
      if (i !== current) paint(i);
    };

    // first frame now, everything else when the section gets close
    load(0).onload = () => { api.resize(); api.draw(box._p || 0); };
    onceVisible(box, () => { for (let i = 0; i < count; i++) load(i); }, "800px 0px");
    return api;
  })();

  /* ------------------------------------------------------------------
     10. "Something I can't show you yet": dust and a lens that reveals
     ------------------------------------------------------------------ */
  (() => {
    const canvas = $("#lens");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const section = canvas.parentElement; // .next-body, hidden until expanded
    const lineEl = $("#next-line");
    const lines = ["There is more here than you can see.", "Some places remember.", "Look again."];
    let W = 0, H = 0, dpr = 1, running = false, raf = 0;
    let lens = { x: 0.62, y: 0.45, r: 120, tr: 120, user: false };
    let t0 = performance.now();

    const dust = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + 0.3, v: Math.random() * 0.00012 + 0.00003, a: Math.random() * 0.5 + 0.15 }));
    const hidden = [
      { k: "orb", x: 0.68, y: 0.32, r: 26 }, { k: "orb", x: 0.82, y: 0.62, r: 16 }, { k: "orb", x: 0.18, y: 0.7, r: 20 },
      { k: "ring", x: 0.55, y: 0.6, r: 34 }, { k: "ring", x: 0.3, y: 0.28, r: 22 },
      { k: "crystal", x: 0.74, y: 0.48, r: 22 }, { k: "crystal", x: 0.4, y: 0.78, r: 16 }, { k: "crystal", x: 0.9, y: 0.25, r: 14 },
      { k: "balloon", x: 0.6, y: 0.2, r: 18 },
    ];

    function size() {
      const r = section.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawHidden(t) {
      ctx.strokeStyle = "rgba(157,140,255,0.35)";
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) {
          const y = H * (0.18 + k * 0.13) + Math.sin(x / 140 + k + t / 3000) * 18;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      hidden.forEach((o, i) => {
        const x = o.x * W, y = o.y * H + Math.sin(t / 1400 + i) * 6, r = o.r;
        if (o.k === "orb") {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
          g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.25, "rgba(168,242,94,0.8)"); g.addColorStop(1, "rgba(168,242,94,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
        } else if (o.k === "ring") {
          ctx.strokeStyle = "rgba(255,138,76,0.9)"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, t / 2600 + i, 0, Math.PI * 2); ctx.stroke();
        } else if (o.k === "crystal") {
          ctx.fillStyle = "rgba(157,140,255,0.85)";
          ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r * 0.6, y); ctx.lineTo(x, y + r * 1.4); ctx.lineTo(x - r * 0.6, y); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(239,233,223,0.5)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y + r * 3.2); ctx.stroke();
          const g = ctx.createRadialGradient(x - r / 3, y - r / 3, 2, x, y, r);
          g.addColorStop(0, "#ffd2b8"); g.addColorStop(1, "#ff8a4c");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      });
    }

    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      dust.forEach((d) => {
        d.y -= d.v * 16; if (d.y < -0.02) d.y = 1.02;
        ctx.fillStyle = `rgba(239,233,223,${d.a})`;
        ctx.fillRect(d.x * W, d.y * H, d.s, d.s);
      });
      if (!lens.user) {
        lens.x = 0.62 + Math.sin(t / 2600) * 0.16;
        lens.y = 0.48 + Math.cos(t / 3100) * 0.14;
      }
      lens.r += (lens.tr - lens.r) * 0.1;
      const lx = lens.x * W, ly = lens.y * H;
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, lens.r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "rgba(20,16,40,0.55)"; ctx.fillRect(0, 0, W, H);
      drawHidden(t);
      ctx.restore();
      ctx.strokeStyle = "rgba(239,233,223,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(lx, ly, lens.r, 0, Math.PI * 2); ctx.stroke();
      if (running) raf = requestAnimationFrame(frame);
    }

    const move = (e) => {
      const r = canvas.getBoundingClientRect();
      lens.x = (e.clientX - r.left) / r.width; lens.y = (e.clientY - r.top) / r.height; lens.user = true;
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", (e) => { move(e); lens.tr = Math.max(W, H) * 0.42; });
    addEventListener("pointerup", () => (lens.tr = 120));
    canvas.addEventListener("pointerleave", () => { lens.user = false; lens.tr = 120; });

    let li = 0;
    setInterval(() => {
      if (!running || reduce) return;
      lineEl.style.opacity = 0;
      setTimeout(() => { li = (li + 1) % lines.length; lineEl.textContent = lines[li]; lineEl.style.opacity = 1; }, 600);
    }, 4200);

    size();
    addEventListener("resize", size);
    if (reduce) { frame(t0); return; }
    new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(frame);
    }).observe(section);
  })();

  /* ------------------------------------------------------------------
     10b. "Coming soon": expand and collapse the teaser
     ------------------------------------------------------------------ */
  const nextBtn = $(".next-toggle");
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const body = $("#next-body"), open = body.hidden;
    body.hidden = !open;
    nextBtn.setAttribute("aria-expanded", String(open));
    nextBtn.innerHTML = open ? 'Collapse <span aria-hidden="true">−</span>' : 'Expand <span aria-hidden="true">+</span>';
    $("#next").classList.toggle("is-collapsed", !open);
    dispatchEvent(new Event("resize")); // size the lens canvas and re-measure the scroll scenes
  });

  /* ------------------------------------------------------------------
     11. CronAI live widget, loaded only when needed
     ------------------------------------------------------------------ */
  const cron = $(".cronai-mount");
  if (cron) {
    onceVisible(cron, () => {
      const s = document.createElement("script");
      s.src = cron.dataset.cronaiSrc;
      s.defer = true;
      s.onload = () => {
        customElements.whenDefined("cron-ai").then(() => {
          const w = document.createElement("cron-ai");
          w.setAttribute("size", "compact");
          w.setAttribute("theme", "terminal");
          w.setAttribute("value", "every weekdy at 9am");
          cron.replaceChildren(w);
        });
      };
      document.head.appendChild(s);
    }, "600px 0px");
  }

  /* ------------------------------------------------------------------
     12. Videos: muted loops play only on screen; films open in a dialog
     ------------------------------------------------------------------ */
  const loopIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        if (!reduce) v.play().catch(() => {});
      } else v.pause();
    });
  }, { threshold: 0.3 });
  $$(".lazy-video").forEach((v) => loopIO.observe(v));

  const dlg = $("#player");
  const dv = $("video", dlg);
  $$(".play").forEach((b) => b.addEventListener("click", () => {
    dv.poster = b.dataset.poster;
    dv.src = b.dataset.video;
    dlg.setAttribute("aria-label", b.dataset.title);
    dlg.showModal();
    dv.play().catch(() => {});
  }));
  dlg.addEventListener("close", () => { dv.pause(); dv.removeAttribute("src"); dv.load(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  /* ------------------------------------------------------------------
     12b. Offline photo graph with spring physics.
          Every node is tied to its rest spot by a spring, and edges are
          springs too: drag a photo and its neighbours follow a little;
          let go and everything bounces back. A tap (not a drag) moves the
          photo to the center and "queries" it in GraphQL.
     ------------------------------------------------------------------ */
  (() => {
    const g = $("#pgraph");
    if (!g) return;
    const svg = $(".pgraph-edges", g);
    const photoEls = $$(".pnode", g), dotEls = $$(".pdot", g);
    // rest spots: x, y in % of the graph, s = diameter in px at full width
    const DESK = { w: 1144, h: 1150, photos: [
      { x: 50, y: 50, s: 470 },
      { x: 16, y: 17, s: 200 }, { x: 84, y: 15, s: 172 }, { x: 8, y: 52, s: 150 },
      { x: 91, y: 52, s: 212 }, { x: 22, y: 86, s: 150 }, { x: 76, y: 88, s: 166 },
      { x: 36, y: 9, s: 112 }, { x: 63, y: 7, s: 96 }, { x: 50, y: 94, s: 104 },
      { x: 6, y: 30, s: 92 }, { x: 95, y: 31, s: 88 }, { x: 6, y: 73, s: 96 }, { x: 95, y: 74, s: 90 },
      { x: 27, y: 33, s: 64 }, { x: 73, y: 33, s: 62 }, { x: 26, y: 70, s: 66 }, { x: 74, y: 70, s: 64 },
      { x: 50, y: 5, s: 58 }, { x: 36, y: 96, s: 60 }, { x: 64, y: 97, s: 58 }, { x: 23, y: 4, s: 56 }, { x: 77, y: 4, s: 58 },
      { x: 17, y: 40, s: 56 }, { x: 83, y: 40, s: 54 }, { x: 84, y: 80, s: 56 }, { x: 16, y: 80, s: 54 } ],
      dots: [] };
    // phones: a clear band under the center photo holds the mini query card
    const PHONE = { w: 690, h: 1100, photos: [
      { x: 50, y: 44, s: 470 },
      { x: 20, y: 10, s: 210 }, { x: 80, y: 10, s: 180 }, { x: 12, y: 69, s: 170 },
      { x: 86, y: 69, s: 230 }, { x: 25, y: 90, s: 150 }, { x: 75, y: 90.5, s: 160 },
      { x: 50, y: 5, s: 110 }, { x: 50, y: 18.6, s: 90 }, { x: 50, y: 96.5, s: 100 },
      { x: 7, y: 30, s: 92 }, { x: 93, y: 30, s: 88 }, { x: 8, y: 82, s: 90 }, { x: 92, y: 82, s: 88 },
      { x: 16, y: 21, s: 70 }, { x: 84, y: 21, s: 70 }, { x: 8, y: 51, s: 64 }, { x: 92, y: 51, s: 64 },
      { x: 30, y: 26, s: 66 }, { x: 70, y: 26, s: 66 }, { x: 30, y: 79, s: 66 }, { x: 70, y: 79, s: 66 }, { x: 50, y: 82, s: 64 },
      { x: 8, y: 40, s: 60 }, { x: 92, y: 40, s: 60 }, { x: 38, y: 66, s: 58 }, { x: 60, y: 66, s: 58 } ],
      dots: [] };
    // edges between rest spots ("p" = photo slot, "d" = dot)
    const EDGES = [["p0", "p1"], ["p0", "p2"], ["p0", "p3"], ["p0", "p4"], ["p0", "p5"], ["p0", "p6"],
      ["p0", "p14"], ["p0", "p15"], ["p0", "p16"], ["p0", "p17"],
      ["p1", "p7"], ["p7", "p18"], ["p18", "p8"], ["p8", "p2"], ["p1", "p21"], ["p21", "p7"], ["p2", "p22"], ["p22", "p8"],
      ["p1", "p10"], ["p10", "p3"], ["p2", "p11"], ["p11", "p4"], ["p3", "p12"], ["p12", "p5"], ["p4", "p13"], ["p13", "p6"],
      ["p5", "p19"], ["p19", "p9"], ["p9", "p20"], ["p20", "p6"],
      ["p14", "p1"], ["p15", "p2"], ["p16", "p5"], ["p17", "p6"], ["p16", "p3"], ["p17", "p4"],
      ["p23", "p14"], ["p23", "p10"], ["p24", "p15"], ["p24", "p11"], ["p25", "p13"], ["p25", "p17"],
      ["p26", "p12"], ["p26", "p16"]];
    const K_REST = 0.075, K_EDGE = 0.022, DAMP = 0.84;

    const nodes = [
      ...photoEls.map((el, i) => ({ el, kind: "p", slot: i, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, size: 0 })),
      ...dotEls.map((el, i) => ({ el, kind: "d", slot: i, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, size: 0 })),
    ];
    const ns = "http://www.w3.org/2000/svg";
    const lines = EDGES.map(([a, b]) => { const l = document.createElementNS(ns, "line"); svg.appendChild(l); return { a, b, l, len: 0 }; });
    const key = (n) => n.kind + n.slot;
    const byKey = () => Object.fromEntries(nodes.map((n) => [key(n), n]));
    let map = byKey(), placed = false, dragging = null;

    function layout() {
      const L = mobile() ? PHONE : DESK;
      const cs = getComputedStyle(g), pad = parseFloat(cs.paddingLeft) || 0;
      // scale to whichever is tighter, the width or the height, so the whole graph fits the stage
      const W = g.clientWidth - 2 * pad, H = g.clientHeight, k = Math.min(1, W / L.w, H / L.h);
      for (const n of nodes) {
        const s = n.kind === "p" ? L.photos[n.slot] : L.dots[n.slot];
        if (n.kind === "p") { n.size = Math.round(s.s * k); n.el.style.width = `${n.size}px`; }
        // keep every photo fully inside the graph: never past an edge
        const half = (n.kind === "p" ? n.size / 2 : 6) + 3;
        n.rx = Math.min(Math.max(pad + (s.x / 100) * W, pad + half), pad + W - half);
        n.ry = Math.min(Math.max((s.y / 100) * H, half), H - half);
        if (!placed) { n.x = n.rx; n.y = n.ry; }
        const center = n.kind === "p" && n.slot === 0;
        n.el.classList.toggle("is-center", center);
        if (n.kind === "p") n.el.setAttribute("aria-label", n.el.dataset.caption + (center ? " (selected)" : ", select it"));
      }
      map = byKey();
      for (const e of lines) e.len = Math.hypot(map[e.a].rx - map[e.b].rx, map[e.a].ry - map[e.b].ry);
      placed = true;
    }

    const mini = $(".gql-mini", g), miniQ = mini && $(".gm-q", mini), miniR = mini && $(".gm-r", mini);
    function render() {
      for (const n of nodes) n.el.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (mini) { const c = nodes.find((m) => m.kind === "p" && m.slot === 0); mini.style.transform = `translate3d(${c.x.toFixed(1)}px, ${(c.y + c.size / 2 + 12).toFixed(1)}px, 0) translateX(-50%)`; }
      for (const e of lines) {
        const A = map[e.a], B = map[e.b];
        e.l.setAttribute("x1", A.x.toFixed(1)); e.l.setAttribute("y1", A.y.toFixed(1));
        e.l.setAttribute("x2", B.x.toFixed(1)); e.l.setAttribute("y2", B.y.toFixed(1));
      }
    }

    let raf = 0;
    function step() {
      let energy = 0;
      const ax = new Map(nodes.map((n) => [n, [K_REST * (n.rx - n.x), K_REST * (n.ry - n.y)]]));
      for (const e of lines) {
        const A = map[e.a], B = map[e.b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
        const f = (K_EDGE * (d - e.len)) / d;
        ax.get(A)[0] += f * dx; ax.get(A)[1] += f * dy; ax.get(B)[0] -= f * dx; ax.get(B)[1] -= f * dy;
      }
      for (const n of nodes) {
        if (n === dragging) continue;
        const [fx, fy] = ax.get(n);
        n.vx = (n.vx + fx) * DAMP; n.vy = (n.vy + fy) * DAMP;
        n.x += n.vx; n.y += n.vy;
        energy += Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(n.rx - n.x) + Math.abs(n.ry - n.y);
      }
      render();
      raf = dragging || energy > 0.6 ? requestAnimationFrame(step) : 0;
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(step); };

    // ---- GraphQL "query" of the selected photo ----
    const qEl = $("#gql-q"), rEl = $("#gql-r");
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    let typeRun = 0;
    async function query(el) {
      if (!qEl) return;
      const run = ++typeRun, d = el.dataset;
      const fields = ["caption", ...(d.place ? ["place"] : []), ...(d.year ? ["year"] : []), "tags"];
      const q = [`<span class="g-kw">query</span> {`, `  <span class="g-fn">photo</span>(id: <span class="g-str">"${d.id}"</span>) {`, ...fields.map((f) => `    <span class="g-field">${f}</span>`), "  }", "}"];
      const val = { caption: `<span class="g-str">"${esc(d.caption)}"</span>`, place: d.place && `<span class="g-str">"${esc(d.place)}"</span>`, year: d.year && `<span class="g-num">${d.year}</span>`,
        tags: "[" + d.tags.split(",").map((t) => `<span class="g-str">"${t}"</span>`).join(", ") + "]" };
      const r = ["{", `  <span class="g-field">"data"</span>: {`, `    <span class="g-field">"photo"</span>: {`,
        ...fields.map((f, i) => `      <span class="g-field">"${f}"</span>: ${val[f]}${i < fields.length - 1 ? "," : ""}`), "    }", "  }", "}"];
      if (mini) {
        // phones: a two-line version that rides under the center photo
        const short = [`<span class="g-kw">query</span> { <span class="g-fn">photo</span>(id: <span class="g-str">"${d.id}"</span>) }`,
          `<span class="g-arrow">→</span> <span class="g-str">"${esc(d.caption)}"</span>` + (d.place ? ` · <span class="g-str">${esc(d.place)}</span>` : "") + (d.year ? ` · <span class="g-num">${d.year}</span>` : "")];
        miniQ.innerHTML = ""; miniR.innerHTML = ""; mini.classList.remove("is-done");
        (async () => {
          if (!reduce) await sleep(250);
          if (run !== typeRun) return;
          miniQ.innerHTML = short[0];
          if (!reduce) await sleep(500);
          if (run !== typeRun) return;
          miniR.innerHTML = short[1]; mini.classList.add("is-done");
        })();
      }
      qEl.innerHTML = ""; rEl.innerHTML = "";
      const put = async (box, rows, gap) => { for (const row of rows) { if (run !== typeRun) return false; box.insertAdjacentHTML("beforeend", row + "\n"); if (!reduce) await sleep(gap); } return true; };
      if (!(await put(qEl, q, 55))) return;
      if (!reduce) await sleep(220);
      await put(rEl, r, 35);
    }

    function select(n) {
      const c = nodes.find((m) => m.kind === "p" && m.slot === 0);
      if (c !== n) { const s = n.slot; n.slot = 0; c.slot = s; layout(); wake(); }
      query(n.el);
    }

    // ---- dragging ----
    photoEls.forEach((el) => {
      const n = nodes.find((m) => m.el === el);
      let start = null, moved = false;
      el.addEventListener("dragstart", (e) => e.preventDefault());
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        start = { px: e.clientX, py: e.clientY, ox: n.x, oy: n.y }; moved = false;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener("pointermove", (e) => {
        if (!start) return;
        const dx = e.clientX - start.px, dy = e.clientY - start.py;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = true; dragging = n; el.classList.add("dragging");
        n.x = start.ox + dx; n.y = start.oy + dy; n.vx = n.vy = 0;
        wake();
      });
      const end = () => {
        if (!start) return;
        start = null; el.classList.remove("dragging");
        if (dragging === n) { dragging = null; wake(); }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("click", (e) => { if (moved) { moved = false; e.preventDefault(); return; } select(n); });
      const hot = (on) => lines.forEach((ln) => ln.l.classList.toggle("hot", on && (ln.a === key(n) || ln.b === key(n))));
      el.addEventListener("pointerenter", () => hot(true));
      el.addEventListener("pointerleave", () => hot(false));
      el.addEventListener("focus", () => hot(true));
      el.addEventListener("blur", () => hot(false));
    });

    layout(); render();
    addEventListener("resize", () => { layout(); wake(); });
    onceVisible(g, () => query(photoEls[0]), "0px 0px -20% 0px");
  })();

  /* ------------------------------------------------------------------
     12c. Writing. Desktop: the list pins while you scroll through it; every
          article gets the same stretch of scrolling (STEP px) and the active
          one opens with its cover and summary. Phones and touch screens: a
          plain list with every cover and summary visible (momentum scrolling
          and a pinned list don't mix). Reduced motion: the plain list too.
     ------------------------------------------------------------------ */
  (() => {
    const stage = $(".articles-stage");
    if (!stage) return;
    const box = $(".articles-sticky", stage), list = $(".articles", stage), items = $$("li", list);
    const N = items.length, STEP = 130, TOP_PAD = 72;
    const plainMode = () => reduce || matchMedia("(max-width: 820px), (hover: none)").matches;
    let active = -1, y = null, raf = 0, visible = false, plain = null;
    const setActive = (i) => {
      if (i === active) return;
      if (active >= 0) items[active].classList.remove("is-open");
      items[i].classList.add("is-open");
      active = i;
    };
    function frame() {
      if (plain) return;
      const r = stage.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
      setActive(Math.min(N - 1, Math.floor(p * N)));
      const li = items[active];
      // keep the open article in the middle, but never leave empty space: the list starts at the top
      // and, at the end, its last article rests just above the bottom fade
      const lowest = box.clientHeight * 0.97 - list.offsetHeight;
      const target = Math.max(Math.min(lowest, TOP_PAD), Math.min(TOP_PAD, box.clientHeight * 0.53 - (li.offsetTop + li.offsetHeight / 2)));
      y = y === null ? target : y + (target - y) * 0.14;
      list.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      if (visible) raf = requestAnimationFrame(frame);
    }
    function applyMode() {
      const want = plainMode();
      if (want === plain) { if (!plain) stage.style.height = `${N * STEP + innerHeight}px`; return; }
      plain = want;
      stage.classList.toggle("is-static", plain);
      stage.classList.toggle("all-open", plain);
      cancelAnimationFrame(raf);
      if (plain) { stage.style.height = ""; list.style.transform = ""; items.forEach((li) => li.classList.remove("is-open")); active = -1; y = null; }
      else { stage.style.height = `${N * STEP + innerHeight}px`; if (visible) raf = requestAnimationFrame(frame); }
    }
    applyMode();
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !plain) raf = requestAnimationFrame(frame);
    }).observe(stage);
    addEventListener("resize", applyMode);
  })();

  /* ------------------------------------------------------------------
     go
     ------------------------------------------------------------------ */
  measure();
  frames.resize();
  tick();
  new ResizeObserver(remeasure).observe(document.body);
  addEventListener("load", () => { measure(); tick(); });
})();
