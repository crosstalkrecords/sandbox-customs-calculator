/* Crosstalk Records — Eliza Mode
   Public storefront enhancement. Loaded from Common Ground HTML Head Tags.
*/
(() => {
  "use strict";
  if (window.__xtElizaModeInstalled) return;
  window.__xtElizaModeInstalled = true;

  const ENABLED_KEY = "xt-eliza-enabled-v2";
  const CACHE_KEY = "xt-eliza-cache-v2";
  const API_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
  const COVER_SELECTOR = ".tile.releaseItem .artwork img, main a[href^='/release/'] img, main img[alt*=' | ']";

  const style = document.createElement("style");
  style.id = "xt-eliza-styles";
  style.textContent = `
    .xt-eliza-toggle-wrap {
      position: relative; z-index: 30; display: flex; justify-content: flex-end;
      width: calc(100% - 32px); max-width: 1100px; margin: -5px auto 14px;
      box-sizing: border-box; pointer-events: none;
    }
    .xt-eliza-toggle {
      appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center;
      gap: 9px; padding: 8px 11px 8px 13px; border: 1px solid rgba(25,25,30,.14);
      border-radius: 999px; background: rgba(255,255,255,.92); color: #222;
      box-shadow: 0 8px 24px rgba(0,0,0,.11); font: 800 10px/1 system-ui,sans-serif;
      letter-spacing: .12em; text-transform: uppercase; cursor: pointer; pointer-events: auto;
    }
    .xt-eliza-toggle[aria-pressed="true"] {
      color: #fff; border-color: rgba(255,255,255,.18);
      background: linear-gradient(120deg,#674fba,#bd546f 54%,#4c86ad);
    }
    .xt-eliza-toggle[data-loading="true"] { cursor: wait; }
    .xt-eliza-switch {
      position: relative; width: 34px; height: 19px; flex: 0 0 auto;
      border-radius: 999px; background: rgba(20,20,25,.16);
    }
    .xt-eliza-switch::after {
      content: ""; position: absolute; top: 3px; left: 3px; width: 13px; height: 13px;
      border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.3);
      transition: transform .18s ease;
    }
    .xt-eliza-toggle[aria-pressed="true"] .xt-eliza-switch::after { transform: translateX(15px); }
    .xt-eliza-host { position: relative !important; }
    .xt-eliza-layer {
      position: absolute !important; inset: 0 !important; z-index: 8 !important;
      display: none; overflow: hidden !important; border-radius: inherit;
      pointer-events: none !important;
    }
    html.xt-eliza-on .xt-eliza-layer { display: block; }
    .xt-eliza-eye {
      position: absolute !important; display: block !important; aspect-ratio: 1/1;
      min-width: 7px !important; min-height: 7px !important;
      transform: translate(-50%,-50%) rotate(var(--tilt)); border: 1px solid #111 !important;
      border-radius: 50% !important; background: #fff !important;
      box-shadow: 0 1px 3px rgba(0,0,0,.4) !important; box-sizing: border-box !important;
    }
    .xt-eliza-pupil {
      position: absolute !important; top: var(--py) !important; left: var(--px) !important;
      display: block !important; width: 47% !important; height: 47% !important;
      min-width: 2px !important; min-height: 2px !important; transform: translate(-50%,-50%);
      border: 0 !important; border-radius: 50% !important; background: #111 !important;
    }
    @media (hover:hover) and (prefers-reduced-motion:no-preference) {
      .xt-eliza-host:hover .xt-eliza-eye:nth-child(odd) .xt-eliza-pupil { animation: xt-eye-a .7s infinite alternate ease-in-out; }
      .xt-eliza-host:hover .xt-eliza-eye:nth-child(even) .xt-eliza-pupil { animation: xt-eye-b .61s infinite alternate ease-in-out; }
    }
    @keyframes xt-eye-a { from { transform:translate(-72%,-63%); } to { transform:translate(-28%,-38%); } }
    @keyframes xt-eye-b { from { transform:translate(-35%,-70%); } to { transform:translate(-66%,-30%); } }
    .xt-eliza-message {
      position: fixed; right: 18px; bottom: 18px; z-index: 1000000;
      padding: 10px 13px; border-radius: 12px; background: rgba(18,18,22,.92); color: #fff;
      box-shadow: 0 12px 34px rgba(0,0,0,.24); font: 700 12px/1.35 system-ui,sans-serif;
      opacity: 0; transform: translateY(8px); pointer-events: none;
      transition: opacity .18s ease,transform .18s ease;
    }
    .xt-eliza-message.show { opacity: 1; transform: translateY(0); }
    @media (max-width:760px) {
      .xt-eliza-toggle-wrap { justify-content: center; width: calc(100% - 24px); margin-top: 0; }
    }
  `;
  document.head.appendChild(style);

  let enabled = localStorage.getItem(ENABLED_KEY) === "1";
  let cache = {};
  let apiPromise = null;
  let detectorReady = false;
  let button = null;
  let io = null;
  let mo = null;
  let queue = [];
  let busy = false;
  let observed = new WeakSet();
  let processed = new WeakSet();

  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch (_) { cache = {}; }

  function tell(text) {
    let box = document.querySelector(".xt-eliza-message");
    if (!box) {
      box = document.createElement("div");
      box.className = "xt-eliza-message";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.textContent = text;
    box.classList.add("show");
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("show"), 2600);
  }

  function syncButton(loading = false) {
    if (!button) return;
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.dataset.loading = loading ? "true" : "false";
    button.querySelector(".xt-eliza-label").textContent = loading
      ? "Eliza Mode: Looking…"
      : `Eliza Mode: ${enabled ? "On" : "Off"}`;
  }

  function addButton() {
    if (location.pathname !== "/" || document.querySelector(".xt-eliza-toggle-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "xt-eliza-toggle-wrap";
    wrap.innerHTML = '<button class="xt-eliza-toggle" type="button" aria-pressed="false"><span class="xt-eliza-label">Eliza Mode: Off</span><span class="xt-eliza-switch" aria-hidden="true"></span></button>';
    const hero = document.querySelector(".xt-hero");
    const nav = document.querySelector("nav.menu.header,.menu.header");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(wrap, hero);
    else if (nav) nav.insertAdjacentElement("afterend", wrap);
    else document.body.insertAdjacentElement("afterbegin", wrap);
    button = wrap.querySelector("button");
    button.addEventListener("click", () => setEnabled(!enabled, true));
    syncButton();
  }

  function loadScript() {
    return new Promise((resolve, reject) => {
      if (window.faceapi) return resolve();
      const script = document.createElement("script");
      script.src = API_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureDetector() {
    if (detectorReady) return Promise.resolve();
    if (apiPromise) return apiPromise;
    syncButton(true);
    apiPromise = loadScript()
      .then(() => window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL))
      .then(() => { detectorReady = true; syncButton(false); })
      .catch(error => {
        console.warn("Eliza Mode could not load:", error);
        enabled = false;
        localStorage.setItem(ENABLED_KEY, "0");
        document.documentElement.classList.remove("xt-eliza-on");
        syncButton(false);
        tell("Eliza Mode was blocked from loading.");
        throw error;
      });
    return apiPromise;
  }

  function keyFor(img) {
    try {
      const url = new URL(img.currentSrc || img.src, location.href);
      url.search = ""; url.hash = "";
      return url.href;
    } catch (_) { return img.currentSrc || img.src || ""; }
  }

  function saveCache() {
    try {
      const entries = Object.entries(cache).slice(-500);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_) {}
  }

  function addEye(layer, x, y, size, index) {
    const eye = document.createElement("span");
    eye.className = "xt-eliza-eye";
    eye.style.left = `${x * 100}%`;
    eye.style.top = `${y * 100}%`;
    eye.style.width = `${size * 100}%`;
    eye.style.setProperty("--tilt", index % 2 ? "7deg" : "-6deg");
    eye.style.setProperty("--px", index % 3 ? "56%" : "43%");
    eye.style.setProperty("--py", index % 2 ? "55%" : "47%");
    const pupil = document.createElement("span");
    pupil.className = "xt-eliza-pupil";
    eye.appendChild(pupil);
    layer.appendChild(eye);
  }

  function render(img, faces) {
    if (!faces.length || !img.isConnected) return;
    const host = img.closest(".artwork") || img.parentElement;
    if (!host) return;
    host.classList.add("xt-eliza-host");
    let layer = host.querySelector(":scope > .xt-eliza-layer");
    if (!layer) {
      layer = document.createElement("span");
      layer.className = "xt-eliza-layer";
      layer.setAttribute("aria-hidden", "true");
      host.appendChild(layer);
    }
    layer.replaceChildren();
    faces.forEach((face, i) => {
      addEye(layer, face.lx, face.y, face.size, i * 2);
      addEye(layer, face.rx, face.y, face.size, i * 2 + 1);
    });
  }

  async function analyse(img) {
    if (!enabled || processed.has(img)) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 105 || rect.height < 105) return;
    processed.add(img);
    const key = keyFor(img);
    if (cache[key]) return render(img, cache[key]);
    try {
      if (!img.complete || !img.naturalWidth) await img.decode();
      await ensureDetector();
      if (!enabled) return;
      const results = await window.faceapi.detectAllFaces(
        img,
        new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .46 })
      );
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const faces = results.slice(0, 12).map(result => {
        const b = result.box;
        return {
          lx: (b.x + b.width * .34) / w,
          rx: (b.x + b.width * .66) / w,
          y: (b.y + b.height * .42) / h,
          size: Math.max(.035, Math.min(.13, (b.width * .19) / w))
        };
      });
      cache[key] = faces;
      saveCache();
      render(img, faces);
    } catch (error) {
      console.warn("Eliza Mode skipped a cover:", error);
    }
  }

  async function drain() {
    if (busy) return;
    busy = true;
    while (enabled && queue.length) {
      await analyse(queue.shift());
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    busy = false;
  }

  function enqueue(img) {
    if (!enabled || processed.has(img) || queue.includes(img)) return;
    queue.push(img);
    drain();
  }

  function observe(root = document) {
    if (!enabled || !io || !root.querySelectorAll) return;
    root.querySelectorAll(COVER_SELECTOR).forEach(img => {
      if (!observed.has(img)) { observed.add(img); io.observe(img); }
    });
  }

  function start() {
    if (!io) {
      io = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) enqueue(entry.target); });
      }, { rootMargin: "220px 0px", threshold: .01 });
    }
    if (!mo) {
      mo = new MutationObserver(changes => changes.forEach(change =>
        change.addedNodes.forEach(node => { if (node instanceof Element) observe(node); })
      ));
    }
    mo.observe(document.body, { childList: true, subtree: true });
    observe(document);
  }

  function stop() {
    if (io) io.disconnect();
    if (mo) mo.disconnect();
    queue = [];
  }

  function setEnabled(next, announce) {
    enabled = Boolean(next);
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    document.documentElement.classList.toggle("xt-eliza-on", enabled);
    syncButton();
    if (enabled) start(); else stop();
    if (announce) tell(enabled ? "Eliza Mode enabled. This may get stupid." : "Eliza Mode disabled.");
  }

  function init() {
    addButton();
    setEnabled(enabled, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

