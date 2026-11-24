/* ============================================================
   Repuven — member app
   ============================================================ */
// window.supabase is our own self-contained client (see the script above this one) —
// no third-party CDN is loaded, so there is nothing to fail to load.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------- visible connection status (quick reachability check to the
   project's own domain — not a 3rd-party CDN, so a "couldn't connect" here means
   this device genuinely can't reach Supabase itself, not a blocked CDN) ---------------- */
(function(){
  // no badge while things work; a message shows only if the server truly can't be reached
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000));
  Promise.race([ fetch(SUPABASE_URL + "/rest/v1/", { headers: { apikey: SUPABASE_ANON_KEY } }), timeout ])
    .catch(() => showFatalLoadError());
})();

function showFatalLoadError(){
  // No banner. Wait quietly; if the app could not start, reload by itself once the server is reachable again.
  if(window.__srvWaiting) return; window.__srvWaiting = true;
  let tries = 0; try{ tries = Number(sessionStorage.getItem("srv-reload") || 0); }catch(_){}
  const check = () => fetch(SUPABASE_URL + "/rest/v1/", { headers: { apikey: SUPABASE_ANON_KEY } })
    .then(() => {
      window.__srvWaiting = false;
      if(window.__srvAppFailed && tries < 3){ try{ sessionStorage.setItem("srv-reload", String(tries + 1)); }catch(_){} location.reload(); }
    })
    .catch(() => setTimeout(check, 8000));
  setTimeout(check, 4000);
  window.addEventListener("online", () => setTimeout(check, 500), { once: true });
}

/* ---------------- Module: Landing (mobile menu placeholders + reveal animation) —
   runs immediately, independent of backend connectivity, so the marketing page is
   always readable even if the Supabase library / network is unavailable. ---------------- */
(function(){
  document.querySelectorAll("#view-landing a[href='#']").forEach(link => link.addEventListener("click", e => e.preventDefault()));

  const revealEls = document.querySelectorAll('#view-landing .reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); } });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // carry a referral code from a shared link (?ref=CODE) through to sign-up
  const __ref = new URLSearchParams(location.search).get('ref');
  if (__ref) {
    try { localStorage.setItem("srv_ref_code", JSON.stringify({ code: __ref.trim().toUpperCase(), at: Date.now() })); } catch (e) {}
    document.querySelectorAll('#view-landing a[href^="#auth/signup"]').forEach(a => {
      a.setAttribute("href", "#auth/signup?ref=" + encodeURIComponent(__ref));
    });
  }

  // VIP invite link (?vip=TOKEN), investor link (?inv=TOKEN) or a VIP member's free link (?vf=CODE): open the join form
  ["vip", "inv", "vf", "sa"].forEach(__k => {
    const __v = new URLSearchParams(location.search).get(__k);
    if (!__v) return;
    const __q = new URLSearchParams(location.search); __q.delete(__k);
    const __rest = __q.toString();
    history.replaceState(null, "", location.pathname + (__rest ? "?" + __rest : "") + "#auth/signup?" + __k + "=" + encodeURIComponent(__v));
  });

  // links to a part of this page scroll there (the router would jump back to the top)
  document.querySelectorAll('#view-landing a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (!id || /[\/?=]/.test(id)) return;
    const target = document.getElementById(id);
    if (!target || !target.closest('#view-landing')) return;
    // wait one tick: the phone menu closes first, then the page scrolls to the right place
    a.addEventListener('click', e => { e.preventDefault(); setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); });
  });

  async function loadLandingArticles(){
    const mount = document.getElementById("landing-articles-mount");
    if(!mount || typeof supabase === "undefined") return;
    try{
      const {data,error} = await supabase.from("articles").select("id,title,body,image_url,created_at,is_published").eq("is_published",true).order("created_at",{ascending:false}).limit(3);
      if(error || !data || !data.length){
        mount.innerHTML = `<div class="landing-article" style="grid-column:1/-1;padding:34px;text-align:center;cursor:default;"><div class="landing-article-meta">Repuven Journal</div><h3>New stories are on the way.</h3><p>We will post guides and news here soon.</p></div>`;
        return;
      }
      const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
      mount.innerHTML = data.map(a => `<article class="landing-article" data-landing-article="${esc(a.id)}">
        <div class="landing-article-media">${a.image_url ? `<img src="${esc(a.image_url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"><div class="landing-article-img-fallback"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-sparkle"/></svg></div>` : `<div class="landing-article-img-fallback" style="display:grid;"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-sparkle"/></svg></div>`}</div>
        <div class="landing-article-body"><div class="landing-article-meta">Repuven • ${new Date(a.created_at).toLocaleDateString()}</div><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p><span class="landing-article-read">Read article <svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrow-right"/></svg></span></div>
      </article>`).join("");
      mount.querySelectorAll("[data-landing-article]").forEach(card=>card.addEventListener("click",()=>{
        const a=data.find(x=>String(x.id)===card.dataset.landingArticle);
        if(!a) return;
        const modal=document.getElementById("article-modal");
        if(!modal) return;
        document.getElementById("am-title").textContent=a.title;
        document.getElementById("am-meta").textContent=new Date(a.created_at).toLocaleDateString();
        document.getElementById("am-body").textContent=a.body;
        const img=document.getElementById("am-image");
        if(a.image_url){img.src=a.image_url;img.style.display="block";}else img.style.display="none";
        modal.style.display="flex";
      }));
    }catch(e){
      console.warn("Landing articles unavailable",e);
    }
  }
  loadLandingArticles();
})();

async function runApp(){

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function money(n){
  const v = Number(n || 0);
  return "$" + v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtDate(d){
  if(!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + " · " +
         dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
}
function toast(msg, type){
  let stack = document.getElementById("toast-stack");
  if(!stack){ stack = document.createElement("div"); stack.id = "toast-stack"; document.body.appendChild(stack); }
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " err" : type === "success" ? " ok" : "");
  el.textContent = msg;
  stack.appendChild(el);
  makeSwipeable(el, 3800);
}
window.srvToast = toast;
/* Any notice can be swiped away (left, right or up), or closed with a tap on ×. */
function makeSwipeable(el, life){
  if(el.dataset.swipe) return; el.dataset.swipe = "1";
  el.classList.add("swipe-note");
  if(!el.querySelector(".swipe-x")){
    const x = document.createElement("button");
    x.type = "button"; x.className = "swipe-x"; x.setAttribute("aria-label", "Close"); x.textContent = "×";
    x.addEventListener("click", e => { e.stopPropagation(); gone(0, -1); });
    el.appendChild(x);
  }
  let timer = null, sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, drag = false, done = false;
  const start = () => { if(life) timer = setTimeout(() => gone(0, -1), life); };
  const stop = () => { clearTimeout(timer); timer = null; };
  function gone(dirX, dirY){
    if(done) return; done = true; stop();
    el.style.transition = "transform .22s ease, opacity .22s ease";
    el.style.transform = dirX ? `translateX(${dirX * 120}%)` : `translateY(${dirY * 60}px)`;
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 230);
  }
  el.addEventListener("pointerdown", e => {
    if(e.target.closest(".swipe-x, a, button:not(.swipe-x)")) return;
    drag = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = Date.now(); stop();
    el.style.transition = "none";
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
  });
  el.addEventListener("pointermove", e => {
    if(!drag) return;
    dx = e.clientX - sx; dy = Math.min(0, e.clientY - sy);
    const sideways = Math.abs(dx) >= Math.abs(dy);
    el.style.transform = sideways ? `translateX(${dx}px)` : `translateY(${dy}px)`;
    el.style.opacity = String(Math.max(0.25, 1 - Math.max(Math.abs(dx), -dy) / 260));
  });
  const end = () => {
    if(!drag) return; drag = false;
    const fast = Date.now() - t0 < 250;
    if(Math.abs(dx) > 80 || (fast && Math.abs(dx) > 30)) return gone(Math.sign(dx), 0);
    if(-dy > 40 || (fast && -dy > 20)) return gone(0, -1);
    el.style.transition = "transform .2s ease, opacity .2s ease";
    el.style.transform = ""; el.style.opacity = "";
    start();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  start();
}
/* ---------------- "Please confirm" sheet for every money action ---------------- */
const ConfirmSheet = (function(){
  const ICONS = {
    withdraw: "i-arrow-up-right",
    transfer: "i-arrows-lr",
    verify:   "i-check-circle",
    deposit:  "i-arrow-down",
    refund:   "i-wallet",
  };
  let root = null, resolver = null, lastFocus = null, openedAt = 0, closing = null;

  function build(){
    root = document.createElement("div");
    root.className = "cfm";
    root.id = "confirm-sheet";
    root.hidden = true;
    root.innerHTML = `
      <div class="cfm-scrim" data-cfm-cancel></div>
      <div class="cfm-card" role="dialog" aria-modal="true" aria-labelledby="cfm-title" aria-describedby="cfm-lead" tabindex="-1">
        <div class="cfm-grip" aria-hidden="true"></div>
        <button type="button" class="cfm-x" data-cfm-cancel aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        <div class="cfm-badge" aria-hidden="true"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div>
        <p class="cfm-kicker">Review and confirm</p>
        <h3 class="cfm-title" id="cfm-title"></h3>
        <p class="cfm-lead" id="cfm-lead"></p>
        <div class="cfm-receipt">
          <dl class="cfm-rows"></dl>
          <div class="cfm-total"><span></span><b></b></div>
        </div>
        <p class="cfm-note"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-lock"/></svg><span></span></p>
        <div class="cfm-actions">
          <button type="button" class="btn btn-secondary cfm-cancel" data-cfm-cancel>Cancel</button>
          <button type="button" class="btn btn-primary cfm-ok"><span class="btn-label">Confirm</span></button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll("[data-cfm-cancel]").forEach(el => el.addEventListener("click", () => close(false)));
    root.querySelector(".cfm-ok").addEventListener("click", () => {
      if(performance.now() - openedAt < 450) return;   // ignore a double tap that started before the sheet opened
      close(true);
    });
    root.addEventListener("keydown", e => {
      if(e.key === "Escape"){ e.preventDefault(); close(false); return; }
      if(e.key !== "Tab") return;
      const f = [...root.querySelectorAll(".cfm-card button:not([disabled]), .cfm-card a[href]")].filter(x => x.offsetParent !== null);
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector(".cfm-card"))){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }

  /**
   * Show the sheet and wait for the answer.
   * o = { icon, title, lead, rows:[{label, value, html, mono}], total:{label, value}, note, confirm, cancel }
   * Resolves true when the person confirms, false when they cancel or close it.
   */
  function open(o){
    if(!root) build();
    if(resolver){ resolver(false); resolver = null; }
    clearTimeout(closing);
    const card = root.querySelector(".cfm-card");
    root.dataset.kind = o.icon || "withdraw";
    card.querySelector(".cfm-badge use").setAttribute("href", "#" + (ICONS[o.icon] || "i-check"));
    card.querySelector(".cfm-kicker").textContent = o.kicker || "Review and confirm";
    card.querySelector(".cfm-title").textContent = o.title || "Please confirm";
    const lead = card.querySelector(".cfm-lead");
    lead.textContent = o.lead || "";
    lead.hidden = !o.lead;
    card.querySelector(".cfm-rows").innerHTML = (o.rows || []).map(r =>
      `<div class="cfm-row"><dt>${escapeHtml(r.label)}</dt><dd class="${r.mono ? "is-mono" : ""}">${r.html ? r.value : escapeHtml(r.value)}</dd></div>`
    ).join("");
    const total = card.querySelector(".cfm-total");
    total.hidden = !o.total;
    if(o.total){ total.querySelector("span").textContent = o.total.label; total.querySelector("b").textContent = o.total.value; }
    const note = card.querySelector(".cfm-note");
    note.hidden = !o.note;
    note.querySelector("span").textContent = o.note || "";
    card.querySelector(".cfm-ok .btn-label").textContent = o.confirm || "Confirm";
    card.querySelector(".cfm-cancel").textContent = o.cancel || "Cancel";

    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("cfm-lock");
    void root.offsetWidth;
    root.classList.add("is-open");
    openedAt = performance.now();
    requestAnimationFrame(() => { try{ card.focus({ preventScroll: true }); }catch(e){} });
    return new Promise(res => { resolver = res; });
  }

  function close(result){
    if(!root || root.hidden || !root.classList.contains("is-open")) return;
    root.classList.remove("is-open");
    document.documentElement.classList.remove("cfm-lock");
    const r = resolver; resolver = null;
    closing = setTimeout(() => { root.hidden = true; }, 260);
    try{ if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }catch(e){}
    if(r) r(!!result);
  }

  return { open, close, get isOpen(){ return !!(root && root.classList.contains("is-open")); } };
})();

/* ---------------- Payout rates (official USD → BDT, bKash rate) ---------------- */
const PayRates = (function(){
  let cache = null, at = 0;
  async function get(force){
    if(!force && cache && Date.now() - at < 5 * 60 * 1000) return cache;
    try{
      const { data, error } = await supabase.rpc("get_payout_rates");
      if(!error && data){ cache = data; at = Date.now(); }
    }catch(e){}
    return cache || { bkash: 117, official: null, email_code: false };
  }
  return { get, peek(){ return cache; } };
})();
function taka(n){ return "৳" + Math.round(Number(n || 0)).toLocaleString("en-US"); }

/* ---------------- "Click here" button in the code email ----------------
   The email button opens  https://www.repuven.com/?otp=123456 .
   That new tab hands the code to the Repuven tab that is waiting for it (the payment /
   security sheet or the password-reset form), which fills it in and checks it by itself.
   If no tab is waiting, the new tab shows the code with a Copy button. */
const OtpLink = (function(){
  const CH = "BroadcastChannel" in window ? new BroadcastChannel("srv-otp") : null;
  const handlers = new Set();
  let incoming = null;
  try{
    const qp = new URLSearchParams(location.search);
    if(qp.has("otp")){
      const c = String(qp.get("otp") || "").replace(/\D/g, "");
      if(c.length >= 6 && c.length <= 10) incoming = c;
      qp.delete("otp");
      const rest = qp.toString();
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    }
  }catch(e){}

  function offer(code){
    for(const h of handlers){ try{ if(h(code)) return true; }catch(e){ console.error(e); } }
    return false;
  }
  // another tab opened the email button: fill the code here if a form is waiting
  if(CH) CH.addEventListener("message", e => {
    const d = e.data || {};
    if(d.t === "otp" && d.code && offer(String(d.code))){ CH.postMessage({ t:"ack", id:d.id }); try{ window.focus(); }catch(_){} }
  });
  window.addEventListener("storage", e => {          // for browsers without BroadcastChannel
    if(e.key !== "srv-otp" || !e.newValue || CH) return;
    try{ const d = JSON.parse(e.newValue); if(Date.now() - d.at < 60000 && offer(String(d.code))) localStorage.setItem("srv-otp-ack", d.id); }catch(_){}
  });

  function listen(fn){ handlers.add(fn); return () => handlers.delete(fn); }

  function handOff(code){
    const id = Math.random().toString(36).slice(2);
    return new Promise(res => {
      let done = false;
      const finish = v => {
        if(done) return; done = true;
        if(CH) CH.removeEventListener("message", onMsg);
        window.removeEventListener("storage", onStore);
        try{ localStorage.removeItem("srv-otp"); }catch(_){}
        res(v);
      };
      const onMsg = e => { if(e.data && e.data.t === "ack" && e.data.id === id) finish(true); };
      const onStore = e => { if(e.key === "srv-otp-ack" && e.newValue === id) finish(true); };
      if(CH){ CH.addEventListener("message", onMsg); CH.postMessage({ t:"otp", code, id }); }
      else{ window.addEventListener("storage", onStore); try{ localStorage.setItem("srv-otp", JSON.stringify({ code, id, at:Date.now() })); }catch(_){} }
      setTimeout(() => finish(false), 1500);
    });
  }

  function card(code, filled){
    const el = document.createElement("div");
    el.className = "otp-link";
    el.innerHTML = `
      <div class="otp-link-card" role="dialog" aria-modal="true" aria-labelledby="otp-link-title">
        <button type="button" class="otp-link-x" data-otp-close aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        ${filled ? `
          <div class="otp-link-ok"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div>
          <h3 id="otp-link-title">Code filled in</h3>
          <p>Your code was put in on your open Repuven page and is being checked there. You can close this tab and go back to it.</p>
          <button type="button" class="btn btn-primary btn-block" data-otp-close>Okay</button>`
        : `
          <h3 id="otp-link-title">Your Repuven code</h3>
          <div class="otp-link-code">${escapeHtml(code)}</div>
          <p>Go back to the Repuven page where you asked for the code and paste it there.</p>
          <button type="button" class="btn btn-primary btn-block" data-otp-copy>Copy code</button>`}
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", async e => {
      if(e.target === el || e.target.closest("[data-otp-close]")){ el.remove(); return; }
      const b = e.target.closest("[data-otp-copy]");
      if(b){
        try{ await navigator.clipboard.writeText(code); }catch(_){
          const t = document.createElement("textarea"); t.value = code; document.body.appendChild(t); t.select(); try{ document.execCommand("copy"); }catch(__){} t.remove();
        }
        b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy code"; }, 1600);
      }
    });
  }

  /** Called once the app has started. */
  async function deliver(){
    if(!incoming) return;
    const code = incoming; incoming = null;
    if(offer(code)) return;                               // a form on this page is waiting
    if(await handOff(code)){ card(code, true); return; }  // filled in on the other open tab
    // password reset asked for in this browser, but that tab is closed: carry on here
    let reset = null;
    try{ reset = JSON.parse(localStorage.getItem("srv-reset-email") || "null"); }catch(_){}
    if(!AppState.session && reset && reset.email && Date.now() - (reset.at || 0) < 3600000){
      Router.go("auth/forgot");
      setTimeout(() => { if(!AuthModule.resumeWithCode(reset.email, code)) card(code, false); }, 150);
      return;
    }
    card(code, false);
  }
  return { listen, deliver };
})();

/* ---------------- Email code before money leaves a wallet ----------------
   PayCode.ask({ what:"withdrawal" }) opens a sheet, emails a code to the member
   and resolves true once the code is confirmed (false if they close it).
   A confirmed code is good for one payment within 10 minutes. */
const PayCode = (function(){
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  const ICON = {
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    totp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/><path d="M12 7.5v3l2 1.2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="6.5" cy="7" r="1.4"/><circle cx="12" cy="7" r="1.4"/><circle cx="17.5" cy="7" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/><circle cx="12" cy="12.5" r="1.4"/><circle cx="17.5" cy="12.5" r="1.4"/><circle cx="12" cy="18" r="1.4"/></svg>'
  };
  const NAME = { pin: "Pay PIN", totp: "Authenticator", email: "Email code" };
  let root = null, resolver = null, email = "", timer = null, verifiedAt = 0, busy = false;
  let mode = "email", modes = [], sec = null, sent = false, what = "payment";

  function mask(e){
    const [u, d] = String(e || "").split("@");
    if(!d) return e || "";
    return (u.length <= 2 ? u.charAt(0) + "•" : u.slice(0, 2) + "•••" + u.slice(-1)) + "@" + d;
  }
  function build(){
    root = document.createElement("div");
    root.className = "pc"; root.hidden = true;
    root.innerHTML = `
      <div class="pc-scrim" data-pc-close></div>
      <div class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pc-title">
        <button type="button" class="pc-x" data-pc-close aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        <div class="pc-mark" id="pc-mark"></div>
        <p class="pc-kicker">Confirm it's you</p>
        <div class="pc-ways" id="pc-ways" role="tablist" aria-label="How to confirm"></div>
        <h3 id="pc-title"></h3>
        <p class="pc-lead" id="pc-lead"></p>
        <div class="pc-boxes" id="pc-boxes">
          <input class="pc-input" id="pc-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" aria-label="Code">
        </div>
        <p class="pc-msg" id="pc-msg" role="status"></p>
        <button type="button" class="btn btn-primary pc-ok" id="pc-ok"><span class="btn-label">Verify and continue</span></button>
        <div class="pc-foot" id="pc-foot"></div>
        <p class="pc-safe">${LOCK}<span>Never share your codes or PIN. Our team will never ask for them.</span></p>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll("[data-pc-close]").forEach(el => el.addEventListener("click", () => close(false)));
    root.addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); close(false); } });
    const input = root.querySelector("#pc-input");
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, mode === "email" ? 10 : 6);
      root.classList.remove("is-bad");
      paint();
      if(mode === "email" ? (input.value.length >= 6 && input.value.length === cells()) : input.value.length === 6) verify();
    });
    input.addEventListener("focus", paint); input.addEventListener("blur", paint);
    root.querySelector("#pc-boxes").addEventListener("click", () => input.focus());
    root.querySelector("#pc-ok").addEventListener("click", verify);
    // code arrived from the "Click here" button in the email
    OtpLink.listen(code => {
      if(!root || root.hidden || !sent || !modes.includes("email")) return false;
      if(mode !== "email") setMode("email");
      const box = root.querySelector("#pc-input");
      box.value = code.slice(0, 10);
      root.classList.remove("is-bad");
      paint();
      verify();
      return true;
    });
    root.querySelector("#pc-ways").addEventListener("click", e => { const b = e.target.closest("[data-pc-way]"); if(b) setMode(b.dataset.pcWay); });
    root.querySelector("#pc-foot").addEventListener("click", e => {
      if(e.target.closest("#pc-resend")) send();
      if(e.target.closest("[data-pc-other]")){ const o = modes.find(m => m !== mode && m !== "pin") || modes.find(m => m !== mode); if(o) setMode(o); }
      if(e.target.closest("[data-pc-forgot]")) forgotPin();
    });
  }
  function cells(){ return mode === "email" ? Math.max(6, root.querySelector("#pc-input").value.length) : 6; }
  function paint(){
    const input = root.querySelector("#pc-input"), box = root.querySelector("#pc-boxes");
    const v = input.value, n = cells(), focused = document.activeElement === input;
    box.classList.toggle("is-pin", mode === "pin");
    box.querySelectorAll(".pc-cell").forEach(c => c.remove());
    for(let i = 0; i < n; i++){
      const c = document.createElement("span");
      c.className = "pc-cell" + (v[i] ? " is-filled" : "") + (focused && i === Math.min(v.length, n - 1) ? " is-on" : "");
      c.textContent = v[i] ? (mode === "pin" ? "•" : v[i]) : "";
      box.insertBefore(c, input);
    }
  }
  function msg(text, bad){ const m = root.querySelector("#pc-msg"); m.textContent = text || ""; m.classList.toggle("is-bad", !!bad); }
  function setMode(m){
    if(!modes.includes(m)) return;
    mode = m;
    clearInterval(timer);
    root.classList.remove("is-bad", "is-good");
    root.querySelector("#pc-mark").innerHTML = ICON[m] + `<i>${LOCK}</i>`;
    root.querySelectorAll("[data-pc-way]").forEach(b => { const on = b.dataset.pcWay === m; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    const input = root.querySelector("#pc-input");
    input.value = "";
    input.setAttribute("autocomplete", m === "pin" ? "off" : "one-time-code");
    input.setAttribute("aria-label", m === "pin" ? "Pay PIN" : m === "totp" ? "Authenticator code" : "Email code");
    const others = modes.length > 1;
    const T = root.querySelector("#pc-title"), L = root.querySelector("#pc-lead"), F = root.querySelector("#pc-foot");
    if(m === "pin"){
      T.textContent = "Enter your Pay PIN";
      L.innerHTML = `Type your 6-number PIN to confirm this ${escapeHtml(what)}.`;
      F.innerHTML = `<button type="button" class="pc-resend" data-pc-forgot>Forgot PIN?</button>`;
    } else if(m === "totp"){
      T.textContent = "Open Google Authenticator";
      L.innerHTML = `Type the 6-digit code shown under <b>Repuven</b> to confirm this ${escapeHtml(what)}.`;
      F.innerHTML = others ? `<span>Phone not with you?</span><button type="button" class="pc-resend" data-pc-other>Use another way</button>` : `<span>Lost your phone? Ask Support to reset it.</span>`;
    } else {
      T.textContent = "Check your email";
      L.innerHTML = `We sent a code to <b>${escapeHtml(mask(email))}</b>. Enter it to confirm this ${escapeHtml(what)}.`;
      F.innerHTML = `<span>Didn't get it?</span><button type="button" class="pc-resend" id="pc-resend">Send a new code</button>`;
    }
    msg("");
    paint();
    if(m === "email" && !sent) send();
    setTimeout(() => { try{ input.focus({ preventScroll:true }); }catch(e){} }, 80);
  }
  function countdown(sec){
    clearInterval(timer);
    const b = root.querySelector("#pc-resend");
    if(!b) return;
    let left = sec;
    const tick = () => {
      const bb = root.querySelector("#pc-resend"); if(!bb){ clearInterval(timer); return; }
      if(left <= 0){ clearInterval(timer); bb.disabled = false; bb.textContent = "Send a new code"; return; }
      bb.disabled = true; bb.textContent = "Send again in " + left + "s"; left--;
    };
    tick(); timer = setInterval(tick, 1000);
  }
  async function send(){
    sent = true;
    msg("Sending the code…");
    const { error } = await supabase.auth.sendEmailCode(email);
    if(mode !== "email") return;
    if(error){
      const wait = /(\d+)\s*seconds?/i.exec(error.message || "");
      if(wait){ countdown(Number(wait[1])); msg("We just sent you a code. Please check your inbox."); return; }
      msg(/rate limit/i.test(error.message || "") ? "Too many emails right now. Please try again in a few minutes." : (error.message || "We could not send the code. Please try again."), true);
      const b = root.querySelector("#pc-resend"); if(b) b.disabled = false;
      return;
    }
    countdown(60);
    msg("Code sent. It can take a minute to arrive — check Spam too.");
  }
  function bad(text){
    root.classList.remove("is-bad"); void root.offsetWidth; root.classList.add("is-bad");
    msg(text, true);
    root.querySelector("#pc-input").select();
  }
  async function verify(){
    if(busy) return;
    const input = root.querySelector("#pc-input"), code = input.value;
    if(code.length < 6){ msg(mode === "pin" ? "Enter all 6 numbers of your PIN." : "Enter the full 6-digit code.", true); input.focus(); return; }
    busy = true;
    const btn = root.querySelector("#pc-ok");
    btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner"></span>';
    let fail = "";
    if(mode === "pin"){
      const { data, error } = await supabase.rpc("verify_pay_pin", { p_pin: code });
      if(error) fail = error.message || "We could not check your PIN.";
      else if(!data || !data.ok){
        fail = (data && data.error) || "Wrong PIN.";
        if(data && data.locked){ PaySec.invalidate(); modes = modes.filter(x => x !== "pin"); paintWays(); }
      }
    } else if(mode === "totp"){
      const { error } = await supabase.auth.mfa.verifyCode(sec.totp_factor, code);
      if(error) fail = /invalid|expired|code|totp/i.test(error.message || "") ? "That code didn't match. Wait for the next code in the app and try again." : (error.message || "We could not check the code.");
    } else {
      const { error } = await supabase.auth.verifyEmailCode({ email, token: code });
      if(error) fail = /expired|invalid|not valid|token/i.test(error.message || "") ? "This code is wrong or has expired. Check the email or get a new code." : (error.message || "We could not check the code.");
    }
    btn.disabled = false; btn.querySelector(".btn-label").textContent = "Verify and continue";
    busy = false;
    if(fail){
      bad(fail);
      if(mode === "pin" && !modes.includes("pin")){ const o = modes[0]; if(o) setTimeout(() => { setMode(o); msg(fail, true); }, 900); }
      return;
    }
    verifiedAt = Date.now();
    root.classList.add("is-good");
    msg("Verified.");
    setTimeout(() => close(true), 450);
  }
  function forgotPin(){
    const o = modes.find(m => m !== "pin");
    if(o){
      setMode(o);
      msg("Confirm this way for now. You can set a new PIN in Profile → Payment security.");
    } else {
      close(false);
      Router.go("profile");
      setTimeout(() => { const c = document.getElementById("sec-card"); if(c) c.scrollIntoView({ behavior:"smooth", block:"start" }); }, 500);
    }
  }
  function paintWays(){
    const w = root.querySelector("#pc-ways");
    w.hidden = modes.length < 2;
    w.innerHTML = modes.map(m => `<button type="button" role="tab" data-pc-way="${m}" class="${m === mode ? "active" : ""}" aria-selected="${m === mode}">${ICON[m]}<span>${NAME[m]}</span></button>`).join("");
  }
  function close(result){
    if(!root || root.hidden) return;
    clearInterval(timer);
    root.classList.remove("is-open");
    document.documentElement.classList.toggle("pc-lock", typeof PaySec !== "undefined" && PaySec.isOpen);
    setTimeout(() => { root.hidden = true; }, 300);
    const r = resolver; resolver = null;
    if(r) r(!!result);
  }

  /** ask({ what, methods }) — methods limits the ways (used when setting up security) */
  async function ask(o){
    o = o || {};
    const force = Array.isArray(o.methods);
    if(!force){
      const rates = await PayRates.get(true);
      if(!rates.email_code) return true;                       // switched off in the admin panel
    }
    email = (AppState.user && AppState.user.email) || "";
    if(!email){ toast("We could not find your email. Please log in again.", "error"); return false; }
    sec = await PaySec.status(true);
    const want = force ? o.methods : ["pin", "totp", "email"];
    modes = want.filter(m => m === "email" || (m === "pin" && sec && sec.pin_set && !sec.pin_locked_min) || (m === "totp" && sec && sec.totp_trusted && sec.totp_factor));
    if(!modes.length) modes = ["email"];
    what = o.what || "payment";
    sent = false;
    if(!root) build();
    mode = modes[0];
    paintWays();
    root.hidden = false;
    document.documentElement.classList.add("pc-lock");
    void root.offsetWidth;
    root.classList.add("is-open");
    setMode(modes[0]);
    return new Promise(res => { resolver = res; });
  }
  // after a payment went through, the next one needs a new check
  function used(){ verifiedAt = 0; }
  function isCodeError(err){ return /EMAIL_CODE_REQUIRED/.test((err && err.message) || ""); }
  return { ask, used, isCodeError };
})();

/* ---------------- Payment security: Google Authenticator + Pay PIN (Profile) ---------------- */
const PaySec = (function(){
  const STORE = {
    android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
    ios: "https://apps.apple.com/app/google-authenticator/id388497605"
  };
  let st = null, at = 0, wired = false, root = null, sheetResolve = null;

  async function status(force){
    if(!force && st && Date.now() - at < 30000) return st;
    try{
      const { data, error } = await supabase.rpc("get_my_pay_security");
      if(!error && data){ st = data; at = Date.now(); }
    }catch(e){}
    return st;
  }
  function invalidate(){ at = 0; }
  const errText = e => String((e && e.message) || e || "Something went wrong.").replace(/^(SECOND_FACTOR_REQUIRED|EMAIL_CODE_REQUIRED):\s*/, "").replace(/^Postgres error:\s*/i, "");

  /* ----- the card on the Profile page ----- */
  function paint(s){
    const card = document.getElementById("sec-card"); if(!card) return;
    s = s || {};
    const chip = (el, text, on) => { el.textContent = text; el.className = "ps-chip" + (on ? " is-on" : ""); };
    chip(document.getElementById("ps-email-chip"), s.email_code === false ? "Not needed" : "On", s.email_code !== false);
    const tSub = document.getElementById("ps-totp-sub"), tBtn = document.getElementById("ps-totp-btn");
    if(s.totp_trusted){ chip(document.getElementById("ps-totp-chip"), "On", true); tSub.textContent = "Codes come from the app on your phone. No email needed."; tBtn.textContent = "Turn off"; tBtn.dataset.act = "totp-off"; }
    else if(s.totp_on){ chip(document.getElementById("ps-totp-chip"), "Not confirmed", false); tSub.textContent = "Confirm it with an email code to start using it."; tBtn.textContent = "Confirm"; tBtn.dataset.act = "totp-confirm"; }
    else { chip(document.getElementById("ps-totp-chip"), "Off", false); tSub.textContent = "A 6-digit code from the app on your phone. Works without email."; tBtn.textContent = "Set up"; tBtn.dataset.act = "totp-setup"; }
    const pSub = document.getElementById("ps-pin-sub"), pBtn = document.getElementById("ps-pin-btn"), pF = document.getElementById("ps-pin-forgot");
    if(s.pin_set){
      chip(document.getElementById("ps-pin-chip"), s.pin_locked_min ? "Locked" : "On", !s.pin_locked_min);
      pSub.textContent = s.pin_locked_min ? `Too many wrong tries. Open again in ${s.pin_locked_min} min, or reset it.` : "Your own 6-number PIN. The fastest way.";
      pBtn.textContent = "Change PIN"; pBtn.dataset.act = "pin-change"; pF.hidden = false;
    } else {
      chip(document.getElementById("ps-pin-chip"), "Off", false);
      pSub.textContent = "Make your own 6-number PIN. The fastest way.";
      pBtn.textContent = "Create PIN"; pBtn.dataset.act = "pin-create"; pF.hidden = true;
    }
  }
  async function refresh(){
    if(!document.getElementById("sec-card")) return;
    wire();
    paint(await status(true));
  }
  function wire(){
    if(wired) return; wired = true;
    document.getElementById("sec-card").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if(!b) return;
      ({ "totp-setup": setupTotp, "totp-off": turnOffTotp, "totp-confirm": confirmTotp, "pin-create": () => newPin("create"), "pin-forgot": () => newPin("forgot"), "pin-change": changePin })[b.dataset.act]();
    });
  }

  /* ----- the sheet used for every step ----- */
  function build(){
    root = document.createElement("div");
    root.className = "pc ps"; root.hidden = true;
    root.innerHTML = `<div class="pc-scrim" data-ps-close></div>
      <div class="pc-card ps-card" role="dialog" aria-modal="true" aria-labelledby="ps-title">
        <button type="button" class="pc-x" data-ps-close aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        <div class="ps-body" id="ps-body"></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll("[data-ps-close]").forEach(el => el.addEventListener("click", () => close()));
    root.addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); close(); } });
  }
  function show(html){
    if(!root) build();
    const body = root.querySelector("#ps-body");
    body.innerHTML = html;
    body.classList.remove("is-swap"); void body.offsetWidth; body.classList.add("is-swap");
    if(root.hidden){
      root.hidden = false;
      document.documentElement.classList.add("pc-lock");
      void root.offsetWidth;
      root.classList.add("is-open");
    }
    root.querySelector(".ps-card").scrollTop = 0;
    return body;
  }
  function close(){
    if(!root || root.hidden) return;
    root.classList.remove("is-open");
    document.documentElement.classList.remove("pc-lock");
    setTimeout(() => { root.hidden = true; }, 300);
    const r = sheetResolve; sheetResolve = null; if(r) r(null);
    refresh();
  }
  function step(n, total){ return total ? `<p class="pc-kicker">Step ${n} of ${total}</p>` : ""; }

  // 6 boxes for a code or a PIN; resolves with the value or null when closed
  function askBoxes({ kicker, title, lead, masked, button, error, extra }){
    const body = show(`
      ${kicker || ""}
      <h3 id="ps-title">${title}</h3>
      <p class="pc-lead">${lead}</p>
      <div class="pc-boxes${masked ? " is-pin" : ""}" id="ps-boxes"><input class="pc-input" id="ps-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="${masked ? "off" : "one-time-code"}" aria-label="${masked ? "PIN" : "Code"}"></div>
      <p class="pc-msg${error ? " is-bad" : ""}" id="ps-msg" role="status">${error ? escapeHtml(error) : ""}</p>
      <button type="button" class="btn btn-primary pc-ok" id="ps-ok"><span class="btn-label">${button || "Continue"}</span></button>
      ${extra || ""}`);
    const input = body.querySelector("#ps-input"), box = body.querySelector("#ps-boxes");
    const paintBoxes = () => {
      const v = input.value, focused = document.activeElement === input;
      box.querySelectorAll(".pc-cell").forEach(c => c.remove());
      for(let i = 0; i < 6; i++){
        const c = document.createElement("span");
        c.className = "pc-cell" + (v[i] ? " is-filled" : "") + (focused && i === Math.min(v.length, 5) ? " is-on" : "");
        c.textContent = v[i] ? (masked ? "•" : v[i]) : "";
        box.insertBefore(c, input);
      }
    };
    return new Promise(res => {
      sheetResolve = res;
      const done = () => {
        if(input.value.length < 6){ const m = body.querySelector("#ps-msg"); m.textContent = masked ? "Enter all 6 numbers." : "Enter the full 6-digit code."; m.classList.add("is-bad"); input.focus(); return; }
        const r = sheetResolve; sheetResolve = null; if(r) r(input.value);
      };
      input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); root.classList.remove("is-bad"); paintBoxes(); if(input.value.length === 6) done(); });
      input.addEventListener("focus", paintBoxes); input.addEventListener("blur", paintBoxes);
      box.addEventListener("click", () => input.focus());
      body.querySelector("#ps-ok").addEventListener("click", done);
      paintBoxes();
      if(error){ root.classList.remove("is-bad"); void root.offsetWidth; root.classList.add("is-bad"); }
      setTimeout(() => { try{ input.focus({ preventScroll:true }); }catch(e){} }, 120);
    });
  }
  function busy(on, label){
    const b = root && root.querySelector("#ps-ok");
    if(!b) return;
    b.disabled = !!on;
    b.querySelector(".btn-label").innerHTML = on ? '<span class="spinner"></span>' : (label || "Continue");
  }
  function finish(title, lead){
    root.classList.remove("is-bad");
    const body = show(`
      <div class="ps-done"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div>
      <h3 id="ps-title">${title}</h3>
      <p class="pc-lead">${lead}</p>
      <button type="button" class="btn btn-primary pc-ok" id="ps-ok"><span class="btn-label">Done</span></button>`);
    body.querySelector("#ps-ok").addEventListener("click", () => close());
  }
  function problem(title, text){
    const body = show(`<h3 id="ps-title">${title}</h3><p class="pc-lead">${escapeHtml(text)}</p>
      <button type="button" class="btn btn-secondary pc-ok" id="ps-ok"><span class="btn-label">Close</span></button>`);
    body.querySelector("#ps-ok").addEventListener("click", () => close());
  }
  function choose(html){
    // a screen with buttons; resolves with the data-go of the button pressed (null when closed)
    const body = show(html);
    return new Promise(res => {
      sheetResolve = res;
      body.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if(!g) return; const r = sheetResolve; sheetResolve = null; if(r) r(g.dataset.go); });
    });
  }
  async function copy(text, btn){
    try{ await navigator.clipboard.writeText(text); }catch(e){
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try{ document.execCommand("copy"); }catch(_){} t.remove();
    }
    if(btn){ const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = o; }, 1500); }
  }
  // confirm it's you before changing security (email code, or the authenticator if it is set up)
  async function confirmFirst(what, emailOnly){
    const s = await status(true);
    const methods = !emailOnly && s && s.totp_trusted ? ["totp", "email"] : ["email"];
    return PayCode.ask({ methods, what });
  }

  /* ----- Google Authenticator ----- */
  async function setupTotp(){
    const go = await choose(`
      ${step(1, 3)}
      <h3 id="ps-title">Get the app</h3>
      <p class="pc-lead">Install <b>Google Authenticator</b> on your phone. It's free. Microsoft Authenticator or Authy work too.</p>
      <div class="ps-stores">
        <a class="ps-store" href="${STORE.android}" target="_blank" rel="noopener"><small>Android</small><b>Google Play</b></a>
        <a class="ps-store" href="${STORE.ios}" target="_blank" rel="noopener"><small>iPhone</small><b>App Store</b></a>
      </div>
      <p class="ps-note">Next we email you a code, to make sure it's really you adding it.</p>
      <button type="button" class="btn btn-primary pc-ok" data-go="next"><span class="btn-label">I have the app</span></button>`);
    if(go !== "next") return;
    const ok = await confirmFirst("Google Authenticator setup", true);
    if(!ok) return;
    show(`<h3 id="ps-title">Getting your code ready…</h3><p class="pc-lead">One moment.</p><div class="skel" style="height:180px;border-radius:16px;margin-top:16px;"></div>`);
    // clear old setups that were never finished
    const old = await supabase.auth.mfa.factors();
    if(old.data) for(const f of old.data.filter(f => f.status !== "verified")) await supabase.auth.mfa.unenroll(f.id);
    const en = await supabase.auth.mfa.enroll("Repuven " + new Date().toISOString().slice(0, 16));
    if(en.error || !en.data || !en.data.id) return problem("Couldn't start the setup", errText(en.error || "Please try again."));
    const fid = en.data.id, totp = en.data.totp || {};
    const ap = await supabase.rpc("approve_my_authenticator", { p_factor: fid });
    if(ap.error) return problem("Couldn't start the setup", errText(ap.error));
    // Supabase sends the QR code as SVG markup (older servers add "data:image/svg+xml;utf-8," in front)
    let qr = String(totp.qr_code || "").trim();
    const pre = /^data:image\/svg\+xml;(?:utf-8|charset=utf-8),/i;
    if(pre.test(qr)) qr = qr.replace(pre, "");
    if(/^(<\?xml|<svg)/i.test(qr)) qr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr);
    else if(!/^data:image\//i.test(qr)) qr = "";
    const key = String(totp.secret || "");
    const keyShown = key.replace(/(.{4})/g, "$1 ").trim();
    const go2 = await choose(`
      ${step(2, 3)}
      <h3 id="ps-title">Add Repuven to the app</h3>
      <p class="pc-lead">In Google Authenticator tap <b>+</b>, then <b>Scan a QR code</b>, and point the camera at this code.</p>
      <div class="ps-qr">${qr ? `<img src="${escapeHtml(qr)}" alt="QR code for Google Authenticator">` : ""}</div>
      <div class="ps-same">
        <b>Using this same phone?</b>
        <span>Tap the button below, or in the app tap <b>+</b> → <b>Enter a setup key</b> and type this key:</span>
        <div class="ps-key"><code>${escapeHtml(keyShown)}</code><button type="button" class="btn btn-secondary btn-sm" id="ps-copy-key">Copy</button></div>
        <span class="ps-small">Account name: your email · Type of key: Time based</span>
        ${totp.uri ? `<a class="btn btn-secondary ps-open" href="${escapeHtml(totp.uri)}">Open in Authenticator</a>` : ""}
      </div>
      <button type="button" class="btn btn-primary pc-ok" data-go="next"><span class="btn-label">I added it — next</span></button>`);
    if(go2 !== "next") return;
    let err = "";
    for(;;){
      const code = await askBoxes({ kicker: step(3, 3), title: "Type the code from the app",
        lead: "The app now shows <b>Repuven</b> with a 6-digit code that changes every 30 seconds. Type the code you see now.",
        button: "Turn on", error: err });
      if(code === null) return;
      busy(true);
      const v = await supabase.auth.mfa.verifyCode(fid, code);
      if(!v.error) break;
      err = "That code didn't match. Wait for the next code in the app and try again.";
    }
    invalidate();
    try{ await supabase.rpc("burn_my_codes"); }catch(e){}
    PayCode.used();
    finish("Google Authenticator is on", "When you withdraw or send money, choose <b>Authenticator</b> and type the code from the app. Keep the app on your phone. If you change phones, turn it off here first or ask Support to reset it.");
  }
  async function confirmTotp(){
    const s = await status(true);
    if(!s || !s.totp_factor) return refresh();
    const ok = await confirmFirst("Google Authenticator", true);
    if(!ok) return;
    const ap = await supabase.rpc("approve_my_authenticator", { p_factor: s.totp_factor });
    invalidate();
    if(ap.error) return problem("Couldn't confirm it", errText(ap.error));
    toast("Google Authenticator is on.", "success");
    refresh();
  }
  async function turnOffTotp(){
    const s = await status(true);
    if(!s || !s.totp_factor) return refresh();
    let err = "";
    for(;;){
      const code = await askBoxes({ title: "Turn off Google Authenticator?",
        lead: "Type the 6-digit code from the app to turn it off. After that you confirm payments with an email code or your Pay PIN.",
        button: "Turn off", error: err,
        extra: `<p class="ps-note">Lost your phone? Message us in Support Chat and we can turn it off for you.</p>` });
      if(code === null) return;
      busy(true);
      const v = await supabase.auth.mfa.verifyCode(s.totp_factor, code);
      if(v.error){ err = "That code didn't match. Wait for the next code in the app and try again."; continue; }
      const d = await supabase.auth.mfa.unenroll(s.totp_factor);
      if(d.error) return problem("Couldn't turn it off", errText(d.error));
      break;
    }
    invalidate();
    try{ await supabase.rpc("burn_my_codes"); }catch(e){}
    PayCode.used();
    finish("Google Authenticator is off", "You can turn it on again any time from this page.");
  }

  /* ----- Pay PIN ----- */
  async function pickPin(title, lead){
    let err = "";
    for(;;){
      const p1 = await askBoxes({ title, lead, masked: true, button: "Next", error: err });
      if(p1 === null) return null;
      if(/^(\d)\1{5}$/.test(p1) || ["123456","654321","012345","123123","112233","121212"].includes(p1)){ err = "This PIN is too easy to guess. Please choose another one."; continue; }
      const p2 = await askBoxes({ title: "Type it again", lead: "Enter the same 6 numbers once more.", masked: true, button: "Save PIN" });
      if(p2 === null) return null;
      if(p1 !== p2){ err = "The two PINs were not the same. Please start again."; continue; }
      return p1;
    }
  }
  async function newPin(kind){
    const ok = await confirmFirst(kind === "forgot" ? "PIN reset" : "new Pay PIN");
    if(!ok) return;
    const pin = await pickPin(kind === "forgot" ? "Choose a new Pay PIN" : "Create your Pay PIN",
      "Choose 6 numbers that only you know. Don't use your birthday, your phone number or 123456.");
    if(!pin) return;
    busy(true);
    const { data, error } = await supabase.rpc("set_pay_pin", { p_new: pin, p_old: null });
    invalidate();
    if(error || !data || !data.ok) return problem("Couldn't save your PIN", errText(error || (data && data.error)));
    finish(kind === "forgot" ? "Your new PIN is ready" : "Your Pay PIN is ready",
      "Next time you withdraw or send money, choose <b>Pay PIN</b> and type your 6 numbers. Never share your PIN with anyone.");
  }
  async function changePin(){
    let err = "";
    let old;
    for(;;){
      old = await askBoxes({ title: "Enter your current PIN", lead: "Type the 6-number PIN you use now.", masked: true, button: "Next", error: err,
        extra: `<div class="pc-foot"><button type="button" class="pc-resend" data-forgot>Forgot PIN?</button></div>` });
      if(old === null) return;
      break;
    }
    const pin = await pickPin("Choose a new PIN", "Choose 6 new numbers that only you know.");
    if(!pin) return;
    busy(true);
    const { data, error } = await supabase.rpc("set_pay_pin", { p_new: pin, p_old: old });
    invalidate();
    if(error) return problem("Couldn't change your PIN", errText(error));
    if(!data || !data.ok) return problem("Your current PIN was wrong", (data && data.error) || "Please try again. If you forgot it, tap Forgot PIN?");
    finish("Your PIN is changed", "Use your new PIN from now on.");
  }
  // "Forgot PIN?" inside the change screen
  document.addEventListener("click", e => {
    if(e.target.closest("#ps-body [data-forgot]")){ const r = sheetResolve; sheetResolve = null; if(r) r(null); newPin("forgot"); }
  });

  return { status, invalidate, refresh, get isOpen(){ return !!(root && !root.hidden); } };
})();
window.PayCode = PayCode; window.PaySec = PaySec;
/* keep pop-ups and code sheets in the visible part of the screen (above the phone keyboard) */
(function(){
  const vv = window.visualViewport;
  if(!vv) return;
  const set = () => {
    const r = document.documentElement.style;
    r.setProperty("--vvh", Math.round(vv.height) + "px");
    r.setProperty("--vvt", Math.round(vv.offsetTop) + "px");
  };
  vv.addEventListener("resize", set);
  vv.addEventListener("scroll", set);
  set();
  // when a code box gets focus, keep it in view
  document.addEventListener("focusin", e => {
    const el = e.target;
    if(!el || !el.closest) return;
    const card = el.closest(".pc-card, .ann-card");
    if(card) setTimeout(() => { try{ el.closest(".pc-boxes, .field, .pc-card")?.scrollIntoView({ block:"center", behavior:"smooth" }); }catch(_){} }, 250);
  });
})();

function cleanCodeErr(err){ return String((err && err.message) || "").replace(/^EMAIL_CODE_REQUIRED:\s*/, ""); }

/* ---------------- Announcements: a pop-up right after login ---------------- */
const Announce = (function(){
  const SEEN_KEY = "srv_ann_seen";   // shown once per login (a new login clears it)
  let root = null, list = [], idx = 0, timer = null, lastFocus = null;
  const seen = () => { try{ return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); }catch(e){ return []; } };
  function markSeen(ids){ try{ localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen(), ...ids])].slice(-50))); }catch(e){} }
  /** a fresh login shows running announcements again */
  function reset(){ try{ localStorage.removeItem(SEEN_KEY); }catch(e){} }

  function build(){
    root = document.createElement("div");
    root.className = "ann";
    root.id = "announcement-pop";
    root.hidden = true;
    root.innerHTML = `
      <div class="ann-scrim" data-ann-close></div>
      <div class="ann-card" role="dialog" aria-modal="true" aria-labelledby="ann-title" tabindex="-1">
        <button type="button" class="ann-x" data-ann-close aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        <div class="ann-media"><img alt="" decoding="async"></div>
        <div class="ann-body">
          <p class="ann-kicker"><span>Announcement</span><span class="ann-count"></span></p>
          <h3 class="ann-title" id="ann-title"></h3>
          <div class="ann-text"></div>
          <div class="ann-foot">
            <span class="ann-until"></span>
            <div class="ann-actions">
              <button type="button" class="btn btn-secondary ann-next">Next</button>
              <button type="button" class="btn btn-primary ann-ok">Got it</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll("[data-ann-close]").forEach(el => el.addEventListener("click", close));
    root.querySelector(".ann-ok").addEventListener("click", close);
    root.querySelector(".ann-next").addEventListener("click", () => show(idx + 1));
    root.querySelector(".ann-media img").addEventListener("error", e => { e.target.closest(".ann-media").hidden = true; });
    root.addEventListener("keydown", e => {
      if(e.key === "Escape"){ e.preventDefault(); close(); }
      if(e.key === "Tab"){
        const f = [...root.querySelectorAll(".ann-card button")].filter(b => b.offsetParent !== null);
        if(!f.length) return;
        if(e.shiftKey && (document.activeElement === f[0] || document.activeElement === root.querySelector(".ann-card"))){ e.preventDefault(); f[f.length - 1].focus(); }
        else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
      }
    });
  }

  function until(d){
    const t = new Date(d);
    if(isNaN(t)) return "";
    return "Until " + t.toLocaleDateString("en-US", { month:"short", day:"numeric" }) + ", " + t.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  }

  function show(i){
    idx = Math.max(0, Math.min(i, list.length - 1));
    const a = list[idx];
    const card = root.querySelector(".ann-card");
    const media = card.querySelector(".ann-media"), img = media.querySelector("img");
    media.hidden = !a.image_url;
    if(a.image_url){ img.src = a.image_url; img.alt = a.title || ""; } else { img.removeAttribute("src"); }
    card.querySelector(".ann-title").textContent = a.title || "";
    card.querySelector(".ann-text").textContent = a.body || "";
    card.querySelector(".ann-text").hidden = !a.body;
    card.querySelector(".ann-until").textContent = until(a.ends_at);
    card.querySelector(".ann-count").textContent = list.length > 1 ? (idx + 1) + " of " + list.length : "";
    const more = idx < list.length - 1;
    card.querySelector(".ann-next").hidden = !more;
    card.classList.remove("is-swap"); void card.offsetWidth; card.classList.add("is-swap");
  }

  function open(){
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("ann-lock");
    void root.offsetWidth;
    root.classList.add("is-open");
    requestAnimationFrame(() => { try{ root.querySelector(".ann-card").focus({ preventScroll: true }); }catch(e){} });
  }

  function close(){
    if(!root || root.hidden) return;
    markSeen(list.map(a => a.id));
    root.classList.remove("is-open");
    document.documentElement.classList.remove("ann-lock");
    setTimeout(() => { root.hidden = true; }, 280);
    try{ if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }catch(e){}
  }

  async function check(){
    if(!AppState.session || (root && !root.hidden)) return;
    const app = document.getElementById("view-app");
    if(!app || app.style.display === "none") return;
    if(ConfirmSheet.isOpen){ schedule(4000); return; }
    const { data, error } = await supabase.rpc("get_active_announcements");
    if(error || !Array.isArray(data)) return;
    const s = seen();
    list = data.filter(a => a && a.id && !s.includes(a.id));
    if(!list.length) return;
    if(!root) build();
    show(0);
    open();
  }
  function schedule(ms){ clearTimeout(timer); timer = setTimeout(check, ms || 1000); }

  return { check, schedule, reset, close, get isOpen(){ return !!(root && !root.hidden); } };
})();

/* ---------------- Mailbox: a new message pops up once by itself ---------------- */
const MailPop = (function(){
  let root = null, list = [], idx = 0, busy = false, lastFocus = null;
  function stamp(v){ const t = v ? new Date(v).getTime() : 0; return isNaN(t) ? 0 : t; }
  function build(){
    root = document.createElement("div");
    root.className = "ann mail-pop";
    root.id = "mail-pop";
    root.hidden = true;
    root.innerHTML = `
      <div class="ann-scrim" data-mp-close></div>
      <div class="ann-card" role="dialog" aria-modal="true" aria-labelledby="mp-title" tabindex="-1">
        <button type="button" class="ann-x" data-mp-close aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button>
        <div class="ann-body">
          <p class="ann-kicker"><span class="mp-kicker">New message<i class="mp-kind"></i></span><span class="ann-count"></span></p>
          <div class="mp-lead"></div>
          <h3 class="ann-title" id="mp-title"></h3>
          <div class="mbx-from mp-from"><span class="mbx-av mp-av"></span><div><b>Repuven Team</b><span class="mp-date"></span></div></div>
          <div class="ann-text mp-text"></div>
          <div class="ann-foot">
            <button type="button" class="btn btn-secondary mp-open">Open Mailbox</button>
            <div class="ann-actions">
              <button type="button" class="btn btn-secondary ann-next">Next</button>
              <button type="button" class="btn btn-primary ann-ok">Got it</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll("[data-mp-close]").forEach(el => el.addEventListener("click", () => close()));
    root.querySelector(".ann-ok").addEventListener("click", () => close());
    root.querySelector(".ann-next").addEventListener("click", () => show(idx + 1));
    root.querySelector(".mp-open").addEventListener("click", () => { close(); Router.go("mailbox"); });
    root.addEventListener("keydown", e => {
      if(e.key === "Escape"){ e.preventDefault(); close(); }
      if(e.key === "Tab"){
        const f = [...root.querySelectorAll(".ann-card button")].filter(b => b.offsetParent !== null);
        if(!f.length) return;
        if(e.shiftKey && (document.activeElement === f[0] || document.activeElement === root.querySelector(".ann-card"))){ e.preventDefault(); f[f.length - 1].focus(); }
        else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function show(i){
    idx = Math.max(0, Math.min(i, list.length - 1));
    const m = list[idx], card = root.querySelector(".ann-card");
    const lead = card.querySelector(".mp-lead");
    lead.innerHTML = (window.Leadership && Leadership.mailHead) ? (Leadership.mailHead(m) || "") : "";
    lead.hidden = !lead.innerHTML;
    card.querySelector(".ann-title").textContent = m.title || "Message";
    card.querySelector(".mp-kind").textContent = MailLook.kind(m);
    card.querySelector(".mp-av").innerHTML = MailLook.avatar();
    card.querySelector(".mp-date").textContent = MailLook.long(m.created_at);
    card.querySelector(".ann-text").innerHTML = MailLook.body(m.body);
    card.querySelector(".ann-text").hidden = !m.body;
    card.querySelector(".ann-count").textContent = list.length > 1 ? (idx + 1) + " of " + list.length : "";
    card.querySelector(".ann-next").hidden = idx >= list.length - 1;
    card.scrollTop = 0;
    card.classList.remove("is-swap"); void card.offsetWidth; card.classList.add("is-swap");
  }
  async function markShown(){
    // the member has seen these: they do not pop up again, here or on another phone
    const newest = list.reduce((a, m) => Math.max(a, stamp(m.created_at)), 0);
    if(!newest || !AppState.user) return;
    const iso = new Date(newest).toISOString();
    const patch = { mailbox_popup_seen_at: iso };
    if(stamp(AppState.profile && AppState.profile.mailbox_last_read_at) < newest) patch.mailbox_last_read_at = iso;
    if(AppState.profile) Object.assign(AppState.profile, patch);
    try{ await supabase.from("profiles").update(patch).eq("id", AppState.user.id); }catch(e){}
    if(typeof refreshMailboxBadge === "function") refreshMailboxBadge();
  }
  function open(){
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("ann-lock");
    void root.offsetWidth;
    root.classList.add("is-open");
    requestAnimationFrame(() => { try{ root.querySelector(".ann-card").focus({ preventScroll: true }); }catch(e){} });
  }
  function close(){
    if(!root || root.hidden) return;
    markShown();
    root.classList.remove("is-open");
    document.documentElement.classList.remove("ann-lock");
    setTimeout(() => { root.hidden = true; }, 280);
    try{ if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }catch(e){}
  }
  async function check(){
    if(busy || !AppState.session || !AppState.user || !AppState.profile || AppState.isVip) return;
    if(root && !root.hidden) return;
    const app = document.getElementById("view-app");
    if(!app || app.style.display === "none") return;
    if((typeof Announce !== "undefined" && Announce.isOpen) || (typeof ConfirmSheet !== "undefined" && ConfirmSheet.isOpen)) return;   // try again on the next round
    if(location.hash.replace(/^#/, "").split(/[/?]/)[0] === "mailbox") return;                     // already reading the Mailbox
    const p = AppState.profile;
    const since = Math.max(stamp(p.mailbox_popup_seen_at), stamp(p.mailbox_last_read_at), stamp(p.created_at));
    busy = true;
    try{
      const { data, error } = await supabase.from("mailbox_messages").select("*").order("created_at", { ascending: false }).limit(20);
      if(error || !Array.isArray(data)) return;
      const fresh = data.filter(m => stamp(m.created_at) > since).reverse();   // oldest first
      if(!fresh.length) return;
      if(root && !root.hidden) return;
      list = fresh;
      if(!root) build();
      show(0);
      open();
    } finally { busy = false; }
  }
  return { check, close, get isOpen(){ return !!(root && !root.hidden); } };
})();

/* ---------------- Home: picture guide to a review task ---------------- */
const HomeGuide = (function(){
  let wired = false, box = null;
  function large(img){
    if(!box){
      box = document.createElement("div");
      box.className = "tut-large";
      box.hidden = true;
      box.innerHTML = `<button type="button" class="tut-large-x" aria-label="Close"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-x"/></svg></button><img alt="">`;
      document.body.appendChild(box);
      const close = () => { box.classList.remove("is-open"); setTimeout(() => { box.hidden = true; }, 220); };
      box.addEventListener("click", close);
      document.addEventListener("keydown", e => { if(e.key === "Escape" && !box.hidden) close(); });
    }
    box.querySelector("img").src = img.src;
    box.querySelector("img").alt = img.alt;
    box.hidden = false;
    void box.offsetWidth;
    box.classList.add("is-open");
  }
  function wire(){
    const track = document.getElementById("tut-track");
    if(!track || wired) return;
    wired = true;
    const prev = document.querySelector('#home-tutorial [data-tut="-1"]'), next = document.querySelector('#home-tutorial [data-tut="1"]');
    const nav = document.querySelector("#home-tutorial .tut-nav");
    const go = dir => {
      const card = track.querySelector(".tut-card");
      const w = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * .8;
      track.scrollBy({ left: dir * w, behavior: "smooth" });
    };
    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      nav.hidden = max <= 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    };
    track.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener("resize", sync);
    setTimeout(sync, 300);
    track.querySelectorAll(".tut-shot img").forEach(img => img.addEventListener("click", () => large(img)));
  }
  return { wire };
})();

function applyTheme(){
  document.documentElement.setAttribute("data-theme","dark");
  document.documentElement.setAttribute("data-accent","green");
}

/* ---------------- session state (loaded once, refreshed on auth changes) ---------------- */
const AppState = { session:null, user:null, profile:null, wallet:null, roles:[], isAdmin:false, isStaff:false, isVip:false, isInv:false, profileChecked:false };

/* Phone numbers: same rules as the server (srv_private.norm_phone).
   01XXXXXXXXX / 8801XXXXXXXXX / +8801XXXXXXXXX -> +8801XXXXXXXXX; other countries +<8-15 digits>. */
function normPhone(v){
  const s = String(v || "").replace(/[\s\-().]/g, "");
  if(/^01[3-9]\d{8}$/.test(s)) return "+88" + s;
  if(/^8801[3-9]\d{8}$/.test(s)) return "+" + s;
  if(/^\+8801[3-9]\d{8}$/.test(s)) return s;
  if(/^\+880/.test(s)) return null;
  if(/^00[1-9]\d{7,14}$/.test(s)) return "+" + s.slice(2);
  if(/^\+[1-9]\d{7,14}$/.test(s)) return s;
  return null;
}
function showPhone(v){ const s = String(v || ""); return /^\+8801\d{9}$/.test(s) ? "0" + s.slice(4) : s; }
async function getProfile(id){ const {data,error}=await supabase.from("profiles").select("*").eq("id",id).maybeSingle(); if(error) throw error; return data; }
async function getWallet(id){ const {data,error}=await supabase.from("wallets").select("*").eq("user_id",id).maybeSingle(); if(error) throw error; return data; }
async function getRoles(id){ const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",id); if(error) throw error; return (data||[]).map(r=>r.role); }
async function refreshWallet(){ if(!AppState.user) return; try{ AppState.wallet = await getWallet(AppState.user.id); }catch(e){ console.error(e); } }

async function loadAppState(){
  const { data:{ session } } = await supabase.auth.getSession();
  AppState.session = session;
  if(!session){ AppState.user=null; AppState.profile=null; AppState.wallet=null; AppState.roles=[]; AppState.isAdmin=false; AppState.isStaff=false; AppState.isVip=false; AppState.isInv=false; AppState.profileChecked=false; document.documentElement.removeAttribute("data-vip"); document.documentElement.removeAttribute("data-inv"); return false; }
  AppState.user = session.user;
  AppState.profileChecked = false;
  try{
    const [profile, roles] = await Promise.all([ getProfile(session.user.id), getRoles(session.user.id) ]);
    AppState.profile = profile;
    AppState.profileChecked = true;
    AppState.roles = roles;
    AppState.isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    AppState.isStaff = AppState.isAdmin || roles.includes("MODERATOR") || roles.includes("FINANCE_ADMIN");
    AppState.isVip = !!(profile && profile.is_vip) && !AppState.isAdmin;
    document.documentElement.toggleAttribute("data-vip", AppState.isVip);
    AppState.isInv = !!(profile && profile.is_investor) && !AppState.isAdmin && !AppState.isVip;
    document.documentElement.toggleAttribute("data-inv", AppState.isInv);
    AppState.wallet = await getWallet(session.user.id);
    await loadSectors();
    applyTheme(profile);
    if(profile && window.__teamAccess) window.__teamAccess.check();
    if(profile && !profile.phone){
      let told = false;
      try{ told = sessionStorage.getItem("srv_phone_told") === profile.id; sessionStorage.setItem("srv_phone_told", profile.id); }catch(e){}
      if(!told) setTimeout(() => toast("Please add your active phone number in Profile.", "info"), 1500);
    }
  }catch(e){ console.error(e); toast("Couldn't load your account. Please refresh.", "error"); }
  return true;
}

/* ---------------- Supportive admin: an account made with a team link (?sa=TOKEN) ----------------
   The first check after sign-in connects the account to its link. A supportive admin gets a
   Team page in the menu and does their work there, inside this website. */
window.__teamAccess = (function(){
  let acc = null, checkedFor = null, done = false;
  async function check(){
    const uid = AppState.user && AppState.user.id;
    if(!uid){ acc = null; checkedFor = null; paint(); return; }
    if(checkedFor === uid){ paint(); return; }
    checkedFor = uid;
    done = false;
    try{ const { data } = await supabase.rpc("get_my_helper_access"); acc = data && data.member ? data : null; }catch(e){ acc = null; }
    done = true;
    paint();
    if(acc && acc.active){
      let told = false;
      try{ told = sessionStorage.getItem("srv_sa_told") === uid; sessionStorage.setItem("srv_sa_told", uid); }catch(e){}
      if(!told) toast("You are a supportive admin. Your Team page is in the menu.", "success");
    }
    if(parseHash().page === "team") route();
  }
  function active(){ return !!(acc && acc.active); }
  function checked(){ return !!(AppState.user && checkedFor === AppState.user.id && done); }
  function paint(){
    const side = document.getElementById("app-sidebar");
    if(!side) return;
    const nav = side.querySelector("nav");
    let el = side.querySelector('.nav-link[data-navkey="team"]');
    if(!(acc && acc.active)){ if(el) el.remove(); return; }
    if(!el && nav){
      el = document.createElement("a");
      el.className = "nav-link"; el.dataset.navkey = "team"; el.href = "#team";
      el.innerHTML = '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7" r="2.6"/><path d="M2.8 16c0-2.6 2.1-4.4 4.7-4.4s4.7 1.8 4.7 4.4"/><circle cx="14" cy="7.8" r="2.1"/><path d="M13.6 11.7c2.2 0 3.9 1.6 3.9 3.9"/></svg><span>Team</span>';
      nav.appendChild(el);
      if(parseHash().page === "team") el.classList.add("active");
    }
  }
  return { check, paint, active, checked };
})();

/* A signed-in person without a member profile gets their account set up here. This is how a
   new account is finished after the link in the confirmation email: that link signs the
   person in while the page loads, before boot() starts listening for sign-ins. */
let __setupTriedFor = null;
async function setupAccountIfNeeded(){
  if(!AppState.session || !AppState.user || window.__ssFormAuth) return;
  if(AppState.profile || AppState.isAdmin || !AppState.profileChecked) return;
  if(__setupTriedFor === AppState.user.id) return;
  __setupTriedFor = AppState.user.id;
  const { error } = await supabase.rpc("ensure_super_survey_profile");
  if(error){
    const msg = String(error.message || "").replace(/^Postgres error:\s*/i, "");
    console.error("Repuven account setup failed:", error);
    if(/not a robot/i.test(msg)){
      // made on an old page without the robot check: logging in (with the check) finishes it
      await supabase.auth.signOut();
      await loadAppState();
      await new Promise(r => setTimeout(r, 300));
      Router.go("auth/signin");
      toast(msg, "error");
      return;
    }
    toast(msg || "We couldn't finish setting up your account. Please refresh the page.", "error");
    return;
  }
  await loadAppState();
}

/* The link in an email (confirm your email, sign in) opens the site already signed in.
   Tidy the address bar so the page opens normally, and say what happened. */
function takeEmailLinkResult(){
  if(!isAuthCallbackHash() || isRecoveryHash()) return "";
  const hp = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  const qp = new URLSearchParams(location.search || "");
  const failed = !!(hp.get("error") || hp.get("error_description") || qp.get("error") || qp.get("error_description"));
  const type = hp.get("type") || qp.get("type") || "";
  ["code", "type", "error", "error_code", "error_description"].forEach(k => qp.delete(k));
  const rest = qp.toString();
  history.replaceState(null, "", location.pathname + (rest ? "?" + rest : ""));
  if(AppState.session) return type === "signup" ? "confirmed" : "signed-in";
  return failed ? "expired" : "";
}

/** Returns a snapshot ctx object matching each page module's expected shape, or null if the
 *  page requires admin and the current user isn't one. */
function ctxFor(opts){
  opts = opts || {};
  if(opts.adminOnly && !AppState.isAdmin) return null;
  return { session:AppState.session, user:AppState.user, profile:AppState.profile, wallet:AppState.wallet, roles:AppState.roles, isAdmin:AppState.isAdmin, isStaff:AppState.isStaff };
}


async function refreshMailboxBadge(){
  refreshSupportBadge();
  if(!AppState.user || AppState.isVip){ paintMailCount(0); return; }
  const {data,error}=await supabase.from("mailbox_messages").select("created_at").order("created_at",{ascending:false}).limit(100);
  if(error)return;
  const last=AppState.profile && AppState.profile.mailbox_last_read_at ? new Date(AppState.profile.mailbox_last_read_at).getTime() : 0;
  const n=(data||[]).filter(x=>new Date(x.created_at).getTime()>last).length;
  paintMailCount(n);
  MailPop.check();
}
function paintMailCount(n){
  const btn=document.getElementById("tb-mail"), c=document.getElementById("tb-mail-count");
  if(btn){ btn.hidden = !AppState.user || AppState.isVip; btn.classList.toggle("has-new", n>0); btn.setAttribute("aria-label", n>0 ? `Mailbox, ${n} new` : "Mailbox"); }
  if(c){ c.hidden = !n; c.textContent = n>9 ? "9+" : String(n); }
}
async function signOut(){
  if(Modules.team) Modules.team.close();
  await supabase.auth.signOut();
  Router.go("");
}

/* ---------------- work sectors (Survey and any others the admin adds) ---------------- */
const SECTOR_ICONS = {
  clipboard:'<rect x="3.5" y="6" width="13" height="10" rx="1.5"/><path d="M7 6V4.5a3 3 0 0 1 6 0V6"/>',
  star:'<path d="m10 3.5 1.9 4 4.3.5-3.2 3 .9 4.3L10 13.1l-3.9 2.2.9-4.3-3.2-3 4.3-.5L10 3.5Z"/>',
  phone:'<rect x="6" y="2.5" width="8" height="15" rx="2"/><path d="M9 15h2"/>',
  video:'<rect x="3" y="5.5" width="10" height="9" rx="2"/><path d="m13 9 4-2.5v7L13 11"/>',
  chat:'<path d="M4 5.5h12v8H8l-4 3v-11Z"/>',
  globe:'<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3Z"/>',
  pen:'<path d="m12.5 4.5 3 3L7 16H4v-3l8.5-8.5Z"/>',
  cart:'<path d="M3 4h2l1.6 8.5h8.2L16.5 7H6"/><circle cx="8" cy="15.5" r="1"/><circle cx="14" cy="15.5" r="1"/>',
  megaphone:'<path d="M4 8.5v3h2.5L13 15V5L6.5 8.5H4Z"/><path d="M15.5 8a3 3 0 0 1 0 4"/>',
  gift:'<rect x="3.5" y="8" width="13" height="8.5" rx="1"/><path d="M3 8h14M10 8v8.5M10 8C8.5 5 6 5 6 6.5S8 8 10 8Zm0 0c1.5-3 4-3 4-1.5S12 8 10 8Z"/>'
};
async function loadSectors(){
  try{
    const { data, error } = await supabase.from("work_sectors").select("id,name,slug,description,icon,sort_order,is_default,is_active").eq("is_active", true).order("sort_order").order("created_at");
    if(error) throw error;
    AppState.sectors = (data || []).length ? data : null;
  }catch(e){ AppState.sectors = null; }
  return AppState.sectors;
}
function defaultSector(){ const l = AppState.sectors || []; return l.find(x => x.is_default) || l[0] || null; }
function sectorBySlug(slug){ const l = AppState.sectors || []; return (slug && l.find(x => x.slug === slug)) || defaultSector(); }
function sectorNavKey(slug){ const d = defaultSector(); return "products/" + ((sectorBySlug(slug) || {}).slug || (d && d.slug) || ""); }

/* ---------------- password change when two-step sign-in (Google Authenticator) is on ----------------
   Supabase only lets a member change their password from a session that passed the authenticator
   step (AAL2). A reset link or a normal login gives an AAL1 session, so we ask for the 6-digit code
   first, verify it, and then save the new password. */
function mfaCodeField(beforeEl, id){
  let input = document.getElementById(id);
  if(input) return input;
  const wrap = document.createElement("div");
  wrap.className = "field"; wrap.id = id + "-wrap";
  wrap.innerHTML = `<label for="${id}">Google Authenticator code</label>
    <input class="input" id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code">
    <p class="hint" style="margin:6px 0 0;font-size:12.5px;opacity:.75;">Two-step sign-in is on for this account. Open Google Authenticator and type the Repuven code.</p>`;
  beforeEl.parentNode.insertBefore(wrap, beforeEl);
  input = wrap.querySelector("input");
  input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); });
  return input;
}
async function verifiedTotpFactor(){
  try{ const { data } = await supabase.auth.mfa.factors(); return (data || []).find(f => f.status === "verified") || null; }catch(_){ return null; }
}
async function updatePasswordWithMfa(password, beforeEl, codeId){
  const factor = await verifiedTotpFactor();
  if(factor){
    const input = mfaCodeField(beforeEl, codeId);
    const code = (input.value || "").replace(/\D/g, "");
    if(code.length !== 6){ input.focus(); return { error: { message: "Type the 6-digit code from Google Authenticator, then save again." } }; }
    const v = await supabase.auth.mfa.verifyCode(factor.id, code);
    if(v.error){ input.value = ""; input.focus(); return { error: { message: "That code didn't work. Type the newest code from Google Authenticator." } }; }
  }
  const res = await supabase.auth.updateUser({ password });
  if(res.error && /aal2|mfa/i.test(res.error.message || "")){
    mfaCodeField(beforeEl, codeId).focus();
    return { error: { message: "Two-step sign-in is on. Type the 6-digit code from Google Authenticator, then save again." } };
  }
  const w = document.getElementById(codeId + "-wrap"); if(!res.error && w) w.remove();
  return res;
}

/* ---------------- sidebar / topbar ---------------- */
const NAV_ITEMS = [
  { key:"home",     label:"Home",
    icon:'<path d="M3 10.5 10 4l7 6.5"/><path d="M5 9v7a1 1 0 0 0 1 1h3v-4h2v4h3a1 1 0 0 0 1-1V9"/>' },
  { key:"products",  label:"Survey",
    icon:'<rect x="3.5" y="6" width="13" height="10" rx="1.5"/><path d="M7 6V4.5a3 3 0 0 1 6 0V6"/>' },
  { key:"wallet",    label:"Wallet",
    icon:'<rect x="3" y="5.5" width="14" height="10" rx="2"/><path d="M3 8.5h14"/><circle cx="13.5" cy="12" r="1"/>' },
  { key:"deposit",   label:"Deposit",
    icon:'<circle cx="10" cy="10" r="7"/><path d="M10 6.5v7M7 8.5c0-1.1 1.2-2 3-2s3 .9 3 2c0 3-6 1.5-6 4.5 0 1.1 1.2 2 3 2s3-.9 3-2"/>' },
  { key:"withdraw",  label:"Withdraw",
    icon:'<path d="M10 3v10"/><path d="M6 9.5 10 13l4-3.5"/><path d="M4 15.5h12"/>' },
  { key:"support",   label:"Support Chat",
    icon:'<path d="M4 5.5h12v8H8l-4 3v-11Z"/><path d="M7 8.5h6M7 11h4"/><circle id="support-nav-dot" cx="16.5" cy="4" r="2.2" fill="var(--danger)" stroke="none" style="display:none"/>' },
  { key:"livechat",  label:"Live Chat",
    icon:'<path d="M4 5.5h12v8H8l-4 3v-11Z"/><circle cx="14.5" cy="8" r="1.2" fill="currentColor" stroke="none"/>' },
  { key:"leaderboard", label:"Leaderboard",
    icon:'<path d="M5 17V9h3v8H5Zm4 0V5h3v12H9Zm4 0v-5h3v5h-3Z"/><path d="M4 17.5h12"/>' },
  { key:"profile",   label:"Profile",
    icon:'<circle cx="10" cy="7" r="3"/><path d="M4 16.5c0-3 2.7-5 6-5s6 2 6 5"/>' },
];

let __siteLogoSrc = null;
function getSiteLogoSrc(){
  if(__siteLogoSrc === null){
    const img = document.querySelector('#view-landing .brand-logo img');
    __siteLogoSrc = img ? img.src : "";
  }
  return __siteLogoSrc;
}

function hydrateSiteLogoAvatars(root=document){
  const src=getSiteLogoSrc();
  if(!src) return;
  root.querySelectorAll?.("[data-site-logo]").forEach(el=>{
    if(!el.querySelector("img")) el.innerHTML=`<img src="${src}" alt="Repuven">`;
  });
  root.querySelectorAll?.("[data-site-logo-avatar]").forEach(el=>{
    if(!el.querySelector("img")) el.innerHTML=`<img src="${src}" alt="Repuven">`;
  });
}
function prepareChatBackground(box){
  if(!box) return;
  const src=getSiteLogoSrc();
  if(src) box.style.setProperty("--chat-wa-logo-bg",`url("${src}")`);
}
function chatAvatarMarkup(name,avatarUrl,isAdmin=false,extraClass=""){
  const safeName=(name||"Member").trim() || "Member";
  const initial=escapeHtml(safeName.slice(0,1).toUpperCase());
  if(isAdmin) return `<span class="chat-wa-avatar chat-wa-avatar-logo ${extraClass}" data-site-logo-avatar aria-hidden="true"></span>`;
  if(avatarUrl) return `<span class="chat-wa-avatar has-photo ${extraClass}"><img src="${escapeHtml(avatarUrl)}" alt=""></span>`;
  return `<span class="chat-wa-avatar ${extraClass}">${initial}</span>`;
}
function fillChatAvatarElement(el,name,avatarUrl,isAdmin=false){
  if(!el) return;
  const safeName=(name||"Member").trim() || "Member";
  if(isAdmin){
    el.classList.add("chat-wa-avatar-logo");
    el.dataset.siteLogoAvatar="1";
    el.innerHTML="";
  }else if(avatarUrl){
    el.classList.add("has-photo");
    delete el.dataset.siteLogoAvatar;
    el.innerHTML=`<img src="${escapeHtml(avatarUrl)}" alt="">`;
  }else{
    el.classList.remove("has-photo","chat-wa-avatar-logo");
    delete el.dataset.siteLogoAvatar;
    el.textContent=safeName.slice(0,1).toUpperCase();
  }
  hydrateSiteLogoAvatars(el.parentElement||document);
}

/* VIP accounts invite people and withdraw: Refer & Earn, Wallet, Withdraw, Profile, Support Chat, Live Chat */
const VIP_PAGES = ["home","wallet","withdraw","profile","support","livechat"];
const VIP_PAGE_META = {
  home: { title:"Refer & Earn", sub:"Share your link and earn" },
  wallet: { title:"Wallet", sub:"Your balance and referral earnings" },
  profile: { title:"Profile", sub:"Your account and referral link" },
};
/* Investor accounts: dashboard, wallet, withdraw, mailbox, profile, support, live chat */
const INV_PAGES = ["home","wallet","withdraw","mailbox","profile","support","livechat"];
const INV_PAGE_META = {
  home: { title:"Investor", sub:"Members, tasks and the Investor Pool" },
  wallet: { title:"Wallet", sub:"Your balance and pool shares" },
};
function withSectors(items){
  const list = AppState.sectors;
  if(!list || !list.length) return items;
  const out = [];
  items.forEach(i => {
    if(i.key !== "products"){ out.push(i); return; }
    list.forEach(sec => out.push({ key:"products", navkey:"products/" + sec.slug, href:"#products/" + sec.slug,
      label: escapeHtml(sec.name), icon: SECTOR_ICONS[sec.icon] || SECTOR_ICONS.clipboard }));
  });
  return out;
}
function navItemsFor(){
  if(AppState.isInv) return INV_PAGES.map(k => NAV_ITEMS.find(i => i.key === k)).filter(Boolean).map(i => i.key === "home"
    ? Object.assign({}, i, { label:"Investor", icon:'<path d="M3 16.5h14"/><path d="M5 13.5V9.5M8.7 13.5V6.5M12.3 13.5V8M16 13.5V4.5"/>' })
    : i);
  if(!AppState.isVip) return withSectors(NAV_ITEMS);
  return VIP_PAGES.map(k => NAV_ITEMS.find(i => i.key === k)).filter(Boolean).map(i => i.key === "home"
    ? Object.assign({}, i, { label:"Refer & Earn", icon:'<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l.8-.8"/>' })
    : i);
}

function renderSidebar(){
  const mount = document.getElementById("app-sidebar");
  if(!mount) return;
  const profile = AppState.profile;
  const initials = ((profile && profile.full_name) || "U").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const logoSrc = getSiteLogoSrc();
  const brandMark = logoSrc ? `<img class="mark-logo" src="${logoSrc}" alt="">` : `<span class="mark">RV</span>`;

  let links = navItemsFor().map(item => `
    <a class="nav-link" data-navkey="${item.navkey || item.key}" href="${item.href || "#" + item.key}">
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      <span>${item.label}</span>
    </a>`).join("");


  mount.innerHTML = `
    <a class="app-brand" href="#home">
      ${brandMark}<span class="word"><img class="rv-word" src="assets/img/wordmark.svg" alt="Repuven"></span>
    </a>
    <nav style="display:flex;flex-direction:column;gap:2px;">${links}</nav>
    <div class="sidebar-foot">
      <div class="sidebar-user">
        <div class="av ${profile && profile.avatar_url ? "has-photo" : ""}">${profile && profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">` : escapeHtml(initials || "U")}</div>
        <div class="meta">
          <div class="name">${escapeHtml((profile && profile.full_name) || "Member")}</div>
          <div class="role">${AppState.isVip ? "VIP member · Verified" : AppState.isInv ? "Investor" : (profile && profile.vip_free && !profile.is_verified) ? "Free member" : ((profile && profile.is_verified) || AppState.isAdmin ? "Verified" : "Unverified")}${AppState.isAdmin ? " · Admin" : ""}</div>
        </div>
      </div>
      <button class="signout-btn" id="signout-btn">Sign out</button>
      <nav class="sidebar-legal" aria-label="Information"><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#help">Help</a></nav>
    </div>`;

  document.getElementById("signout-btn").addEventListener("click", signOut);
  if(window.__teamAccess) window.__teamAccess.paint();
  if(window.Leadership) window.Leadership.paintChip();
}

function setActiveNav(key){
  document.querySelectorAll("#app-sidebar .nav-link").forEach(a => a.classList.toggle("active", a.dataset.navkey === key));
  const mb = document.getElementById("tb-mail"); if(mb) mb.classList.toggle("active", key === "mailbox");
}

const PAGE_META = {
  home:      { title:"Home",         sub:"What's happening on Repuven", actions:'<a href="#products" class="btn btn-primary btn-sm">Browse Survey <svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrow-right"/></svg></a>' },
  products:  { title:"Survey",     sub:"Pick a task and follow the brief" },
  profile:   { title:"Profile",      sub:"Account, verification and referrals" },
  wallet:    { title:"Wallet",       sub:"Your balance and earnings" },
  deposit:   { title:"Deposit",      sub:"Add money to your wallet" },
  withdraw:  { title:"Withdraw",     sub:"Cash out to Binance or bKash" },
  mailbox:   { title:"Mailbox",      sub:"Notices and messages from Repuven" },
  support:   { title:"Support Chat", sub:"Private chat with Repuven support" },
  livechat:  { title:"Live Chat", sub:"Group chat at set times" },
  leaderboard:{ title:"Leaderboard", sub:"Top members by verified referrals" },
  admin:     { title:"Admin Panel",  sub:"Manage Repuven" },
  team:      { title:"Team",         sub:"Your work as a supportive admin" },
};
function setTopbar(key){
  const meta = (AppState.isVip && VIP_PAGE_META[key]) || (AppState.isInv && INV_PAGE_META[key]) || PAGE_META[key] || {};
  document.getElementById("topbar-title").textContent = meta.title || "";
  document.getElementById("topbar-sub").textContent = meta.sub || "";
  document.getElementById("topbar-actions").innerHTML = meta.actions || "";
}

function wireShellChrome(){
  const toggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("app-sidebar");
  const scrim = document.getElementById("sidebar-scrim");
  if(toggle && sidebar && scrim){
    toggle.addEventListener("click", () => { sidebar.classList.add("open"); scrim.classList.add("show"); });
    scrim.addEventListener("click", () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); });
  }
}

/* ---------------- router ---------------- */
const APP_PAGES = ["home","products","profile","leaderboard","wallet","deposit","withdraw","mailbox","support","livechat","team"];
const Modules = {}; // each page module registers itself here: { init(sub,params), onActivate(sub,params) }

/* ---------------- Team page: the supportive admin's work, inside this website ---------------- */
Modules.team = (function(){
  // The team tools (assets/js/team-tools.js) load only when a supportive admin opens Team.
  let blobUrl = null;
  async function unpack(){
    if(blobUrl) return blobUrl;
    if(typeof DecompressionStream === "undefined") throw new Error("old browser");
    if(!window.SRV_TEAM_PACK){
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "assets/js/team-tools.js?v=20261124f"; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const bin = Uint8Array.from(atob(window.SRV_TEAM_PACK), c => c.charCodeAt(0));
    const html = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    return blobUrl;
  }
  async function open(){
    const f = document.getElementById("team-frame");
    if(!f || f.dataset.src) return;
    f.dataset.src = "1";
    f.addEventListener("load", () => { const l = document.getElementById("team-load"); if(l) l.hidden = true; }, { once: true });
    try{ f.src = (await unpack()) + "#admin"; }
    catch(e){
      delete f.dataset.src;
      const l = document.getElementById("team-load");
      if(l) l.innerHTML = '<div class="team-msg">Please update your browser (Chrome, Edge or Safari) to open Team.</div>';
    }
  }
  function close(){
    const f = document.getElementById("team-frame");
    if(f && f.dataset.src){ f.src = "about:blank"; delete f.dataset.src; const l = document.getElementById("team-load"); if(l) l.hidden = false; }
  }
  return { init: open, onActivate: open, close };
})();

function parseHash(){
  const raw = (location.hash || "").slice(1);
  if(!raw) return { page:"", sub:"", params:new URLSearchParams() };
  const qIdx = raw.indexOf("?");
  const pathPart = qIdx === -1 ? raw : raw.slice(0, qIdx);
  const queryPart = qIdx === -1 ? "" : raw.slice(qIdx+1);
  const slashIdx = pathPart.indexOf("/");
  const page = slashIdx === -1 ? pathPart : pathPart.slice(0, slashIdx);
  const sub = slashIdx === -1 ? "" : pathPart.slice(slashIdx+1);
  return { page, sub, params: new URLSearchParams(queryPart) };
}
function isAuthCallbackHash(){
  const h = location.hash || "";
  const q = location.search || "";
  // Recovery links can arrive as a hash-token callback (implicit flow) or as a
  // query-string code callback (PKCE/OAuth). Keep the router from rendering the
  // landing page while the auth client is processing either form.
  return h.includes("access_token=") || h.includes("type=recovery") || h.includes("type=signup") || h.includes("error=") || h.includes("error_description=") || q.includes("code=") || q.includes("type=recovery");
}

function isRecoveryHash(){
  const h=(location.hash||"").slice(1);
  const params=new URLSearchParams(h);
  if(params.get("type")==="recovery" && (!!params.get("access_token") || !!params.get("refresh_token"))) return true;
  const qp=new URLSearchParams(location.search||"");
  if(qp.get("type")==="recovery" && !!qp.get("code")) return true;
  try{ if(qp.get("code") && localStorage.getItem("ss-recovery-pending")==="1") return true; }catch(e){}
  return false;
}

async function handlePasswordRecoveryHash(){
  if(!isRecoveryHash()) return false;
  if(!AppState.session) await loadAppState();
  if(!AppState.session) return false;
  const hashParams=new URLSearchParams((location.hash||"").slice(1));
  const queryParams=new URLSearchParams(location.search||"");
  const params=hashParams.get("type")==="recovery" ? hashParams : queryParams;
  // Handle recovery after the session exchange, even when PASSWORD_RECOVERY fired before boot listeners.
  showTopLevel("auth");
  AuthModule.activate("newpass", params);
  history.replaceState(null, "", location.pathname);
  try{ localStorage.removeItem("ss-recovery-pending"); }catch(e){}
  window.__ssRecoveryHandled=true;
  return true;
}
function restorePageScroll(){
  // The landing auth modal temporarily locks body scrolling. If auth state changes
  // directly from that modal, the modal can disappear before its close handler runs.
  // Always restore the normal document scroll state when leaving the auth layer.
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.touchAction = "";
  document.documentElement.style.overflow = "";
}

function srvResumeDone(){ document.documentElement.classList.remove("srv-resume"); }
function showTopLevel(which){
  srvResumeDone();
  document.getElementById("view-landing").style.display = which === "landing" ? "" : "none";
  document.getElementById("view-auth").style.display = which === "auth" ? "" : "none";
  document.getElementById("view-app").style.display = which === "app" ? "" : "none";
  if(which === "app"){
    restorePageScroll();
    applyTheme(AppState.profile);
  } else if(which === "landing"){
    const landingMode="dark";
    document.documentElement.setAttribute("data-theme",landingMode);
    document.documentElement.setAttribute("data-accent","green");
    applyLandingTheme(landingMode);
  } else {
    document.documentElement.setAttribute("data-theme","dark");
    document.documentElement.setAttribute("data-accent","green");
  }
  window.scrollTo(0,0);
}
function showPageSection(key, sub, params){
  APP_PAGES.forEach(p => { const el = document.getElementById("page-"+p); if(el) el.style.display = (p===key ? "" : "none"); });
  setTopbar(key);
  setActiveNav(key === "products" && AppState.sectors ? sectorNavKey(sub) : key);
  if(key === "products" && AppState.sectors){
    const sec = sectorBySlug(sub);
    if(sec){ document.getElementById("topbar-title").textContent = sec.name; document.getElementById("topbar-sub").textContent = sec.description || "Pick a task and follow the brief"; }
  }
  const mod = Modules[key];
  if(mod){
    if(!mod.initialized){ mod.initialized = true; mod.init(sub, params); }
    else if(mod.onActivate){ mod.onActivate(sub, params); }
  }
  const sidebar = document.getElementById("app-sidebar"), scrim = document.getElementById("sidebar-scrim");
  if(sidebar) sidebar.classList.remove("open");
  if(scrim) scrim.classList.remove("show");
  restorePageScroll();
}

async function route(){
  if(isAuthCallbackHash()) return; // supabase-js + onAuthStateChange own this; don't reroute mid-callback
  const { page, sub, params } = parseHash();
  srvResumeDone();
  if(DocPages.handle(page)) return;   // #privacy, #terms, #help

  if(!AppState.session){
    if(page === "auth" && (sub === "signin" || sub === "signup" || sub === "")){
      showTopLevel("landing");
      LandingAuth.activate(sub || "signup", params);
    } else if(page === "auth" && (sub === "forgot" || sub === "newpass")){
      LandingAuth.close();
      showTopLevel("auth");
      AuthModule.activate(sub, params);
    } else {
      LandingAuth.close();
      showTopLevel("landing");
    }
    return;
  }

  if(page === "auth" || page === ""){
    // Login/signup may complete while the landing auth modal is still open.
    // Closing it here prevents its body scroll lock from carrying into the app.
    const authModal = document.getElementById("authModal");
    if(authModal && authModal.classList.contains("is-open")){ LandingAuth.close(); }
    else { restorePageScroll(); }
    Router.go("home");
    return;
  }
  if(!APP_PAGES.includes(page)){ Router.go("home"); return; }
  if(page === "team"){
    // only a supportive admin opens Team; wait for the access check before deciding
    if(!(window.__teamAccess && window.__teamAccess.active())){ if(window.__teamAccess && window.__teamAccess.checked && window.__teamAccess.checked()) Router.go("home"); return; }
    showTopLevel("app"); showPageSection("team", sub, params); return;
  }
  if(AppState.isVip && !VIP_PAGES.includes(page)){ Router.go("home"); return; }
  if(AppState.isInv && !INV_PAGES.includes(page)){ Router.go("home"); return; }

  // Support is intentionally available to every authenticated account,
  // including unverified users. Verification gates must not block this page.
  // Other verification-dependent features keep their existing eligibility rules.
  showTopLevel("app");
  showPageSection(page, sub, params);
}
const Router = { go(hash){ if(location.hash.replace(/^#/, "") === hash) route(); else location.hash = hash; } };

// Defensive recovery for mobile browsers where a modal/body scroll lock can survive
// a fast auth-state transition. The app itself never needs body overflow hidden.
window.addEventListener("pageshow", () => {
  if(AppState.session && document.getElementById("view-app")?.style.display !== "none") restorePageScroll();
});

/* ---------------- Module: Privacy, Terms and Help pages (#privacy, #terms, #help) ---------------- */
const DocPages = (function(){
  const PAGES = ["privacy", "terms", "help"];
  const TITLES = { privacy: "Privacy Policy", terms: "Terms of Service", help: "Help & Support" };
  const view = document.getElementById("view-doc");
  const baseTitle = document.title;
  let backTo = null, wired = false, open = false;

  function wireOnce(){
    if(wired || !view) return;
    wired = true;
    view.querySelectorAll("[data-doc-close]").forEach(el => el.addEventListener("click", (e) => { e.preventDefault(); close(); }));
    document.addEventListener("keydown", (e) => { if(open && e.key === "Escape") close(); });
  }

  function show(page){
    if(!view) return;
    wireOnce();
    view.querySelectorAll("[data-doc]").forEach(a => { a.hidden = a.dataset.doc !== page; });
    view.querySelectorAll("[data-doc-link]").forEach(a => {
      const on = a.dataset.docLink === page;
      a.classList.toggle("active", on);
      if(on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const chat = document.getElementById("doc-open-chat");
    if(chat){
      chat.setAttribute("href", AppState.session ? "#support" : "#auth/signin");
      chat.textContent = AppState.session ? "Open Support Chat" : "Log in to chat";
    }
    view.style.display = "block";
    document.documentElement.classList.add("doc-open");
    view.scrollTop = 0;
    document.title = TITLES[page] + " · Repuven";
    open = true;
  }

  function hide(){
    if(!view || !open) return;
    view.style.display = "none";
    document.documentElement.classList.remove("doc-open");
    document.title = baseTitle;
    open = false;
  }

  /** Called first by the router. Returns true when the hash is one of these pages. */
  function handle(page){
    if(PAGES.includes(page)){ show(page); return true; }
    backTo = (location.hash || "").replace(/^#/, "");
    hide();
    return false;
  }

  function close(){
    Router.go(backTo !== null ? backTo : (AppState.session ? "home" : ""));
  }

  return { handle, close };
})();

/* ---------------- Module: Auth (forgot-password / set-new-password only —
   sign in / sign up now live in the landing page's auth modal, see LandingAuth) ---------------- */
const AuthModule = (function(){
  const panels = ["forgot","newpass"];
  function showPanel(name){
    panels.forEach(p => document.getElementById("panel-"+p).classList.toggle("show", p===name));
    document.getElementById("panel-forgot-body").classList.toggle("show", name==="forgot");
    document.getElementById("panel-newpass-body").classList.toggle("show", name==="newpass");
    if(name==="newpass"){ resetRobotCheck(); setStep(2); }
  }
  function resetRobotCheck(){
    const box=document.getElementById("robot-check-wrap");
    const cb=document.getElementById("robot-check");
    const area=document.getElementById("form-newpass");
    const status=document.getElementById("robot-status");
    if(!box||!cb||!area) return;
    cb.checked=false; area.classList.remove("unlocked"); box.classList.remove("verified","verifying");
    if(status) status.textContent="Checking your browser…";
  }
  function passwordStrength(value){
    let score=0;
    if(value.length>=6) score+=25; if(value.length>=10) score+=25;
    if(/[A-Z]/.test(value)) score+=15; if(/[0-9]/.test(value)) score+=15; if(/[^A-Za-z0-9]/.test(value)) score+=20;
    return Math.min(score,100);
  }
  function setLoading(btn, loading, label){
    btn.disabled = loading;
    btn.querySelector(".btn-label").innerHTML = loading ? '<span class="spinner"></span>' : label;
  }
  function showErr(id, msg){ const el = document.getElementById(id); el.textContent = msg; el.style.display = msg ? "block" : "none"; }

  let codeEmail = "", resendTimer = null;
  function setStep(n){ document.querySelectorAll("#view-auth .recovery-step").forEach((s, i) => s.classList.toggle("active", i === n)); }
  function maskEmail(email){
    const at = email.indexOf("@");
    if(at < 1) return email;
    const user = email.slice(0, at), domain = email.slice(at);
    return (user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2)) + "*".repeat(Math.max(2, Math.min(6, user.length - 2))) + domain;
  }
  function friendlyAuthError(msg){
    const m = String(msg || "");
    if(/expired|invalid/i.test(m) && /token|code|otp/i.test(m)) return "This code is wrong or too old. Check it, or send a new code.";
    const wait = m.match(/after (\d+) seconds?/i);
    if(wait) return "Please wait " + wait[1] + " seconds, then try again.";
    if(/rate limit/i.test(m)) return "Too many emails were sent. Please try again a little later.";
    return m;
  }
  function startResendTimer(){
    const b = document.getElementById("code-resend");
    let left = 60;
    clearInterval(resendTimer);
    b.disabled = true;
    b.textContent = "Send a new code (" + left + "s)";
    resendTimer = setInterval(() => {
      left -= 1;
      if(left <= 0){ clearInterval(resendTimer); b.disabled = false; b.textContent = "Send a new code"; }
      else b.textContent = "Send a new code (" + left + "s)";
    }, 1000);
  }
  function showCodeStep(email){
    codeEmail = email;
    document.getElementById("form-forgot").hidden = true;
    document.getElementById("form-code").hidden = false;
    document.getElementById("code-note").innerHTML = "We sent a code to <b>" + escapeHtml(maskEmail(email)) + "</b>. Type it below.";
    document.getElementById("fg-code").value = "";
    showErr("code-err", "");
    setStep(1);
    startResendTimer();
    setTimeout(() => document.getElementById("fg-code").focus(), 60);
  }
  function showEmailStep(){
    document.getElementById("form-forgot").hidden = false;
    document.getElementById("form-code").hidden = true;
    clearInterval(resendTimer);
    setStep(0);
  }

  function fillCode(code){
    const form = document.getElementById("form-code");
    if(!form || form.hidden || !codeEmail || document.getElementById("view-auth").style.display === "none") return false;
    document.getElementById("fg-code").value = code;
    if(form.requestSubmit) form.requestSubmit(); else document.getElementById("code-submit").click();
    return true;
  }
  function rememberEmail(email){ try{ localStorage.setItem("srv-reset-email", JSON.stringify({ email, at: Date.now() })); }catch(_){} }
  /** The email button was opened in a new tab: show the code step for that email and check the code. */
  function resumeWithCode(email, code){
    wireOnce();
    showPanel("forgot");
    showCodeStep(email);
    return fillCode(code);
  }

  let wired = false;
  function wireOnce(){
    if(wired) return;
    wired = true;
    OtpLink.listen(fillCode);
    document.getElementById("yr").textContent = new Date().getFullYear();

    document.getElementById("form-code").addEventListener("submit", async (e) => {
      e.preventDefault();
      showErr("code-err", "");
      const token = document.getElementById("fg-code").value.replace(/\D/g, "");
      if(token.length < 6){ showErr("code-err", "Type the code from the email."); return; }
      const btn = document.getElementById("code-submit");
      setLoading(btn, true);
      const { error } = await supabase.auth.verifyOtp({ email: codeEmail, token, type: "recovery" });
      setLoading(btn, false, "Continue");
      if(error){ showErr("code-err", friendlyAuthError(error.message) || "This code is wrong or too old."); return; }
      clearInterval(resendTimer);
      try{ localStorage.removeItem("srv-reset-email"); }catch(_){}
      showPanel("newpass");
      toast("Code accepted. Now choose a new password.", "success");
    });
    document.getElementById("fg-code").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/[^0-9 ]/g, "").slice(0, 12); });
    document.getElementById("code-resend").addEventListener("click", async () => {
      if(!codeEmail) return;
      const b = document.getElementById("code-resend");
      b.disabled = true;
      const { error } = await supabase.auth.resetPasswordForEmail(codeEmail, { redirectTo: location.origin + location.pathname });
      if(error){ b.disabled = false; showErr("code-err", friendlyAuthError(error.message) || "Could not send a new code."); return; }
      showErr("code-err", "");
      toast("We sent a new code.", "success");
      startResendTimer();
    });
    document.getElementById("code-change").addEventListener("click", () => { showEmailStep(); document.getElementById("fg-email").focus(); });

    document.getElementById("form-forgot").addEventListener("submit", async (e) => {
      e.preventDefault();
      showErr("forgot-err","");
      const email = document.getElementById("fg-email").value.trim();
      const btn = document.getElementById("forgot-submit");
      setLoading(btn, true);
      const recoveryRedirect = location.origin + location.pathname; const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect });
      setLoading(btn, false, "Send code");
      if(error){ showErr("forgot-err", friendlyAuthError(error.message) || "Could not send the code."); return; }
      rememberEmail(email);
      showCodeStep(email);
      toast("We sent a code to your email.", "success");
    });

    document.getElementById("robot-check").addEventListener("change", async (e) => {
      const box=document.getElementById("robot-check-wrap");
      const area=document.getElementById("form-newpass");
      const status=document.getElementById("robot-status");
      if(!e.target.checked){
        area.classList.remove("unlocked");
        box.classList.remove("verified","verifying");
        status.textContent="Ready for security verification";
        return;
      }
      box.classList.add("verifying");
      box.classList.remove("verified");
      area.classList.remove("unlocked");
      status.textContent="Solve the puzzle to continue…";
      if(window.SrvPuzzle){
        const pz = window.SrvPuzzle.open({ noWork:true });
        const ok = await pz.solved;
        if(!ok){ e.target.checked=false; box.classList.remove("verifying"); status.textContent="Ready for security verification"; return; }
        await pz.success();
      }
      box.classList.remove("verifying");
      box.classList.add("verified");
      status.textContent="✓ Verification complete · Secure session confirmed";
      area.classList.add("unlocked");
      if(await verifiedTotpFactor()) mfaCodeField(document.getElementById("newpass-err"), "np-mfa");
    });

    document.getElementById("np-pass").addEventListener("input", (e) => {
      const score=passwordStrength(e.target.value);
      document.getElementById("password-strength-bar").style.width=score+"%";
      document.getElementById("password-hint").textContent=score>=80?"Strong password":"Use at least 6 characters. Mix letters, numbers and symbols.";
    });

    document.getElementById("form-newpass").addEventListener("submit", async (e) => {
      e.preventDefault();
      showErr("newpass-err","");
      if(!document.getElementById("robot-check").checked){ showErr("newpass-err","Please complete the security check first."); return; }
      const password = document.getElementById("np-pass").value;
      const confirm = document.getElementById("np-pass-confirm").value;
      if(password.length < 6){ showErr("newpass-err","Password must be at least 6 characters."); return; }
      if(password !== confirm){ showErr("newpass-err","The passwords do not match."); return; }
      const btn = document.getElementById("newpass-submit");
      setLoading(btn, true);
      const { error } = await updatePasswordWithMfa(password, document.getElementById("newpass-err"), "np-mfa");
      setLoading(btn, false, "Save new password");
      if(error){ showErr("newpass-err", error.message || "Couldn't update your password."); return; }
      toast("Password updated successfully.", "success");
      try{ localStorage.removeItem("ss-recovery-pending"); localStorage.removeItem("ss-recovery-pkce-verifier"); }catch(e){}
      await loadAppState(); renderSidebar(); Router.go("home");
    });
  }

  /** Called by the router when we land on #auth/forgot or #auth/newpass while logged out. */
  function activate(sub){
    wireOnce();
    const name = panels.includes(sub) ? sub : "forgot";
    if(name === "forgot") showEmailStep();
    showPanel(name);
  }

  return { activate, resumeWithCode };
})();

/* ---------------- Module: LandingAuth (the sign-in/sign-up modal on the homepage) ---------------- */

/* ---------------- Module: slide puzzle (shown while the human check works in the background) ---------------- */
const SrvPuzzle = (function(){
  const W = 280, H = 160, S = 46, T = 11, TOL = 6, START = 6;
  let open_ = null, lastStyle = -1, grain = null;

  function rng(seed){ return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  /* a real jigsaw piece: knobs out on top and right, holes in on bottom and left */
  const KNOB = [[.36,0],[.42,-.05,.27,.24,.5,.24],[.73,.24,.58,-.05,.64,0],[1,0]];
  function edge(c, ax, ay, dx, dy, nx, ny, sign){
    const P = (u, o) => [ax + u * S * dx + o * sign * S * nx, ay + u * S * dy + o * sign * S * ny];
    for(const k of KNOB){
      if(k.length === 2) c.lineTo(...P(k[0], k[1]));
      else c.bezierCurveTo(...P(k[0], k[1]), ...P(k[2], k[3]), ...P(k[4], k[5]));
    }
  }
  function piecePath(c, x, y){
    c.beginPath();
    c.moveTo(x, y);
    edge(c, x, y, 1, 0, 0, -1, 1);            // top: knob out
    edge(c, x + S, y, 0, 1, 1, 0, 1);         // right: knob out
    edge(c, x + S, y + S, -1, 0, 0, 1, -1);   // bottom: hole in
    edge(c, x, y + S, 0, -1, -1, 0, -1);      // left: hole in
    c.closePath();
  }
  function hiDpi(cv, w, h){
    const d = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0);
    return c;
  }

  /* ---------- artwork: 8 styles, each with hand-picked colours ---------- */
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function lin(c, x0, y0, x1, y1, stops){ const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  // a ridge line with a little hand-made wobble
  function ridge(r, base, rough, steps){
    const pts = []; let y = base + (r() - .5) * rough;
    for(let i = 0; i <= steps; i++){ y += (r() - .5) * rough; y = Math.max(base - rough * 1.6, Math.min(base + rough * 1.6, y)); pts.push([i / steps * W, y]); }
    return pts;
  }
  function fillUnder(c, pts, style){
    c.beginPath(); c.moveTo(0, H); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(W, H); c.closePath(); c.fillStyle = style; c.fill();
  }
  function smoothUnder(c, pts, style){
    c.beginPath(); c.moveTo(0, H); c.lineTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    c.lineTo(W, pts[pts.length - 1][1]); c.lineTo(W, H); c.closePath(); c.fillStyle = style; c.fill();
  }

  const STYLES = [
    // 1. mountains at dusk
    function mountains(c, r){
      const P = pick(r, [
        { sky:["#F6C9A8","#E79A86","#7B5E86"], sun:"#FFF1D6", hills:["#5B4A78","#46395F","#2F2745","#1D1830"] },
        { sky:["#CFE6E3","#9CC9C1","#4E8C86"], sun:"#F7F3E3", hills:["#3F7A72","#2E5F59","#1F4642","#12302D"] },
        { sky:["#FBE3B4","#F2B544","#C9860F"], sun:"#FFF7E6", hills:["#8A5A2B","#6B4321","#4A2E17","#2B1B0E"] },
      ]);
      c.fillStyle = lin(c, 0, 0, 0, H, P.sky); c.fillRect(0, 0, W, H);
      c.fillStyle = P.sun; c.beginPath(); c.arc(40 + r() * 200, 46 + r() * 20, 18 + r() * 10, 0, Math.PI * 2); c.fill();
      P.hills.forEach((col, i) => {
        fillUnder(c, ridge(r, 70 + i * 22, 10 - i, 14 + i * 4), col);
        if(i < 3){ c.fillStyle = "rgba(255,255,255,.07)"; c.fillRect(0, 84 + i * 22, W, 10); }
      });
    },
    // 2. Bauhaus poster
    function bauhaus(c, r){
      const P = pick(r, [
        { bg:"#EFEADB", ink:["#16A35E","#0B1F17","#f2b544","#E7708F","#2E5F59"] },
        { bg:"#F4EDE1", ink:["#1F3A5F","#D9643A","#E8B83E","#1A1A1A","#7FA7A0"] },
        { bg:"#0E2118", ink:["#EFEADB","#4CC38A","#f2b544","#2B5A44","#E79A86"] },
      ]);
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      const cw = 56, ch = 53.4;
      for(let gx = 0; gx < 5; gx++) for(let gy = 0; gy < 3; gy++){
        const x = gx * cw, y = gy * ch, col = pick(r, P.ink), kind = Math.floor(r() * 6), rot = Math.floor(r() * 4) * Math.PI / 2;
        c.save(); c.translate(x + cw / 2, y + ch / 2); c.rotate(rot); c.fillStyle = col; c.strokeStyle = col;
        const m = Math.min(cw, ch) / 2;
        if(kind === 0){ c.beginPath(); c.arc(0, 0, m - 4, 0, Math.PI * 2); c.fill(); }
        else if(kind === 1){ c.beginPath(); c.moveTo(-m, m); c.arc(-m, m, m * 2 - 2, -Math.PI / 2, 0); c.closePath(); c.fill(); }
        else if(kind === 2){ c.beginPath(); c.arc(0, m, m - 2, Math.PI, 0); c.closePath(); c.fill(); }
        else if(kind === 3){ c.lineWidth = 4; for(let k = -m + 6; k < m; k += 11){ c.beginPath(); c.moveTo(-m + 4, k); c.lineTo(m - 4, k); c.stroke(); } }
        else if(kind === 4){ c.fillRect(-m + 6, -m + 6, m * 2 - 12, m * 2 - 12); c.fillStyle = P.bg; c.beginPath(); c.arc(0, 0, m / 2.4, 0, Math.PI * 2); c.fill(); }
        else { c.beginPath(); c.moveTo(-m + 4, m - 4); c.lineTo(m - 4, m - 4); c.lineTo(-m + 4, -m + 4); c.closePath(); c.fill(); }
        c.restore();
      }
    },
    // 3. ocean waves
    function waves(c, r){
      const P = pick(r, [
        { sky:["#FCE8D5","#F7C6A3"], sun:"#F2A65A", sea:["#9ED1D6","#5FA8B3","#2F7A8C","#1C566B","#103A4D","#08263A"] },
        { sky:["#E9F3EE","#CDE6DA"], sun:"#4CC38A", sea:["#B7E2CF","#7CC4A6","#3E9C78","#22795A","#145C42","#0B3D2B"] },
        { sky:["#2B2A4A","#4B3F6B"], sun:"#F6E7C1", sea:["#7D74A8","#5F5690","#463F78","#33305F","#232245","#16152E"] },
      ]);
      c.fillStyle = lin(c, 0, 0, 0, 70, P.sky); c.fillRect(0, 0, W, H);
      c.fillStyle = P.sun; c.beginPath(); c.arc(60 + r() * 160, 40, 16 + r() * 8, 0, Math.PI * 2); c.fill();
      P.sea.forEach((col, i) => {
        const base = 56 + i * 18, amp = 3 + r() * 4, f = .02 + r() * .025, ph = r() * 7;
        c.beginPath(); c.moveTo(0, H);
        for(let x = 0; x <= W; x += 4) c.lineTo(x, base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph) * amp * .4);
        c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
        c.strokeStyle = "rgba(255,255,255,.28)"; c.lineWidth = 1;
        c.beginPath(); for(let x = 0; x <= W; x += 4){ const y = base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph) * amp * .4; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      });
    },
    // 4. desert dunes
    function dunes(c, r){
      const P = pick(r, [
        { sky:["#F9E7D2","#F3CBA5"], sun:"#FFF6E9", sand:[["#E9B07A","#C98549"],["#D9935A","#AE6A33"],["#C27742","#8F5226"],["#9E5A2E","#6B3A1A"]] },
        { sky:["#E6E0F0","#F4D8D2"], sun:"#FFFFFF", sand:[["#E8C3B0","#C99A85"],["#D3A08C","#A9766A"],["#B47F78","#8A5C5A"],["#8C5E62","#5E3E45"]] },
      ]);
      c.fillStyle = lin(c, 0, 0, 0, H, P.sky); c.fillRect(0, 0, W, H);
      c.fillStyle = P.sun; c.beginPath(); c.arc(70 + r() * 140, 52, 28, 0, Math.PI * 2); c.fill();
      P.sand.forEach((g, i) => {
        const pts = []; const base = 82 + i * 20;
        for(let k = 0; k <= 6; k++) pts.push([k / 6 * W, base + (r() - .5) * 26]);
        smoothUnder(c, pts, lin(c, 0, base - 14, W, H, g));
      });
    },
    // 5. city at night
    function city(c, r){
      const P = pick(r, [
        { sky:["#0F1B33","#2B3A67","#5A5A8C"], b:["#141C2E","#1B2540","#0C1222"], win:"#F2C46D" },
        { sky:["#071A13","#0E2118","#2B5A44"], b:["#0A140F","#10231A","#06100B"], win:"#6FEAAA" },
      ]);
      c.fillStyle = lin(c, 0, 0, 0, H, P.sky); c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(255,255,255,.75)";
      for(let i = 0; i < 40; i++){ c.beginPath(); c.arc(r() * W, r() * 70, r() * 1.1 + .3, 0, Math.PI * 2); c.fill(); }
      const mx = 30 + r() * 220; c.fillStyle = "#F5F0DF"; c.beginPath(); c.arc(mx, 30, 13, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.sky[0]; c.beginPath(); c.arc(mx + 6, 26, 12, 0, Math.PI * 2); c.fill();
      P.b.forEach((col, layer) => {
        let x = -10;
        while(x < W){
          const w = 16 + r() * 26, h = 40 + r() * 60 - layer * 8 + layer * 14, y = H - h;
          c.fillStyle = col; c.fillRect(x, y, w, h);
          if(r() < .3){ c.fillRect(x + w / 2 - 1, y - 10, 2, 10); }
          c.fillStyle = P.win;
          for(let wy = y + 6; wy < H - 6; wy += 8) for(let wx = x + 4; wx < x + w - 4; wx += 6) if(r() < .28){ c.globalAlpha = .5 + r() * .5; c.fillRect(wx, wy, 2.5, 3.5); }
          c.globalAlpha = 1; x += w + 2;
        }
      });
    },
    // 6. topographic map
    function topo(c, r){
      const P = pick(r, [
        { bg:"#0E2118", band:["#13291F","#173226"], line:"rgba(111,234,170,.55)" },
        { bg:"#EFEADB", band:["#E6DFCB","#DDD4BC"], line:"rgba(11,31,23,.45)" },
        { bg:"#1E1B2E", band:["#252238","#2C2842"], line:"rgba(242,181,68,.6)" },
      ]);
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      // smooth contour rings around two or three hills, each ring a little wobbly like a hand-drawn map
      const hills = [0, 1, 2].slice(0, 2 + Math.floor(r() * 2)).map(() => ({ x: 30 + r() * 220, y: 20 + r() * 120, w: [r() * 6, r() * 6, r() * 6], a: .1 + r() * .14 }));
      hills.forEach((h, hi) => {
        for(let k = 9; k >= 1; k--){
          const R = k * (9 + hi * 2);
          c.beginPath();
          for(let i = 0; i <= 96; i++){
            const t = i / 96 * Math.PI * 2;
            const rr = R * (1 + h.a * Math.sin(t * 2 + h.w[0]) + h.a * .6 * Math.sin(t * 3 + h.w[1] + k * .15) + .05 * Math.sin(t * 5 + h.w[2]));
            const x = h.x + Math.cos(t) * rr * 1.25, y = h.y + Math.sin(t) * rr;
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          }
          c.closePath();
          c.fillStyle = P.band[k % 2]; c.fill();
          c.strokeStyle = P.line; c.lineWidth = k % 3 === 0 ? 1.4 : .8; c.stroke();
        }
      });
    },
    // 7. terrazzo
    function terrazzo(c, r){
      const P = pick(r, [
        { bg:"#F2EEE6", chips:["#16A35E","#0E7A46","#f2b544","#E79A86","#2B5A44","#C9CDC8"] },
        { bg:"#2A2A2A", chips:["#EFEADB","#E8B83E","#D9643A","#7FA7A0","#9AA19C","#4CC38A"] },
        { bg:"#EAD9C6", chips:["#7B5E86","#2F7A8C","#F2A65A","#1D1830","#EFEADB","#C98549"] },
      ]);
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      for(let i = 0; i < 70; i++){
        const x = r() * W, y = r() * H, s = 3 + r() * (i < 12 ? 16 : 7), n = 4 + Math.floor(r() * 3);
        c.fillStyle = pick(r, P.chips); c.beginPath();
        for(let k = 0; k < n; k++){ const a = k / n * Math.PI * 2 + r() * .6, rr = s * (.6 + r() * .5); k ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
    },
    // 8. leaves
    function leaves(c, r){
      const P = pick(r, [
        { bg:"#F1EDE2", leaf:["#2E5F59","#3F7A72","#16A35E","#0E7A46","#7FA7A0","#C9A227"] },
        { bg:"#0E2118", leaf:["#2B5A44","#3E9C78","#6FEAAA","#17402D","#C9A227","#EFEADB"] },
      ]);
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      for(let i = 0; i < 26; i++){
        const x = r() * W, y = r() * H, L = 24 + r() * 34, Wd = L * (.28 + r() * .14), a = r() * Math.PI * 2, col = pick(r, P.leaf);
        c.save(); c.translate(x, y); c.rotate(a);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L / 2, -Wd, L, 0); c.quadraticCurveTo(L / 2, Wd, 0, 0); c.closePath();
        c.fillStyle = col; c.fill();
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = .8;
        c.beginPath(); c.moveTo(-6, 0); c.lineTo(L * .92, 0); c.stroke();
        for(let v = .25; v < .85; v += .17){ c.beginPath(); c.moveTo(L * v, 0); c.lineTo(L * (v + .1), -Wd * .45); c.moveTo(L * v, 0); c.lineTo(L * (v + .1), Wd * .45); c.stroke(); }
        c.restore();
      }
    },
  ];
  function grainTile(){
    if(grain) return grain;
    const cv = document.createElement("canvas"); cv.width = cv.height = 96;
    const c = cv.getContext("2d"), d = c.createImageData(96, 96);
    for(let i = 0; i < d.data.length; i += 4){ const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; }
    c.putImageData(d, 0, 0); grain = cv; return cv;
  }
  function paintPicture(seed){
    const cv = document.createElement("canvas"), c = hiDpi(cv, W, H), r = rng(seed);
    let k = Math.floor(r() * STYLES.length);
    if(k === lastStyle) k = (k + 1 + Math.floor(r() * (STYLES.length - 1))) % STYLES.length;
    lastStyle = k;
    c.save(); STYLES[k](c, r); c.restore();
    // fine paper grain, like printed artwork
    c.globalCompositeOperation = "overlay"; c.fillStyle = c.createPattern(grainTile(), "repeat"); c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    cv.dataset.style = STYLES[k].name;
    return cv;
  }

  /** opens the puzzle. Returns { solved: Promise<boolean>, progress(pct), success(), close() }.
      solved resolves true when the piece is in place, false if the person closes it. */
  function open(opts){
    opts = opts || {};
    if(open_) open_.close(false);
    const host = document.createElement("div");
    host.className = "pz-host";
    host.innerHTML = `
      <div class="pz-scrim"></div>
      <div class="pz-card" role="dialog" aria-modal="true" aria-labelledby="pz-title">
        <button type="button" class="pz-x" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <b class="pz-title" id="pz-title">Slide the piece into place</b>
        <small class="pz-sub" aria-live="polite">Drag the slider until the piece fits the gap.</small>
        <div class="pz-stage">
          <canvas class="pz-pic"></canvas>
          <canvas class="pz-piece"></canvas>
          <div class="pz-done" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.2 12.6l4.3 4.3L18.9 7.4"/></svg></div>
        </div>
        <div class="pz-track">
          <div class="pz-fill"></div>
          <span class="pz-hint">Slide to fit</span>
          <button type="button" class="pz-handle" aria-label="Slide the piece. Use arrow keys, then Enter." >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>
          </button>
        </div>
        <div class="pz-foot">
          <button type="button" class="pz-new">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>New puzzle
          </button>
          <span class="pz-work"><i><em></em></i><span class="pz-pct">${opts.noWork ? "" : "Checking…"}</span></span>
        </div>
      </div>`;
    document.body.appendChild(host);
    const $ = q => host.querySelector(q);
    const card = $(".pz-card"), pic = $(".pz-pic"), piece = $(".pz-piece"), handle = $(".pz-handle"), track = $(".pz-track"),
          fill = $(".pz-fill"), title = $(".pz-title"), sub = $(".pz-sub"), bar = $(".pz-work em"), pct = $(".pz-pct");
    if(opts.noWork) $(".pz-work").hidden = true;

    let tx = 0, ty = 0, x = 0, dragging = false, startX = 0, startPos = 0, misses = 0, done = false, workPct = 0, resolveSolved;
    const solved = new Promise(r => resolveSolved = r);
    const maxPos = W - S - T - 2 - START;

    function build(){
      const seed = (Math.random() * 4294967296) >>> 0;
      const r = rng(seed ^ 0x9e3779b9);
      tx = Math.round(100 + r() * (W - S - T - 6 - 100));
      ty = Math.round(T + 4 + r() * (H - S - T - 8));
      const src = paintPicture(seed);
      const c = hiDpi(pic, W, H);
      c.drawImage(src, 0, 0, W, H);
      piecePath(c, tx, ty);
      c.save(); c.clip();
      c.fillStyle = "rgba(6,10,8,.58)"; c.fillRect(tx - T, ty - T, S + 2 * T, S + 2 * T);
      c.shadowColor = "rgba(0,0,0,.75)"; c.shadowBlur = 7; c.shadowOffsetY = 2;
      piecePath(c, tx, ty); c.lineWidth = 5; c.strokeStyle = "rgba(0,0,0,.6)"; c.stroke();
      c.restore();
      piecePath(c, tx, ty); c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,.42)"; c.stroke();
      pic.dataset.style = src.dataset.style;
      const pw = S + T + 3, ph = S + T + 3;
      const p = hiDpi(piece, pw, ph);
      p.save(); piecePath(p, 1, T + 1); p.clip();
      p.drawImage(src, -(tx - 1), -(ty - T - 1), W, H);
      // soft bevel: light from the top-left
      piecePath(p, 1 + 1.4, T + 1 + 1.4); p.lineWidth = 2.2; p.strokeStyle = "rgba(255,255,255,.45)"; p.stroke();
      piecePath(p, 1 - 1.4, T + 1 - 1.4); p.lineWidth = 2.2; p.strokeStyle = "rgba(0,0,0,.35)"; p.stroke();
      p.restore();
      piecePath(p, 1, T + 1); p.lineWidth = 1.8; p.strokeStyle = "rgba(255,255,255,.92)"; p.stroke();
      piece.style.top = (ty - T - 1) + "px";
      move(0, false);
    }
    function move(pos, anim){
      x = Math.max(0, Math.min(maxPos, pos));
      const cls = anim ? "add" : "remove";
      piece.classList[cls]("pz-anim"); handle.classList[cls]("pz-anim"); fill.classList[cls]("pz-anim");
      piece.style.left = (START + x - 1) + "px";
      const hx = x / maxPos * (track.clientWidth - handle.offsetWidth || W - 44);
      handle.style.transform = `translateX(${hx}px)`;
      fill.style.width = (hx + handle.offsetWidth / 2) + "px";
      host.classList.toggle("pz-moved", x > 2);
    }
    function posFromPointer(clientX){
      const span = (track.clientWidth - handle.offsetWidth) || 1;
      return startPos + (clientX - startX) / span * maxPos;
    }
    function drop(){
      if(done) return;
      if(Math.abs(START + x - tx) <= TOL){
        done = true;
        move(tx - START, true);
        host.classList.add("pz-fit");
        if(!opts.noWork && workPct < 100){
          title.textContent = "Nice! Finishing the check…";
          sub.textContent = "This takes a second.";
        }
        resolveSolved(true);
        return;
      }
      misses++;
      card.classList.remove("pz-shake"); void card.offsetWidth; card.classList.add("pz-shake");
      sub.textContent = "Not quite. Try again.";
      move(0, true);
      if(misses >= 3){ misses = 0; setTimeout(() => { if(!done){ build(); sub.textContent = "Here is a new one. Drag the slider until the piece fits."; } }, 380); }
    }
    function onDown(e){
      if(done || (e.button != null && e.button !== 0)) return;
      dragging = true; startX = e.clientX; startPos = x;
      host.classList.add("pz-drag");
      try{ e.target.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    }
    function onMove(e){ if(dragging){ move(posFromPointer(e.clientX), false); e.preventDefault(); } }
    function onUp(){ if(!dragging) return; dragging = false; host.classList.remove("pz-drag"); drop(); }
    [handle, piece].forEach(el => {
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
    handle.addEventListener("keydown", e => {
      if(done) return;
      if(e.key === "ArrowRight"){ move(x + (e.shiftKey ? 12 : 3), false); e.preventDefault(); }
      else if(e.key === "ArrowLeft"){ move(x - (e.shiftKey ? 12 : 3), false); e.preventDefault(); }
      else if(e.key === "Enter" || e.key === " "){ drop(); e.preventDefault(); }
    });
    $(".pz-new").addEventListener("click", () => { if(!done){ misses = 0; build(); sub.textContent = "Drag the slider until the piece fits the gap."; } });
    $(".pz-x").addEventListener("click", () => ctl.close(false));
    const onKey = e => { if(e.key === "Escape") ctl.close(false); };
    document.addEventListener("keydown", onKey);

    const ctl = {
      solved,
      /** background check progress, 0–100 */
      progress(p){
        workPct = Math.max(workPct, Math.min(100, Math.round(p)));
        bar.style.width = workPct + "%";
        pct.textContent = workPct >= 100 ? "Checked" : "Checking " + workPct + "%";
      },
      /** both parts done: tick, then close */
      success(){
        ctl.progress(100);
        host.classList.add("pz-ok");
        title.textContent = "You're verified";
        sub.textContent = "Thanks! You can continue.";
        return new Promise(r => setTimeout(() => { ctl.close(true); r(); }, 650));
      },
      close(result){
        if(!host.isConnected) return;
        document.removeEventListener("keydown", onKey);
        host.classList.add("pz-out");
        setTimeout(() => host.remove(), 220);
        if(open_ === ctl) open_ = null;
        if(!done) resolveSolved(false);
        if(result === false && opts.onCancel) opts.onCancel();
      }
    };
    open_ = ctl;
    requestAnimationFrame(() => { host.classList.add("pz-in"); build(); });
    return ctl;
  }
  return { open };
})();
window.SrvPuzzle = SrvPuzzle;
/* ---------------- Module: "I'm not a robot" check (server-signed puzzle, solved in the browser) ---------------- */
const HumanCheck = (function(){
  // SHA-256 of a short text, first 32 bits only (the puzzle needs the leading zero bits)
  const SHA_SRC = `
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W = new Uint32Array(64);
function h0(str){
  W.fill(0);
  const len = str.length;
  for (let i = 0; i < len; i++) W[i >> 2] |= str.charCodeAt(i) << (24 - (i & 3) * 8);
  W[len >> 2] |= 0x80 << (24 - (len & 3) * 8);
  W[15] = len * 8;
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a, e = 0x510e527f, f = 0x9b05688c, g = 0x1f83d9ab, h = 0x5be0cd19;
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  return (0x6a09e667 + a) >>> 0;
}`;
  const WORKER_SRC = SHA_SRC + `
onmessage = function(e){
  const salt = e.data.salt, shift = 32 - e.data.bits;
  for (let n = 0; ; n++) {
    if ((h0(salt + ':' + n) >>> shift) === 0) { postMessage({ done: true, n: n }); return; }
    if (n % 40000 === 39999) postMessage({ done: false, n: n });
  }
};`;
  let workerUrl = null, localHash = null;

  function solveInWorker(salt, bits, onProgress){
    return new Promise((resolve, reject) => {
      let w;
      try{
        if(!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
        w = new Worker(workerUrl);
      }catch(e){ reject(e); return; }
      const stop = setTimeout(() => { w.terminate(); reject(new Error("timeout")); }, 60000);
      w.onmessage = e => {
        if(e.data.done){ clearTimeout(stop); w.terminate(); resolve(e.data.n); }
        else onProgress(e.data.n);
      };
      w.onerror = err => { clearTimeout(stop); w.terminate(); reject(err); };
      w.postMessage({ salt, bits });
    });
  }
  async function solveHere(salt, bits, onProgress){
    if(!localHash) localHash = new Function(SHA_SRC + "\nreturn h0;")();
    const shift = 32 - bits;
    for(let n = 0; ; n++){
      if((localHash(salt + ":" + n) >>> shift) === 0) return n;
      if(n % 20000 === 19999){ onProgress(n); await new Promise(r => setTimeout(r, 0)); }
    }
  }
  async function solve(salt, bits, onProgress){
    try{ return await solveInWorker(salt, bits, onProgress); }
    catch(e){ return solveHere(salt, bits, onProgress); }
  }

  const TEXT = {
    idle:    ["I'm not a robot", "Tap the box to check"],
    busy:    ["Verifying…", "Checking you're human"],
    ok:      ["You're verified", ""],
    error:   ["Couldn't verify", "Tap the box to try again"],
    expired: ["Check expired", "Tap the box again"],
  };
  const MARKUP = `
    <button type="button" class="hc-box" role="checkbox" aria-checked="false" aria-label="I'm not a robot">
      <svg class="hc-ring" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5"/></svg>
      <svg class="hc-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 12.6l4.3 4.3L18.9 7.4"/></svg>
    </button>
    <div class="hc-text"><b class="hc-title"></b><small class="hc-sub" aria-live="polite"></small></div>
    <div class="hc-brand">
      <svg class="hc-emblem" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path class="hc-shield" d="M20 3.6 32.6 8.3v9.6c0 8.1-5.2 14.3-12.6 17.9C12.6 32.2 7.4 26 7.4 17.9V8.3L20 3.6Z"/>
        <g class="hc-print">
          <path d="M14.4 18.8a5.6 5.6 0 0 1 11.2 0v1.4"/>
          <path d="M17 25.4c.8-1.5 1.2-3.2 1.2-5v-1.6a1.8 1.8 0 0 1 3.6 0v1.8"/>
          <path d="M21.8 22.4c-.2 1.8-.8 3.5-1.7 5"/>
          <path d="M12 21.2c.2-.8.3-1.6.3-2.5a7.7 7.7 0 0 1 12.3-6.2"/>
          <path d="M27.6 17c.2.6.2 1.2.2 1.8 0 2.3-.4 4.4-1.1 6.3"/>
          <path d="M14.6 27.2c.7-1.2 1.1-2.5 1.3-3.9"/>
        </g>
        <path class="hc-scan" d="M11 13h18"/>
      </svg>
      <span class="hc-brand-name">Secure check</span>
      <span class="hc-links"><a href="#privacy">Privacy</a><i>·</i><a href="#terms">Terms</a></span>
    </div>
    <div class="hc-bar" aria-hidden="true"><i></i></div>`;

  function attach(el, purpose){
    if(!el) return null;
    if(el.__hc) return el.__hc;
    el.classList.add("hc");
    el.innerHTML = MARKUP;
    const box = el.querySelector(".hc-box"), title = el.querySelector(".hc-title"), sub = el.querySelector(".hc-sub"), bar = el.querySelector(".hc-bar i");
    let state = "idle", proof = null, expiresAt = 0, expTimer = null, run = 0, needTimer = null, pz = null;

    function setState(s, subText){
      state = s;
      el.dataset.state = s;
      box.setAttribute("aria-checked", s === "ok" ? "true" : "false");
      box.setAttribute("aria-busy", s === "busy" ? "true" : "false");
      title.textContent = TEXT[s][0];
      sub.textContent = subText != null ? subText : TEXT[s][1];
      if(s !== "busy") bar.style.width = s === "ok" ? "100%" : "0%";
      el.dispatchEvent(new CustomEvent("humancheck", { detail: { state: s } }));
    }
    async function start(){
      if(state === "busy" || state === "ok") return;
      const me = ++run;
      clearTimeout(expTimer);
      proof = null;
      setState("busy");
      bar.style.width = "4%";
      const t0 = performance.now();
      // Cloudflare can start too (login / sign-up), so it's ready when the person presses the button
      if(purpose !== "withdraw"){ try{ window.SrvCaptcha && window.SrvCaptcha.prefetch(); }catch(_){} }
      // the slide puzzle keeps the person busy while the check runs
      pz = window.SrvPuzzle ? window.SrvPuzzle.open({ onCancel: () => { if(me === run){ run++; pz = null; setState("idle"); } } }) : null;
      const myPz = pz;
      try{
        const { data, error } = await supabase.rpc("get_human_challenge", { p_purpose: purpose });
        if(error || !data) throw new Error((error && error.message) || "No puzzle");
        const ch = Array.isArray(data) ? data[0] : data;
        const expected = Math.pow(2, Number(ch.bits) || 18);
        const n = await solve(ch.salt, Number(ch.bits) || 18, done => {
          if(me !== run) return;
          const p = 6 + 86 * (1 - Math.exp(-done / expected));
          bar.style.width = Math.min(92, p) + "%";
          if(myPz) myPz.progress(Math.min(95, p));
        });
        if(myPz){
          myPz.progress(100);
          const ok = await myPz.solved;
          if(!ok || me !== run) return;
        } else {
          const minTime = 1300 + Math.random() * 500;
          const left = minTime - (performance.now() - t0);
          if(left > 0) await new Promise(r => setTimeout(r, left));
        }
        if(me !== run) return;
        proof = { purpose: ch.purpose, salt: ch.salt, exp: ch.exp, bits: ch.bits, sig: ch.sig, n: String(n) };
        expiresAt = Number(ch.exp) * 1000 - 30000;
        const mins = Math.max(1, Math.round((expiresAt - Date.now()) / 60000));
        setState("ok", "ID " + String(ch.salt).slice(0, 4).toUpperCase() + "-" + String(ch.salt).slice(4, 8).toUpperCase() + " · " + mins + " min");
        expTimer = setTimeout(() => { if(state === "ok"){ proof = null; setState("expired"); } }, Math.max(1000, expiresAt - Date.now()));
        if(myPz){ await myPz.success(); if(pz === myPz) pz = null; }
      }catch(e){
        console.warn("Human check failed", e);
        if(myPz){ myPz.close(true); if(pz === myPz) pz = null; }
        if(me === run) setState("error");
      }
    }
    box.addEventListener("click", e => {
      if(!e.isTrusted) return;   // a real tap or click only
      start();
    });
    box.addEventListener("keydown", e => {
      if((e.key === " " || e.key === "Enter") && e.isTrusted){ e.preventDefault(); start(); }
    });

    const ctl = {
      purpose,
      /** the solved puzzle, or null when the box is not ticked (or the check expired) */
      proof(){ return state === "ok" && proof && Date.now() < expiresAt ? proof : null; },
      /** shake the box and ask the person to tick it */
      nudge(){
        if(state === "busy") return;
        if(state === "ok" && !ctl.proof()) setState("expired");
        el.classList.remove("is-need"); void el.offsetWidth; el.classList.add("is-need");
        sub.textContent = state === "expired" ? "The check expired. Tap the box again." : "Please tick this box first";
        clearTimeout(needTimer);
        needTimer = setTimeout(() => el.classList.remove("is-need"), 1600);
        try{ box.focus({ preventScroll: true }); }catch(e){}
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
      /** back to an empty box (after the puzzle was used, or after a failed attempt) */
      reset(){ run++; clearTimeout(expTimer); proof = null; if(pz){ const p = pz; pz = null; p.close(true); } el.classList.remove("is-need"); setState("idle"); },
      get state(){ return state; },
    };
    setState("idle");
    el.__hc = ctl;
    return ctl;
  }

  return { attach };
})();

const LandingAuth = (function(){
  const modal = document.getElementById("authModal");
  let refValid = false, refTimer = null, wired = false, currentMode = "signup";

  // referral code: the inviter's code from their link (remembered for 60 days), otherwise Repuven's own code
  const DEFAULT_REF = "ADMIN-SS-001", REF_KEY = "srv_ref_code", REF_DAYS = 60;
  const cleanRef = c => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
  function rememberRef(code){ try{ localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() })); }catch(e){} }
  function rememberedRef(){
    try{
      const v = JSON.parse(localStorage.getItem(REF_KEY) || "null");
      if(v && v.code && Date.now() - Number(v.at || 0) < REF_DAYS * 864e5) return cleanRef(v.code);
    }catch(e){}
    return "";
  }
  function forgetRef(){ try{ localStorage.removeItem(REF_KEY); }catch(e){} }
  function setRef(code, source){
    const input = document.getElementById("signupReferral");
    if(!input) return;
    input.value = code;
    input.dataset.refSource = source;
    refValid = false;
    clearTimeout(refTimer);
    checkRef();
  }
  function fillRef(params){
    const fromLink = cleanRef((params && params.get("ref")) || new URLSearchParams(location.search).get("ref"));
    if(fromLink){ rememberRef(fromLink); setRef(fromLink, "link"); return; }
    const input = document.getElementById("signupReferral");
    if(input && input.value.trim() && input.dataset.refSource === "typed") return;   // keep what the person typed
    const saved = rememberedRef();
    setRef(saved || DEFAULT_REF, saved ? "saved" : "default");
  }
  let hcSignup = null, hcLogin = null, sentEmail = "", resendTimer = null;
  // VIP invite links (?vip=TOKEN): no referral code and no verification
  const vip = { token: "", code: "", state: "", kind: "vip" };   // state: "" | "checking" | "ok" | "bad"; kind: "vip" | "inv" | "free"
  const LINK_TEXT = {
    sa: { chip:"TEAM", kicker:"Team invite", h:"Help run Repuven.", p:"This link makes you a supportive admin. After you join, you sign in to the admin panel and do only the work the admin gave you.",
          title:"Create your team account", sub:"Fill in your details to get your supportive admin account.", busy:"Creating your team account...",
          ok:"<b>You have a team invite.</b><span>No referral code and no payment. After you confirm your email, open the admin panel and sign in with this account.</span>",
          bad:"<b>This team link is not working.</b><span>It may be turned off or already used. One link works for one account. Ask the admin for a new link.</span>",
          checking:"<b>Checking your team link…</b>" },
    vip: { chip:"VIP", kicker:"VIP invite", h:"Invite people. Earn. Withdraw.", p:"This link gives you a VIP account. It is verified for free, and you do not need a referral code.",
           title:"Create your VIP account", sub:"Fill in your details to get your VIP account.", busy:"Creating your VIP account...",
           ok:"<b>You have a VIP invite.</b><span>Your account is verified for free. No referral code and no payment. You invite people and withdraw what you earn.</span>",
           bad:"<b>This VIP link is not working.</b><span>It may be turned off or already used. Ask the person who sent it for a new link, or join with a referral code.</span>",
           checking:"<b>Checking your VIP link…</b>" },
    inv: { chip:"INVESTOR", kicker:"Investor invite", h:"See how Repuven grows.", p:"This link gives you an investor account. You see members, verified accounts, tasks and the Investor Pool, and you get a share of the pool every month.",
           title:"Create your investor account", sub:"Fill in your details to get your investor account.", busy:"Creating your investor account...",
           ok:"<b>You have an investor invite.</b><span>No referral code and no payment. Your account opens with the investor dashboard, and the pool is shared among investors 2 days before each month ends.</span>",
           bad:"<b>This investor link is not working.</b><span>It may be turned off or already used. Ask the person who sent it for a new link.</span>",
           checking:"<b>Checking your investor link…</b>" },
    free: { chip:"FREE", kicker:"Free invite", h:"Start working without paying.", p:"You were invited by a VIP member. You can open Survey and do tasks without the $20 verification.",
           title:"Create your account", sub:"Joining is free. It takes one minute.", busy:"Creating your account...",
           ok:"<b>No verification payment needed.</b><span>Survey opens for you right away. To withdraw, send balance or buy the $20 package, invite 3 people who verify their account.</span>",
           bad:"<b>This invite link is not working.</b><span>Ask the person who sent it for a new link, or join with a referral code.</span>",
           checking:"<b>Checking your invite link…</b>" }
  };
  let sideText = null;

  function showMessage(message, type){ const el = document.getElementById("authStatus"); el.textContent = message; el.className = "auth-status " + (type||""); }
  function setBusy(busy){ document.querySelector(".auth-main").classList.toggle("auth-loading", busy); }
  function vipActive(){ return vip.state === "ok"; }

  function paintVip(){
    const onSignup = currentMode === "signup";
    const vipOn = vipActive() && onSignup;
    modal.classList.toggle("is-vip", vipOn);
    const refInput = document.getElementById("signupReferral");
    if(refInput) refInput.required = false;   // the code is filled in for the person

    const side = modal.querySelector(".auth-side");
    if(side){
      const k = side.querySelector(".auth-kicker"), h = side.querySelector("h2"), p = side.querySelector("p");
      if(!sideText) sideText = { k: k ? k.textContent : "", h: h ? h.textContent : "", p: p ? p.textContent : "" };
      const T = LINK_TEXT[vip.kind] || LINK_TEXT.vip;
      if(k) k.textContent = vipOn ? T.kicker : sideText.k;
      if(h) h.textContent = vipOn ? T.h : sideText.h;
      if(p) p.textContent = vipOn ? T.p : sideText.p;
    }
    if(onSignup){
      const T = LINK_TEXT[vip.kind] || LINK_TEXT.vip;
      document.getElementById("authTitle").textContent = vipOn ? T.title : "Create your account";
      document.getElementById("authSub").textContent = vipOn ? T.sub : "Joining is free. It takes one minute.";
    }

    const note = document.getElementById("authVipNote");
    if(!note) return;
    if(!onSignup || !vip.token){ note.hidden = true; return; }
    note.hidden = false;
    note.classList.toggle("is-bad", vip.state === "bad");
    const T = LINK_TEXT[vip.kind] || LINK_TEXT.vip;
    note.innerHTML = '<span class="vip-chip">' + T.chip + '</span><div>' + (vip.state === "ok" ? T.ok : vip.state === "bad" ? T.bad : T.checking) + '</div>';
  }

  async function setVip(token, kind){
    kind = kind || "vip";
    token = String(token || "").trim().toUpperCase().replace(kind === "free" ? /[^A-Z0-9-]/g : /[^A-Z0-9]/g, "");
    if(!token) return;
    if(token === vip.token && kind === vip.kind && (vip.state === "ok" || vip.state === "bad" || vip.state === "checking")){ paintVip(); return; }
    vip.token = token; vip.code = ""; vip.state = "checking"; vip.kind = kind;
    paintVip();
    try{
      const { data, error } = kind === "sa" ? await supabase.rpc("get_helper_link_info", { p_token: token })
        : kind === "inv" ? await supabase.rpc("get_investor_link_info", { p_token: token })
        : kind === "free" ? await supabase.rpc("get_vip_free_link_info", { p_code: token })
        : await supabase.rpc("get_vip_link_info", { p_token: token });
      if(error) throw error;
      const info = Array.isArray(data) ? data[0] : data;
      if(info && info.valid && info.referral_code){ vip.state = "ok"; vip.code = String(info.referral_code); }
      else vip.state = "bad";
    }catch(e){
      console.warn("VIP link check failed", e);
      vip.state = "bad";
    }
    if(vip.token === token) paintVip();
  }

  function setTab(mode){
    currentMode = mode;
    modal.classList.remove("is-sent");
    document.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("active", b.dataset.tab===mode));
    document.getElementById("signinForm").classList.toggle("active", mode==="signin");
    document.getElementById("signupForm").classList.toggle("active", mode==="signup");
    document.getElementById("authTitle").textContent = mode==="signup" ? "Create your account" : "Welcome back";
    document.getElementById("authSub").textContent = mode==="signup" ? "Joining is free. It takes one minute." : "Log in to your account.";
    showMessage("","");
    paintVip();
  }

  function mailAppFor(email){
    const d = String(email.split("@")[1] || "").toLowerCase();
    if(d === "gmail.com" || d === "googlemail.com") return ["Open Gmail", "https://mail.google.com/mail/u/0/#inbox"];
    if(/^(outlook|hotmail|live|msn)\./.test(d)) return ["Open Outlook", "https://outlook.live.com/mail/"];
    if(/^yahoo\./.test(d)) return ["Open Yahoo Mail", "https://mail.yahoo.com/"];
    return null;
  }
  function startResendTimer(seconds){
    const btn = document.getElementById("authResend");
    clearInterval(resendTimer);
    let left = seconds;
    const tick = () => {
      if(left <= 0){ clearInterval(resendTimer); btn.disabled = false; btn.textContent = "Send the email again"; return; }
      btn.disabled = true; btn.textContent = "Send again in " + left + "s"; left--;
    };
    tick(); resendTimer = setInterval(tick, 1000);
  }
  function showSent(email){
    sentEmail = email;
    document.getElementById("authSentEmail").textContent = email;
    const app = mailAppFor(email), openBtn = document.getElementById("authOpenMail");
    if(app){ openBtn.hidden = false; openBtn.querySelector("span").textContent = app[0]; openBtn.href = app[1]; } else { openBtn.hidden = true; }
    document.getElementById("authSentNote").textContent = "";
    modal.classList.add("is-sent");
    modal.querySelector(".auth-main").scrollTop = 0;
    startResendTimer(60);
  }
  async function resendEmail(){
    const note = document.getElementById("authSentNote");
    if(!sentEmail) return;
    const btn = document.getElementById("authResend");
    btn.disabled = true; btn.textContent = "Sending…"; note.textContent = "";
    try{
      const res = await fetch(SUPABASE_URL + "/auth/v1/resend?redirect_to=" + encodeURIComponent(window.location.origin + window.location.pathname), {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "signup", email: sentEmail })
      });
      if(!res.ok){
        const j = await res.json().catch(() => null);
        throw new Error((j && (j.msg || j.message || j.error_description)) || "We couldn't send the email. Please try again in a minute.");
      }
      note.textContent = "Sent again. Check your inbox and Spam folder.";
      startResendTimer(60);
    }catch(e){
      note.textContent = e.message || "We couldn't send the email. Please try again in a minute.";
      startResendTimer(20);
    }
  }

  function open(mode, params){
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    setTab(mode);
    const search = new URLSearchParams(location.search);
    fillRef(params);
    const pick = k => (params && params.get(k)) || search.get(k);
    if(pick("vip")) setVip(pick("vip"), "vip");
    else if(pick("inv")) setVip(pick("inv"), "inv");
    else if(pick("vf")) setVip(pick("vf"), "free");
    else if(pick("sa")) setVip(pick("sa"), "sa");
  }
  function close(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden","true");
    restorePageScroll();
    showMessage("","");
    // only drop the #auth/... address of the form itself; any other page address stays,
    // so closing the form (or the router tidying up) never loses the page being opened
    if(/^#auth(\/|\?|$)/.test(location.hash || "")) history.replaceState(null, "", location.pathname + location.search);
  }

  async function checkRef(){
    const input = document.getElementById("signupReferral");
    const statusEl = document.getElementById("refStatus");
    const code = input.value.trim();
    if(!code){ refValid = false; statusEl.textContent = ""; statusEl.style.color = ""; return; }
    statusEl.textContent = "Checking…"; statusEl.style.color = "";
    let { data, error } = await supabase.rpc("check_referral_code", { p_code: code });
    let reason = "";
    if(error){   // older database: plain yes / no check
      const r = await supabase.rpc("validate_super_survey_referral", { p_code: code });
      data = { valid: !!r.data }; error = r.error;
    }
    if(input.value.trim() !== code) return;   // the person changed the code while we were checking
    if(error){ refValid = false; statusEl.textContent = "Couldn't verify this code."; statusEl.style.color = "#e0507a"; return; }
    refValid = !!(data && data.valid);
    reason = (data && data.reason) || "";
    if(!refValid && input.dataset.refSource === "saved"){ forgetRef(); setRef(DEFAULT_REF, "default"); return; }
    const source = input.dataset.refSource;
    statusEl.textContent = !refValid
      ? (reason === "not_verified" ? "This member has not verified their account yet, so their code can't be used. Ask them to verify first, or use another code." : "This code is not valid. Ask the member who invited you.")
      : source === "default" ? "✓ Repuven's code is added. You can change it."
      : (source === "link" || source === "saved") ? "✓ Your inviter's code is added for you."
      : "✓ Valid referral code";
    statusEl.style.color = refValid ? "#1fdb96" : "#e0507a";
  }

  function wireOnce(){
    if(wired) return;
    wired = true;

    document.querySelectorAll("[data-auth-mode]").forEach(btn => btn.addEventListener("click", (e) => {
      e.preventDefault();
      Router.go("auth/" + btn.dataset.authMode);
    }));
    document.getElementById("authClose").addEventListener("click", () => Router.go(""));
    modal.addEventListener("click", (e) => { if(e.target === modal) Router.go(""); });
    document.addEventListener("keydown", (e) => { if(e.key === "Escape" && modal.classList.contains("is-open")) Router.go(""); });
    document.querySelectorAll(".auth-tab").forEach(b => b.addEventListener("click", () => Router.go("auth/" + b.dataset.tab)));
    document.querySelectorAll("[data-toggle-pass]").forEach(btn => btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.togglePass);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "SHOW" : "HIDE";
    }));

    document.getElementById("signupReferral").addEventListener("input", (e) => {
      e.target.dataset.refSource = "typed";
      e.target.value = e.target.value.toUpperCase();
      clearTimeout(refTimer);
      refTimer = setTimeout(checkRef, 450);
    });

    // an emptied field gets Repuven's code back (a moment later, so the tap that left the field still lands)
    document.getElementById("signupReferral").addEventListener("blur", (e) => {
      const input = e.target;
      setTimeout(() => { if(!input.value.trim() && !vipActive()) setRef(DEFAULT_REF, "default"); }, 220);
    });

    document.getElementById("forgotPassLink").addEventListener("click", () => Router.go("auth/forgot"));

    async function ensureSignupProvisioned(human){
      const { data, error } = await supabase.rpc("ensure_member_profile", { p_human: human || null });
      if(error) throw error;
      return data;
    }

    document.getElementById("signupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const full_name = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const phone = normPhone(document.getElementById("signupPhone").value);
      if(!phone){ showMessage("Please enter your active phone number, like 01XXXXXXXXX."); document.getElementById("signupPhone").focus(); return; }
      if(!vipActive() && !document.getElementById("signupReferral").value.trim()) setRef(DEFAULT_REF, "default");
      const code = document.getElementById("signupReferral").value.trim();
      const useVip = vipActive();

      if(vip.token && vip.state === "checking"){ showMessage("Please wait. We are checking your invite link."); return; }
      if(!useVip){
        if(!code){ showMessage("You need a referral code to join."); return; }
        if(!refValid){ await checkRef(); if(!refValid){ showMessage("Please enter a valid referral code from a member."); return; } }
      }
      if(password.length < 6){ showMessage("Password must be at least 6 characters."); return; }
      {
        const { data: phoneFree, error: phoneFreeErr } = await supabase.rpc("phone_is_free", { p_phone: phone });
        if(!phoneFreeErr && phoneFree === false){ showMessage("This phone number is already used by another account. Log in with it, or use another number."); document.getElementById("signupPhone").focus(); return; }
      }
      const human = hcSignup && hcSignup.proof();
      if(!human){ if(hcSignup) hcSignup.nudge(); showMessage("Please tick “I'm not a robot” first."); return; }

      setBusy(true); showMessage(useVip ? (LINK_TEXT[vip.kind] || LINK_TEXT.vip).busy : "Creating your account...", "success");
      const linkMeta = vip.kind === "sa" ? { helper_token: vip.token } : vip.kind === "inv" ? { investor_token: vip.token } : vip.kind === "free" ? { vip_free_code: vip.code } : { vip_token: vip.token };
      const meta = useVip ? Object.assign({ full_name, phone, referred_by_code: vip.code, human }, linkMeta) : { full_name, phone, referred_by_code: code, human };
      window.__ssFormAuth = true;
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: meta, emailRedirectTo: window.location.origin + window.location.pathname }
      });
      setBusy(false);
      const signupErr=(error?.message||"").toLowerCase();
      const alreadyRegistered=!!error && /already (registered|exists|used)|user already|duplicate|email.*already/.test(signupErr);
      const obfuscatedExisting=!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length===0;
      if(alreadyRegistered || obfuscatedExisting){ window.__ssFormAuth = false; showMessage("This Gmail is already used. Please use another Gmail."); return; }
      if(error){ window.__ssFormAuth = false; showMessage(error.message || "Couldn't create your account."); return; }
      if(data.session){
        try { await ensureSignupProvisioned(null); } catch(provisionError) {
          window.__ssFormAuth = false;
          console.error("Repuven provisioning failed after signup:", provisionError);
          showMessage(provisionError.message || "Your account is made, but setup is not finished. Please log in again.");
          return;
        }
        window.__ssFormAuth = false;
        showMessage(useVip && vip.kind === "sa" ? "Your team account is ready. Open the admin panel from the menu." : useVip && vip.kind === "vip" ? "Your VIP account is ready. You are now logged in!" : useVip && vip.kind === "inv" ? "Your investor account is ready. You are now logged in!" : "Account created. You are now logged in!", "success");
        await loadAppState(); renderSidebar();
        setTimeout(() => Router.go("home"), 700);
      } else {
        window.__ssFormAuth = false;
        if(hcSignup) hcSignup.reset();
        showSent(email);
      }
    });

    document.getElementById("signinForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const human = hcLogin && hcLogin.proof();
      if(!human){ if(hcLogin) hcLogin.nudge(); showMessage("Please tick “I'm not a robot” first."); return; }
      const loginId = document.getElementById("signinEmail").value.trim();
      const password = document.getElementById("signinPassword").value;
      const byPhone = !loginId.includes("@");
      let email = loginId;
      if(byPhone && !normPhone(loginId)){ showMessage("Enter your email, or your phone number like 01XXXXXXXXX."); document.getElementById("signinEmail").focus(); return; }
      setBusy(true); showMessage("Signing you in securely...", "success");
      if(byPhone){
        // the server checks the number and password, and gives back the account's email only when they match
        const { data, error: phoneErr } = await supabase.rpc("phone_login", { p_phone: normPhone(loginId), p_password: password });
        if(phoneErr || !data || !data.ok){
          setBusy(false);
          if(hcLogin) hcLogin.reset();
          showMessage(phoneErr ? "Couldn't log in with your phone number right now. Please use your email." : (data && data.error) || "Incorrect phone number or password.");
          return;
        }
        email = data.email;
      }
      window.__ssFormAuth = true;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if(error){
        window.__ssFormAuth = false;
        if(hcLogin) hcLogin.reset();
        showMessage(error.message === "Invalid login credentials" ? (byPhone ? "Incorrect phone number or password." : "Incorrect email or password.") : (error.message || "Couldn't log in."));
        return;
      }
      try { await ensureSignupProvisioned(human); } catch(provisionError) {
        window.__ssFormAuth = false;
        setBusy(false);
        if(hcLogin) hcLogin.reset();
        console.error("Repuven provisioning failed after login:", provisionError);
        showMessage(provisionError.message || "Your account needs setup. Please contact support.");
        return;
      }
      window.__ssFormAuth = false;
      if(hcLogin) hcLogin.reset();
      showMessage("Login successful. Welcome back!", "success");
      await loadAppState(); renderSidebar();
      setTimeout(() => Router.go("home"), 500);
    });

    hcSignup = HumanCheck.attach(document.querySelector("#signupForm .hc"), "signup");
    hcLogin = HumanCheck.attach(document.querySelector("#signinForm .hc"), "login");
    // once the box is ticked, the "please tick" message is not needed any more
    modal.querySelectorAll(".hc").forEach(el => el.addEventListener("humancheck", e => {
      if(e.detail.state === "ok" && /robot/i.test(document.getElementById("authStatus").textContent)) showMessage("", "");
    }));
    document.getElementById("authResend").addEventListener("click", resendEmail);
    document.getElementById("authSentBack").addEventListener("click", () => {
      modal.classList.remove("is-sent");
      const input = document.getElementById("signupEmail");
      input.value = ""; showMessage("", "");
      setTimeout(() => input.focus(), 50);
    });
  }

  /** Called by the router whenever we land on #auth/signin or #auth/signup while logged out. */
  function activate(sub, params){
    wireOnce();
    open(sub === "signin" ? "signin" : "signup", params);
  }

  return { activate, close };
})();

/* ---------------- Module: Home ---------------- */
Modules.home = (function(){
  async function loadArticles(){
    const mount = document.getElementById("articles-mount");
    const { data, error } = await supabase
      .from("articles").select("*")
      .eq("is_published", true)
      .order("created_at", { ascending:false })
      .limit(30);

    if(error){ mount.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg></div>Couldn't load updates right now.</div>`; return; }
    if(!data || !data.length){ mount.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-newspaper"/></svg></div>No news yet — check back soon.</div>`; return; }

    mount.innerHTML = `<div class="articles-grid">${data.map(a => `
      <div class="card article-card" data-id="${a.id}">
        ${a.image_url ? `<img src="${escapeHtml(a.image_url)}" alt="">` : ""}
        <div class="body">
          <h3>${escapeHtml(a.title)}</h3>
          <div class="snippet">${escapeHtml(a.body)}</div>
          <div class="meta">${fmtDate(a.created_at)}</div>
        </div>
      </div>`).join("")}</div>`;

    mount.querySelectorAll(".article-card").forEach(card => {
      card.addEventListener("click", () => {
        const a = data.find(x => x.id === card.dataset.id);
        document.getElementById("am-title").textContent = a.title;
        document.getElementById("am-meta").textContent = fmtDate(a.created_at);
        document.getElementById("am-body").textContent = a.body;
        const img = document.getElementById("am-image");
        if(a.image_url){ img.src = a.image_url; img.style.display = "block"; } else { img.style.display = "none"; }
        document.getElementById("article-modal").style.display = "flex";
      });
    });
  }

  function renderWelcome(ctx){
    const { profile, wallet, isAdmin } = ctx;
    document.getElementById("wc-title").textContent = "Welcome back, " + ((profile && profile.full_name && profile.full_name.split(" ")[0]) || "there");
    document.getElementById("wc-balance").textContent = money(wallet ? wallet.available_balance : 0);
    const vb = document.getElementById("wc-verified-badge");
    vb.textContent = (profile && profile.is_verified) ? "✓ Verified member" : (profile && profile.vip_free) ? "✓ Free member · Survey is open" : "Verify your account to open Survey";
  }

  function init(){
    renderWelcome(ctxFor());

    document.getElementById("am-close").addEventListener("click", () => document.getElementById("article-modal").style.display = "none");
    document.getElementById("article-modal").addEventListener("click", (e) => { if(e.target.id === "article-modal") e.currentTarget.style.display = "none"; });

    loadArticles();
  }

  async function onActivate(){
    await refreshWallet();
    renderWelcome(ctxFor());
    loadArticles();
  }

  return { init, onActivate };
})();

/* ---------------- Module: VIP home (VIP accounts only invite people and withdraw) ---------------- */
const VipHome = (function(){
  let wired = false;
  const $ = id => document.getElementById(id);

  function inviteLink(){
    const code = (AppState.profile && AppState.profile.referral_code) || "";
    return code ? `${location.origin}${location.pathname}#auth/signup?ref=${encodeURIComponent(code)}` : "";
  }
  // second link: people join without the $20 verification; the VIP member earns nothing from them
  function freeLink(){
    const code = (AppState.profile && AppState.profile.referral_code) || "";
    return code ? `${location.origin}${location.pathname}#auth/signup?vf=${encodeURIComponent(code)}` : "";
  }

  async function copyText(text, btn){
    if(!text) return;
    let ok = false;
    try{ await navigator.clipboard.writeText(text); ok = true; }
    catch(e){
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try{ ok = document.execCommand("copy"); }catch(_){}
      ta.remove();
    }
    if(btn){
      const label = btn.dataset.label || btn.textContent;
      btn.dataset.label = label;
      btn.textContent = ok ? "Copied!" : "Could not copy";
      setTimeout(() => { btn.textContent = label; }, 1500);
    }
  }

  function wire(){
    if(wired) return;
    wired = true;
    $("vip-copy-link").addEventListener("click", () => copyText(inviteLink(), $("vip-copy-link")));
    $("vip-copy-code").addEventListener("click", () => copyText((AppState.profile && AppState.profile.referral_code) || "", $("vip-copy-code")));
    $("vip-ref-link").addEventListener("focus", e => e.target.select());
    $("vip-free-link").addEventListener("focus", e => e.target.select());
    $("vip-copy-free").addEventListener("click", () => copyText(freeLink(), $("vip-copy-free")));
    const share = $("vip-share");
    if(navigator.share){
      share.hidden = false;
      share.addEventListener("click", () => {
        navigator.share({ title: "Repuven", text: "Join Repuven with my invite link:", url: inviteLink() }).catch(() => {});
      });
    }
  }

  function shortDate(v){
    try{ return new Date(v).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }); }catch(e){ return fmtDate(v); }
  }
  function earningText(t){
    const d = String(t.description || "");
    let m = d.match(/direct referral bonus for Package (\d)/i);
    if(m) return "A person you invited verified their account" + (m[1] === "1" ? " (old $10 package)" : "");
    m = d.match(/upline referral bonus for Package (\d)/i);
    if(m) return "A person they invited verified their account" + (m[1] === "1" ? " (old $10 package)" : "");
    if(/referral commission from referred user withdrawal/i.test(d)) return "5% of a withdrawal by a person you invited";
    if(/bonus: a member you invited verified/i.test(d)) return "A person you invited verified their account";
    if(/bonus: a member in your team verified/i.test(d)) return "A person they invited verified their account";
    return d || "Referral commission";
  }

  function statusBadge(r){
    if(r.status === "QUALIFIED") return '<span class="badge badge-green">Verified</span>';
    if(r.status === "REJECTED") return '<span class="badge badge-danger">Rejected</span>';
    if(r.status === "SUSPICIOUS") return '<span class="badge badge-danger">Flagged</span>';
    return '<span class="badge badge-muted">Not verified yet</span>';
  }

  async function load(){
    wire();
    Leadership.refresh(true);
    const p = AppState.profile || {}, w = AppState.wallet || {};
    const first = ((p.full_name || "").trim().split(/\s+/)[0]) || "there";
    $("vip-hello").textContent = "Welcome, " + first;
    $("vip-ref-link").value = inviteLink() || "—";
    $("vip-free-link").value = freeLink() || "—";
    $("vip-ref-code").textContent = p.referral_code || "—";
    $("vip-balance").textContent = money(w.available_balance || 0);
    $("vip-earned").textContent = money(w.lifetime_earnings || w.referral_earnings || 0);
    if(!AppState.user) return;

    const [refs, earns] = await Promise.all([
      supabase.from("referrals").select("status,created_at,qualified_at").eq("referrer_id", AppState.user.id).order("created_at", { ascending:false }),
      supabase.from("wallet_transactions").select("amount,description,created_at,status").eq("user_id", AppState.user.id).in("transaction_type", ["REFERRAL_COMMISSION", "LEADERSHIP_BONUS", "LEADERSHIP_INCOME"]).order("created_at", { ascending:false }).limit(30)
    ]);

    const list = (refs && refs.data) || [];
    $("vip-joined").textContent = list.length;
    $("vip-verified").textContent = list.filter(r => r.status === "QUALIFIED").length;
    const rw = $("vip-ref-table");
    if(refs && refs.error){
      rw.innerHTML = '<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn\'t load this list. Please refresh.</div>';
    } else if(!list.length){
      rw.innerHTML = '<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-link"/></svg></div>No one has joined yet. Share your link to start.</div>';
    } else {
      rw.innerHTML = `<ul class="vip-rows">${
        list.map((r, i) => `<li><div><b>Person ${list.length - i}</b><small>Joined ${shortDate(r.created_at)}${r.qualified_at ? " · Verified " + shortDate(r.qualified_at) : ""}</small></div>${statusBadge(r)}</li>`).join("")
      }</ul>`;
    }

    const rows = (earns && earns.data) || [];
    const ew = $("vip-earn-table");
    if(earns && earns.error){
      ew.innerHTML = '<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn\'t load your earnings. Please refresh.</div>';
    } else if(!rows.length){
      ew.innerHTML = '<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-wallet"/></svg></div>No earnings yet. You earn when people you invite get verified.</div>';
    } else {
      ew.innerHTML = `<ul class="vip-rows">${
        rows.map(t => `<li><div><b>${escapeHtml(earningText(t))}</b><small>${shortDate(t.created_at)}</small></div><span class="vip-amount">+${money(t.amount)}</span></li>`).join("")
      }</ul>`;
    }
  }

  return { load };
})();

/* Accounts made with a VIP member's free link: they work without the $20 verification
   until 3 people they invited verify. Then Survey locks and they must verify ($20).
   Withdraw and transfer need the verification. */
const FreeMember = (function(){
  let st = null;
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
  function isFree(){ const p = AppState.profile; return !!(p && p.vip_free && !p.is_verified && !AppState.isAdmin); }
  async function refresh(){
    if(!isFree()){ st = null; return null; }
    const { data, error } = await supabase.rpc("get_free_member_status");
    if(!error) st = data || null;
    return st;
  }
  function locked(){ return isFree() && !!st && !st.unlocked; }
  function canVerify(){ return !isFree() || !st || !!st.can_verify; }
  function surveyLocked(){ return isFree() && !!st && !!st.survey_locked; }
  function count(){ return Math.min(3, Number(st && st.verified_refs || 0)); }
  function steps(){
    const n = count();
    return `<div class="fm-steps" aria-label="${n} of 3 verified">${[0,1,2].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("")}<span>${n} of 3 verified</span></div>`;
  }
  function bannerHtml(what){
    if(count() >= 3){
      const v = what === "transfer" ? ["Verify your account to send balance", "3 people you invited have verified. Verify your account with the $20 package to send balance."]
                                    : ["Verify your account to withdraw", "3 people you invited have verified. Verify your account with the $20 package to withdraw."];
      return `<span class="wdx-pending-ico">${LOCK}</span><div style="flex:1;min-width:0;"><b>${v[0]}</b><p>${v[1]}</p><a class="fm-link" href="#profile">Verify now</a></div>`;
    }
    const t = what === "transfer"
      ? ["Balance transfer needs a verified account", "You joined with a free invite link. When 3 people you invite verify their account, you can verify yours with the $20 package and then send balance."]
      : ["Withdraw needs a verified account", "You joined with a free invite link. When 3 people you invite verify their account, you can verify yours with the $20 package and then withdraw."];
    return `<span class="wdx-pending-ico">${LOCK}</span><div style="flex:1;min-width:0;"><b>${t[0]}</b>
      <p>${t[1]}</p>
      ${steps()}<a class="fm-link" href="#profile">Get your invite link</a></div>`;
  }
  function cardHtml(){
    return `<div class="fm-card"><div class="fm-card-head"><span class="fm-ico">${LOCK}</span><div><div class="vc-title">Survey is open for you</div>
      <div class="vc-sub">You joined with a free invite link, so you don't need the $20 verification to work.</div></div></div>
      <ul class="fm-rules"><li>You can do tasks and earn now.</li><li>When 3 people you invite verify their account, Survey stops for you until you verify yours with the $20 package.</li><li>To withdraw or send balance, your account must be verified.</li></ul>
      ${steps()}<a class="btn btn-primary btn-sm" href="#profile">Get your invite link</a></div>`;
  }
  return { isFree, refresh, locked, canVerify, surveyLocked, bannerHtml, cardHtml };
})();

/* Investor accounts: what the site has and what is in the Investor Pool */
const InvHome = (function(){
  const $ = id => document.getElementById(id);
  const num = v => Number(v || 0).toLocaleString("en-US");
  function longDate(v){ try{ return new Date(v + "T00:00:00").toLocaleDateString(undefined, { day:"numeric", month:"long", year:"numeric" }); }catch(e){ return v || "—"; } }
  function daysTo(v){ try{ const d = new Date(v + "T00:00:00"), t = new Date(); t.setHours(0,0,0,0); return Math.round((d - t) / 864e5); }catch(e){ return null; } }
  async function load(){
    const p = AppState.profile || {};
    $("inv-hello").textContent = "Welcome, " + (((p.full_name || "").trim().split(/\s+/)[0]) || "there");
    $("inv-balance").textContent = money((AppState.wallet || {}).available_balance || 0);
    const { data, error } = await supabase.rpc("get_investor_dashboard");
    if(error || !data){
      $("inv-err").hidden = false;
      $("inv-err").textContent = "Couldn't load the numbers. Please refresh.";
      return;
    }
    $("inv-err").hidden = true;
    $("inv-pool").textContent = money(data.pool);
    $("inv-pool-month").textContent = money(data.pool_month);
    $("inv-members").textContent = num(data.members);
    $("inv-members-sub").textContent = "+" + num(data.members_month) + " this month";
    $("inv-verified").textContent = num(data.verified);
    $("inv-verified-sub").textContent = "+" + num(data.verified_month) + " this month";
    $("inv-tasks").textContent = num(data.tasks);
    const myPct = Number(data.my_pct || 0).toLocaleString("en-US", { maximumFractionDigits: 3 }) + "%";
    $("inv-investors").textContent = myPct;
    $("inv-estimate-sub").textContent = "pool × " + myPct;
    $("inv-estimate").textContent = money(data.estimate);
    $("inv-next").textContent = longDate(data.next_payout);
    const dd = daysTo(data.next_payout);
    $("inv-next-sub").textContent = dd == null ? "Bangladesh time" : dd <= 0 ? "Today · Bangladesh time" : dd === 1 ? "Tomorrow · Bangladesh time" : "In " + dd + " days · Bangladesh time";
    $("inv-total").textContent = money(data.my_total);
    const rows = data.my_payouts || [];
    $("inv-history").innerHTML = rows.length
      ? `<ul class="vip-rows">${rows.map(r => `<li><div><b>${escapeHtml(r.month)}</b><small>Your share of ${money(r.pool)}</small></div><span class="vip-amount">+${money(r.amount)}</span></li>`).join("")}</ul>`
      : '<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-wallet"/></svg></div>Your first share arrives on the next payout day.</div>';
  }
  return { load };
})();

// The Home page shows the VIP page for VIP accounts and the normal page for everyone else.
(function(){
  const base = Modules.home;
  let baseStarted = false;
  Modules.home = {
    init(sub, params){ return this.onActivate(sub, params); },
    async onActivate(sub, params){
      if(AppState.isVip){ await refreshWallet(); return VipHome.load(); }
      if(AppState.isInv){ await refreshWallet(); return InvHome.load(); }
      if(!baseStarted){ baseStarted = true; return base.init(sub, params); }
      return base.onActivate(sub, params);
    }
  };
})();

/* ---------------- Module: Survey ---------------- */
Modules.products = (function(){
  let curSector = null;   // which sector (Survey, or another one the admin added) this page shows
  const secName = () => (curSector && curSector.name) || "Survey";
  const inSector = t => !curSector || t.sector_id === curSector.id || (!t.sector_id && curSector.is_default);
  function pickSector(sub){
    const next = AppState.sectors ? sectorBySlug(sub) : null;
    const changed = (next && next.id) !== (curSector && curSector.id);
    curSector = next;
    return changed;
  }
  let tasksCache = [], mySubs = [], activeFile = null, activeTaskId = null, previewUrl = null, wired = false;

  /* ---- small helpers for the premium task cards ---- */
  const ICON = (id) => `<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const NEW_FOR_MS = 48 * 3600 * 1000;   // a task counts as "New" for 2 days
  const REVIEW_MS = 4 * 3600 * 1000;      // every submission is reviewed within 4 hours
  const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  const TARGET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>';
  let quota = null, quotaTimer = null, reloadedFor = null;   // { limit, used, left, resets_at } — 7 tasks a day, Bangladesh time

  function capped(){ return !!(quota && Number(quota.left) <= 0); }
  function untilReset(){
    const ms = quota && quota.resets_at ? new Date(quota.resets_at).getTime() - Date.now() : NaN;
    if(!isFinite(ms)) return "";
    if(ms <= 0) return "a moment";
    const h = Math.floor(ms / 3600000), m = Math.max(1, Math.ceil((ms % 3600000) / 60000));
    return (h ? h + "h " : "") + (m === 60 ? "59m" : m + "m");
  }
  async function fetchQuota(){
    try{
      const { data, error } = await supabase.rpc("get_my_task_quota");
      if(!error && data) quota = data;
    }catch(e){}
    return quota;
  }
  function renderQuota(){
    const box = document.getElementById("svx-quota");
    if(!box) return;
    clearInterval(quotaTimer);
    if(!quota){ box.hidden = true; return; }
    const lim = Math.max(0, Number(quota.limit) || 0), used = Math.min(lim, Math.max(0, Number(quota.used) || 0)), left = Math.max(0, lim - used);
    const full = left <= 0;
    const bar = lim <= 14
      ? `<div class="svx-q-bar">${Array.from({ length: lim }, (_, i) => `<i class="${i < used ? "on" : ""}"></i>`).join("")}</div>`
      : `<div class="svx-q-bar"><span class="svx-q-fill"><i style="width:${lim ? Math.round(used / lim * 100) : 0}%"></i></span></div>`;
    const paint = () => {
      const t = untilReset();
      box.querySelector(".svx-q-note").innerHTML = full
        ? `You have completed ${lim} tasks today. New tasks open again in <b>${t}</b> (12:00 AM Bangladesh time).`
        : `You can complete ${lim} tasks a day. The count starts again at 12:00 AM Bangladesh time${t ? ` · in <b>${t}</b>` : ""}.`;
      if(quota.resets_at && new Date(quota.resets_at).getTime() <= Date.now() && reloadedFor !== quota.resets_at){   // a new day: refresh once
        reloadedFor = quota.resets_at;
        clearInterval(quotaTimer);
        if(AppState.user) loadTasks(AppState.user);
      }
    };
    box.className = "svx-quota" + (full ? " is-full" : "");
    box.innerHTML = `
      <div class="svx-q-top">
        <div><small>${full ? "Daily limit reached" : "Today's tasks"}</small><b>${used}<span>/ ${lim}</span></b></div>
        <span class="svx-q-pill">${full ? LOCK_SVG + "Come back tomorrow" : left + " left today"}</span>
      </div>
      ${bar}
      <p class="svx-q-note"></p>`;
    box.hidden = false;
    paint();
    quotaTimer = setInterval(paint, 30000);
  }
  function cappedToast(){
    toast(`You have completed ${quota ? quota.limit : 7} tasks today. New tasks open again in ${untilReset() || "a few hours"}.`, "error");
  }

  // Each task gets an icon and a colour that match what the member will do.
  // The link (Google Maps, YouTube, Play Store...) decides first, then the words in the task.
  const KINDS = {
    map:    { icon:"i-pin",       tone:"map",    label:"Place" },
    review: { icon:"i-star",      tone:"review", label:"Review" },
    video:  { icon:"i-play",      tone:"video",  label:"Video" },
    app:    { icon:"i-download",  tone:"app",    label:"App" },
    survey: { icon:"i-clipboard", tone:"survey", label:"Survey" },
    social: { icon:"i-heart",     tone:"social", label:"Social" },
    web:    { icon:"i-globe",     tone:"web",    label:"Website" },
    shop:   { icon:"i-bag",       tone:"shop",   label:"Shop" },
    task:   { icon:"i-target",    tone:"task",   label:"Task" }
  };
  function kindOf(t){
    const host = hostOf(safeUrl(t.target_url));
    if(host === "Google Maps") return KINDS.map;
    if(host === "YouTube" || host === "TikTok") return KINDS.video;
    if(host === "Google Play" || host === "App Store") return KINDS.app;
    if(host === "Google Forms") return KINDS.survey;
    if(host === "Trustpilot") return KINDS.review;
    if(["Facebook","Instagram","X","Telegram"].includes(host)) return KINDS.social;
    const s = ((t.title || "") + " " + (t.description || "")).toLowerCase();
    if(/\b(maps?|location|place|directions?|business page)\b/.test(s)) return KINDS.map;
    if(/\b(video|youtube|watch|reels?|shorts)\b/.test(s)) return KINDS.video;
    if(/\b(review|reviews|rate|rating|stars?|feedback)\b/.test(s)) return KINDS.review;
    if(/\b(apps?|play store|app store|install|download|apk)\b/.test(s)) return KINDS.app;
    if(/\b(survey|surveys|questions?|form|quiz|poll)\b/.test(s)) return KINDS.survey;
    if(/\b(follow|like|likes|share|comment|subscribe|join|group|channel|page)\b/.test(s)) return KINDS.social;
    if(/\b(website|site|web|visit|browse|test|testing|sign ?up|register)\b/.test(s)) return KINDS.web;
    if(/\b(shop|store|product|buy|order)\b/.test(s)) return KINDS.shop;
    if(host) return KINDS.web;
    return KINDS.task;
  }
  function iconOf(t){ return kindOf(t).icon; }

  // Only real web links are shown or opened (a link without https:// still works).
  function safeUrl(url){
    const s = String(url || "").trim();
    if(!s) return "";
    if(/^https?:\/\/[^\s]+$/i.test(s)) return s;
    if(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}([\/?#][^\s]*)?$/i.test(s)) return "https://" + s;
    return "";
  }
  const HOSTS = { "play.google.com":"Google Play", "apps.apple.com":"App Store", "youtube.com":"YouTube", "m.youtube.com":"YouTube", "youtu.be":"YouTube",
    "facebook.com":"Facebook", "m.facebook.com":"Facebook", "fb.com":"Facebook", "instagram.com":"Instagram", "tiktok.com":"TikTok",
    "trustpilot.com":"Trustpilot", "x.com":"X", "twitter.com":"X", "t.me":"Telegram", "forms.gle":"Google Forms",
    "maps.google.com":"Google Maps", "maps.app.goo.gl":"Google Maps", "g.page":"Google Maps" };
  function hostOf(url){
    if(!url) return "";
    try{
      const u = new URL(url);
      const h = u.hostname.replace(/^www\./i, "").toLowerCase();
      if(h === "docs.google.com" && /\/forms\//.test(u.pathname)) return "Google Forms";
      if(h === "google.com" && /^\/maps/.test(u.pathname)) return "Google Maps";
      return HOSTS[h] || h;
    }catch(e){ return ""; }
  }
  function agoOf(d){
    const t = d ? new Date(d).getTime() : NaN;
    if(!isFinite(t)) return "";
    const m = Math.max(0, Date.now() - t) / 60000;
    if(m < 1) return "Just now";
    if(m < 60) return Math.floor(m) + "m ago";
    if(m < 1440) return Math.floor(m / 60) + "h ago";
    if(m < 10080) return Math.floor(m / 1440) + "d ago";
    return new Date(t).toLocaleDateString("en-US", { month:"short", day:"numeric" });
  }
  function isNew(t){ const c = t.created_at ? new Date(t.created_at).getTime() : NaN; return isFinite(c) && Date.now() - c < NEW_FOR_MS; }
  function subOf(id){ return mySubs.find(s => s.task_id === id); }

  // Links written inside the brief become tappable (text is escaped first).
  function linkify(escaped){
    return escaped.replace(/\bhttps?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/gi, (m) => {
      const trail = (m.match(/[.,!?;:)\]]+$/) || [""])[0];
      const url = trail ? m.slice(0, -trail.length) : m;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
    });
  }
  // Two or more lines in the brief are shown as numbered steps.
  function briefHtml(text){
    const raw = String(text || "").replace(/\r\n?/g, "\n").trim();
    if(!raw) return "";
    const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);
    if(lines.length >= 2 && lines.length <= 15){
      return `<ol class="svx-steps">${lines.map(l => {
        const clean = l.replace(/^(?:step\s*\d+\s*[:.)\-–]\s*|\d{1,2}\s*[.)\-–:]\s+|[-–•*·]\s+)/i, "") || l;
        return `<li><span>${linkify(escapeHtml(clean))}</span></li>`;
      }).join("")}</ol>`;
    }
    return `<p class="svx-brief-p">${linkify(escapeHtml(raw))}</p>`;
  }

  function icoHtml(t){ const k = kindOf(t); return `<span class="svx-ico tone-${k.tone}" aria-hidden="true" title="${k.label}">${ICON(k.icon)}</span>`; }
  function pillsHtml(t, sub){
    if(sub) return "";
    let h = "";
    if(isNew(t)) h += `<span class="svx-pill is-new">New</span>`;
    if(t.budget != null) h += `<span class="svx-pill is-limited" title="Limited budget — first come, first served"><i></i>Limited spots</span>`;
    return h;
  }
  function metaHtml(t, sub){
    const host = hostOf(safeUrl(t.target_url));
    const ago = agoOf(t.created_at);
    const pills = pillsHtml(t, sub);
    if(!host && !ago && !pills) return "";
    return `<div class="svx-meta">${pills}${host ? ICON("i-globe") + `<b>${escapeHtml(host)}</b>` : (ago ? ICON("i-clock") : "")}` +
           `${host && ago ? '<span class="svx-dot"></span>' : ""}${ago ? `<em>${escapeHtml(ago)}</em>` : ""}</div>`;
  }
  function stepsOf(t){
    const lines = String(t.instructions || "").replace(/\r\n?/g, "\n").split("\n").map(s => s.trim()).filter(Boolean);
    return lines.length >= 2 && lines.length <= 15 ? lines.length : 0;
  }
  function statusHtml(s){
    if(s === "APPROVED") return `<span class="svx-status is-ok">${ICON("i-check")}Approved</span>`;
    if(s === "REJECTED") return `<span class="svx-status is-bad">Rejected</span>`;
    return `<span class="svx-status is-pending"><i></i>Pending review</span>`;
  }
  function actionHtml(sub, lock){
    return sub ? statusHtml(sub.status)
      : lock ? `<span class="svx-capped">${LOCK_SVG}Tomorrow</span>`
      : `<button type="button" class="btn btn-primary svx-go">Start task ${ARROW}</button>`;
  }
  function featuredHtml(t, i){
    const lock = capped();
    const host = hostOf(safeUrl(t.target_url)), ago = agoOf(t.created_at), steps = stepsOf(t);
    const facts = [
      host ? ["Where", host] : null,
      ago ? ["Posted", ago] : null,
      steps ? ["Steps", String(steps)] : null,
      t.budget != null ? ["Spots", "Limited"] : ["Spots", "Open"]
    ].filter(Boolean);
    return `<article class="svx-card is-featured ${lock ? "is-capped" : "is-open"}" style="--d:${Math.min(i, 8) * 60}ms" data-card="${escapeHtml(t.id)}">
        <div class="svx-feat">
          <div class="svx-feat-main">
            <div class="svx-feat-top">${icoHtml(t)}<span class="svx-kicker${isNew(t) ? " is-new" : ""}">${isNew(t) ? "<i></i>New task" : "Featured task"}</span></div>
            <h3 class="svx-title">${escapeHtml(t.title)}</h3>
            ${t.description ? `<p class="svx-desc">${escapeHtml(t.description)}</p>` : ""}
            <ul class="svx-facts">${facts.map(f => `<li><small>${f[0]}</small><b>${escapeHtml(f[1])}</b></li>`).join("")}</ul>
          </div>
          <aside class="svx-feat-side">
            <div class="svx-earn"><span>Reward</span><b>${money(t.reward)}</b><p>Paid to your wallet once your proof is approved.</p></div>
            ${actionHtml(null, lock)}
          </aside>
        </div>
      </article>`;
  }
  function cardHtml(t, i, featured){
    if(featured) return featuredHtml(t, i);
    const sub = subOf(t.id);
    const lock = !sub && capped();
    const cls = "svx-card" + (sub ? " is-done" : lock ? " is-capped" : " is-open") + (sub && sub.status === "REJECTED" ? " is-rejected" : "");
    return `<article class="${cls}" style="--d:${Math.min(i, 8) * 60}ms"${sub ? "" : ` data-card="${escapeHtml(t.id)}"`}>
        <div class="svx-row">
          ${icoHtml(t)}
          <div class="svx-body">
            ${metaHtml(t, sub)}
            <h3 class="svx-title">${escapeHtml(t.title)}</h3>
            ${t.description ? `<p class="svx-desc">${escapeHtml(t.description)}</p>` : ""}
          </div>
          <div class="svx-tray">
            <div class="svx-earn"><span>${sub && sub.status === "APPROVED" ? "Earned" : "Reward"}</span><b>${money(t.reward)}</b></div>
            ${actionHtml(sub, lock)}
          </div>
        </div>
        ${afterHtml(sub)}
      </article>`;
  }
  // under a submitted task: when it will be checked, or why it was rejected
  function afterHtml(sub){
    if(!sub) return "";
    if(sub.status === "REJECTED"){
      return sub.admin_note ? `<div class="svx-reason"><small>Why it was rejected</small><p>${escapeHtml(sub.admin_note)}</p></div>` : "";
    }
    if(sub.status !== "PENDING") return "";
    const due = sub.submitted_at ? new Date(sub.submitted_at).getTime() + REVIEW_MS : NaN;
    const left = due - Date.now();
    let txt = "We review every task <b>within 4 hours</b>.";
    if(isFinite(left) && left > 0){
      const h = Math.floor(left / 3600000), m = Math.max(1, Math.round((left % 3600000) / 60000));
      txt = `Review <b>within 4 hours</b> · about ${h ? h + "h " : ""}${m}m left`;
    }else if(isFinite(left)){
      txt = "Taking a little longer than usual — <b>we'll review it soon</b>.";
    }
    return `<div class="svx-review">${ICON("i-clock")}<span>${txt}</span></div>`;
  }
  function emptyHtml(icon, title, text, extra, cls){
    return `<div class="svx-empty${cls ? " " + cls : ""}"><div class="svx-empty-mark">${ICON(icon)}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${extra || ""}</div>`;
  }
  function skeletonHtml(){
    const one = `<div class="svx-card is-skel" aria-hidden="true"><div class="svx-row"><span class="svx-ico"><span class="svx-shim"></span></span>
      <div class="svx-body"><div class="svx-shim" style="height:11px;width:38%"></div><div class="svx-shim" style="height:16px;width:78%;margin-top:4px"></div><div class="svx-shim" style="height:12px;width:58%"></div></div>
      <div class="svx-tray"><div class="svx-shim" style="height:40px;width:150px;border-radius:11px"></div></div></div></div>`;
    return one + one + one;
  }
  function summaryHtml(open){
    const total = open.reduce((a, t) => a + Number(t.reward || 0), 0);
    const top = open.reduce((a, t) => Math.max(a, Number(t.reward || 0)), 0);
    return `<div><span>Open tasks</span><b>${open.length}</b></div>
      <div><span>Total rewards</span><b class="is-money">${money(total)}</b></div>
      <div><span>Top reward</span><b>${open.length ? money(top) : "—"}</b></div>`;
  }
  function setCount(n){
    const b = document.getElementById("t-available");
    if(!b) return;
    let c = b.querySelector(".svx-count");
    if(!n){ if(c) c.remove(); return; }
    if(!c){ c = document.createElement("span"); c.className = "svx-count"; b.appendChild(c); }
    c.textContent = n;
  }
  function renderLocked(profile, why){
    const root = document.getElementById("content-root");
    root.innerHTML = `
      <div class="svx">
      <div class="card lock-card">
        <div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-lock"/></svg></div>
        <h2>${why === "free3" ? "Verify your account to keep working" : "Verify your account to open " + escapeHtml(secName())}</h2>
        <p>${why === "free3" ? "3 people you invited have verified their account. Now verify yours with the one-time $20 package from your wallet, and Survey opens again right after." :
             profile && profile.is_suspended ? "Your account is suspended. Please contact support." :
             profile && profile.is_banned ? "Your account is restricted." :
             "Open your Profile and verify your account. It's a one-time $20 from your wallet, and every task opens for you right after."}</p>
        <a href="#profile" class="btn btn-primary">Go to Profile <svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrow-right"/></svg></a>
      </div>
      </div>`;
  }

  function renderShell(){
    const root = document.getElementById("content-root");
    root.innerHTML = `
      <div class="svx svx-page">
        <div class="svx-bar">
          <div class="svx-tabs">
            <button type="button" class="active" id="t-available">Available</button>
            <button type="button" id="t-mine"><span class="svx-tab-long">My Submissions</span><span class="svx-tab-short">Submitted</span></button>
            <button type="button" id="t-posted"><span class="svx-tab-long">My Posted Tasks</span><span class="svx-tab-short">Posted</span></button>
          </div>
          <button type="button" class="btn btn-secondary svx-post" id="post-task-btn" aria-label="Post a task">${PLUS}<span>Post a task</span></button>
        </div>
        <div id="pane-available">
          <div class="svx-quota" id="svx-quota" hidden></div>
          <div class="svx-sum" id="svx-sum" hidden></div>
          <div class="products-grid svx-grid" id="products-grid">${skeletonHtml()}</div>
        </div>
        <div id="pane-mine" style="display:none;"><div class="table-wrap" id="mine-wrap"><div style="padding:20px;" class="skel" style="height:120px;"></div></div></div>
        <div id="pane-posted" style="display:none;"><div class="admin-card-list" id="posted-wrap"><div style="padding:20px;" class="skel" style="height:120px;"></div></div></div>
      </div>
    `;
    document.getElementById("t-available").addEventListener("click", () => switchTab("available"));
    document.getElementById("t-mine").addEventListener("click", () => switchTab("mine"));
    document.getElementById("t-posted").addEventListener("click", () => switchTab("posted"));
    document.getElementById("post-task-btn").addEventListener("click", openTaskModal);
  }

  function switchTab(which){
    document.getElementById("t-available").classList.toggle("active", which==="available");
    document.getElementById("t-mine").classList.toggle("active", which==="mine");
    document.getElementById("t-posted").classList.toggle("active", which==="posted");
    document.getElementById("pane-available").style.display = which==="available" ? "" : "none";
    document.getElementById("pane-mine").style.display = which==="mine" ? "" : "none";
    document.getElementById("pane-posted").style.display = which==="posted" ? "" : "none";
    if(which==="posted") loadPosted();
    if(which==="mine") loadMine();
  }

  async function loadTasks(user){
    const [{ data: tasks, error }, { data: subs }] = await Promise.all([
      supabase.from("survey_tasks").select("*").eq("status","PUBLISHED").order("created_at",{ascending:false}),
      supabase.from("survey_submissions").select("task_id,status,admin_note,submitted_at").eq("user_id", user.id),
      fetchQuota()
    ]);
    mySubs = subs || [];
    renderQuota();
    const grid = document.getElementById("products-grid");
    const sum = document.getElementById("svx-sum");
    if(!grid) return;
    if(error){
      if(sum) sum.hidden = true;
      setCount(0);
      grid.innerHTML = emptyHtml("i-warning", "Couldn't load " + secName(), "Please check your connection and try again.",
        `<button type="button" class="btn btn-secondary" id="svx-retry">Try again</button>`);
      document.getElementById("svx-retry").addEventListener("click", () => { grid.innerHTML = skeletonHtml(); loadTasks(user); });
      return;
    }
    tasksCache = (tasks || []).filter(inSector);
    const open = tasksCache.filter(t => !subOf(t.id));
    const done = tasksCache.filter(t => subOf(t.id));
    setCount(open.length);
    if(!tasksCache.length){
      if(sum) sum.hidden = true;
      grid.innerHTML = emptyHtml("i-clipboard", "No " + secName() + " tasks right now", "New tasks show up here as soon as they are posted. Check back soon.");
      return;
    }
    if(sum){   // the totals strip only helps when there is more than one task to choose from
      sum.hidden = open.length < 2;
      sum.innerHTML = open.length < 2 ? "" : summaryHtml(open);
    }

    let html = "", i = 0;
    if(open.length){
      html += cardHtml(open[0], i++, true);            // the newest open task gets the big card
      if(open.length > 1){
        html += `<div class="svx-label"><h3>More tasks</h3><span>${open.length - 1} open</span></div>`;
        open.slice(1).forEach(t => { html += cardHtml(t, i++, false); });
      }
    }else{
      html += emptyHtml("i-check", "You're all caught up", "You have sent proof for every open task. New tasks show up here as soon as they are posted.", "", "is-done");
    }
    if(done.length){
      html += `<div class="svx-label"><h3>Submitted</h3><span>${done.length} task${done.length === 1 ? "" : "s"}</span></div>`;
      done.forEach(t => { html += cardHtml(t, i++, false); });
    }
    grid.innerHTML = html;

    grid.querySelectorAll("[data-card]").forEach(card => card.addEventListener("click", () => {
      if(capped()){ cappedToast(); return; }
      openSubmit(card.dataset.card);
    }));
  }

  async function loadMine(){
    const user = AppState.user;
    const wrap = document.getElementById("mine-wrap");
    const { data, error } = await supabase
      .from("survey_submissions").select("*, survey_tasks(title,reward)")
      .eq("user_id", user.id).order("submitted_at",{ascending:false});
    if(error){ wrap.innerHTML = `<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn't load your submissions.</div>`; return; }
    if(!data || !data.length){ wrap.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-folder"/></svg></div>You haven't submitted anything yet.</div>`; return; }
    wrap.innerHTML = `<table class="tbl"><thead><tr><th>Survey</th><th>Reward</th><th>Status</th><th>Submitted</th><th>Admin note</th></tr></thead><tbody>
      ${data.map(s => `<tr>
        <td>${escapeHtml(s.survey_tasks ? s.survey_tasks.title : "—")}</td>
        <td>${money(s.reward)}</td>
        <td>${s.status==="APPROVED"?'<span class="badge badge-green">Approved</span>':s.status==="REJECTED"?'<span class="badge badge-danger">Rejected</span>':'<span class="badge badge-gold">Pending</span>'}</td>
        <td>${fmtDate(s.submitted_at)}</td>
        <td>${escapeHtml(s.admin_note || "—")}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }

  async function loadPosted(){
    const wrap = document.getElementById("posted-wrap");
    const { data, error } = await supabase.from("survey_tasks").select("*").eq("submitted_by", AppState.user.id).order("created_at",{ascending:false});
    if(error){ wrap.innerHTML = `<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn't load your posted tasks.</div>`; return; }
    if(!data || !data.length){ wrap.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-clipboard"/></svg></div>You haven't posted any tasks yet.</div>`; return; }

    const statusBadge = (s) => s==="PUBLISHED" ? '<span class="badge badge-green">Live</span>'
      : s==="PENDING_PRICING" ? '<span class="badge badge-gold">Awaiting review</span>'
      : s==="CANCELLED" ? '<span class="badge badge-muted">Cancelled</span>'
      : '<span class="badge badge-muted">'+s+'</span>';

    wrap.innerHTML = data.map(t => `
      <div class="list-item">
        <div class="grow">
          <div class="ttl">${escapeHtml(t.title)} ${statusBadge(t.status)}</div>
          <div class="sub2">${t.status==="PUBLISHED" ? `Reward ${money(t.reward)} per completion · budget ${money(t.charged_amount)}` : t.status==="PENDING_PRICING" ? "Waiting for admin to set reward & budget" : (t.admin_note ? escapeHtml(t.admin_note) : "")}</div>
        </div>
        ${t.status==="PUBLISHED" ? `<div class="list-actions"><button class="btn btn-danger btn-sm" data-cancel="${t.id}">Cancel</button></div>` : ""}
      </div>`).join("");

    wrap.querySelectorAll("[data-cancel]").forEach(btn => btn.addEventListener("click", async () => {
      const task = (data || []).find(x => x.id === btn.dataset.cancel) || {};
      const sure = await ConfirmSheet.open({ icon: "refund", title: "Cancel this task?", lead: "The task stops right away. Money that was not used comes back to your wallet.",
        rows: [{ label: "Task", value: task.title || "Task" }], confirm: "Cancel task", cancel: "Keep task" });
      if(!sure) return;
      btn.disabled = true;
      const { error } = await supabase.rpc("cancel_user_task", { p_task_id: btn.dataset.cancel });
      if(error){ toast(error.message || "Couldn't cancel task.", "error"); btn.disabled = false; return; }
      toast("Task cancelled. Unused money is back in your wallet.", "success");
      await refreshWallet();
      loadPosted();
    }));
  }

  /* ---- sheets: lock the page behind them while one is open ---- */
  const taskModal = document.getElementById("task-modal");
  const modal = document.getElementById("submit-modal");
  function syncLock(){
    const anyOpen = modal.style.display === "flex" || taskModal.style.display === "flex";
    document.documentElement.classList.toggle("svx-lock", anyOpen);
  }

  function openTaskModal(){
    document.getElementById("tm-form").reset();
    document.getElementById("tm-err").style.display = "none";
    taskModal.style.display = "flex";
    taskModal.querySelector(".modal").scrollTop = 0;
    syncLock();
  }
  function closeTaskModal(){ taskModal.style.display = "none"; syncLock(); }
  function wireTaskModalOnce(){
    document.getElementById("tm-close").addEventListener("click", closeTaskModal);
    taskModal.addEventListener("click", (e) => { if(e.target.id === "task-modal") closeTaskModal(); });
    document.getElementById("tm-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("tm-err");
      errEl.style.display = "none";
      const title = document.getElementById("tm-title").value.trim();
      const desc = document.getElementById("tm-desc").value.trim();
      if(!title || !desc){ errEl.textContent = "Please fill in the title and description."; errEl.style.display = "block"; return; }
      const btn = document.getElementById("tm-submit");
      btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner"></span>';
      const { error } = await supabase.rpc("submit_user_task", {
        p_title: title, p_description: desc,
        p_instructions: document.getElementById("tm-instr").value.trim(),
        p_target_url: document.getElementById("tm-url").value.trim(),
        p_image_url: null
      });
      btn.disabled = false; btn.querySelector(".btn-label").textContent = "Submit for review";
      if(error){ errEl.textContent = error.message || "Couldn't submit your task."; errEl.style.display = "block"; return; }
      closeTaskModal();
      toast("Task submitted for review!", "success");
      switchTab("posted");
    });
  }

  function resetProof(){
    activeFile = null;
    if(previewUrl){ URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const pv = document.getElementById("sm-preview");
    pv.style.display = "none"; pv.removeAttribute("src");
    document.getElementById("sm-file").value = "";
    document.getElementById("sm-dropzone").classList.remove("has-file");
    document.getElementById("sm-drop-label").textContent = "Tap to choose a screenshot";
  }

  function openSubmit(taskId){
    const t = tasksCache.find(x => x.id === taskId);
    if(!t) return;
    if(capped()){ cappedToast(); return; }
    activeTaskId = taskId;
    const qEl = document.getElementById("sm-quota");
    if(qEl){
      if(quota){
        const left = Math.max(0, Number(quota.left) || 0);
        qEl.innerHTML = `${TARGET_SVG}<span>You can complete <b>${left} more task${left === 1 ? "" : "s"}</b> today (limit ${quota.limit} a day).</span>`;
        qEl.hidden = false;
      }else qEl.hidden = true;
    }

    { const k = kindOf(t), m = document.getElementById("sm-media"); m.className = "svx-ico tone-" + k.tone; m.innerHTML = ICON(k.icon); }
    document.getElementById("sm-flags").innerHTML = pillsHtml(t, null);
    document.getElementById("sm-meta").innerHTML = metaHtml(t, true);
    document.getElementById("sm-title").textContent = t.title;
    document.getElementById("sm-reward").textContent = money(t.reward);

    const instr = String(t.instructions || "").trim(), desc = String(t.description || "").trim();
    const lead = document.getElementById("sm-lead");
    if(instr && desc && instr !== desc){ lead.innerHTML = linkify(escapeHtml(desc)); lead.hidden = false; }
    else { lead.innerHTML = ""; lead.hidden = true; }
    document.getElementById("sm-instructions").innerHTML = briefHtml(instr || desc);
    document.getElementById("sm-brief").hidden = !(instr || desc);

    const linkEl = document.getElementById("sm-link");
    const url = safeUrl(t.target_url);
    if(url){ linkEl.href = url; document.getElementById("sm-link-host").textContent = hostOf(url) || url; linkEl.style.display = "flex"; }
    else { linkEl.removeAttribute("href"); linkEl.style.display = "none"; }

    document.getElementById("sm-review").value = "";
    resetProof();
    document.getElementById("sm-err").style.display = "none";
    modal.style.display = "flex";
    modal.querySelector(".modal").scrollTop = 0;
    syncLock();
  }
  function closeSubmit(){ modal.style.display = "none"; syncLock(); }

  function wireModalOnce(){
    if(wired) return;
    wired = true;
    wireTaskModalOnce();
    document.getElementById("sm-close").addEventListener("click", closeSubmit);
    modal.addEventListener("click", (e) => { if(e.target.id === "submit-modal") closeSubmit(); });
    document.addEventListener("keydown", (e) => {
      if(e.key !== "Escape") return;
      if(modal.style.display === "flex") closeSubmit();
      else if(taskModal.style.display === "flex") closeTaskModal();
    });
    const drop = document.getElementById("sm-dropzone");
    drop.addEventListener("click", () => document.getElementById("sm-file").click());
    drop.addEventListener("keydown", (e) => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); document.getElementById("sm-file").click(); } });
    document.getElementById("sm-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if(!f) return;
      activeFile = f;
      if(previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(f);
      document.getElementById("sm-preview").src = previewUrl;
      document.getElementById("sm-preview").style.display = "block";
      document.getElementById("sm-drop-label").textContent = f.name;
      drop.classList.add("has-file");
    });

    document.getElementById("sm-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("sm-err");
      errEl.style.display = "none";
      const review = document.getElementById("sm-review").value.trim();
      if(!review){ errEl.textContent = "Please describe your review."; errEl.style.display="block"; return; }
      if(!activeFile){ errEl.textContent = "Please attach a screenshot."; errEl.style.display="block"; return; }

      const btn = document.getElementById("sm-submit");
      btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner"></span>';

      await fetchQuota();                      // don't upload a screenshot if today's limit is already used
      if(capped()){
        errEl.textContent = `You have completed ${quota.limit} tasks today. You can send this one after 12:00 AM (Bangladesh time).`;
        errEl.style.display = "block";
        btn.disabled = false; btn.querySelector(".btn-label").textContent = "Submit for review";
        renderQuota();
        return;
      }

      try{
        const user = AppState.user;
        const ext = (activeFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${activeTaskId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("super-survey-submissions").upload(path, activeFile, { upsert:false });
        if(upErr) throw upErr;

        const { error: rpcErr } = await supabase.rpc("submit_super_survey_submission", {
          p_task: activeTaskId, p_review: review, p_screenshot_path: path
        });
        if(rpcErr) throw rpcErr;

        toast("Sent! We will check it soon.", "success");
        closeSubmit();
        loadTasks(user);
      }catch(err){
        const m = String((err && err.message) || "");
        errEl.textContent = m.replace(/^DAILY_LIMIT:\s*/, "") || "Something went wrong. Please try again.";
        errEl.style.display = "block";
        if(/^DAILY_LIMIT/.test(m) && AppState.user) loadTasks(AppState.user);
      }finally{
        btn.disabled = false; btn.querySelector(".btn-label").textContent = "Submit for review";
      }
    });
  }

  function eligible(profile){ return profile && (((profile.is_verified || profile.vip_free) && !profile.is_suspended && !profile.is_banned) || AppState.isAdmin); }

  async function freeLocked(profile){
    if(!(profile && profile.vip_free && !profile.is_verified) || AppState.isAdmin) return false;
    try{ await FreeMember.refresh(); }catch(e){}
    return FreeMember.surveyLocked();
  }
  async function init(sub){
    pickSector(sub);
    const ctx = ctxFor();
    const { user, profile } = ctx;
    if(!eligible(profile)){ renderLocked(profile); return; }
    if(await freeLocked(profile)){ renderLocked(profile, "free3"); return; }
    renderShell();
    wireModalOnce();
    loadTasks(user);
  }

  async function onActivate(sub){
    const changed = pickSector(sub);
    const ctx = ctxFor();
    const { user, profile } = ctx;
    if(!eligible(profile)){ renderLocked(profile); return; }
    if(await freeLocked(profile)){ renderLocked(profile, "free3"); return; }
    if(!document.getElementById("t-available")){ renderShell(); } // was showing the locked state before
    else if(changed){ switchTab("available"); const g = document.getElementById("products-grid"); if(g) g.innerHTML = skeletonHtml(); }
    wireModalOnce();
    loadTasks(user);
  }

  return { init, onActivate };
})();

/* ---------------- Module: Profile ---------------- */
Modules.profile = (function(){
  let wired = false;
  let pendingAvatarFile = null;

  function initialsFor(profile){
    return ((profile && profile.full_name) || "U").trim().split(/\\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase() || "U";
  }

  function renderAvatar(profile){
    const el=document.getElementById("profile-avatar-preview");
    if(!el) return;
    el.innerHTML = profile && profile.avatar_url
      ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Profile photo">`
      : escapeHtml(initialsFor(profile));
    el.classList.toggle("has-photo", !!(profile && profile.avatar_url));
  }

  function setAvatarError(msg){
    const el=document.getElementById("profile-avatar-err");
    if(!el) return;
    el.textContent=msg||"";
    el.style.display=msg?"block":"none";
  }

  async function saveAvatar(){
    const file=pendingAvatarFile;
    if(!file) return;
    setAvatarError("");
    if(file.size>5*1024*1024){setAvatarError("Please choose an image smaller than 5 MB.");return;}
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setAvatarError("Use JPG, PNG or WebP.");return;}
    const btn=document.getElementById("profile-avatar-save");
    btn.disabled=true; btn.querySelector(".btn-label")?.remove?.();
    btn.textContent="Uploading…";
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`${AppState.user.id}/avatar-${Date.now()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("super-survey-avatars").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
    if(uploadError){btn.disabled=false;btn.textContent="Save photo";setAvatarError(uploadError.message||"Could not upload photo.");return;}
    const {data}=supabase.storage.from("super-survey-avatars").getPublicUrl(path);
    const url=data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
    const {error}=await supabase.from("profiles").update({avatar_url:url,updated_at:new Date().toISOString()}).eq("id",AppState.user.id);
    if(error){btn.disabled=false;btn.textContent="Save photo";setAvatarError(error.message||"Could not save photo.");return;}
    AppState.profile=await getProfile(AppState.user.id);
    pendingAvatarFile=null;
    document.getElementById("profile-avatar-input").value="";
    document.getElementById("profile-avatar-save").disabled=true;
    btn.textContent="Save photo";
    renderAvatar(AppState.profile); renderSidebar();
    toast("Profile photo updated.","success");
  }

  async function removeAvatar(){
    setAvatarError("");
    const old=AppState.profile && AppState.profile.avatar_url;
    if(old){
      try{
        const u=new URL(old.split("?")[0]);
        const marker="/storage/v1/object/public/super-survey-avatars/";
        const idx=u.pathname.indexOf(marker);
        if(idx>=0){
          const path=decodeURIComponent(u.pathname.slice(idx+marker.length));
          await supabase.storage.from("super-survey-avatars").remove([path]);
        }
      }catch(e){}
    }
    const {error}=await supabase.from("profiles").update({avatar_url:null,updated_at:new Date().toISOString()}).eq("id",AppState.user.id);
    if(error){setAvatarError(error.message||"Could not remove photo.");return;}
    AppState.profile=await getProfile(AppState.user.id);
    pendingAvatarFile=null;
    document.getElementById("profile-avatar-input").value="";
    document.getElementById("profile-avatar-save").disabled=true;
    renderAvatar(AppState.profile); renderSidebar();
    toast("Profile photo removed.","success");
  }

  async function loadVerification(user, profile){
    const mount = document.getElementById("verify-mount");
    if(!mount) return;
    const vTitle = document.getElementById("verify-title"), vSub = document.getElementById("verify-sub");
    const setHead = (t, s) => { if(vTitle) vTitle.textContent = t; if(vSub) vSub.textContent = s; };
    if(AppState.isInv){
      setHead("Account status", "Your account is an investor account.");
      mount.innerHTML = `<div class="verify-current"><div class="vc-icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div><div><div class="vc-title">Your investor account is verified</div><div class="vc-sub">You don't pay anything for verification. Withdrawals have no fee, and you can send balance to other members from your Wallet.</div></div></div>`;
      return;
    }
    if(AppState.isVip){
      setHead("Account status", "Your account is a VIP account.");
      mount.innerHTML = `<div class="verify-current"><div class="vc-icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div><div><div class="vc-title">Your VIP account is verified</div><div class="vc-sub">You don't pay anything for it. Share your referral link, and withdraw what you earn from $1.00.</div></div></div>`;
      return;
    }
    setHead("Account verification", AppState.isAdmin ? "Admin accounts have full access."
      : (profile && profile.is_verified) ? "Your account is verified."
      : "Verify your account to open the Survey page and start earning.");
    if(AppState.isAdmin){
      mount.innerHTML = `<div class="status-box approved"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg> <div><b>Admin account — full access.</b><br>Verification isn't required for admins.</div></div>`;
      return;
    }

    const PRICE = 20;
    const tier = Number(profile && profile.verification_tier) || 0;
    if(profile && profile.is_verified){
      if(tier === 1){
        // accounts that verified earlier with the old $10 package keep their rules
        const counted = Math.min(20, Number(profile.package1_withdrawn || 0));
        mount.innerHTML = `<div class="verify-current"><div class="vc-icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div><div style="flex:1;min-width:0;"><div class="vc-title">Your account is verified</div><div class="vc-sub">You verified with the old $10 package. Your withdrawal fee is 50% until your total withdrawals reach $20.00. After that, the fee becomes 10% by itself.</div><div class="package-progress" style="--progress:${counted / 20 * 100}%;"><span></span></div><div class="package-progress-label"><span>$${counted.toFixed(2)} counted</span><span>$20.00</span></div></div></div>`;
      }else{
        mount.innerHTML = `<div class="verify-current"><div class="vc-icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-check"/></svg></div><div><div class="vc-title">Your account is verified</div><div class="vc-sub">Withdrawals have a 10% fee. You can withdraw from $1.00.</div></div></div>`;
      }
      return;
    }

    if(profile && profile.vip_free){
      await FreeMember.refresh();
      if(!FreeMember.canVerify()){
        setHead("Account status", "You joined with a free invite link.");
        mount.innerHTML = FreeMember.cardHtml("package");
        return;
      }
    }
    const balance = Number(AppState.wallet && AppState.wallet.available_balance || 0);
    const enough = balance >= PRICE;
    mount.innerHTML = `
      <div class="package-picker">
        ${enough ? `` : `<div class="wallet-warning"><span>ⓘ</span><span>Your wallet balance is ${money(balance)}. Add ${money(PRICE - balance)} more on the Deposit page, then come back here.</span></div>`}
        <div class="package-details open" id="package-details"><div class="package-details-inner" id="package-details-inner">
          <div class="pd-head"><div><div class="pd-kicker">Account verification</div><h4>Verify your account</h4><div class="pd-sub">One payment from your wallet</div></div><div class="pd-price">$20<small>one-time payment</small></div></div>
          <ul>
            <li>Your account is verified right away and the Survey page opens for you.</li>
            <li>Each withdrawal has a 10% fee. You can withdraw from $1.00, and there is no upper limit.</li>
            <li>You pay only once. Your account stays verified.</li>
          </ul>
          <button type="button" class="btn btn-primary package-buy" id="package-buy">Verify for $20.00 <svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrow-right"/></svg></button>
          <div class="package-note">${enough ? `The $20.00 is taken from your wallet balance.` : `First <a href="#deposit">add money on the Deposit page</a>.`}</div>
        </div></div>
      </div>`;

    const btn = document.getElementById("package-buy");
    const label = btn.innerHTML;
    btn.addEventListener("click", async () => {
      let fresh = null;
      try{ fresh = await getWallet(user.id); }catch(e){}
      const have = Number(fresh && fresh.available_balance || 0);
      if(have < PRICE){ toast(`You need ${money(PRICE)} in your wallet to verify. Add money on the Deposit page first.`, "error"); return; }
      const go = await ConfirmSheet.open({
        icon: "verify",
        title: "Verify your account?",
        lead: "We take $20.00 from your wallet and verify your account right away.",
        rows: [
          { label: "Payment for", value: "Account verification" },
          { label: "Paid from", value: "Your wallet" },
          { label: "Balance now", value: money(have) },
          { label: "Balance after", value: money(have - PRICE) }
        ],
        total: { label: "You pay", value: money(PRICE) },
        note: "This is a one-time payment. You do not pay it again.",
        confirm: "Pay $20.00 and verify"
      });
      if(!go) return;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying…';
      const { error } = await supabase.rpc("purchase_verification_package", { p_tier: 2 });
      if(error){
        btn.disabled = false; btn.innerHTML = label;
        toast(String(error.message || "We could not verify your account. Please try again.").replace(/^Postgres error:\s*/i, ""), "error");
        return;
      }
      AppState.profile = await getProfile(user.id);
      AppState.wallet = await getWallet(user.id);
      toast("Your account is verified.", "success");
      loadVerification(user, AppState.profile);
      try{ Modules.wallet && Modules.wallet.onActivate && Modules.wallet.onActivate(); }catch(e){}
    });
  }

  async function loadReferrals(user, wallet, code){
    document.getElementById("ref-earnings").textContent = money(wallet ? wallet.referral_earnings : 0);
    const { data: refs } = await supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at",{ascending:false});
    const list = refs || [];
    document.getElementById("ref-total").textContent = list.length;
    document.getElementById("ref-qualified").textContent = list.filter(r => r.status === "QUALIFIED").length;

    const wrap = document.getElementById("ref-table-wrap");
    if(!list.length){
      wrap.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-link"/></svg></div>${Modules.profile._code ? "No referrals yet — share your link above." : "No referrals yet. Verify your account to get your link."}</div>`;
    } else {
      wrap.innerHTML = `<table class="tbl"><thead><tr><th>#</th><th>Status</th><th>Joined</th><th>Qualified</th></tr></thead><tbody>
        ${list.map((r,i) => `<tr>
          <td>Referral ${i+1}</td>
          <td>${r.status==="QUALIFIED"?'<span class="badge badge-green">Qualified</span>':r.status==="REJECTED"?'<span class="badge badge-danger">Rejected</span>':r.status==="SUSPICIOUS"?'<span class="badge badge-danger">Flagged</span>':'<span class="badge badge-muted">Pending</span>'}</td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.qualified_at ? fmtDate(r.qualified_at) : "—"}</td>
        </tr>`).join("")}
      </tbody></table>`;
    }
  }

  function renderAll(ctx){
    const { user, profile, wallet } = ctx;
    document.getElementById("pf-name").value = (profile && profile.full_name) || "";
    document.getElementById("pf-email").value = user.email || "";
    document.getElementById("pf-phone").value = showPhone(profile && profile.phone);
    const phoneHint = document.getElementById("pf-phone-hint");
    phoneHint.textContent = profile && profile.phone ? "Your active number. Change it here and it changes everywhere." : "Add your active phone number so we can reach you about your account.";
    phoneHint.classList.toggle("is-missing", !(profile && profile.phone));
    renderAvatar(profile);

    // a member gets a referral link after verifying (VIP, investor and free-link accounts already can)
    const canRefer = !!(profile && (profile.is_verified || profile.is_vip || profile.is_investor || profile.vip_free)) || AppState.isAdmin;
    const code = canRefer ? ((profile && profile.referral_code) || "") : "";
    const link = code ? `${location.origin}${location.pathname}#auth/signup?ref=${encodeURIComponent(code)}` : "";
    document.getElementById("ref-code").textContent = code || "—";
    document.getElementById("ref-link").textContent = code ? link : "—";
    document.getElementById("ref-share").hidden = !canRefer;
    document.getElementById("ref-locked").hidden = canRefer;
    document.getElementById("ref-sub").textContent = canRefer
      ? "Share your referral link. When someone joins with it and gets verified, you get a reward automatically."
      : "Only verified members can invite people.";
    Modules.profile._link = link; Modules.profile._code = code;

    loadVerification(user, profile);
    loadReferrals(user, wallet, code);
  }

  function wireOnce(){
    if(wired) return;
    wired = true;

    const avatarInput=document.getElementById("profile-avatar-input");
    const avatarBtn=document.getElementById("profile-avatar-btn");
    const avatarSave=document.getElementById("profile-avatar-save");
    const avatarRemove=document.getElementById("profile-avatar-remove");
    avatarBtn.addEventListener("click",()=>avatarInput.click());
    avatarInput.addEventListener("change",()=>{
      const file=avatarInput.files && avatarInput.files[0];
      if(!file)return;
      pendingAvatarFile=file;
      setAvatarError("");
      const reader=new FileReader();
      reader.onload=e=>{const el=document.getElementById("profile-avatar-preview");el.innerHTML=`<img src="${e.target.result}" alt="Preview">`;el.classList.add("has-photo");};
      reader.readAsDataURL(file);
      avatarSave.disabled=false;
    });
    avatarSave.addEventListener("click",saveAvatar);
    avatarRemove.addEventListener("click",removeAvatar);

    document.getElementById("form-name").addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = AppState.user;
      const btn = e.target.querySelector("button");
      const phoneRaw = document.getElementById("pf-phone").value.trim();
      const phone = phoneRaw ? normPhone(phoneRaw) : null;
      const oldPhone = (AppState.profile && AppState.profile.phone) || null;
      if(phoneRaw && !phone){ toast("Enter a valid phone number, like 01XXXXXXXXX.", "error"); document.getElementById("pf-phone").focus(); return; }
      if(!phoneRaw && oldPhone){ toast("Your phone number can't be empty. Enter your active number.", "error"); document.getElementById("pf-phone").focus(); return; }
      btn.disabled = true;
      const { error } = await supabase.from("profiles").update({ full_name: document.getElementById("pf-name").value.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
      let phoneErr = null;
      if(!error && phone && phone !== oldPhone){ const r = await supabase.rpc("set_my_phone", { p_phone: phone }); phoneErr = r.error; }
      btn.disabled = false;
      if(error){ toast("Couldn't save changes.", "error"); return; }
      if(phoneErr){ toast(phoneErr.message || "Couldn't save your phone number.", "error"); return; }
      AppState.profile = await getProfile(user.id);
      renderSidebar(); setActiveNav("profile");
      toast("Profile updated.", "success");
    });

    document.getElementById("form-pass").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("pass-err");
      errEl.style.display = "none";
      const p1 = document.getElementById("pf-pass1").value, p2 = document.getElementById("pf-pass2").value;
      if(p1.length < 6){ errEl.textContent = "Password must be at least 6 characters."; errEl.style.display = "block"; return; }
      if(p1 !== p2){ errEl.textContent = "Passwords don't match."; errEl.style.display = "block"; return; }
      const btn = e.target.querySelector("button");
      btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner spinner-dark"></span>';
      const { error } = await updatePasswordWithMfa(p1, errEl, "pf-mfa");
      btn.disabled = false; btn.querySelector(".btn-label").textContent = "Update password";
      if(error){ errEl.textContent = error.message || "Couldn't update password."; errEl.style.display = "block"; return; }
      document.getElementById("pf-pass1").value = ""; document.getElementById("pf-pass2").value = "";
      toast("Password updated.", "success");
    });

    function copyText(text, btn){
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent; btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = orig, 1500);
      });
    }
    document.getElementById("copy-link-btn").addEventListener("click", () => copyText(Modules.profile._link || "", document.getElementById("copy-link-btn")));
    document.getElementById("copy-code-btn").addEventListener("click", () => copyText(Modules.profile._code || "", document.getElementById("copy-code-btn")));
    document.getElementById("ref-go-verify").addEventListener("click", () => {
      const card = document.getElementById("verify-card");
      if(card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("profile-signout-btn").addEventListener("click", signOut);
  }

  function init(){ wireOnce(); renderAll(ctxFor()); Leadership.paintAll(); Leadership.refresh(true); PaySec.refresh(); }
  async function onActivate(){ await refreshWallet(); renderAll(ctxFor()); Leadership.paintAll(); Leadership.refresh(true); PaySec.refresh(); }

  return { init, onActivate };
})();

/* ---------------- Public landing theme ---------------- */
function applyLandingTheme(){
  const landing=document.getElementById("view-landing");
  if(landing) landing.setAttribute("data-landing-theme","dark");
}
function initLandingTheme(){
  try{ localStorage.removeItem("ss_landing_theme"); }catch(e){}
  applyLandingTheme();
}

/* ---------------- Module: Wallet ---------------- */
Modules.wallet = (function(){
  let hidden = false;

  function renderBalance(){
    const balEl = document.getElementById("bal-amount");
    if(balEl) balEl.textContent = hidden ? "••••••" : money(AppState.wallet ? AppState.wallet.available_balance : 0);
  }

  const TYPE_LABEL = {
    TASK_REWARD:"Task reward", REFERRAL_COMMISSION:"Referral commission", VERIFICATION_PAYMENT:"Verification package",
    WITHDRAWAL:"Withdrawal", WITHDRAWAL_FEE:"Withdrawal fee", ADMIN_ADJUSTMENT:"Admin adjustment",
    REFUND:"Refund", REVERSAL:"Reversal", DEPOSIT:"Deposit", TRANSFER:"Balance transfer",
    LEADERSHIP_BONUS:"Leadership bonus", LEADERSHIP_INCOME:"Leadership monthly income", INVESTOR_INCOME:"Investor pool share"
  };

  const isOutTxn = t => ["WITHDRAWAL","WITHDRAWAL_FEE","VERIFICATION_PAYMENT"].includes(t.transaction_type)
    || (t.transaction_type === "TRANSFER" && /^TRF(-S-|OUT-)/.test(String(t.transaction_code || "")));
  // "ssw 02c9 8765dd", "02C98765DD" and "SSW-02C98765DD" all mean the same wallet (the server does the same)
  function walletNo(s){
    const v = String(s || "").toUpperCase().replace(/\s+/g, "");
    if(/^SSW-?[0-9A-F]{10}$/.test(v)) return "SSW-" + v.slice(-10);
    if(/^[0-9A-F]{10}$/.test(v)) return "SSW-" + v;
    return v;
  }
  const cleanErr = (e, d) => String((e && e.message) || d).replace(/^Postgres error:\s*/i, "");

  async function loadTransfers(){
    const wrap=document.getElementById("transfer-history");
    if(!wrap || !AppState.user) return;
    // free-link accounts can't send balance until 3 people they invited have verified
    await FreeMember.refresh();
    const fl=document.getElementById("tfx-freelock"), tf=document.getElementById("transfer-form");
    if(fl && tf){
      const lock=FreeMember.locked();
      fl.hidden=!lock;
      if(lock) fl.innerHTML=FreeMember.bannerHtml("transfer");
      tf.classList.toggle("is-blocked", lock);
      tf.querySelectorAll("input,button,textarea").forEach(x=>{ x.disabled=lock; });
    }
    const {data,error}=await supabase.rpc("get_my_wallet_transfers",{p_limit:50});
    if(error){ wrap.innerHTML='<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Could not load transfers.</div>'; return; }
    if(!data || !data.length){ wrap.innerHTML='<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrows-lr"/></svg></div>No balance transfers yet.</div>'; return; }
    wrap.innerHTML=`<table class="tbl"><thead><tr><th>Direction</th><th>Amount</th><th>Person</th><th>Note</th><th>Date</th></tr></thead><tbody>${
      data.map(t=>{
        const sent=t.direction==="SENT";
        return `<tr><td>${sent?'<span class="badge badge-danger">Sent</span>':'<span class="badge badge-green">Received</span>'}</td><td style="font-weight:800;">${sent?'−':'+'}${money(t.amount)}</td><td><div style="font-weight:600;color:var(--ink);">${escapeHtml(t.other_name||"Member")}</div><div style="font-size:11.5px;color:var(--muted);font-family:var(--font-mono);letter-spacing:.02em;">${escapeHtml(t.other_wallet||"—")}</div></td><td>${escapeHtml(t.note||"—")}</td><td>${fmtDate(t.created_at)}</td></tr>`;
      }).join("")
    }</tbody></table>`;
  }

  async function loadAll(){
    const user = AppState.user, wallet = AppState.wallet;
    hidden = !!(AppState.profile && AppState.profile.balance_hidden);
    renderBalance();
    document.getElementById("s-lifetime").textContent = money(wallet ? wallet.lifetime_earnings : 0);
    document.getElementById("s-task").textContent = money(wallet ? wallet.task_earnings : 0);
    document.getElementById("s-referral").textContent = money(wallet ? wallet.referral_earnings : 0);
    document.getElementById("s-withdrawn").textContent = money(wallet ? wallet.lifetime_withdrawals : 0);
    const walletNo=document.getElementById("my-wallet-number");
    if(walletNo) walletNo.textContent=wallet ? wallet.wallet_number : "—";

    const { data, error } = await supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at",{ascending:false}).limit(100);
    const wrap = document.getElementById("txn-wrap");
    if(error){ wrap.innerHTML = `<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn't load transactions.</div>`; }
    else if(!data || !data.length){ wrap.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-wallet"/></svg></div>No transactions yet.</div>`; }
    else {
      wrap.innerHTML = `<table class="tbl"><thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
        ${data.map(t => `<tr>
          <td class="txn-type">${TYPE_LABEL[t.transaction_type] || t.transaction_type}</td>
          <td>${escapeHtml(t.description || "—")}</td>
          <td style="font-weight:700;color:${isOutTxn(t) ? "var(--danger)" : "var(--green-dark)"};">
            ${isOutTxn(t) ? "−" : "+"}${money(t.amount)}
          </td>
          <td>${t.status==="COMPLETED"?'<span class="badge badge-green">Completed</span>':t.status==="PENDING"?'<span class="badge badge-gold">Pending</span>':'<span class="badge badge-muted">'+t.status+'</span>'}</td>
          <td>${fmtDate(t.created_at)}</td>
        </tr>`).join("")}
      </tbody></table>`;
    }
    await loadTransfers();
  }

  function wireTransfer(){
    const form=document.getElementById("transfer-form");
    if(!form || form.dataset.wired) return;
    form.dataset.wired="1";
    document.getElementById("copy-wallet-number").addEventListener("click",async()=>{
      const v=AppState.wallet && AppState.wallet.wallet_number;
      if(v){ try{ await navigator.clipboard.writeText(v); }catch(e){} toast("Wallet number copied.","success"); }
    });
    const err=document.getElementById("transfer-err");
    const btn=document.getElementById("transfer-submit");
    const showErr=m=>{ err.textContent=m; err.style.display="block"; };
    const busy=(on,label)=>{ btn.disabled=on; btn.querySelector(".btn-label").innerHTML=on?'<span class="spinner"></span> '+escapeHtml(label||""):"Transfer balance"; };
    const numberInput=document.getElementById("transfer-wallet-number");
    numberInput.addEventListener("blur",()=>{ const v=walletNo(numberInput.value); if(v) numberInput.value=v; });
    const feeOf=a=>Math.round(a*0.02*100)/100;
    const preview=()=>{
      const box=document.getElementById("tfx-preview"), t=String(document.getElementById("transfer-amount").value||"").trim(), a=Number(t);
      if(!/^\d+(\.\d{1,2})?$/.test(t) || !(a>0)){ box.hidden=true; return; }
      const f=feeOf(a);
      document.getElementById("tfx-send").textContent=money(a);
      document.getElementById("tfx-fee").textContent="−"+money(f);
      document.getElementById("tfx-net").textContent=money(Math.max(0,a-f));
      box.hidden=false;
    };
    form.addEventListener("input",()=>{ err.style.display="none"; preview(); });
    form.addEventListener("reset",()=>setTimeout(preview,0));

    form.addEventListener("submit",async e=>{
      e.preventDefault();
      err.style.display="none";
      const recipient=walletNo(numberInput.value);
      const amountText=String(document.getElementById("transfer-amount").value||"").trim();
      const note=document.getElementById("transfer-note").value.trim()||null;
      if(!recipient){ showErr("Enter the wallet number of the person you are sending to."); return; }
      if(!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText)<=0){ showErr("Enter a valid amount, for example 5 or 5.25."); return; }
      const amount=Number(amountText);
      await refreshWallet();
      const have=Number(AppState.wallet && AppState.wallet.available_balance || 0);
      const mine=String(AppState.wallet && AppState.wallet.wallet_number || "").toUpperCase();
      if(recipient===mine){ showErr("This is your own wallet number. Enter the other person's wallet number."); return; }
      if(amount>have){ showErr(`Your balance is too low. You can send up to ${money(have)}.`); return; }

      // who gets the money (so the person can check before sending)
      busy(true,"Checking…");
      const {data:who,error:lookErr}=await supabase.rpc("lookup_wallet_recipient",{p_wallet_number:recipient});
      busy(false);
      if(lookErr || !who){ showErr(cleanErr(lookErr,"We could not check this wallet number. Please try again.")); return; }
      numberInput.value=who.wallet_number;

      const fee=feeOf(amount), net=Math.round((amount-fee)*100)/100;
      if(!(net>0)){ showErr("This amount is too small to send."); return; }
      const go=await ConfirmSheet.open({
        icon:"transfer",
        title:"Send "+money(amount)+"?",
        lead:"Check the name and wallet number. The money goes to this person right away.",
        rows:[
          {label:"To",value:`${escapeHtml(who.name)}<small>${escapeHtml(who.wallet_number)}</small>`,html:true},
          {label:"You send",value:money(amount)},
          {label:"Transfer fee (2%)",value:"−"+money(fee)},
          ...(note?[{label:"Note",value:note}]:[]),
          {label:"Your balance after",value:money(Math.max(0,have-amount))}
        ],
        total:{label:"They receive",value:money(net)},
        note:"Next we email you a code to confirm it's you. Transfers are instant and cannot be undone.",
        confirm:"Continue"
      });
      if(!go) return;
      const verified=await PayCode.ask({what:"transfer"});
      if(!verified){ showErr("Transfer not sent. Confirm the email code to continue."); return; }

      busy(true,"Sending…");
      const {data,error}=await supabase.rpc("transfer_wallet_balance",{p_recipient_wallet_number:who.wallet_number,p_amount:amount,p_note:note});
      busy(false);
      if(error){
        if(PayCode.isCodeError(error)) PayCode.used();
        const msg=cleanCodeErr({message:cleanErr(error,"Transfer failed. Please try again.")});
        showErr(/duplicate key/i.test(msg)?"This transfer could not be saved. Please try again.":msg);
        return;
      }
      PayCode.used();
      form.reset();
      toast(`${money(Number(data && data.received || net))} sent to ${(data && data.name) || who.name} (fee ${money(Number(data && data.fee || fee))}).`,"success");
      await refreshWallet();
      await loadAll();
    });
  }

  function init(){
    document.getElementById("eye-btn").addEventListener("click", async () => {
      hidden = !hidden; renderBalance();
      await supabase.from("profiles").update({ balance_hidden: hidden, updated_at: new Date().toISOString() }).eq("id", AppState.user.id);
      if(AppState.profile) AppState.profile.balance_hidden = hidden;
    });
    wireTransfer(); loadAll();
  }
  async function onActivate(){ await refreshWallet(); wireTransfer(); loadAll(); }
  // used by the Balance transfer tab on the Withdraw page
  async function openTransfer(){
    wireTransfer();
    const n = document.getElementById("my-wallet-number");
    if(n) n.textContent = AppState.wallet ? AppState.wallet.wallet_number : "—";
    await loadTransfers();
  }
  return { init, onActivate, openTransfer };
})();;

/* ---------------- Module: Withdraw ---------------- */
Modules.withdraw = (function(){
  let available = 0;
  // ---- two tabs: Withdraw | Balance transfer ----
  const TAB_TEXT = {
    withdraw: ["Withdraw", "Send your earnings to Binance or bKash. Choose a method, add your account and enter the amount."],
    transfer: ["Balance transfer", "Send money from your balance to another member. They get it right away."]
  };
  let tabsWired = false;
  function setTab(tab, push){
    if(tab !== "transfer" || AppState.isVip) tab = "withdraw";
    document.querySelectorAll("[data-wd-tab]").forEach(b => { const on = b.dataset.wdTab === tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    document.getElementById("wd-panel-withdraw").hidden = tab !== "withdraw";
    document.getElementById("wd-panel-transfer").hidden = tab !== "transfer";
    document.getElementById("wd-h").textContent = TAB_TEXT[tab][0];
    document.getElementById("wd-lead").textContent = TAB_TEXT[tab][1];
    if(push){ try{ history.replaceState(null, "", "#withdraw" + (tab === "transfer" ? "/transfer" : "")); }catch(e){} }
    if(tab === "transfer" && Modules.wallet && Modules.wallet.openTransfer) Modules.wallet.openTransfer();
  }
  function wireTabs(){
    if(tabsWired) return; tabsWired = true;
    document.querySelectorAll("[data-wd-tab]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.wdTab, true)));
  }

  let method = "BINANCE";
  let rates = null;
  let pending = null;
  const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>';
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.2"/><path d="M12 17.2h.01"/></svg>';
  const ETA = {
    BINANCE: { name:"Binance", range:"4 – 48 hours", text:"Binance payouts arrive within 4 to 48 hours after you send the request." },
    BKASH:   { name:"bKash",   range:"20 min – 2 hours", text:"bKash payouts arrive within 20 minutes to 2 hours after you send the request." }
  };

  function currentRate(){
    if(AppState.isInv) return 0;   // investor accounts withdraw without a fee
    const tier = AppState.profile && Number(AppState.profile.verification_tier);
    return tier === 1 ? 0.50 : 0.10;
  }
  function syncTierNote(){
    const el=document.getElementById("bd-rate"); if(el) el.textContent=Math.round(currentRate()*100);
  }
  function bdtRate(){ return rates && Number(rates.bkash) > 0 ? Number(rates.bkash) : 117; }
  function calc(v){
    const rate=currentRate(), comm=Math.round(v*rate*100)/100, payout=Math.round((v-comm)*100)/100;
    return { rate, comm, payout, bdt: Math.round(payout*bdtRate()) };
  }

  function renderInfo(){
    const box=document.getElementById("wdx-info"); if(!box) return;
    const e=ETA[method];
    box.innerHTML=`
      <div class="wdx-eta"><span class="wdx-eta-ico">${CLOCK}</span>
        <div><small>Arrival time · ${e.name}</small><b>${e.range}</b><p>${e.text}</p></div></div>
      <div class="wdx-warn" role="note"><span class="wdx-warn-ico">${WARN}</span>
        <div><b>One withdrawal at a time</b><p>While a withdrawal is being processed, please don't request another one. Wait until it shows Approved or Rejected.</p></div></div>`;
  }
  function renderRate(){
    const el=document.getElementById("wdx-rate"); if(!el) return;
    if(method!=="BKASH"){ el.hidden=true; return; }
    el.hidden=false;
    el.innerHTML=`<span class="wdx-live"><i></i>Today's rate</span><span>1 USD = <b>৳${bdtRate().toFixed(2)}</b></span><span style="flex-basis:100%">It follows Bangladesh's official dollar rate, so it can go up or down.</span>`;
  }
  function update(){
    const amountInput=document.getElementById("wd-amount"), breakdown=document.getElementById("breakdown"), amtErr=document.getElementById("wd-amount-err"), tk=document.getElementById("wdx-taka");
    const v=parseFloat(amountInput.value); amtErr.style.display="none";
    if(!v||v<1){ breakdown.style.display="none"; if(tk) tk.hidden=true; return; }
    if(v>available){ amtErr.textContent="You do not have enough balance for this amount."; amtErr.style.display="block"; }
    const c=calc(v);
    document.getElementById("bd-rate").textContent=Math.round(c.rate*100);
    document.getElementById("bd-amount").textContent=money(v);
    document.getElementById("bd-comm").textContent="−"+money(c.comm);
    document.getElementById("bd-payout").textContent=money(c.payout);
    breakdown.style.display="block";
    if(tk){
      tk.hidden = method!=="BKASH";
      document.getElementById("wdx-taka-amt").textContent=taka(c.bdt);
      document.getElementById("wdx-taka-note").textContent=`${money(c.payout)} × ৳${bdtRate().toFixed(2)} per dollar. The rate is locked when you send the request.`;
    }
  }
  function setMethod(m){
    method=m;
    document.querySelectorAll("#wd-method-toggle .withdraw-method").forEach(b=>b.classList.toggle("active",b.dataset.method===m));
    const label=document.getElementById("wd-account-label");if(label)label.textContent=m==="BKASH"?"bKash number":"Binance account ID";
    const input=document.getElementById("wd-binance");if(input)input.placeholder=m==="BKASH"?"Your bKash number":"Your Binance UID / Pay ID";
    renderInfo(); renderRate(); update();
  }
  async function loadRates(){ rates=await PayRates.get(); renderRate(); update(); }

  function renderPending(){
    const el=document.getElementById("wdx-pending"), form=document.getElementById("wd-form"), btn=document.getElementById("wd-submit");
    if(!el) return;
    if(!pending){
      if(FreeMember.locked()){ el.innerHTML=FreeMember.bannerHtml(); el.hidden=false; form.classList.add("is-blocked"); btn.disabled=true; return; }
      el.hidden=true; form.classList.remove("is-blocked"); btn.disabled=false; return;
    }
    const e=ETA[pending.payout_method==="BKASH"?"BKASH":"BINANCE"];
    const get=pending.payout_method==="BKASH"&&pending.payout_bdt!=null?taka(pending.payout_bdt):money(pending.payout_amount);
    el.innerHTML=`<span class="wdx-pending-ico">${CLOCK}</span><div><b>Your withdrawal is on its way</b>
      <p>${money(pending.amount)} to ${e.name} (you get ${get}) — sent ${fmtDate(pending.requested_at)}. It arrives within ${e.range}. You can request a new withdrawal after this one is finished.</p></div>`;
    el.hidden=false; form.classList.add("is-blocked"); btn.disabled=true;
  }
  async function loadHistory(){
    const wrap=document.getElementById("wd-history"); if(!wrap) return;
    await FreeMember.refresh();
    const {data,error}=await supabase.from("withdrawal_requests").select("*").eq("user_id",AppState.user.id).order("requested_at",{ascending:false});
    if(error){wrap.innerHTML='<div class="empty-state withdraw-empty"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn’t load your withdrawal requests.</div>';return;}
    pending=(data||[]).find(w=>w.status==="PENDING")||null;
    renderPending();
    if(!data||!data.length){wrap.innerHTML='<div class="empty-state withdraw-empty"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-arrow-up-right"/></svg></div><div style="font-weight:700;color:var(--ink);margin-bottom:4px;">No withdrawal requests yet</div><div>Your submitted requests will appear here.</div></div>';return;}
    const youGet=w=>w.payout_method==="BKASH"&&w.payout_bdt!=null?`${taka(w.payout_bdt)}<div style="font-size:11.5px;color:var(--muted);">${money(w.payout_amount)} · ৳${Number(w.bdt_rate).toFixed(2)}/$</div>`:(w.payout_amount!=null?money(w.payout_amount):"—");
    wrap.innerHTML=`<table class="tbl"><thead><tr><th>Method</th><th>Amount</th><th>You receive</th><th>Account</th><th>Status</th><th>Requested</th></tr></thead><tbody>${data.map(w=>`<tr><td><span class="pay-cell"><span class="pay-logo ${w.payout_method==="BKASH"?"pay-bkash-mark":"pay-binance-mark"}" aria-hidden="true"></span>${w.payout_method==="BKASH"?"bKash":"Binance"}</span></td><td>${money(w.amount)}</td><td>${youGet(w)}</td><td>${escapeHtml(w.binance_id)}</td><td>${w.status==="APPROVED"?'<span class="badge badge-green">Approved</span>':w.status==="REJECTED"?'<span class="badge badge-danger">Rejected</span>'+(w.admin_note?`<div style="font-size:11.5px;color:var(--muted);margin-top:4px;max-width:220px;">${escapeHtml(w.admin_note)}</div>`:""):w.status==="CANCELLED"?'<span class="badge badge-muted">Cancelled</span>':'<span class="badge badge-gold">Pending</span>'}</td><td>${fmtDate(w.requested_at)}</td></tr>`).join("")}</tbody></table>`;
  }
  function refreshAvail(){
    available=AppState.wallet?Number(AppState.wallet.available_balance):0;
    const a=document.getElementById("avail-amount");if(a)a.textContent=money(available);
    syncTierNote();
  }
  function init(sub){
    wireTabs(); setTab(sub);
    refreshAvail();
    if(AppState.isInv){ const n=document.querySelector("#page-withdraw .wd-note"); if(n) n.textContent="Investor accounts withdraw without a fee. For your safety we email you a code before the request is sent. It shows as Pending until our team pays it."; }
    if(AppState.profile&&AppState.profile.default_payout_method==="BKASH") method="BKASH";
    setMethod(method);
    document.querySelectorAll("#wd-method-toggle .withdraw-method").forEach(b=>b.addEventListener("click",()=>setMethod(b.dataset.method)));
    const amountInput=document.getElementById("wd-amount"),breakdown=document.getElementById("breakdown");
    const hc=HumanCheck.attach(document.getElementById("wd-human"),"withdraw");
    document.getElementById("wd-human").addEventListener("humancheck",e=>{if(e.detail.state==="ok"){const er=document.getElementById("wd-err");if(/robot/i.test(er.textContent))er.style.display="none";}});
    amountInput.addEventListener("input",update);
    document.getElementById("wd-form").addEventListener("submit",async e=>{
      e.preventDefault();const errEl=document.getElementById("wd-err");errEl.style.display="none";
      const fail=m=>{errEl.textContent=m;errEl.style.display="block";};
      if(pending){fail("You already have a withdrawal in progress. Please wait until it is finished.");return;}
      const accountId=document.getElementById("wd-binance").value.trim(),amount=parseFloat(amountInput.value);
      if(!accountId){fail("Please enter your "+(method==="BKASH"?"bKash number.":"Binance account ID."));return;}
      if(!amount||amount<1){fail("The minimum withdrawal is $1.00.");return;}
      if(amount>available){fail("You do not have enough balance for this withdrawal.");return;}
      if(!(hc&&hc.proof())){if(hc)hc.nudge();fail("Please tick “I'm not a robot” first.");return;}
      if(method==="BKASH") rates=await PayRates.get(true);
      const c=calc(amount),isBkash=method==="BKASH",eta=ETA[method];
      const go=await ConfirmSheet.open({
        icon:"withdraw",
        title:"Withdraw "+money(amount)+"?",
        lead:"Please check the details. We send the money to this account.",
        rows:[
          {label:"Method",value:`<span class="pay-cell"><span class="pay-logo ${isBkash?"pay-bkash-mark":"pay-binance-mark"}" aria-hidden="true"></span>${eta.name}</span>`,html:true},
          {label:isBkash?"bKash number":"Binance ID",value:accountId,mono:true},
          {label:"Amount",value:money(amount)},
          {label:"Fee ("+Math.round(c.rate*100)+"%)",value:"−"+money(c.comm)},
          ...(isBkash?[{label:"After fee",value:money(c.payout)},{label:"Rate today",value:"1 USD = ৳"+bdtRate().toFixed(2)}]:[]),
          {label:"Arrives in",value:eta.range}
        ],
        total:{label:"You receive",value:isBkash?taka(c.bdt):money(c.payout)},
        note:"Next we email you a code to confirm it's you. After that the request goes to our team and cannot be changed.",
        confirm:"Continue"
      });
      if(!go)return;
      const verified=await PayCode.ask({what:"withdrawal"});
      if(!verified){fail("Withdrawal not sent. Confirm the email code to continue.");return;}
      const human=hc&&hc.proof();
      if(!human){if(hc)hc.nudge();fail("The “I'm not a robot” check expired. Please tick it again.");return;}
      const btn=document.getElementById("wd-submit");btn.disabled=true;btn.querySelector(".btn-label").innerHTML='<span class="spinner"></span>';
      const {error}=await supabase.rpc("submit_super_survey_withdrawal",{p_amount:amount,p_account_id:accountId,p_method:method,p_human:human});
      btn.disabled=false;btn.querySelector(".btn-label").textContent="Request withdrawal";
      if(hc)hc.reset();
      if(error){
        if(PayCode.isCodeError(error)) PayCode.used();
        fail(cleanCodeErr(error)||"Couldn’t submit your request.");
        loadHistory();
        return;
      }
      PayCode.used();
      toast(isBkash?`Withdrawal sent. You get ${taka(c.bdt)} on bKash within 20 min – 2 hours.`:"Withdrawal sent. It arrives on Binance within 4 – 48 hours.","success");
      document.getElementById("wd-form").reset();setMethod(method);breakdown.style.display="none";await refreshWallet();refreshAvail();loadHistory();
    });
    loadRates();
    loadHistory();
  }
  async function onActivate(sub){wireTabs();setTab(sub);await refreshWallet();refreshAvail();loadRates();loadHistory();}
  return {init,onActivate};
})();

/* ---------------- Module: Deposit ---------------- */
Modules.deposit = (function(){
  const NAMES = { BINANCE: "Binance", BKASH: "bKash" };
  // Used until the payment_methods table answers (and if it has not been created yet).
  const methods = {
    BINANCE: { account: "1221294000", is_open: true },
    BKASH:   { account: "01303902372", is_open: true }
  };
  let method = "BKASH";
  let step = 1;   // step of the method on screen
  const flows = {
    BKASH:   { step: 1, flow: "dpx-flow",         track: "dpz-track", focus: "dpx-trx" },
    BINANCE: { step: 1, flow: "dep-binance-flow", track: "bnz-track", focus: "dep-reference" }
  };
  let watchTimer = null, watchIds = [];
  let cfg = { rate: 126, number: "01303902372", is_open: true, auto: true, min_usd: 1, max_usd: 396 };
  const LS_PAYER = "srv.bkash.payer";
  const $ = id => document.getElementById(id);
  const ICO_BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" fill="currentColor"/></svg>';
  const ICO_SUPPORT = '<svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-message"/></svg>';

  /* ---------- small helpers ---------- */
  function takaText(n){ return "৳" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function normPayer(v){ let d = String(v || "").replace(/\D/g, ""); if(/^8801\d{9}$/.test(d)) d = d.slice(2); return d; }
  function validPayer(d){ return /^01[3-9]\d{8}$/.test(d); }
  function normTrx(v){
    const s = String(v || "");
    const inSms = s.match(/Trx\s*ID\s*[:#.-]?\s*([A-Za-z0-9]{6,14})/i);   // a whole SMS was pasted
    return (inSms ? inSms[1] : s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  }
  function validTrx(t){ return /^[A-Z0-9]{8,12}$/.test(t); }
  function usdValue(){ const v = parseFloat($("dpx-usd").value); return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
  // whole taka, rounded up (same as the server): integer maths avoids float surprises
  function takaFor(usd){ const cents = Math.round(usd * 100), rate = Math.round(cfg.rate * 100); return Math.ceil(cents * rate / 10000); }
  function showErr(id, msg){ const el = $(id); if(!el) return; el.textContent = msg || ""; el.style.display = msg ? "block" : "none"; }
  async function copyText(text, btn){
    try{ await navigator.clipboard.writeText(text); }
    catch(_e){
      const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try{ document.execCommand("copy"); }catch(_e2){} t.remove();
    }
    if(!btn) return;
    const label = btn.querySelector("span");
    btn.classList.add("is-done"); if(label) label.textContent = "Copied";
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove("is-done"); if(label) label.textContent = "Copy"; }, 1600);
  }

  /* ---------- methods ---------- */
  function firstOpen(){
    if(methods[method] && methods[method].is_open) return method;
    if(methods.BKASH.is_open) return "BKASH";
    if(methods.BINANCE.is_open) return "BINANCE";
    return method;
  }

  async function loadMethods(){
    const [pm, conf] = await Promise.all([
      supabase.from("payment_methods").select("method,account,is_open"),
      supabase.rpc("get_bkash_deposit_config")
    ]);
    if(!pm.error && Array.isArray(pm.data)){
      pm.data.forEach(r => {
        if(!methods[r.method]) return;
        methods[r.method] = { account: (r.account || methods[r.method].account), is_open: r.is_open !== false };
      });
    }
    if(!conf.error && conf.data){
      cfg = Object.assign(cfg, conf.data);
      cfg.rate = Number(cfg.rate) || 126;
      methods.BKASH.is_open = cfg.is_open !== false && methods.BKASH.is_open;
      if(cfg.number) methods.BKASH.account = cfg.number;
    }
    paintMethods();
    setMethod(firstOpen());
  }

  function paintMethods(){
    document.querySelectorAll("#dep-method-toggle .method-btn").forEach(b => {
      const info = methods[b.dataset.method]; if(!info) return;
      b.classList.toggle("is-closed", !info.is_open);
      const st = b.querySelector(".dp-status");
      if(st) st.textContent = info.is_open ? "Open" : "Closed";
    });
    const tag = $("dpx-auto-tag"); if(tag) tag.hidden = !cfg.auto;
    const bk = document.querySelector('#dep-method-toggle [data-method="BKASH"]'); if(bk) bk.classList.toggle("is-manual", !cfg.auto);
  }

  function setMethod(m){
    flows[method].step = step;
    method = m; step = flows[m].step;
    const info = methods[m];
    const isBk = m === "BKASH";
    const wrap = document.querySelector("#page-deposit .dz"); if(wrap) wrap.classList.toggle("is-bkash", isBk);
    document.querySelectorAll("#dep-method-toggle .method-btn").forEach(b => b.classList.toggle("active", b.dataset.method === m));
    $("dpx-flow").hidden = !isBk;
    $("dep-binance-flow").hidden = isBk;
    if(isBk) paintBkash(); else paintBinance();
    const submit = $("dep-submit");
    submit.disabled = !info.is_open;
    submit.querySelector(".btn-label").textContent = isBk ? "Confirm deposit" : "Submit deposit";
    goStep(step, true);
    showErr("dep-err", "");
    paintAside();
  }

  /* ---------- Binance flow ---------- */
  function bnUsd(){ const v = parseFloat($("bnz-usd").value); return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
  function bnProblem(usd){ if(!(usd > 0)) return "empty"; if(usd < minUsd()) return "low"; if(usd > 100000) return "high"; return ""; }
  function usdtNum(n){ return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function usdtText(n){ return usdtNum(n) + " USDT"; }
  const ICO_OK = '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.7"/>';
  const ICO_INFO = '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>';

  function paintBinance(){
    const open = methods.BINANCE.is_open;
    $("dep-binance-flow").classList.toggle("is-closed", !open);
    $("bnz-closed").hidden = open;
    if(!open) $("bnz-closed-text").textContent = methods.BKASH.is_open ? "Please use bKash or try again later." : "Please try again later.";
    const id = methods.BINANCE.account || "";
    $("bnz-id").textContent = id; $("bnz-copy-id").dataset.copy = id; $("bnz-guide-id").textContent = id;
    bnQuote();
  }

  function bnQuote(){
    const usd = bnUsd(), prob = bnProblem(usd);
    document.querySelectorAll("[data-bnz-usd]").forEach(c => c.classList.toggle("active", Number(c.dataset.bnzUsd) === usd));
    $("bnz-usdt").textContent = usdtText(usd);
    $("bnz-send-amt").innerHTML = `${usdtNum(usd)}<small>USDT</small>`;
    $("bnz-copy-amt").dataset.copy = usd > 0 ? String(usd) : "";
    $("bnz-send-sub").textContent = `${money(usd)} will be added to your wallet`;
    $("bnz-guide-amt").textContent = usd > 0 ? usdtText(usd) : "the amount";
    const box = $("bnz-amount"), lim = $("bnz-limit"), txt = $("bnz-limit-text");
    box.classList.toggle("is-low", prob === "low" || prob === "high");
    lim.classList.toggle("is-bad", prob === "low" || prob === "high");
    lim.classList.toggle("is-good", !prob);
    lim.querySelector("svg").innerHTML = prob ? ICO_INFO : ICO_OK;
    if(prob === "low") txt.textContent = `The minimum deposit is $${minUsd()}. Please enter $${minUsd()} or more.`;
    else if(prob === "high") txt.textContent = "That amount is too high. Please enter a smaller amount.";
    else if(!prob) txt.textContent = `${money(usd)} will be added to your wallet after our team checks it.`;
    else txt.textContent = `Minimum deposit is $${minUsd()}`;
    showErr("bnz-usd-err", "");
    paintAside(); paintNav();
  }

  /* ---------- bKash flow ---------- */
  function paintBkash(){
    const open = methods.BKASH.is_open;
    $("dpx-flow").classList.toggle("is-closed", !open);
    $("dpx-closed").hidden = open;
    if(!open) $("dpx-closed-text").textContent = methods.BINANCE.is_open ? "Please use Binance or try again later." : "Please try again later.";
    const num = methods.BKASH.account || cfg.number;
    $("dpx-number").textContent = num;
    $("dpx-copy-number").dataset.copy = num;
    $("dpx-rate-line").innerHTML = `Rate <b>৳${Number(cfg.rate).toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> = $1 <i></i> Min <b>$${minUsd()}</b> <i></i> Max <b>$${Number(cfg.max_usd || 396).toLocaleString("en-US")}</b>`;
    $("dpz-min-pill").textContent = "Minimum $" + minUsd();
    $("dpz-rate-mini").textContent = `৳${Number(cfg.rate).toLocaleString("en-US", { maximumFractionDigits: 2 })} = $1`;
    const auto = $("dpx-auto-line");
    auto.classList.toggle("is-manual", !cfg.auto);
    auto.querySelector(".dpx-auto-txt b").textContent = cfg.auto ? "Added to your wallet automatically" : "Checked by our team";
    auto.querySelector(".dpx-auto-txt span").textContent = cfg.auto
      ? "As soon as the bKash payment is confirmed. Usually in less than a minute."
      : "Auto confirm is paused. Our team checks it and adds it to your wallet.";
    paintPayer(); quote();
  }

  function paintPayer(){
    const d = normPayer($("dpx-payer").value);
    const ok = validPayer(d);
    $("dpx-payer").closest(".dpx-phone").classList.toggle("is-ok", ok);
    $("dpx-rule-num").textContent = ok ? d : "your number";
    if(ok) showErr("dpx-payer-err", "");
    paintAside(); paintNav();
    return ok ? d : null;
  }

  function minUsd(){ return Number(cfg.min_usd) > 0 ? Number(cfg.min_usd) : 1; }
  function maxUsd(){ return Number(cfg.max_usd) > 0 ? Number(cfg.max_usd) : Math.floor(50000 / (cfg.rate || 126)); }
  // "" = fine, otherwise the reason the amount can't be used
  function amountProblem(usd){
    if(!(usd > 0)) return "empty";
    if(usd < minUsd()) return "low";
    if(takaFor(usd) > 50000 || usd > maxUsd()) return "high";
    return "";
  }

  function quote(){
    const usd = usdValue();
    const prob = amountProblem(usd);
    document.querySelectorAll("[data-dpx-usd]").forEach(c => c.classList.toggle("active", Number(c.dataset.dpxUsd) === usd));
    const taka = usd > 0 ? takaFor(usd) : 0;
    $("dpx-taka").textContent = takaText(taka);
    $("dpx-rule-taka").textContent = takaText(taka);
    $("dpx-copy-taka").dataset.copy = String(taka);
    $("dpz-ticket-usd").textContent = `${money(usd)} will be added to your wallet`;
    $("dpx-quote").classList.toggle("is-on", usd > 0);
    const box = $("dpz-amount"), lim = $("dpz-limit"), txt = $("dpz-limit-text");
    box.classList.toggle("is-low", prob === "low" || prob === "high");
    box.classList.toggle("is-good", !prob);
    lim.classList.toggle("is-bad", prob === "low" || prob === "high");
    lim.classList.toggle("is-good", !prob);
    lim.querySelector("svg").innerHTML = !prob ? '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.7"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>';
    if(prob === "low") txt.textContent = `The minimum deposit is $${minUsd()}. Please enter $${minUsd()} or more.`;
    else if(prob === "high") txt.textContent = `You can add up to $${maxUsd()} at a time (bKash limit ৳50,000).`;
    else if(!prob) txt.textContent = `${money(usd)} will be added to your wallet.`;
    else txt.textContent = `Minimum deposit is $${minUsd()}`;
    showErr("dpx-usd-err", "");
    paintAside(); paintNav();
    return prob ? null : taka;
  }

  /* ---------- steps (each method keeps its own step) ---------- */
  function stepOk(n){
    if(n < 1) return true;
    if(method === "BINANCE") return !bnProblem(bnUsd());
    if(amountProblem(usdValue())) return false;
    if(!validPayer(normPayer($("dpx-payer").value))) return false;
    return true;
  }

  function nextLabel(){
    if(step === 2) return "I've sent it";
    if(method === "BINANCE"){
      const p = bnProblem(bnUsd());
      if(p === "empty") return "Enter an amount";
      if(p === "low") return `Minimum is $${minUsd()}`;
      if(p === "high") return "Amount is too high";
      return "Continue";
    }
    const prob = amountProblem(usdValue());
    if(prob === "empty") return "Enter an amount";
    if(prob === "low") return `Minimum is $${minUsd()}`;
    if(prob === "high") return `Maximum is $${maxUsd()}`;
    if(!validPayer(normPayer($("dpx-payer").value))) return "Enter your bKash number";
    return "Continue";
  }

  function paintNav(){
    const f = flows[method]; if(!f) return;
    const open = methods[method].is_open;
    const next = $("dpz-next"), back = $("dpz-back"), submit = $("dep-submit");
    back.hidden = step === 1;
    next.hidden = step === 3;
    submit.hidden = step !== 3;
    next.disabled = !open || (step === 1 && !stepOk(1));
    next.querySelector(".btn-label").textContent = nextLabel();
    next.classList.toggle("is-blocked", next.disabled);
    $("dpx-safe").hidden = step === 1;
    $("dpx-safe-text").textContent = step === 1 ? ""
      : step === 2 ? (method === "BINANCE" ? "Pay in the Binance app first, then continue." : "Send the money first, then continue.")
      : (method === "BINANCE" ? "Only press this after you have paid in Binance." : "Only press this after you have sent the money.");
    document.querySelectorAll("#" + f.track + " li").forEach(li => {
      const n = Number(li.dataset.go);
      li.className = n < step ? "is-done" : n === step ? "is-on" : "";
      li.querySelector("button").disabled = n > step;
    });
  }

  function step1Errors(){
    if(method === "BINANCE"){
      const p = bnProblem(bnUsd());
      showErr("bnz-usd-err", p === "high" ? "Please enter a smaller amount." : `Enter at least $${minUsd()} to continue.`);
      return;
    }
    const prob = amountProblem(usdValue());
    if(prob === "empty" || prob === "low") showErr("dpx-usd-err", `Enter at least $${minUsd()} to continue.`);
    else if(prob === "high") showErr("dpx-usd-err", `You can add up to $${maxUsd()} at a time.`);
    if(!validPayer(normPayer($("dpx-payer").value))) showErr("dpx-payer-err", "Enter your 11-digit bKash number, like 01712345678.");
  }

  function goStep(n, quiet){
    if(n > 1 && !stepOk(1)){ n = 1; if(!quiet) step1Errors(); }
    const f = flows[method];
    const prev = step; step = n; f.step = n;
    const flow = $(f.flow);
    flow.dataset.step = String(n);
    flow.querySelectorAll(".dpz-pane").forEach(p => {
      const on = Number(p.dataset.pane) === n;
      p.hidden = !on;
      if(on && !quiet && prev !== n){ p.classList.remove("is-in", "is-back"); void p.offsetWidth; p.classList.add(n > prev ? "is-in" : "is-back"); }
    });
    if(n === 3) paintRecap();
    showErr("dep-err", "");
    paintNav();
    if(!quiet && prev !== n){
      const top = $(f.track).getBoundingClientRect().top + window.scrollY - 90;
      if(window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
      if(n === 3) setTimeout(() => { try{ $(f.focus).focus({ preventScroll: true }); }catch(_e){} }, 260);
    }
  }

  function paintRecap(){
    if(method === "BINANCE"){
      const usd = bnUsd();
      $("bnz-recap").innerHTML = `
        <div><small>You sent</small><b>${usdtText(usd)}</b></div>
        <div><small>To Binance ID</small><b>${escapeHtml(methods.BINANCE.account || "")}</b></div>
        <div class="is-add"><small>You get</small><b>${money(usd)}</b></div>`;
      return;
    }
    const usd = usdValue(), payer = normPayer($("dpx-payer").value);
    $("dpz-recap").innerHTML = `
      <div><small>You sent</small><b>${takaText(takaFor(usd))}</b></div>
      <div><small>From</small><b>${escapeHtml(payer)}</b></div>
      <div class="is-add"><small>You get</small><b>${money(usd)}</b></div>`;
  }

  function paintAside(){
    const aside = $("dep-aside"); if(!aside) return;
    if(method !== "BKASH"){
      const bu = bnUsd();
      aside.innerHTML = `<h3>Summary</h3>
        <div class="dpx-sum-hero"><small>You send with Binance Pay</small><b>${usdtText(bu)}</b><span>${bu >= minUsd() ? money(bu) + " goes to your wallet" : "Minimum deposit is $" + minUsd()}</span></div>
        <dl class="wd-sum-list">
          <div><dt>Coin</dt><dd>USDT · 1 USDT = $1</dd></div>
          <div><dt>Minimum</dt><dd>$${minUsd()}</dd></div>
          <div><dt>Binance ID</dt><dd>${escapeHtml(methods.BINANCE.account || "")}</dd></div>
          <div><dt>Send with</dt><dd>Binance Pay</dd></div>
          <div><dt>Confirmation</dt><dd><span class="dpx-sum-auto is-manual"><i></i>By our team</span></dd></div>
        </dl>
        <div class="dpx-help-support">${ICO_SUPPORT}<span>If your deposit is not added after some time, please <a href="#support">contact Support</a> with your Order ID.</span></div>`;
      return;
    }
    const usd = usdValue(), taka = usd > 0 ? takaFor(usd) : 0;
    const payer = normPayer($("dpx-payer").value);
    aside.innerHTML = `<h3>Summary</h3>
      <div class="dpx-sum-hero"><small>You send in bKash</small><b>${taka ? takaText(taka) : "৳0"}</b><span>${usd >= minUsd() ? money(usd) + " goes to your wallet" : "Minimum deposit is $" + minUsd()}</span></div>
      <dl class="wd-sum-list">
        <div><dt>Rate</dt><dd>৳${Number(cfg.rate).toLocaleString("en-US", { maximumFractionDigits: 2 })} per $1</dd></div>
        <div><dt>Minimum</dt><dd>$${minUsd()}</dd></div>
        <div><dt>Send to</dt><dd>${escapeHtml(methods.BKASH.account || cfg.number)}</dd></div>
        <div><dt>Send from</dt><dd>${validPayer(payer) ? escapeHtml(payer) : "—"}</dd></div>
        <div><dt>How</dt><dd>Send Money</dd></div>
        <div><dt>Confirmation</dt><dd><span class="dpx-sum-auto ${cfg.auto ? "" : "is-manual"}"><i></i>${cfg.auto ? "Automatic" : "By our team"}</span></dd></div>
      </dl>
      <div class="dpx-help-support">${ICO_SUPPORT}<span>If your deposit is not confirmed, please <a href="#support">contact Support</a> with your TrxID.</span></div>`;
  }

  async function submitBkash(){
    const errEl = $("dep-err");
    showErr("dep-err", "");
    if(!methods.BKASH.is_open){ showErr("dep-err", "bKash is closed right now. Please try again later."); return; }
    const payer = normPayer($("dpx-payer").value);
    const usd = usdValue();
    const trx = normTrx($("dpx-trx").value);
    let bad = false;
    if(!stepOk(1)){ goStep(1); return; }
    if(!validTrx(trx)){ showErr("dpx-trx-err", "Enter the TrxID from bKash. It is about 10 letters and numbers, like BKA5JX2Z9P."); bad = true; }
    if(bad){ $("dpx-trx").focus(); return; }
    const taka = takaFor(usd);
    const go = await ConfirmSheet.open({
      icon: "deposit",
      title: "Confirm your bKash deposit",
      lead: "We match your TrxID with the bKash message and add the money to your wallet.",
      rows: [
        { label: "You sent", value: takaText(taka) },
        { label: "From", value: payer, mono: true },
        { label: "To", value: methods.BKASH.account || cfg.number, mono: true },
        { label: "TrxID", value: trx, mono: true }
      ],
      total: { label: "Added to your wallet", value: money(usd) },
      note: "Only confirm after you have sent the money with Send Money.",
      confirm: "Confirm deposit"
    });
    if(!go) return;
    const btn = $("dep-submit");
    btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner"></span>';
    const { data, error } = await supabase.rpc("submit_bkash_deposit", { p_usd: usd, p_payer: payer, p_trx: trx });
    btn.disabled = false; btn.querySelector(".btn-label").textContent = "Confirm deposit";
    if(error){
      errEl.textContent = error.message || "Couldn't send your deposit. Please try again.";
      errEl.style.display = "block";
      errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      loadMethods();
      return;
    }
    try{ localStorage.setItem(LS_PAYER, payer); }catch(_e){}
    $("dpx-trx").value = ""; $("dpx-trx").classList.remove("is-ok");
    goStep(1, true);
    DepVerify.open(data || {}, {
      onApproved: d => credited(d, true),          // money is in: update the balance at once
      onClose: () => { loadHistory(); }
    });
    if(data && data.status === "APPROVED") credited(data, true);
    loadHistory();
  }

  /* ---------- Binance flow (checked by the team) ---------- */
  async function submitBinance(){
    showErr("dep-err", ""); showErr("bnz-ref-err", "");
    if(!methods.BINANCE.is_open){ showErr("dep-err", "Binance is closed right now. Please try again later."); return; }
    if(!stepOk(1)){ goStep(1); return; }
    const amount = bnUsd();
    const reference = $("dep-reference").value.replace(/\s+/g, "");
    if(!/^[A-Za-z0-9-]{6,64}$/.test(reference)){
      showErr("bnz-ref-err", "Enter the Order ID from Binance (Pay › History).");
      $("dep-reference").focus();
      return;
    }
    const go = await ConfirmSheet.open({
      icon: "deposit",
      title: "Submit your Binance deposit",
      lead: "Our team checks your Order ID, then adds the money to your wallet.",
      rows: [
        { label: "You sent", value: usdtText(amount) },
        { label: "To Binance ID", value: methods.BINANCE.account, mono: true },
        { label: "Sent with", value: "Binance Pay" },
        { label: "Order ID", value: reference, mono: true }
      ],
      total: { label: "Added to your wallet", value: money(amount) },
      note: "Only submit after you have paid in Binance. Wrong or fake Order IDs are rejected.",
      confirm: "Submit deposit"
    });
    if(!go) return;
    const btn = $("dep-submit");
    btn.disabled = true; btn.querySelector(".btn-label").innerHTML = '<span class="spinner"></span>';
    const { error } = await supabase.from("deposit_requests").insert({ user_id: AppState.user.id, amount, method: "BINANCE", reference });
    btn.disabled = false; btn.querySelector(".btn-label").textContent = "Submit deposit";
    if(error){ showErr("dep-err", error.message || "Couldn't send your deposit. Please try again."); loadMethods(); return; }
    toast("Deposit sent. Our team will check it and add it to your wallet.", "success");
    $("bnz-usd").value = ""; $("dep-reference").value = ""; $("dep-reference").classList.remove("is-ok");
    goStep(1, true); bnQuote();
    loadHistory();
  }

  /* ---------- wallet + history ---------- */
  function refreshAvail(){
    const bal = money(AppState.wallet ? AppState.wallet.available_balance : 0);
    $("dep-avail-amount").textContent = bal;
    const wc = document.getElementById("wc-balance"); if(wc) wc.textContent = bal;
    const be = document.getElementById("bal-amount"); if(be && !/•/.test(be.textContent)) be.textContent = bal;
  }

  /* A deposit was confirmed: pull the new balance right away and show it. */
  const creditedIds = new Set();
  async function credited(d, quiet){
    if(d && d.id){ if(creditedIds.has(d.id)) return creditedP; creditedIds.add(d.id); }
    creditedP = creditedRun(d, quiet); return creditedP;
  }
  let creditedP = null;
  async function creditedRun(d, quiet){
    await refreshWallet(); refreshAvail();
    const b = document.querySelector("#page-deposit .wd-balance");
    if(b){ b.classList.remove("is-bump"); void b.offsetWidth; b.classList.add("is-bump"); }
    if(!quiet && d) toast(`${money(d.amount)} was added to your wallet.`, "success");
    loadHistory();
  }

  /* While a bKash deposit is waiting, keep checking so the money shows the moment it is confirmed. */
  function pageOpen(){ const pg = document.getElementById("page-deposit"); return !!pg && pg.style.display !== "none" && !document.hidden; }
  function watch(list){
    watchIds = list.filter(d => d.method === "BKASH" && d.status === "PENDING").map(d => d.id);
    if(!watchIds.length){ clearInterval(watchTimer); watchTimer = null; return; }
    if(watchTimer) return;
    watchTimer = setInterval(async () => {
      if(!watchIds.length){ clearInterval(watchTimer); watchTimer = null; return; }
      if(!pageOpen()) return;
      const { data } = await supabase.from("deposit_requests").select("id,status,amount").in("id", watchIds);
      (data || []).forEach(d => { if(d.status === "APPROVED") credited(d, false); });
      if((data || []).some(d => d.status !== "PENDING")) loadHistory();
    }, 4000);
  }

  function statusCell(d){
    if(d.status === "APPROVED") return `<span class="badge badge-green">Confirmed</span>${d.verified_by === "AUTO" ? `<span class="dpx-h-auto">${ICO_BOLT}Auto</span>` : ""}`;
    if(d.status === "REJECTED") return '<span class="badge badge-danger">Rejected</span>';
    if(d.method === "BKASH" && (d.auto_state === "WAITING_SMS" || d.auto_state === "WAIT_BALANCE")) return '<span class="badge badge-gold dpx-checking"><i></i>Checking</span>';
    return '<span class="badge badge-gold">Pending</span>';
  }
  function noteCell(d){
    if(d.status === "REJECTED") return escapeHtml(d.admin_note || "—");
    if(d.status === "APPROVED") return d.verified_by === "AUTO" ? "Confirmed from the bKash message" : escapeHtml(d.admin_note || "—");
    return `Not confirmed? <a href="#support">Contact Support</a>`;
  }

  async function loadHistory(){
    const wrap = $("dep-history");
    const { data, error } = await supabase.from("deposit_requests").select("*").eq("user_id", AppState.user.id).order("requested_at", { ascending: false });
    if(error){ wrap.innerHTML = `<div class="empty-state"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg> Couldn't load your deposits.</div>`; return; }
    paintPending((data || []).filter(d => d.status === "PENDING"));
    watch(data || []);
    if(!data || !data.length){ wrap.innerHTML = `<div class="empty-state"><div class="icon"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-banknote"/></svg></div>No deposits yet.</div>`; return; }
    wrap.innerHTML = `<table class="tbl"><thead><tr><th>Method</th><th>Amount</th><th>Transaction ID</th><th>Status</th><th>Date</th><th>Note</th></tr></thead><tbody>
      ${data.map(d => `<tr>
        <td><span class="pay-cell"><span class="pay-logo ${d.method === "BKASH" ? "pay-bkash-mark" : "pay-binance-mark"}" aria-hidden="true"></span>${d.method === "BKASH" ? "bKash" : "Binance"}</span></td>
        <td class="dpx-h-amt">${money(d.amount)}${d.taka_amount ? `<small>${takaText(d.taka_amount)}</small>` : ""}</td>
        <td>${escapeHtml(d.reference)}</td>
        <td>${statusCell(d)}</td>
        <td>${fmtDate(d.requested_at)}</td>
        <td class="dpx-h-note">${noteCell(d)}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }

  function paintPending(list){
    const box = $("dpx-pending"); if(!box) return;
    if(!list.length){ box.hidden = true; box.innerHTML = ""; return; }
    const total = list.reduce((s, d) => s + Number(d.amount || 0), 0);
    const checking = list.some(d => d.method === "BKASH" && (d.auto_state === "WAITING_SMS" || d.auto_state === "WAIT_BALANCE"));
    box.innerHTML = `<i class="dpx-pending-dot" aria-hidden="true"></i>
      <div class="dpx-pending-main">
        <b>${list.length === 1 ? "Your deposit of " + money(total) + " is being checked" : list.length + " deposits (" + money(total) + ") are being checked"}</b>
        <p>${checking ? "It is added to your wallet as soon as the bKash message reaches us." : "Our team is checking it."} If your deposit is not confirmed, please contact Support.</p>
      </div>
      <a class="btn btn-secondary" href="#support">Contact Support</a>`;
    box.hidden = false;
  }

  /* ---------- init ---------- */
  function init(){
    refreshAvail();
    try{ const p = localStorage.getItem(LS_PAYER); if(p) $("dpx-payer").value = p; }catch(_e){}
    paintMethods();
    setMethod(firstOpen());
    document.querySelectorAll("#dep-method-toggle .method-btn").forEach(b => b.addEventListener("click", () => setMethod(b.dataset.method)));

    $("dep-binance-flow").addEventListener("click", e => {
      const c = e.target.closest(".dpx-copy"); if(c){ if(c.dataset.copy) copyText(c.dataset.copy, c); return; }
      const chip = e.target.closest("[data-bnz-usd]");
      if(chip){ $("bnz-usd").value = chip.dataset.bnzUsd; bnQuote(); }
    });
    $("bnz-usd").addEventListener("input", bnQuote);
    $("bnz-usd").addEventListener("keydown", e => { if(e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault(); });
    $("dep-reference").addEventListener("input", () => {
      const v = $("dep-reference").value.replace(/\s+/g, "");
      const ok = /^[A-Za-z0-9-]{6,64}$/.test(v);
      $("dep-reference").classList.toggle("is-ok", ok);
      if(ok) showErr("bnz-ref-err", "");
    });
    $("dpx-flow").addEventListener("click", e => {
      const c = e.target.closest(".dpx-copy"); if(c){ copyText(c.dataset.copy || "", c); return; }
      const chip = e.target.closest("[data-dpx-usd]");
      if(chip){ $("dpx-usd").value = chip.dataset.dpxUsd; quote(); showErr("dpx-usd-err", ""); }
    });
    $("dpx-payer").addEventListener("input", paintPayer);
    $("dpx-payer").addEventListener("blur", () => {
      const d = normPayer($("dpx-payer").value);
      if(d && !validPayer(d)) showErr("dpx-payer-err", "Enter your 11-digit bKash number, like 01712345678.");
      else if(validPayer(d)) $("dpx-payer").value = d;
    });
    $("dpx-usd").addEventListener("input", quote);
    const trxIn = $("dpx-trx");
    trxIn.addEventListener("paste", e => {
      const t = (e.clipboardData || window.clipboardData) ? (e.clipboardData || window.clipboardData).getData("text") : "";
      if(!t) return;
      e.preventDefault();
      trxIn.value = normTrx(t);
      trxIn.dispatchEvent(new Event("input"));
    });
    trxIn.addEventListener("input", () => {
      const v = normTrx(trxIn.value);
      if(trxIn.value !== v) trxIn.value = v;
      trxIn.classList.toggle("is-ok", validTrx(v));
      if(validTrx(v)) showErr("dpx-trx-err", "");
    });

    $("dpz-next").addEventListener("click", () => { if(step < 3) goStep(step + 1); });
    $("dpz-back").addEventListener("click", () => { if(step > 1) goStep(step - 1); });
    ["dpz-track", "bnz-track"].forEach(id => $(id).addEventListener("click", e => {
      const li = e.target.closest("li[data-go]"); if(!li) return;
      const n = Number(li.dataset.go); if(n < step) goStep(n);
    }));
    $("dpx-usd").addEventListener("keydown", e => { if(e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault(); });

    $("dep-form").addEventListener("submit", e => {
      e.preventDefault();
      if(step < 3){ goStep(step + 1); return; }
      if(method === "BKASH") submitBkash(); else submitBinance();
    });

    loadMethods();
    loadHistory();
  }

  async function onActivate(){ await refreshWallet(); refreshAvail(); loadMethods(); loadHistory(); }

  return { init, onActivate };
})();

/* ---------------- "Checking your payment" sheet (bKash auto deposit) ---------------- */
const DepVerify = (function(){
  let root = null, timer = null, started = 0, dep = null, cb = {}, state = "";
  const WAIT_MS = 120000;

  function build(){
    root = document.createElement("div");
    root.className = "dpv"; root.id = "dep-verify"; root.hidden = true;
    root.innerHTML = `
      <div class="dpv-scrim"></div>
      <div class="dpv-card" role="dialog" aria-modal="true" aria-labelledby="dpv-title" aria-live="polite">
        <div class="dpv-orb" aria-hidden="true">
          <span class="dpv-core"><span class="pay-logo pay-bkash-mark"></span>
            <svg class="dpv-i-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <svg class="dpv-i-wait" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </span>
        </div>
        <p class="dpv-kicker" id="dpv-kicker">bKash deposit</p>
        <h3 id="dpv-title">Checking your payment</h3>
        <p class="dpv-lead" id="dpv-lead"></p>
        <div class="dpv-amt"><b id="dpv-usd">$0.00</b><span id="dpv-sub"></span></div>
        <ol class="dpv-steps" id="dpv-steps">
          <li data-s="1"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></i>Deposit request saved</li>
          <li data-s="2"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></i>bKash message matched<small id="dpv-clock"></small></li>
          <li data-s="3"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></i>Added to your wallet</li>
        </ol>
        <div class="dpv-help" id="dpv-help" hidden><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-message"/></svg><span id="dpv-help-text"></span></div>
        <div class="dpv-actions" id="dpv-actions">
          <a class="btn btn-secondary" id="dpv-support" href="#support" hidden>Contact Support</a>
          <button type="button" class="btn btn-primary" id="dpv-ok">Keep this open</button>
        </div>
        <p class="dpv-foot" id="dpv-foot">You can close this. We keep checking and add it to your wallet automatically.</p>
      </div>`;
    document.body.appendChild(root);
    root.querySelector("#dpv-ok").addEventListener("click", close);
    root.querySelector("#dpv-support").addEventListener("click", () => close());
    root.addEventListener("keydown", e => { if(e.key === "Escape") close(); });
  }

  function steps(s2, s3){
    const li = root.querySelectorAll("#dpv-steps li");
    li[0].className = "is-done";
    li[1].className = s2; li[2].className = s3;
  }

  function setState(next){
    state = next;
    root.classList.remove("is-ok", "is-wait", "is-review");
    const $q = id => root.querySelector("#" + id);
    const help = $q("dpv-help"), sup = $q("dpv-support"), ok = $q("dpv-ok"), acts = $q("dpv-actions"), foot = $q("dpv-foot");
    if(next === "ok"){
      root.classList.add("is-ok");
      $q("dpv-kicker").textContent = "Payment received";
      $q("dpv-title").textContent = "Deposit confirmed";
      $q("dpv-lead").textContent = "The money is in your wallet now. You can use it right away.";
      steps("is-done", "is-done"); $q("dpv-clock").textContent = "";
      help.hidden = true; sup.hidden = true; ok.textContent = "Done"; acts.classList.remove("two"); foot.hidden = true;
    } else if(next === "wait" || next === "review"){
      root.classList.add(next === "wait" ? "is-wait" : "is-review");
      $q("dpv-kicker").textContent = "Deposit saved";
      $q("dpv-title").textContent = next === "wait" ? "Still waiting for bKash" : "Our team will check it";
      $q("dpv-lead").textContent = next === "wait"
        ? "We have not received the bKash message for this TrxID yet. It is added to your wallet as soon as it arrives."
        : "Something did not match automatically (amount, number or TrxID). Our team will check it soon.";
      steps("is-wait", ""); $q("dpv-clock").textContent = "";
      $q("dpv-help-text").innerHTML = "If your deposit is not confirmed, please <b>contact Support</b> with your TrxID.";
      help.hidden = false; sup.hidden = false; ok.textContent = "OK"; acts.classList.add("two"); foot.hidden = true;
    } else {
      $q("dpv-kicker").textContent = "bKash deposit";
      $q("dpv-title").textContent = "Checking your payment";
      $q("dpv-lead").textContent = "We are matching your TrxID with the bKash message. This usually takes less than a minute.";
      steps("is-on", ""); help.hidden = true; sup.hidden = true; ok.textContent = "Close"; acts.classList.remove("two"); foot.hidden = false;
    }
  }

  function apply(d){
    if(!d) return;
    if(d.status === "APPROVED"){
      stop();
      if(state !== "ok"){
        setState("ok");
        const r = cb.onApproved ? cb.onApproved(Object.assign({}, dep, d)) : null;
        Promise.resolve(r).then(() => {
          const bal = AppState.wallet ? Number(AppState.wallet.available_balance) : 0;
          if(bal > 0 && state === "ok") root.querySelector("#dpv-lead").textContent = "The money is in your wallet now. New balance: " + money(bal) + ".";
        });
      }
      return;
    }
    if(d.status === "REJECTED"){ stop(); setState("review"); root.querySelector("#dpv-title").textContent = "Deposit not accepted";
      root.querySelector("#dpv-lead").textContent = d.admin_note ? d.admin_note : "Please contact Support if you think this is a mistake."; return; }
    const st = d.auto_state || d.state;
    if(st === "REVIEW" || !st){ setState("review"); slow(); return; }
    if(Date.now() - started > WAIT_MS){ if(state !== "wait") setState("wait"); slow(); return; }
    if(state !== "checking") setState("checking");
  }

  function tick(){
    if(!dep || !dep.id) return;
    const left = Math.max(0, Math.round((Date.now() - started) / 1000));
    const clock = root.querySelector("#dpv-clock");
    if(state === "checking" && clock) clock.textContent = left + "s";
  }

  async function poll(){
    if(!dep || !dep.id) return;
    tick();
    const { data } = await supabase.from("deposit_requests").select("id,status,auto_state,amount,taka_amount,reference,admin_note").eq("id", dep.id).maybeSingle();
    if(data){ dep = Object.assign(dep, data); apply(data); }
  }
  let slowMode = false;
  function slow(){ if(slowMode) return; slowMode = true; clearInterval(timer); timer = setInterval(poll, 8000); }
  function stop(){ clearInterval(timer); timer = null; }

  function open(d, done){
    if(!root) build();
    dep = d || {}; cb = typeof done === "function" ? { onClose: done } : (done || {}); started = Date.now(); slowMode = false; state = "";
    root.querySelector("#dpv-usd").textContent = money(dep.amount || 0);
    root.querySelector("#dpv-sub").textContent = (dep.taka ? "৳" + Number(dep.taka).toLocaleString("en-US") + " · " : "") + "TrxID " + (dep.trx || "");
    setState("checking");
    root.hidden = false;
    document.documentElement.classList.add("dpv-lock");
    requestAnimationFrame(() => root.classList.add("is-open"));
    apply({ status: dep.status, auto_state: dep.state });
    stop();
    if(dep.status !== "APPROVED"){ timer = setInterval(poll, 2500); setTimeout(poll, 1200); }
    setTimeout(() => { const b = root.querySelector("#dpv-ok"); if(b) b.focus(); }, 60);
  }

  function close(){
    if(!root || root.hidden) return;
    stop();
    root.classList.remove("is-open");
    document.documentElement.classList.remove("dpv-lock");
    setTimeout(() => { root.hidden = true; }, 260);
    if(cb.onClose) cb.onClose();
  }

  return { open, close };
})();


/* ---------------- Module: Mailbox ---------------- */
/* shared look for a message: its kind, the team's mark, times, text with links */
const MailLook = {
  kind(m){
    const k = String((m && m.kind) || "").toUpperCase();
    if(/^LEADER_/.test(k)) return "Leadership";
    if(/WITHDRAW/.test(k)) return "Withdrawal";
    if(/DEPOSIT/.test(k)) return "Deposit";
    if(/VERIF/.test(k)) return "Verification";
    if(/TASK|SURVEY/.test(k)) return "Survey";
    return "Notice";
  },
  avatar(){
    const src = typeof getSiteLogoSrc === "function" ? getSiteLogoSrc() : "";
    return src ? `<img src="${escapeHtml(src)}" alt="">` : "RV";
  },
  dayKey(d){ const t = new Date(d); return t.getFullYear() + "-" + t.getMonth() + "-" + t.getDate(); },
  group(d){
    const t = new Date(d), now = new Date();
    const day = 86400000, start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if(t.getTime() >= start) return "Today";
    if(t.getTime() >= start - day) return "Yesterday";
    if(t.getTime() >= start - 6 * day) return "This week";
    return "Earlier";
  },
  short(d){
    const t = new Date(d), g = MailLook.group(d);
    if(g === "Today") return t.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
    if(g === "Yesterday") return "Yesterday";
    if(g === "This week") return t.toLocaleDateString("en-US", { weekday:"short" });
    return t.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  },
  long(d){
    const t = new Date(d);
    return t.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) + " at " + t.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  },
  preview(m){ return String((m && m.body) || "").replace(/\s+/g, " ").trim().slice(0, 140); },
  /** plain text with safe links */
  body(text){
    return escapeHtml(String(text || "")).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  }
};

Modules.mailbox = (function(){
  let wired = false, all = [], shown = [], current = null, filter = "all", lastRead = 0, opened = new Set();
  const stamp = v => { const t = v ? new Date(v).getTime() : 0; return isNaN(t) ? 0 : t; };
  const isNew = m => stamp(m.created_at) > lastRead && !opened.has(m.id);

  function paintCounts(){
    const n = all.filter(isNew).length;
    document.getElementById("mbx-n-all").textContent = all.length ? String(all.length) : "";
    document.getElementById("mbx-n-new").textContent = n ? String(n) : "";
    document.getElementById("mbx-sub").textContent = !all.length ? "No messages yet."
      : n ? `${n} new · ${all.length} ${all.length === 1 ? "message" : "messages"}` : `All read · ${all.length} ${all.length === 1 ? "message" : "messages"}`;
    paintMailCount(all.filter(m => stamp(m.created_at) > lastRead).length);
  }
  function paintList(){
    const list = document.getElementById("mailbox-list");
    shown = filter === "new" ? all.filter(isNew) : all.slice();
    if(!shown.length){
      list.innerHTML = `<div class="mbx-none"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-mail-open"/></svg><b>${filter === "new" ? "You're all caught up" : "Your mailbox is empty"}</b><span>${filter === "new" ? "There are no new messages." : "Notices from the team will appear here."}</span></div>`;
      return;
    }
    let html = "", last = "";
    shown.forEach(m => {
      const g = MailLook.group(m.created_at);
      if(g !== last){ html += `<p class="mbx-group">${g}</p>`; last = g; }
      const lead = /^LEADER_/.test(m.kind || "") && m.meta && window.Leadership ? Leadership.chip((m.meta && m.meta.level) || 1) : "";
      html += `<button type="button" class="mbx-item${isNew(m) ? " is-new" : ""}${current && current.id === m.id ? " is-open" : ""}" data-mail-id="${escapeHtml(m.id)}">
        <span class="mbx-item-top"><span class="mbx-item-kind">${MailLook.kind(m)}</span><time>${MailLook.short(m.created_at)}</time></span>
        <b class="mbx-item-title">${lead}${escapeHtml(m.title || "Message")}</b>
        <span class="mbx-item-text">${escapeHtml(MailLook.preview(m))}</span>
      </button>`;
    });
    list.innerHTML = html;
  }
  async function load(){
    const list = document.getElementById("mailbox-list");
    if(!list) return;
    const { data, error } = await supabase.from("mailbox_messages").select("*").order("created_at", { ascending:false }).limit(100);
    if(error){ list.innerHTML = '<div class="mbx-none"><svg class="icon-glyph" viewBox="0 0 24 24"><use href="#i-warning"/></svg><b>Could not load your mailbox</b><span>Please check your connection and try again.</span></div>'; return; }
    all = data || [];
    lastRead = stamp(AppState.profile && AppState.profile.mailbox_last_read_at);
    if(current) current = all.find(m => m.id === current.id) || null;
    paintCounts(); paintList();
    if(!current) showEmpty();
  }
  function showEmpty(){
    document.getElementById("mbx-doc").hidden = true;
    document.getElementById("mbx-empty").hidden = false;
    document.getElementById("mbx").classList.remove("is-reading");
  }
  async function open(m){
    if(!m) return;
    current = m;
    opened.add(m.id);
    document.getElementById("mbx-kind").textContent = MailLook.kind(m);
    document.getElementById("mailbox-reader-title").textContent = m.title || "Message";
    document.getElementById("mailbox-reader-date").textContent = MailLook.long(m.created_at);
    document.getElementById("mbx-av").innerHTML = MailLook.avatar();
    document.getElementById("mailbox-reader-body").innerHTML = MailLook.body(m.body);
    const leadHead = document.getElementById("mailbox-reader-head"); if(leadHead) leadHead.innerHTML = window.Leadership ? Leadership.mailHead(m) : "";
    const i = shown.findIndex(x => x.id === m.id);
    document.getElementById("mbx-pos").textContent = i >= 0 && shown.length > 1 ? `${i + 1} of ${shown.length}` : "";
    document.getElementById("mbx-prev").disabled = i <= 0;
    document.getElementById("mbx-next").disabled = i < 0 || i >= shown.length - 1;
    document.getElementById("mbx-empty").hidden = true;
    const doc = document.getElementById("mbx-doc");
    doc.hidden = false;
    document.getElementById("mailbox-reader").scrollTop = 0;
    doc.classList.remove("is-swap"); void doc.offsetWidth; doc.classList.add("is-swap");
    document.getElementById("mbx").classList.add("is-reading");
    paintCounts(); paintList();
    if(window.matchMedia("(max-width: 880px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    // read up to this message (newer messages stay new)
    const t = stamp(m.created_at);
    if(t > stamp(AppState.profile && AppState.profile.mailbox_last_read_at)){
      const iso = new Date(t).toISOString();
      if(AppState.profile) AppState.profile.mailbox_last_read_at = iso;
      await supabase.from("profiles").update({ mailbox_last_read_at: iso, updated_at: new Date().toISOString() }).eq("id", AppState.user.id);
    }
    paintMailCount(all.filter(x => stamp(x.created_at) > stamp(AppState.profile && AppState.profile.mailbox_last_read_at)).length);
  }
  function step(dir){
    const i = shown.findIndex(x => current && x.id === current.id);
    const n = shown[i + dir];
    if(n) open(n);
  }
  function wire(){
    if(wired) return; wired = true;
    document.getElementById("mailbox-list").addEventListener("click", e => {
      const b = e.target.closest("[data-mail-id]"); if(!b) return;
      open(all.find(x => x.id === b.dataset.mailId));
    });
    document.getElementById("mailbox-reader-close").addEventListener("click", () => { current = null; showEmpty(); paintList(); });
    document.getElementById("mbx-prev").addEventListener("click", () => step(-1));
    document.getElementById("mbx-next").addEventListener("click", () => step(1));
    document.querySelectorAll("[data-mbx-filter]").forEach(b => b.addEventListener("click", () => {
      filter = b.dataset.mbxFilter;
      document.querySelectorAll("[data-mbx-filter]").forEach(x => x.classList.toggle("active", x === b));
      paintList();
    }));
    document.getElementById("page-mailbox").addEventListener("keydown", e => {
      if(!current || /input|textarea/i.test(e.target.tagName)) return;
      if(e.key === "ArrowUp" || e.key === "k"){ e.preventDefault(); step(-1); }
      if(e.key === "ArrowDown" || e.key === "j"){ e.preventDefault(); step(1); }
    });
  }
  function init(){ wire(); load(); }
  async function onActivate(){ wire(); if(typeof MailPop !== "undefined" && MailPop.isOpen) MailPop.close(); opened = new Set(); load(); }
  return { init, onActivate, open: id => open(all.find(x => x.id === id)) };
})();

/* ---------------- Module: Support Chat ---------------- */
Modules.support = (function(){
  let wired = false, timer = null, server = [], loaded = false, typing = false, sending = null;
  const $ = id => document.getElementById(id);
  const visible = () => { const p = $("page-support"); return !!p && p.style.display !== "none" && !document.hidden; };
  const team = () => ({ logo: getSiteLogoSrc() });

  // ---------- quick answers: common questions get an instant answer (kept on this device only) ----------
  const FAQ = {
    verify:   ["How do I verify my account?",
               "Open Profile and scroll to Account verification. It's a one-time $20, paid from your wallet balance. If your balance is under $20, add money on the Deposit page first. As soon as you pay, your account is verified and the Survey page opens."],
    deposit:  ["How do I add money?",
               "Go to Deposit and pick Binance or bKash (only use a method marked Open). Send the money to the account shown there, then enter the amount and the transaction ID and submit. We check it and add it to your wallet. You can follow it in your deposit history."],
    withdraw: ["How do withdrawals work?",
               "Open Withdraw, pick Binance or bKash, then enter your account and the amount. The minimum is $1.00 and a 10% fee comes off each withdrawal. Tick the robot check and confirm. Your request shows as Pending until our team sends it."],
    pending:  ["My withdrawal is still pending",
               "Withdrawals are sent by our team one by one, so it can take a little while. You can see the status on the Withdraw page. If it feels too long, send us the amount and the date here and we'll look into it."],
    transfer: ["How do I send money to another member?",
               "Open Withdraw and tap Balance transfer. Enter their wallet number (it starts with SSW-), the amount and a note if you like. You'll see their name before you confirm. Transfers are instant and can't be undone, so double-check the number."],
    referral: ["How does the referral program work?",
               "Copy your link from Profile → Your referral link and share it. When someone you invited verifies their account, you get $3.50. When someone they invite verifies, you get $2.00. Get 10 people verified and you become a leader."],
    leader:   ["How do I become a leader?",
               "Get 10 people you invited verified and you become a Bronze Leader. There are 5 levels: Bronze (10), Silver (25), Gold (50), Platinum (100) and Diamond (200 verified referrals). For each person you invite who verifies, $0.80 is set aside and paid to you when you reach your next level. Leaders also share the Leader Pool every month, 2 days before the month ends, and higher levels get bigger shares. You can follow your progress on your Profile."],
    password: ["I forgot my password",
               "Log out, tap Log in, then Forgot password? Enter your email and we'll send you a code to set a new password. If it doesn't show up in a minute, check your Spam folder."],
    rejected: ["Why was my submission sent back?",
               "Usually it's one of these: the screenshot doesn't clearly show the finished task, a step in the brief was missed, or the same proof was used before. Open the task again, read the brief, and send a clear screenshot. If you think it's a mistake, tell us here."],
    vip:      ["What does a VIP account include?",
               "Your VIP account is verified for free, so you never pay the $20. It is made for inviting people, not for tasks. Share your link from Refer & Earn or Profile. You get $3.50 when someone you invited verifies, $2.00 when someone they invite verifies. With 10 verified referrals you also become a leader. You can withdraw from $1.00 to Binance or bKash."],
    human:    ["Talk to our team",
               "Sure. Type your message below and someone from our team will reply right here. Please don't share your password or any code."],
  };
  const AUTO_KEY = "srv_support_auto";
  let auto = (() => { try{ return JSON.parse(sessionStorage.getItem(AUTO_KEY) || "[]"); }catch(e){ return []; } })();
  const saveAuto = () => { try{ sessionStorage.setItem(AUTO_KEY, JSON.stringify(auto.slice(-40))); }catch(e){} };

  function items(){
    const t = team();
    const list = server.map(m => {
      const mine = m.sender === "USER";
      return { id: m.id, who: mine ? "me" : "team", mine, name: "Support team", avatar: t, text: m.body, at: m.created_at,
               status: mine ? (m.read_by_admin ? "seen" : "sent") : null };
    });
    if(sending) list.push({ id: "sending", who: "me", mine: true, text: sending.text, at: sending.at, status: "sending" });
    auto.forEach((m, i) => list.push({ id: "auto" + i, who: m.kind === "q" ? "me" : "auto", mine: m.kind === "q", auto: m.kind === "a", name: "Support team", avatar: t, text: m.body, at: m.at }));
    return list.sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  function render(bottom){
    const box = $("sc-scroll"); if(!box) return;
    const list = items();
    if(!list.length && !typing){
      ChatKit.paint(box, ChatKit.empty("i-message", "Start a conversation", "Ask about your account, a payment or a task. Our team replies right here."), { key: "empty" });
      return;
    }
    const key = list.map(m => m.id + ":" + (m.status || "")).join("|") + (typing ? "|typing" : "");
    ChatKit.paint(box, ChatKit.render(list) + (typing ? ChatKit.typing(team()) : ""), { key, bottom });
  }

  async function load(){
    const { data, error } = await supabase.rpc("get_my_support_messages", { p_limit: 200 });
    if(error){
      if(!loaded) ChatKit.paint($("sc-scroll"), ChatKit.empty("i-warning", "We couldn't load your chat", "Check your connection, then open this page again."), { key: "error" });
      return;
    }
    loaded = true;
    server = Array.isArray(data) ? data : [];
    render();
    if(visible() && server.some(m => m.sender === "ADMIN" && !m.read_by_user)){
      const r = await supabase.rpc("mark_my_support_messages_read");
      if(!r.error){ server.forEach(m => { if(m.sender === "ADMIN") m.read_by_user = true; }); refreshSupportBadge(); }
    }
  }

  function chipsOff(off){ document.querySelectorAll("#page-support [data-faq]").forEach(b => { b.disabled = off; }); }
  async function askFaq(key){
    const item = FAQ[key];
    if(!item || typing) return;
    typing = true; chipsOff(true);
    auto.push({ kind: "q", body: item[0], at: new Date().toISOString() }); saveAuto(); render(true);
    await new Promise(r => setTimeout(r, 650 + Math.min(900, item[1].length * 4)));
    auto.push({ kind: "a", body: item[1], at: new Date().toISOString() }); saveAuto();
    typing = false; chipsOff(false); render(true);
    if(key === "human"){ const i = $("sc-input"); if(i) i.focus({ preventScroll: true }); }
  }

  async function send(text){
    sending = { text, at: new Date().toISOString() }; render(true);
    const { error } = await supabase.from("support_messages").insert({ user_id: AppState.user.id, sender: "USER", body: text, read_by_admin: false, read_by_user: true });
    sending = null;
    if(error){ render(); toast(String(error.message || "Your message wasn't sent. Please try again.").replace(/^Postgres error:\s*/i, ""), "error"); return false; }
    await load(); render(true);
    return true;
  }

  function size(){
    ChatKit.fill($("sc-chat"), { gap: 20, min: 460 });
    const b = $("sc-scroll"); if(b) requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; });
  }
  function wire(){
    if(wired) return; wired = true;
    const ava = $("sc-head-ava"), src = getSiteLogoSrc();
    if(ava && src) ava.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
    document.querySelectorAll("#page-support [data-faq]").forEach(b => b.addEventListener("click", () => askFaq(b.dataset.faq)));
    ChatKit.composer($("sc-form"), send);
    window.addEventListener("resize", () => { if(visible()) ChatKit.fill($("sc-chat"), { gap: 20, min: 460 }); });
  }
  function init(){
    wire(); size(); render(); load();
    if(!timer) timer = setInterval(() => { if(AppState.user && visible()) load(); }, 5000);
  }
  function onActivate(){ wire(); size(); load(); }
  return { init, onActivate, load };
})();

// a dot next to "Support Chat" when the team has written back
async function refreshSupportBadge(){
  if(!AppState.user || AppState.isAdmin) return;
  const { count, error } = await supabase.from("support_messages").select("id", { count: "exact", head: true })
    .eq("user_id", AppState.user.id).eq("sender", "ADMIN").eq("read_by_user", false);
  if(error) return;
  const dot = document.getElementById("support-nav-dot");
  if(dot) dot.style.display = Number(count) > 0 ? "" : "none";
}


Modules.leaderboard = {
  initialized:false,
  init(){ this.initialized=true; wireLeaderboard(); loadLeaderboard(); },
  onActivate(){ wireLeaderboard(); loadLeaderboard(); }
};

/* ---------------- Module: Live Chat (community room + private chat with the team) ---------------- */
Modules.livechat = (function(){
  let wired = false, timer = null, st = null, wasOpen = null, msgs = [], editing = null;
  let invite = null, tab = "room", pmsgs = [], seenTeam = -1;
  const $ = id => document.getElementById(id);
  const visible = () => { const p = $("page-livechat"); return !!p && p.style.display !== "none" && !document.hidden; };
  const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const PEN = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.8 4.2a1.8 1.8 0 0 1 2.6 2.6l-8.6 8.6-3.3.7.7-3.3Z"/></svg>';
  const LOCK = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

  // ---------- opening hours (Bangladesh time, from the server) ----------
  const toMin = hhmm => { const p = String(hhmm || "0:0").split(":").map(Number); return p[0] * 60 + (p[1] || 0); };
  const t12 = hhmm => { const p = String(hhmm || "00:00").split(":").map(Number); if(!p[0] && !p[1]) return "midnight"; return ((p[0] % 12) || 12) + ":" + String(p[1] || 0).padStart(2, "0") + " " + (p[0] >= 12 ? "PM" : "AM"); };
  function clock(){
    const s = st && st.dhaka_now; if(!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); if(!m) return null;
    return { dow: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(), min: +m[4] * 60 + +m[5] };
  }
  const hours = () => (st && Array.isArray(st.hours)) ? st.hours : [];
  const dayRow = d => hours().find(h => Number(h.day) === d);
  function nextOpen(){
    const c = clock(); if(!c) return null;
    for(let k = 0; k < 8; k++){
      const d = (c.dow + k) % 7, h = dayRow(d);
      if(!h || !h.enabled) continue;
      if(k === 0 && toMin(h.open) <= c.min) continue;
      return { k, d, open: h.open };
    }
    return null;
  }
  function closesAt(){
    const c = clock(); if(!c) return null;
    const y = dayRow((c.dow + 6) % 7);
    if(y && y.enabled && toMin(y.open) > toMin(y.close) && c.min < toMin(y.close)) return y.close;   // opened yesterday, runs past midnight
    const h = dayRow(c.dow);
    return h && h.enabled ? h.close : null;
  }
  function whenText(n){ return n ? (n.k === 0 ? "today" : n.k === 1 ? "tomorrow" : "on " + DAY[n.d]) + " at " + t12(n.open) : ""; }
  function hoursList(){
    const c = clock();
    return `<ul class="lc-hours">${[0,1,2,3,4,5,6].map(d => {
      const h = dayRow(d);
      return `<li class="${c && c.dow === d ? "is-today" : ""}"><span>${DAY[d]}</span><span>${h && h.enabled ? t12(h.open) + " – " + t12(h.close) : "Closed"}</span></li>`;
    }).join("")}</ul>`;
  }

  // ---------- the room ----------
  function setPill(text, kind){ const p = $("lc-status"); if(!p) return; p.className = "ck-pill" + (kind ? " is-" + kind : ""); p.innerHTML = `<i></i><span>${escapeHtml(text)}</span>`; }
  function lock(html){ const l = $("lc-lock"), f = $("lc-form"); if(!l || !f) return; l.hidden = !html; l.innerHTML = html ? LOCK + `<span>${html}</span>` : ""; const was = f.hidden; f.hidden = !!html; if(was && !f.hidden && f.ckFit) f.ckFit(); }

  function paintState(err){
    const sub = $("lc-sub"), box = $("lc-scroll");
    if(err){
      setPill("Unavailable"); sub.textContent = "We couldn't reach Live Chat. Please try again in a moment.";
      lock("Live Chat isn't available right now."); $("lc-pin").hidden = true;
      ChatKit.paint(box, ChatKit.empty("i-warning", "Live Chat isn't available", "Please check your connection and try again."), { key: "err" });
      return;
    }
    const n = nextOpen(), until = closesAt();
    if(st.open && !st.blocked){
      setPill("Live now", "live");
      sub.textContent = (until ? "Open until " + t12(until) + " · " : "") + "Everyone in the room can read what you write.";
      lock("");
    } else if(st.open && st.blocked){
      setPill("Read only", "warn");
      sub.textContent = "You can read the chat, but you can't post right now.";
      lock(`You can't post in Live Chat right now. If you think this is a mistake, <a href="#support">write to Support</a>.`);
    } else {
      setPill("Closed");
      sub.textContent = n ? "Opens " + whenText(n) + " (Bangladesh time)." : "Closed for now.";
      lock(st.blocked ? `You can't post in Live Chat right now. If you think this is a mistake, <a href="#support">write to Support</a>.` : "You can write here when Live Chat opens.");
      $("lc-pin").hidden = true;
      ChatKit.paint(box, `<div class="lc-closed"><span class="lc-closed-ico">${CLOCK}</span><b>Live Chat is closed right now</b><p>${n ? "It opens again " + escapeHtml(whenText(n)) + ". Times are Bangladesh time." : "It opens again at the set times."}</p>${hours().length ? hoursList() : ""}</div>`, { key: "closed-" + (n ? n.k + n.open : "") + (clock() ? clock().dow : "") });
    }
  }

  function roomItems(){
    const me = AppState.user && AppState.user.id;
    const canEdit = st && st.open && !st.blocked;
    return msgs.filter(m => !m.is_deleted).map(m => {
      const team = m.sender_role === "ADMIN", mine = !team && m.user_id === me;
      return {
        id: m.id, who: team ? "team" : (m.user_id || m.id), mine,
        name: team ? "Repuven" : (m.full_name || "Member"), badge: team ? "Team" : null,
        avatar: team ? { logo: getSiteLogoSrc() } : { name: m.full_name || "Member", url: m.avatar_url },
        text: m.body, at: m.created_at, edited: !!m.edited_at,
        tools: mine && canEdit ? `<div class="ck-tools"><button type="button" class="ck-tool" data-lc-edit="${escapeHtml(m.id)}" title="Edit" aria-label="Edit message">${PEN}</button></div>` : ""
      };
    });
  }
  function paintRoom(bottom){
    if(editing) return;   // don't redraw under someone who is editing
    const box = $("lc-scroll"), list = roomItems();
    const pinned = msgs.filter(m => m.is_pinned && !m.is_deleted).pop();
    $("lc-pin").hidden = !pinned;
    if(pinned) $("lc-pin-text").textContent = pinned.body;
    const key = "room|" + list.map(m => m.id + (m.edited ? "e" : "") + m.text.length + (m.tools ? "t" : "")).join("|");
    ChatKit.paint(box, list.length ? ChatKit.render(list, { names: true }) : ChatKit.empty("i-message", "No messages yet", "Say hello and start the conversation."), { key, bottom });
  }
  async function loadRoom(bottom){
    const { data, error } = await supabase.rpc("get_live_chat_messages_v2", { p_limit: 300 });
    if(error) return;
    msgs = Array.isArray(data) ? data : [];
    paintRoom(bottom);
  }
  function startEdit(id){
    const m = msgs.find(x => x.id === id), row = document.querySelector(`#lc-scroll .ck-row[data-mid="${CSS.escape(id)}"]`);
    if(!m || !row) return;
    editing = id;
    const bubble = row.querySelector(".ck-bubble");
    bubble.innerHTML = `<div class="ck-edit"><textarea maxlength="2000" aria-label="Edit your message">${escapeHtml(m.body)}</textarea><div class="ck-edit-row"><button type="button" class="is-cancel">Cancel</button><button type="button" class="is-save">Save</button></div></div>`;
    const ta = bubble.querySelector("textarea"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const done = () => { editing = null; $("lc-scroll").dataset.ckKey = ""; paintRoom(); };
    bubble.querySelector(".is-cancel").onclick = done;
    ta.addEventListener("keydown", e => { if(e.key === "Escape") done(); if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); bubble.querySelector(".is-save").click(); } });
    bubble.querySelector(".is-save").onclick = async () => {
      const body = ta.value.trim(); if(!body){ ta.focus(); return; }
      if(body === m.body){ done(); return; }
      const b = bubble.querySelector(".is-save"); b.disabled = true; b.textContent = "Saving…";
      const { error } = await supabase.rpc("edit_live_chat_group_message", { p_message_id: id, p_body: body });
      if(error){ b.disabled = false; b.textContent = "Save"; toast(String(error.message || "Couldn't save your change.").replace(/^Postgres error:\s*/i, ""), "error"); return; }
      m.body = body; m.edited_at = new Date().toISOString(); done(); loadRoom();
    };
  }

  // ---------- private chat with the team ----------
  function paintTabs(){
    const accepted = invite && invite.status === "ACCEPTED";
    $("lc-tabs").hidden = !accepted;
    if(!accepted && tab === "private") tab = "room";
    document.querySelectorAll("#lc-tabs [data-lc-tab]").forEach(b => b.classList.toggle("is-on", b.dataset.lcTab === tab));
    $("lc-room").hidden = tab !== "room";
    $("lc-private").hidden = tab !== "private";
    const pending = invite && invite.status === "PENDING";
    $("lc-invite").hidden = !pending;
    if(pending) $("lc-invite-msg").textContent = invite.message || "Tap Open private chat to start. Only you and our team will see it.";
  }
  async function loadInvite(){
    const { data, error } = await supabase.rpc("get_my_private_chat_invite");
    if(error) return;
    const inv = (Array.isArray(data) ? data[0] : data) || null;
    const was = invite && invite.id;
    invite = inv && (inv.status === "PENDING" || inv.status === "ACCEPTED") ? inv : null;
    if(!invite || invite.id !== was){ pmsgs = []; seenTeam = -1; }
    paintTabs();
    if(invite && invite.status === "ACCEPTED") await loadPrivate();
  }
  async function loadPrivate(bottom){
    if(!invite || invite.status !== "ACCEPTED") return;
    const { data, error } = await supabase.rpc("get_private_chat_messages", { p_invite_id: invite.id, p_limit: 300 });
    if(error) return;
    pmsgs = (Array.isArray(data) ? data : []).filter(m => !m.is_deleted);
    const me = AppState.user && AppState.user.id;
    const teamCount = pmsgs.filter(m => m.sender_id !== me).length;
    if(tab === "private" && visible()) seenTeam = teamCount;
    else if(seenTeam < 0) seenTeam = teamCount;
    $("lc-tab-dot").hidden = !(teamCount > seenTeam);
    const list = pmsgs.map(m => {
      const mine = m.sender_id === me;
      return { id: m.id, who: mine ? "me" : "team", mine, name: "Support team", avatar: { logo: getSiteLogoSrc() }, text: m.body, at: m.created_at, edited: !!m.edited_at };
    });
    const key = "p|" + list.map(m => m.id + (m.edited ? "e" : "")).join("|");
    ChatKit.paint($("lc-pscroll"), list.length ? ChatKit.render(list) : ChatKit.empty("i-message", "Your private chat is open", "Write your message below. Only you and our team can read it."), { key, bottom });
  }
  async function answerInvite(yes){
    if(!invite) return;
    const btns = [$("lc-invite-yes"), $("lc-invite-no")]; btns.forEach(b => { b.disabled = true; });
    const { error } = await supabase.rpc("respond_private_chat_invite", { p_invite_id: invite.id, p_accept: yes });
    btns.forEach(b => { b.disabled = false; });
    if(error){ toast(String(error.message || "Please try again.").replace(/^Postgres error:\s*/i, ""), "error"); return; }
    if(!yes){ invite = null; paintTabs(); return; }
    tab = "private"; await loadInvite(); fit();
  }

  // ---------- refresh ----------
  async function refresh(){
    if(!AppState.user) return;
    const { data, error } = await supabase.rpc("get_live_chat_access");
    if(error){ paintState(error); return; }
    st = data || {};
    if(wasOpen === false && st.open && visible()) toast("Live Chat is open now.", "success");
    wasOpen = !!st.open;
    paintState();
    if(st.open) await loadRoom();
    await loadInvite();
  }
  function fit(){ ChatKit.fill($("lc-chat"), { gap: 20, min: 480 }); }
  function wire(){
    if(wired) return; wired = true;
    ChatKit.composer($("lc-form"), async text => {
      const { error } = await supabase.rpc("send_live_chat_group_message", { p_body: text });
      if(error){ toast(String(error.message || "Your message wasn't sent.").replace(/^Postgres error:\s*/i, ""), "error"); return false; }
      await loadRoom(true); return true;
    });
    ChatKit.composer($("lc-pform"), async text => {
      if(!invite) return false;
      const { error } = await supabase.rpc("send_private_chat_message", { p_invite_id: invite.id, p_body: text });
      if(error){ toast(String(error.message || "Your message wasn't sent.").replace(/^Postgres error:\s*/i, ""), "error"); return false; }
      await loadPrivate(true); return true;
    });
    $("lc-scroll").addEventListener("click", e => { const b = e.target.closest("[data-lc-edit]"); if(b) startEdit(b.dataset.lcEdit); });
    document.querySelectorAll("#lc-tabs [data-lc-tab]").forEach(b => b.addEventListener("click", () => {
      tab = b.dataset.lcTab; paintTabs();
      if(tab === "private"){ seenTeam = pmsgs.filter(m => m.sender_id !== (AppState.user && AppState.user.id)).length; $("lc-tab-dot").hidden = true; loadPrivate(true); }
      else { $("lc-scroll").dataset.ckKey = ""; paintRoom(true); }
    }));
    $("lc-invite-yes").addEventListener("click", () => answerInvite(true));
    $("lc-invite-no").addEventListener("click", () => answerInvite(false));
    window.addEventListener("resize", () => { if(visible()) fit(); });
  }
  function init(){
    wire(); fit(); refresh();
    if(!timer) timer = setInterval(() => { if(AppState.user && visible()) refresh(); }, 4000);
  }
  async function onActivate(){ wire(); fit(); await refresh(); }
  return { init, onActivate, refresh, loadMessages: loadRoom };
})();


/* ---------------- Requested feature helpers ---------------- */
function wireHowItWorksGuide(){
  const modal=document.getElementById("earning-guide-modal");
  const openBtn=document.getElementById("see-how-it-works");
  const closeBtn=document.getElementById("earning-guide-close");
  const startBtn=document.getElementById("earning-guide-start");
  if(!modal || modal.dataset.wired) return;
  modal.dataset.wired="1";
  const close=()=>{modal.style.display="none";document.body.style.overflow="";};
  const open=()=>{modal.style.display="flex";document.body.style.overflow="hidden";};
  openBtn?.addEventListener("click",e=>{e.preventDefault();open();});
  closeBtn?.addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  startBtn?.addEventListener("click",()=>{close();document.querySelector('[data-auth-mode="signup"]')?.click();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.style.display!=="none")close();});
}

/* ---------------- Leaderboard: the top 10 partners ---------------- */
async function loadLeaderboard(){
  const podium = document.getElementById("lb-podium"), list = document.getElementById("lb-list");
  const camp = document.getElementById("lb-camp"), toggle = document.getElementById("leaderboard-visibility-toggle");
  if(!podium || !list || !AppState.user) return;
  if(toggle) toggle.checked = !(AppState.profile && AppState.profile.show_on_leaderboard === false);
  if(!podium.dataset.loaded){
    podium.innerHTML = [0, 1, 2].map(() => '<div class="skel" style="height:190px;border-radius:20px;"></div>').join("");
    list.innerHTML = '<div class="skel" style="height:300px;border-radius:20px;"></div>';
  }
  // v3 also sends each member's profile photo; v2 is the older list without photos
  let [lb, cp] = await Promise.all([
    supabase.rpc("get_referral_leaderboard_v3", { p_limit: 10 }),
    supabase.rpc("get_public_referral_prize_campaign")
  ]);
  if(lb.error) lb = await supabase.rpc("get_referral_leaderboard_v2", { p_limit: 10 });
  if(lb.error){
    podium.innerHTML = "";
    list.innerHTML = `<div class="lb-error">We couldn't load the leaderboard. Please try again in a moment.</div>`;
    return;
  }
  const rows = (Array.isArray(lb.data) ? lb.data : []).slice(0, 10);
  const c = (Array.isArray(cp.data) ? cp.data[0] : cp.data) || null;
  const live = c && c.campaign_status === "ACTIVE";
  const prizeFor = i => live ? Number([c.first_prize, c.second_prize, c.third_prize][i] || 0) : 0;
  const places = Array.from({ length: 10 }, (_, i) => rows[i] || null);
  const n = v => Number(v) || 0;

  // the prize campaign, when there is one
  if(camp){
    if(c){
      const ends = new Date(c.ends_at), starts = new Date(c.starts_at);
      const days = Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
      const state = c.campaign_status === "ACTIVE" ? ["Live", "live"] : c.campaign_status === "UPCOMING" ? ["Starts soon", "warn"] : ["Ended", ""];
      const when = c.campaign_status === "UPCOMING"
        ? `Starts <b>${escapeHtml(starts.toLocaleDateString("en-US", { month: "short", day: "numeric" }))}</b>`
        : c.campaign_status === "ACTIVE"
          ? `<b>${days} ${days === 1 ? "day" : "days"} left</b> · ends ${escapeHtml(ends.toLocaleDateString("en-US", { month: "short", day: "numeric" }))}`
          : `Ended ${escapeHtml(ends.toLocaleDateString("en-US", { month: "short", day: "numeric" }))}`;
      camp.hidden = false;
      camp.innerHTML = `
        <div>
          <div class="lb-camp-top"><span class="ck-pill${state[1] ? " is-" + state[1] : ""}"><i></i><span>${state[0]}</span></span></div>
          <h3>${escapeHtml(c.title || "Referral prizes")}</h3>
          ${c.description ? `<p>${escapeHtml(c.description)}</p>` : ""}
          <div class="lb-camp-foot"><span>${when}</span><button type="button" class="lb-share" data-lb-share>Get your link</button></div>
        </div>
        <div class="lb-prizes">
          ${["1st", "2nd", "3rd"].map((t, i) => `<div class="lb-prize"><span><i class="lb-medal r${i + 1}">${i + 1}</i>${t} place</span><b>${money(n([c.first_prize, c.second_prize, c.third_prize][i]))}</b></div>`).join("")}
        </div>`;
      const share = camp.querySelector("[data-lb-share]");
      if(share) share.addEventListener("click", () => Router.go("profile"));
    } else { camp.hidden = true; camp.innerHTML = ""; }
  }

  // the top three
  podium.innerHTML = [1, 0, 2].map(i => {
    const r = places[i], prize = prizeFor(i);
    if(!r) return `<article class="lb-top r${i + 1} is-open"><span class="lb-rank"><i class="lb-medal r${i + 1}">${i + 1}</i></span><span class="ck-ava">?</span><span class="lb-who-copy"><b>Open spot</b><small>Invite people to take it</small></span>${prize ? `<span class="lb-prize-chip">Prize ${money(prize)}</span>` : ""}</article>`;
    return `<article class="lb-top r${i + 1}"><span class="lb-rank"><i class="lb-medal r${i + 1}">${i + 1}</i></span>${ChatKit.avatar({ name: r.full_name || "Partner", url: r.avatar_url || "" })}<span class="lb-who-copy"><b>${escapeHtml(r.full_name || "Partner")}${Leadership.chip(r.leader_level)}</b><small>${n(r.qualified_referrals)} verified · ${n(r.total_referrals)} invited</small></span><span class="lb-earn">${money(n(r.referral_earnings))}<em>earned</em></span>${prize ? `<span class="lb-prize-chip">Prize ${money(prize)}</span>` : ""}</article>`;
  }).join("");

  // places 4 to 10
  list.innerHTML = `<div class="lb-row lb-head"><span>#</span><span>Partner</span><span class="lb-num lb-col-hide">Verified</span><span class="lb-num lb-col-hide">Invited</span><span class="lb-num">Earned</span></div>`
    + places.slice(3).map((r, k) => {
      const rank = k + 4;
      if(!r) return `<div class="lb-row is-open"><span class="lb-n">${rank}</span><span class="lb-who"><span class="ck-ava ck-ava-sm">?</span><b>Open spot</b></span><span class="lb-num lb-col-hide">—</span><span class="lb-num lb-col-hide">—</span><span class="lb-num">—</span></div>`;
      return `<div class="lb-row"><span class="lb-n">${rank}</span><span class="lb-who">${ChatKit.avatar({ name: r.full_name || "Partner", size: "sm", url: r.avatar_url || "" })}<b>${escapeHtml(r.full_name || "Partner")}${Leadership.chip(r.leader_level)}</b></span><span class="lb-num lb-col-hide">${n(r.qualified_referrals)}</span><span class="lb-num lb-col-hide">${n(r.total_referrals)}</span><span class="lb-num is-money">${money(n(r.referral_earnings))}</span></div>`;
    }).join("");
  podium.dataset.loaded = "1";
}

function wireLeaderboard(){
  const toggle = document.getElementById("leaderboard-visibility-toggle");
  if(toggle && !toggle.dataset.wired){
    toggle.dataset.wired = "1";
    toggle.addEventListener("change", async () => {
      toggle.disabled = true;
      const { error } = await supabase.rpc("set_leaderboard_visibility", { p_visible: !!toggle.checked });
      toggle.disabled = false;
      if(error){ toggle.checked = !toggle.checked; toast(error.message || "Couldn't save this. Please try again.", "error"); return; }
      if(AppState.profile) AppState.profile.show_on_leaderboard = !!toggle.checked;
      toast(toggle.checked ? "Your name can show on the leaderboard." : "Your name is hidden from the leaderboard.", "success");
      await loadLeaderboard();
    });
  }
  if(!window.__ssLeaderboardRouteWired){
    window.__ssLeaderboardRouteWired = true;
    window.addEventListener("hashchange", () => { if(parseHash().page === "leaderboard") loadLeaderboard(); });
  }
  if(parseHash().page === "leaderboard") loadLeaderboard();
}

/* ---------------- Leadership: levels, badges and the Leader Pool ---------------- */
const Leadership = window.Leadership = (function(){
  const DEFAULT_LEVELS = [
    { level: 1, name: "Bronze Leader", required: 10, shares: 1 },
    { level: 2, name: "Silver Leader", required: 25, shares: 2 },
    { level: 3, name: "Gold Leader", required: 50, shares: 3 },
    { level: 4, name: "Platinum Leader", required: 100, shares: 4 },
    { level: 5, name: "Diamond Leader", required: 200, shares: 5 }
  ];
  const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 7"/></svg>';
  const CHEVRON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 8 4.5 4.5L14.5 8"/></svg>';
  let data = null, loadedAt = 0, loading = null, timer = null, popShown = false;
  const $ = id => document.getElementById(id);

  const levels = () => (data && Array.isArray(data.levels) && data.levels.length ? data.levels : DEFAULT_LEVELS)
    .map(l => ({ level: Number(l.level), name: String(l.name || ""), required: Number(l.required), shares: Number(l.shares) }));
  const nameOf = lvl => (levels().find(l => l.level === Number(lvl)) || {}).name || "Leader";
  const levelNow = () => (data && data.eligible !== false ? Number(data.level) || 0 : 0);
  const plural = (n, one, many) => n + " " + (Number(n) === 1 ? one : many);

  // a leader badge as an inline picture (the drawings live once in the page, see #srv-leader-sprite)
  function badge(lvl, opts){
    const o = opts || {};
    const n = Math.max(1, Math.min(5, Number(lvl) || 1));
    const label = o.label === false ? "" : (o.label || nameOf(n));
    const cls = "ldr-badge" + (o.cls ? " " + o.cls : "") + (o.locked ? " is-locked" : "");
    return `<svg class="${cls}" viewBox="0 0 48 48" ${label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"'} focusable="false">${label ? `<title>${escapeHtml(label)}</title>` : ""}<use href="#ldr-b${n}"></use></svg>`;
  }
  // the small badge shown next to a leader's name (nothing for members who are not leaders)
  function chip(lvl){ return Number(lvl) >= 1 ? badge(lvl, { cls: "ldr-badge-sm" }) : ""; }

  function dayLabel(s){
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return "the payout day";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function shortDay(v){
    const d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ---------- the leadership card (Profile and Refer & Earn) ----------
  function card(){
    const d = data;
    if(!d || d.eligible === false) return "";
    const list = levels();
    const lvl = Number(d.level) || 0;
    const cur = list.find(l => l.level === lvl) || null;
    const next = d.next ? { level: Number(d.next.level), name: String(d.next.name), required: Number(d.next.required), shares: Number(d.next.shares) } : null;
    const verified = Number(d.verified) || 0;
    const pool = d.pool || {};
    const payDay = dayLabel(pool.payout_day);
    const myShares = Number(d.shares) || 0, totalShares = Number(pool.shares) || 0, leaders = Number(pool.leaders) || 0;
    const held = Number(d.held) || 0, income = Number(d.income_paid) || 0;
    const est = lvl >= 1 && totalShares ? Math.floor(Number(pool.balance || 0) * myShares / totalShares * 100) / 100 : 0;
    const first = list[0] || DEFAULT_LEVELS[0];

    const title = lvl >= 1 ? escapeHtml(d.name || nameOf(lvl)) : "Become a leader";
    const sub = lvl >= 1
      ? `Level ${lvl} of 5${next ? "" : ", the top level"} · ${plural(verified, "verified referral", "verified referrals")} · ${plural(myShares, "share", "shares")} of the Leader Pool`
      : `Get ${first.required} people you invited verified to become a ${escapeHtml(first.name)}. ${verified ? `You have ${verified} so far.` : "Your link is on this page."}`;

    let progress;
    if(next){
      const from = cur ? cur.required : 0, to = next.required;
      const pct = Math.max(0, Math.min(100, (verified - from) / Math.max(1, to - from) * 100));
      const left = Math.max(0, to - verified);
      progress = `<div class="ldr-progress">
        <div class="ldr-progress-head"><span>Next: <b>${escapeHtml(next.name)}</b></span><span><b>${verified}</b> / ${to} verified</span></div>
        <div class="ldr-bar" role="progressbar" aria-label="Progress to ${escapeHtml(next.name)}" aria-valuemin="0" aria-valuemax="${to}" aria-valuenow="${verified}"><i style="width:${pct.toFixed(1)}%"></i></div>
        <small>${left === 1 ? "1 more verified referral to go." : left + " more verified referrals to go."}${lvl >= 1 ? ` Then you get ${plural(next.shares, "share", "shares")} of the pool.` : ""}</small>
      </div>`;
    } else {
      progress = `<div class="ldr-progress"><div class="ldr-bar"><i style="width:100%"></i></div><small>You've reached the top level. Every new person you invite who verifies pays you $0.80 straight away.</small></div>`;
    }

    const stats = `<div class="ldr-stats">
      <div class="ldr-stat"><span>Bonus waiting</span><b>${money(held)}</b><small>${next ? "Paid when you reach " + escapeHtml(next.name) : "Paid straight away at this level"}</small></div>
      <div class="ldr-stat"><span>Leader Pool</span><b>${money(pool.balance)}</b><small>Shared on ${escapeHtml(payDay)} ${leaders ? "among " + plural(leaders, "leader", "leaders") : "among all leaders"}</small></div>
      <div class="ldr-stat"><span>Your leader income</span><b>${money(income)}</b><small>${lvl >= 1 ? (est >= 0.01 ? "About " + money(est) + " more on " + escapeHtml(payDay) : "Your share grows with the pool") : "Starts when you become a leader"}</small></div>
    </div>`;

    const ladder = `<div class="ldr-ladder"><h4>The five levels</h4><ol class="ldr-steps">${
      list.map(l => {
        const st = l.level < lvl ? "is-done" : l.level === lvl ? "is-current" : "is-locked";
        const tag = st === "is-current" ? '<span class="ldr-step-tag">You</span>' : st === "is-done" ? `<span class="ldr-step-tag" aria-label="Reached">${CHECK}</span>` : "";
        return `<li class="ldr-step ${st}">${badge(l.level, { locked: st === "is-locked", label: l.name })}<b>${escapeHtml(l.name.replace(/ Leader$/, ""))}</b><small>${l.required} verified · ${plural(l.shares, "share", "shares")}</small>${tag}</li>`;
      }).join("")
    }</ol></div>`;

    const ev = (Array.isArray(d.events) ? d.events : []).slice(0, 5);
    const hist = ev.length ? `<div class="ldr-hist"><h4>Recent</h4><ul>${ev.map(e => {
      const amt = Number(e.amount) || 0, lv = Number(e.level) || lvl || 1;
      const text = e.kind === "LEVEL_UP" ? "Became a " + (e.note || nameOf(lv))
        : e.kind === "INCOME" ? "Monthly income · " + (e.note || "Leader Pool")
        : "Leadership bonus";
      const note = e.kind === "LEVEL_UP" ? (amt >= 0.01 ? "Bonus added to your wallet" : "New badge on your profile") : "Added to your wallet";
      return `<li>${badge(lv, { label: false })}<div><b>${escapeHtml(text)}</b><small>${escapeHtml(shortDay(e.at))} · ${note}</small></div>${amt >= 0.01 ? `<span>+${money(amt)}</span>` : ""}</li>`;
    }).join("")}</ul></div>` : "";

    const how = `<details class="ldr-how"><summary>How Leadership works${CHEVRON}</summary><ul>
      <li>Every person you invite who verifies their account counts toward your level.</li>
      <li>$0.80 from each of their $20 is set aside for you. You get all of it when you reach your next level.</li>
      <li>5% of every $20 paid on Repuven goes into the Leader Pool. It is shared among all leaders 2 days before each month ends.</li>
      <li>Higher levels get more of the pool: ${list.map(l => escapeHtml(l.name.replace(/ Leader$/, "")) + " " + l.shares).join(", ")} ${list.length ? "shares" : ""}.</li>
      ${AppState.isVip ? "" : "<li>Each new level and each monthly payment comes with a message in your Mailbox.</li>"}
    </ul></details>`;

    return `<section class="card ldr" data-level="${lvl}" aria-label="Leadership">
      <div class="ldr-top">
        <div class="ldr-emblem">${badge(lvl || 1, { locked: !lvl, label: lvl ? (d.name || nameOf(lvl)) : first.name })}</div>
        <div class="ldr-id"><span class="ldr-kicker">Leadership</span><h3>${title}</h3><p>${sub}</p></div>
      </div>
      ${progress}${stats}${ladder}${hist}${how}
    </section>`;
  }

  function paintCards(){
    const lvl = data && data.eligible !== false ? Number(data.level) || 0 : -1;
    const html = lvl >= 0 ? card() : "";
    const top = $("leader-mount-top"), ref = $("leader-mount-ref"), vip = $("leader-mount-vip");
    if(top) top.innerHTML = lvl >= 1 ? html : "";
    if(ref) ref.innerHTML = lvl === 0 ? html : "";
    if(vip) vip.innerHTML = AppState.isVip ? html : "";
  }

  // the badge next to the name in the menu
  function paintChip(){
    const box = document.querySelector("#app-sidebar .sidebar-user");
    if(!box) return;
    const nm = box.querySelector(".name"), role = box.querySelector(".role");
    const lvl = levelNow();
    if(nm){
      const old = nm.querySelector(".ldr-badge"); if(old) old.remove();
      if(lvl >= 1) nm.insertAdjacentHTML("beforeend", chip(lvl));
    }
    if(role){
      if(role.dataset.base === undefined) role.dataset.base = role.textContent;
      role.textContent = lvl >= 1 ? (data.name || nameOf(lvl)) + (AppState.isVip ? " · VIP" : "") : role.dataset.base;
    }
  }
  // the badge on the profile photo
  function paintAvatar(){
    const el = $("profile-leader-badge");
    if(!el) return;
    const lvl = levelNow();
    el.hidden = lvl < 1;
    el.innerHTML = lvl >= 1 ? badge(lvl) : "";
  }
  // a chip in the welcome card on Home
  function paintHome(){
    const box = document.querySelector("#page-home .welcome-badges");
    if(!box) return;
    let el = $("wc-leader-badge");
    const lvl = levelNow();
    if(lvl < 1){ if(el) el.remove(); return; }
    if(!el){ el = document.createElement("span"); el.id = "wc-leader-badge"; el.className = "badge wc-leader"; box.appendChild(el); }
    el.innerHTML = chip(lvl) + escapeHtml(data.name || nameOf(lvl));
  }
  function paintAll(){ paintChip(); paintAvatar(); paintCards(); paintHome(); }

  // ---------- a pop-up the first time a member sees a new level or a monthly payment ----------
  const seenKey = () => "srv_ldr_seen_" + ((AppState.user && AppState.user.id) || "x");
  function readSeen(){ try{ return JSON.parse(localStorage.getItem(seenKey()) || "null"); }catch(e){ return null; } }
  function writeSeen(v){ try{ localStorage.setItem(seenKey(), JSON.stringify(v)); }catch(e){} }

  function closePop(){
    const w = $("ldr-pop"); if(!w) return;
    w.classList.remove("is-in");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => w.remove(), 220);
  }
  function onKey(e){ if(e.key === "Escape") closePop(); }
  function pop(o){
    closePop();
    const old = $("ldr-pop"); if(old) old.remove();
    const w = document.createElement("div");
    w.className = "ldr-pop-wrap"; w.id = "ldr-pop";
    w.innerHTML = `<div class="ldr-pop" role="dialog" aria-modal="true" aria-labelledby="ldr-pop-title" data-level="${o.level}" tabindex="-1">
      <button type="button" class="ldr-pop-x" data-ldr-close aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/></svg></button>
      <div class="ldr-pop-emblem">${badge(o.level)}</div>
      <span class="ldr-kicker">${escapeHtml(o.kicker)}</span>
      <h2 id="ldr-pop-title">${escapeHtml(o.title)}</h2>
      <p>${escapeHtml(o.text)}</p>
      ${o.amount >= 0.01 ? `<div class="ldr-pop-amount"><b>+${money(o.amount)}</b><span>${escapeHtml(o.amountText)}</span></div>` : ""}
      <div class="ldr-pop-actions"><button type="button" class="btn btn-primary" data-ldr-go>See my leadership</button><button type="button" class="btn btn-ghost" data-ldr-close>Close</button></div>
    </div>`;
    document.body.appendChild(w);
    w.addEventListener("click", e => {
      if(e.target === w || e.target.closest("[data-ldr-close]")){ closePop(); return; }
      if(e.target.closest("[data-ldr-go]")){ closePop(); Router.go(AppState.isVip ? "home" : "profile"); }
    });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => { w.classList.add("is-in"); const b = w.querySelector(".ldr-pop"); if(b) b.focus({ preventScroll: true }); });
  }

  function celebrate(){
    if(!data || data.eligible === false || popShown) return;
    const lvl = Number(data.level) || 0;
    const ev = Array.isArray(data.events) ? data.events : [];
    const income = ev.find(e => e.kind === "INCOME") || null;
    const seen = readSeen() || { level: 0, income: null };
    const save = () => writeSeen({ level: lvl, income: income ? income.at : (seen.income || null) });
    if(lvl > (Number(seen.level) || 0)){
      const up = ev.find(e => e.kind === "LEVEL_UP" && Number(e.level) === lvl);
      const name = data.name || nameOf(lvl);
      popShown = true; save();
      pop({
        level: lvl,
        kicker: "New level · " + lvl + " of 5",
        title: data.next ? "You're now a " + name : "You've reached the top: " + name,
        text: plural(Number(data.verified) || 0, "person", "people") + " you invited " + ((Number(data.verified) || 0) === 1 ? "has" : "have") + " verified their accounts. Your new badge is on your profile.",
        amount: up ? Number(up.amount) || 0 : 0,
        amountText: "Leadership bonus, now in your wallet"
      });
      return;
    }
    if(income && income.at !== seen.income && Date.now() - new Date(income.at).getTime() < 10 * 86400000 && lvl >= 1){
      popShown = true; save();
      pop({
        level: Number(income.level) || lvl,
        kicker: "Leadership income",
        title: "Your monthly income is here",
        text: "Your share of the Leader Pool for " + (income.note || "this month") + " is in your wallet. Thank you for leading the way.",
        amount: Number(income.amount) || 0,
        amountText: plural(Number(data.shares) || 0, "share", "shares") + " as a " + (data.name || nameOf(lvl))
      });
      return;
    }
    if(lvl !== Number(seen.level) || (income && income.at !== seen.income)) save();
  }

  // ---------- loading ----------
  async function refresh(force){
    if(!AppState.user || AppState.isAdmin) return null;
    if(loading) return loading;
    if(!force && data && Date.now() - loadedAt < 20000){ paintAll(); return data; }
    loading = (async () => {
      try{
        const { data: d, error } = await supabase.rpc("get_my_leadership");
        if(!error && d){ data = d; loadedAt = Date.now(); AppState.leader = d; }
      }catch(e){}
      loading = null;
      paintAll();
      celebrate();
      return data;
    })();
    if(!timer) timer = setInterval(() => { if(AppState.user && !document.hidden) refresh(true); }, 5 * 60 * 1000);
    return loading;
  }
  function reset(){ data = null; loadedAt = 0; popShown = false; AppState.leader = null; closePop(); }

  // the header of a leadership message in the Mailbox
  function mailHead(m){
    const meta = m && m.meta && typeof m.meta === "object" ? m.meta : null;
    if(!meta || !/^LEADER_/.test(String(m.kind || ""))) return "";
    const lvl = Number(meta.level) || 1, amt = Number(meta.amount) || 0;
    return `<div class="ldr-mail" data-level="${lvl}">${badge(lvl)}<div><span class="ldr-kicker">${m.kind === "LEADER_INCOME" ? "Leadership income" : "New level · " + lvl + " of 5"}</span><b>${escapeHtml(meta.name || nameOf(lvl))}</b>${amt >= 0.01 ? `<em>+${money(amt)} added to your wallet</em>` : ""}</div></div>`;
  }

  return { refresh, reset, paintAll, paintChip, badge, chip, nameOf, mailHead, card, get data(){ return data; } };
})();

/* ---------------- boot ---------------- */
async function boot(){
  await loadAppState();
  const linkResult = takeEmailLinkResult();
  await setupAccountIfNeeded();
  if(AppState.session){ renderSidebar(); refreshMailboxBadge(); Leadership.refresh(); if(!window.__ssMailboxBadgeTimer) window.__ssMailboxBadgeTimer=setInterval(refreshMailboxBadge,10000); }
  hydrateSiteLogoAvatars(document);
  wireShellChrome();
  wireHowItWorksGuide();
  wireLeaderboard();
  initLandingTheme();
  const recoveryHandled = await handlePasswordRecoveryHash();

  supabase.auth.onAuthStateChange(async (event, session) => {
    const formAuth = !!window.__ssFormAuth;
    if(event === "INITIAL_SESSION") return;
    if(event === "PASSWORD_RECOVERY"){
      if(window.__ssRecoveryHandled) return;
      await loadAppState();
      showTopLevel("auth");
      AuthModule.activate("newpass", new URLSearchParams());
      window.__ssRecoveryHandled=true;
      return;
    }
    const wasLoggedIn = !!AppState.session;
    await loadAppState();
    if(event === "SIGNED_IN" && !wasLoggedIn){
      // the join/login form sets up the account itself (with its robot check)
      if(!formAuth){
        const { error: setupError } = await supabase.rpc("ensure_super_survey_profile");
        if(setupError){
          console.error("Repuven auth provisioning failed:", setupError);
          if(/not a robot/i.test(setupError.message || "")){
            await supabase.auth.signOut();
            await new Promise(r => setTimeout(r, 300));
            Router.go("auth/signin");
            toast(setupError.message, "error");
            return;
          }
        }
      }
      await loadAppState();
      renderSidebar(); refreshMailboxBadge(); Leadership.reset(); Leadership.refresh(true);
      if(!isAuthCallbackHash()) Router.go("home");
      HomeGuide.wire();
      Announce.reset(); Announce.schedule(1200);
    }
    if(event === "SIGNED_OUT"){
      Leadership.reset();
      Router.go("");
    }
  });

  window.addEventListener("hashchange", route);
  if(!recoveryHandled) await route();
  OtpLink.deliver();
  if(linkResult === "confirmed" && AppState.profile) toast("Your email is confirmed. Welcome to Repuven!", "success");
  if(linkResult === "expired" && !AppState.session){ Router.go("auth/signin"); toast("This email link has expired or was already used. Please log in.", "error"); }
  if(AppState.session) Announce.schedule(1400);
  HomeGuide.wire();
}
/* ---------------- social media links in the landing footer (set in the admin panel) ---------------- */
const SOCIAL = [
  ["facebook","Facebook",'<path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.2c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.9v3.1h2.6V21h3Z"/>'],
  ["instagram","Instagram",'<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/>'],
  ["x","X (Twitter)",'<path fill="currentColor" d="M3.5 3.5h5.2l11.8 17h-5.2L3.5 3.5Z"/><path d="M20 3.5 13.6 10.6M10.4 13.4 4 20.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'],
  ["tiktok","TikTok",'<path d="M14.2 3.5v11a3.6 3.6 0 1 1-3.6-3.6M14.2 3.5c.4 2.6 2.3 4.5 5.1 4.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'],
  ["telegram","Telegram",'<path d="M20.5 4.2 3.6 10.8c-.8.3-.7 1.4.1 1.6l4.2 1.3 1.6 5c.2.7 1.1.9 1.6.3l2.3-2.4 4.3 3.2c.6.4 1.4.1 1.6-.6l2.6-13.9c.1-.8-.6-1.4-1.4-1.1ZM8 13.6l9.5-6.2-6.9 7.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'],
  ["youtube","YouTube",'<path fill="currentColor" fill-rule="evenodd" d="M21.3 7.6c-.2-.9-.9-1.6-1.8-1.8C17.9 5.4 12 5.4 12 5.4s-5.9 0-7.5.4c-.9.2-1.6.9-1.8 1.8C2.3 9.2 2.3 12 2.3 12s0 2.8.4 4.4c.2.9.9 1.6 1.8 1.8 1.6.4 7.5.4 7.5.4s5.9 0 7.5-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.4.4-4.4s0-2.8-.4-4.4ZM10.1 15V9l5.2 3-5.2 3Z"/>'],
  ["whatsapp","WhatsApp",'<path d="M4 20.2 5.2 16A8.3 8.3 0 1 1 8.3 19l-4.3 1.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path fill="currentColor" d="M9.3 8.2c.2-.4.5-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.1.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5-.1l.6-.7c.1-.2.4-.2.6-.1l1.5.7c.2.1.4.3.3.6 0 .5-.3 1.3-1.2 1.6-.8.3-2.1.2-3.9-1-1.7-1.2-2.6-2.7-2.9-3.6-.3-1-.1-1.8.4-2.3Z"/>']
];
async function fillSocial(){
  const box = document.getElementById("sv-social"); if(!box) return;
  try{
    const { data, error } = await supabase.rpc("get_social_links");
    if(error || !data) return;
    const links = SOCIAL.filter(([k]) => /^https:\/\//i.test(String(data[k] || "")));
    if(!links.length){ box.hidden = true; return; }
    box.innerHTML = links.map(([k, label, svg]) => `<a class="sv-social-a" href="${escapeHtml(data[k])}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${svg}</svg></a>`).join("");
    box.hidden = false;
  }catch(_){}
}
fillSocial();
boot();

} // end of runApp()

/* ---------------- entry point ---------------- */
runApp().then(() => { try{ sessionStorage.removeItem("srv-reload"); }catch(_){} }).catch((e) => { document.documentElement.classList.remove("srv-resume"); console.error("Repuven: runApp() crashed —", e); window.__srvAppFailed = true; showFatalLoadError(); });
