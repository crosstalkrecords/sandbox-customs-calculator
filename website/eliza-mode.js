/* Crosstalk Records — Eliza Mode
   Public storefront enhancement. Loaded from Common Ground HTML Head Tags.
*/
(() => {
  "use strict";
  if (window.__xtElizaModeInstalled) return;
  window.__xtElizaModeInstalled = true;

  const ENABLED_KEY = "xt-eliza-enabled-v2";
  const CACHE_KEY = "xt-eliza-cache-v5";
  const API_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
  const COVER_SELECTOR = ".tile.releaseItem .artwork img, main a[href^='/release/'] img, main img[alt*=' | ']";
  const GOOD_TASTE_ARTISTS = [
    "amy winehouse", "nirvana", "kurt cobain", "joy division", "ian curtis",
    "linkin park", "chester bennington", "soundgarden", "audioslave", "chris cornell",
    "the prodigy", "keith flint", "avicii", "tim bergling", "frightened rabbit",
    "scott hutchison", "sparklehorse", "mark linkous", "vic chesnutt"
  ];
  const GOOD_TASTE_TERMS = [
    "in memoriam", "memorial", "tribute to", "rest in peace", "r.i.p.", "rip "
  ];

  const style = document.createElement("style");
  style.id = "xt-eliza-styles";
  style.textContent = `
    .xt-eliza-toggle-wrap {
      position: fixed; top: max(10px,env(safe-area-inset-top)); right: 12px;
      z-index: 1000000; display: flex; width: auto; margin: 0;
      box-sizing: border-box; pointer-events: none; opacity: .78;
      transform: scale(.92); transform-origin: top right;
      transition: opacity .18s ease,transform .18s ease;
    }
    .xt-eliza-toggle-wrap:hover,.xt-eliza-toggle-wrap:focus-within { opacity: 1; transform: scale(1); }
    .xt-eliza-toggle {
      appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center;
      gap: 8px; padding: 7px 10px 7px 11px; border: 1px solid rgba(25,25,30,.14);
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
      min-width: 8px !important; min-height: 8px !important;
      transform: translate(-50%,-50%) rotate(var(--tilt)); border: 1.5px solid #111 !important;
      border-radius: 50% !important;
      background: radial-gradient(circle at 38% 32%,#fff 0 50%,#eee 74%,#ccc 100%) !important;
      box-shadow: 0 1px 2px rgba(0,0,0,.58),inset 0 0 0 1px rgba(255,255,255,.55) !important;
      box-sizing: border-box !important;
    }
    .xt-eliza-pupil {
      position: absolute !important;
      top: calc(50% + var(--xt-look-y,0px)) !important;
      left: calc(50% + var(--xt-look-x,0px)) !important;
      display: block !important; width: 46% !important; height: 46% !important;
      min-width: 2px !important; min-height: 2px !important; transform: translate(-50%,-50%);
      border: 0 !important; border-radius: 50% !important;
      background: radial-gradient(circle at 33% 28%,#fff 0 8%,#111 10% 100%) !important;
      transition: top .13s ease-out,left .13s ease-out !important;
    }
    .xt-eliza-message {
      position: fixed; right: 18px; bottom: 18px; z-index: 1000000;
      padding: 10px 13px; border-radius: 12px; background: rgba(18,18,22,.92); color: #fff;
      box-shadow: 0 12px 34px rgba(0,0,0,.24); font: 700 12px/1.35 system-ui,sans-serif;
      opacity: 0; transform: translateY(8px); pointer-events: none;
      transition: opacity .18s ease,transform .18s ease;
    }
    .xt-eliza-message.show { opacity: 1; transform: translateY(0); }
    @media (max-width:760px) {
      .xt-eliza-toggle-wrap { top: max(8px,env(safe-area-inset-top)); right: 8px; transform: scale(.86); }
      .xt-eliza-toggle-wrap:hover,.xt-eliza-toggle-wrap:focus-within { transform: scale(.92); }
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
  const cleanImages = new Map();
  let lastScrollX = window.scrollX;
  let lastScrollY = window.scrollY;
  let scrollFrame = 0;
  let settleTimer = 0;
  let scrollListening = false;

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
    // Keep this outside Common Ground's transformed content container.
    // A fixed element inside that container is positioned against the app,
    // not the viewport, which pushed the control offscreen at some widths.
    document.body.appendChild(wrap);
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
      .then(async () => {
        // Prefer WebGL for speed, but skip the bundle's broken automatic WASM
        // fallback and use the always-available CPU backend when necessary.
        const tf = window.faceapi && window.faceapi.tf;
        if (tf && typeof tf.setBackend === "function") {
          let ready = false;
          try { ready = await tf.setBackend("webgl"); }
          catch (_) { ready = false; }
          if (!ready) await tf.setBackend("cpu");
          if (typeof tf.ready === "function") await tf.ready();
        }
        return Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
        ]);
      })
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

  function passesGoodTaste(img) {
    const tile = img.closest(".tile.releaseItem") || img.closest("a[href^='/release/']") || img.parentElement;
    const text = `${img.alt || ""} ${tile?.textContent || ""}`.toLowerCase().replace(/\s+/g, " ");
    return !GOOD_TASTE_ARTISTS.some(name => text.includes(name)) &&
      !GOOD_TASTE_TERMS.some(term => text.includes(term));
  }

  function saveCache() {
    try {
      const entries = Object.entries(cache).slice(-500);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_) {}
  }

  function cleanImageFor(img) {
    const src = img.currentSrc || img.src;
    if (!src) return Promise.reject(new Error("Cover has no image URL"));
    if (cleanImages.has(src)) return cleanImages.get(src);
    const request = new Promise((resolve, reject) => {
      const clean = new Image();
      clean.crossOrigin = "anonymous";
      clean.decoding = "async";
      clean.onload = () => resolve(clean);
      clean.onerror = () => reject(new Error(`Cover CDN blocked CORS access: ${src}`));
      clean.src = src;
    });
    cleanImages.set(src, request);
    request.catch(() => cleanImages.delete(src));
    return request;
  }

  function sameFace(a, b) {
    const ab = a.detection.box;
    const bb = b.detection.box;
    const ax = ab.x + ab.width / 2;
    const ay = ab.y + ab.height / 2;
    const bx = bb.x + bb.width / 2;
    const by = bb.y + bb.height / 2;
    return Math.hypot(ax - bx, ay - by) < Math.max(ab.width, bb.width) * .28;
  }

  function landmarkFace(result, imageWidth, imageHeight) {
    const box = result.detection.box;
    const left = result.landmarks.getLeftEye();
    const right = result.landmarks.getRightEye();
    if (!left.length || !right.length) return null;
    const centre = points => points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 }
    );
    const lc = centre(left);
    const rc = centre(right);
    lc.x /= left.length; lc.y /= left.length;
    rc.x /= right.length; rc.y /= right.length;
    const gap = Math.hypot(rc.x - lc.x, rc.y - lc.y);
    const width = points => Math.hypot(
      points[3].x - points[0].x,
      points[3].y - points[0].y
    );
    const eyeWidth = (width(left) + width(right)) / 2;
    const plausible = gap > box.width * .16 && gap < box.width * .72 &&
      Math.abs(rc.y - lc.y) < gap * .42 && eyeWidth > gap * .12 && eyeWidth < gap * .78;
    if (!plausible) return null;
    return {
      lx: lc.x / imageWidth,
      ly: lc.y / imageHeight,
      rx: rc.x / imageWidth,
      ry: rc.y / imageHeight,
      size: Math.max(.038, Math.min(.105, (eyeWidth * 1.65) / imageWidth))
    };
  }

  function addEye(layer, x, y, size, index) {
    const eye = document.createElement("span");
    eye.className = "xt-eliza-eye";
    eye.style.left = `${x * 100}%`;
    eye.style.top = `${y * 100}%`;
    eye.style.width = `${size * 100}%`;
    eye.style.setProperty("--tilt", index % 2 ? "7deg" : "-6deg");
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
      addEye(layer, face.lx, face.ly, face.size, i * 2);
      addEye(layer, face.rx, face.ry, face.size, i * 2 + 1);
    });
  }

  async function analyse(img) {
    if (!enabled || processed.has(img)) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 105 || rect.height < 105) return;
    if (!passesGoodTaste(img)) {
      processed.add(img);
      return;
    }
    const key = keyFor(img);
    if (cache[key]) {
      processed.add(img);
      return render(img, cache[key]);
    }
    try {
      if (!img.complete || !img.naturalWidth) await img.decode();
      await ensureDetector();
      if (!enabled) return;
      // The storefront's visible <img> elements omit crossorigin, which taints
      // any canvas used by TensorFlow. Analyse a CORS-enabled copy instead.
      const source = await cleanImageFor(img);
      const strict = await window.faceapi.detectAllFaces(
        source,
        new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: .54 })
      ).withFaceLandmarks(true);
      const playful = await window.faceapi.detectAllFaces(
        source,
        new window.faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: .34 })
      ).withFaceLandmarks(true);
      const results = strict.slice();
      playful.forEach(candidate => {
        const largeEnough = candidate.detection.box.width >= source.naturalWidth * .12;
        if (largeEnough && !results.some(existing => sameFace(existing, candidate))) {
          results.push(candidate);
        }
      });
      const w = source.naturalWidth || 1;
      const h = source.naturalHeight || 1;
      const faces = results.slice(0, 18)
        .map(result => landmarkFace(result, w, h))
        .filter(Boolean);
      cache[key] = faces;
      saveCache();
      processed.add(img);
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

  function resetGaze() {
    document.documentElement.style.setProperty("--xt-look-x", "0px");
    document.documentElement.style.setProperty("--xt-look-y", "0px");
  }

  function reactToScroll() {
    if (!enabled || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const nextX = window.scrollX;
      const nextY = window.scrollY;
      const dx = Math.max(-2.2, Math.min(2.2, (nextX - lastScrollX) * .09));
      const dy = Math.max(-2.2, Math.min(2.2, (nextY - lastScrollY) * .09));
      lastScrollX = nextX;
      lastScrollY = nextY;
      document.documentElement.style.setProperty("--xt-look-x", `${dx}px`);
      document.documentElement.style.setProperty("--xt-look-y", `${dy}px`);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(resetGaze, 135);
    });
  }

  function observe(root = document) {
    if (!enabled || !io) return;
    const images = [];
    // Common Ground frequently inserts the <img> itself as the mutation node.
    // querySelectorAll() only searches descendants, so include that node too.
    if (root instanceof Element && root.matches(COVER_SELECTOR)) images.push(root);
    if (root.querySelectorAll) images.push(...root.querySelectorAll(COVER_SELECTOR));
    images.forEach(img => {
      if (!observed.has(img)) { observed.add(img); io.observe(img); }
    });
  }

  function start() {
    lastScrollX = window.scrollX;
    lastScrollY = window.scrollY;
    if (!scrollListening) {
      window.addEventListener("scroll", reactToScroll, { passive: true });
      scrollListening = true;
    }
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
    // The shop grid is rendered asynchronously after the head script executes.
    // These inexpensive rescans cover render batches that land between setup
    // and the first mutation callback.
    [250, 900, 2200].forEach(delay => setTimeout(() => observe(document), delay));
  }

  function stop() {
    if (io) io.disconnect();
    if (mo) mo.disconnect();
    if (scrollListening) {
      window.removeEventListener("scroll", reactToScroll);
      scrollListening = false;
    }
    resetGaze();
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
