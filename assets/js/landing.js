/* landing: mobile menu + scroll reveal */
(function(){
  var btn=document.getElementById('svMenuBtn'), menu=document.getElementById('svMenu');
  function setMenu(open){
    if(!btn||!menu) return;
    if(open){ menu.removeAttribute('hidden'); } else { menu.setAttribute('hidden',''); }
    btn.setAttribute('aria-expanded',String(open));
    btn.setAttribute('aria-label',open?'Close menu':'Open menu');
    var u=btn.querySelector('use'); if(u) u.setAttribute('href',open?'#i-x':'#i-menu');
  }
  if(btn&&menu){
    btn.addEventListener('click',function(){ setMenu(menu.hasAttribute('hidden')); });
    menu.addEventListener('click',function(e){ if(e.target.closest('a')) setMenu(false); });
  }
  var els=document.querySelectorAll('#view-landing .sv .reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } }); },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(el){ io.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('is-visible'); }); }
  setTimeout(function(){ els.forEach(function(el){ if(!el.classList.contains('is-visible') && el.getBoundingClientRect().top<window.innerHeight) el.classList.add('is-visible'); }); },2500);
})();
/* "See how it works": wire the guide right away, so it opens even before the
   app finishes its first network check (the app's own wiring then skips it) */
(function(){
  var modal=document.getElementById('earning-guide-modal');
  if(!modal||modal.dataset.wired) return;
  modal.dataset.wired='1';
  var openBtn=document.getElementById('see-how-it-works'), closeBtn=document.getElementById('earning-guide-close'), startBtn=document.getElementById('earning-guide-start');
  function close(){ modal.style.display='none'; document.body.style.overflow=''; }
  function open(){ modal.style.display='flex'; document.body.style.overflow='hidden'; if(closeBtn) closeBtn.focus(); }
  if(openBtn) openBtn.addEventListener('click',function(e){ e.preventDefault(); open(); });
  if(closeBtn) closeBtn.addEventListener('click',close);
  modal.addEventListener('click',function(e){ if(e.target===modal) close(); });
  if(startBtn) startBtn.addEventListener('click',function(){ close(); var s=document.querySelector('[data-auth-mode="signup"]'); if(s) s.click(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&modal.style.display!=='none') close(); });
})();
/* withdraw: quick amounts + live summary (the withdraw module still owns the form) */
(function(){
  var form=document.getElementById('wd-form'); if(!form) return;
  var acct=document.getElementById('wd-binance'), amt=document.getElementById('wd-amount');
  var sm=document.getElementById('wd-sum-method'), sl=document.getElementById('wd-sum-logo'), sa=document.getElementById('wd-sum-account');
  function method(){ var a=form.querySelector('.withdraw-method.active'); return a?a.getAttribute('data-method'):'BINANCE'; }
  function update(){
    var bk=method()==='BKASH';
    if(sm) sm.textContent=bk?'bKash':'Binance';
    if(sl) sl.className='pay-logo pay-xs '+(bk?'pay-bkash-mark':'pay-binance-mark');
    if(sa) sa.textContent=(acct&&acct.value||'').trim()||'—';
  }
  form.addEventListener('click',function(e){
    var chip=e.target.closest('[data-wd-amount]');
    if(!chip||!amt) return;
    var v=chip.getAttribute('data-wd-amount');
    if(v==='all'){ var t=parseFloat((document.getElementById('avail-amount').textContent||'').replace(/[^0-9.]/g,'')); v=isNaN(t)?'':t.toFixed(2); }
    amt.value=v; amt.dispatchEvent(new Event('input',{bubbles:true})); amt.focus();
  });
  if(acct) acct.addEventListener('input',update);
  form.addEventListener('reset',function(){ setTimeout(update,0); });
  if('MutationObserver' in window){
    var mo=new MutationObserver(update);
    form.querySelectorAll('.withdraw-method').forEach(function(b){ mo.observe(b,{attributes:true,attributeFilter:['class']}); });
  }
  update();
})();

/* landing v12: reveals, the hero story, the step rail, the wallet counter, the FAQ */
(function(){
  var root = document.getElementById('view-landing');
  if(!root || !root.querySelector('.lx')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('lx-ready');
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ root.classList.add('lx-go'); }); });
  var visible = function(){ return root.style.display !== 'none' && !document.hidden; };

  /* reveal on scroll */
  var rv = root.querySelectorAll('.lx-rv');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); if(e.target.id === 'lxWallet') countUp(); } });
    }, { threshold:.14, rootMargin:'0px 0px -6% 0px' });
    rv.forEach(function(el){ io.observe(el); });
  } else {
    rv.forEach(function(el){ el.classList.add('is-in'); });
    setTimeout(countUp, 0);
  }

  /* wallet balance counts up once */
  var counted = false;
  function countUp(){
    var el = root.querySelector('.lx-count');
    if(!el || counted) return;
    counted = true;
    var to = parseFloat(el.getAttribute('data-to')) || 0;
    if(reduce){ el.textContent = '$' + to.toFixed(2); return; }
    var t0 = performance.now(), dur = 1600;
    (function step(now){
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = '$' + (to * e).toFixed(2);
      if(k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* FAQ */
  root.querySelectorAll('.lx-acc-q').forEach(function(q){
    q.addEventListener('click', function(){
      var item = q.closest('.lx-acc-item'), open = !item.classList.contains('is-open');
      root.querySelectorAll('.lx-acc-item.is-open').forEach(function(o){ if(o !== item){ o.classList.remove('is-open'); o.querySelector('.lx-acc-q').setAttribute('aria-expanded','false'); } });
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });

  /* the hero story: a task gets done, feedback is written, the money goes out */
  var stage = document.getElementById('lxStage');
  var TEXT = "Sign-up took under a minute. I only got stuck on the coupon field. It's hidden until the very last step.";
  var timers = [];
  function later(fn, ms){ timers.push(setTimeout(fn, ms)); }
  function clearAll(){ timers.forEach(clearTimeout); timers = []; }
  function story(){
    if(!stage) return;
    clearAll();
    if(!reduce && !visible()){ timers.push(setTimeout(story, 3000)); return; }
    var checks = stage.querySelectorAll('.lx-checks li'), bar = stage.querySelector('.lx-bar i');
    var stars = stage.querySelectorAll('.lx-stars i'), review = stage.querySelector('.lx-review');
    var typed = stage.querySelector('.lx-typed-text'), pay = stage.querySelector('.lx-pay-state');
    if(reduce){
      checks.forEach(function(li){ li.classList.add('done'); }); bar.style.width = '100%';
      for(var s = 0; s < 4; s++) stars[s].classList.add('on');
      typed.textContent = TEXT; review.classList.add('has-shot','ready');
      pay.setAttribute('data-state','done'); pay.querySelector('.lx-pay-txt').textContent = 'Sent';
      return;
    }
    checks.forEach(function(li){ li.classList.remove('done'); }); bar.style.width = '0%';
    stars.forEach(function(st){ st.classList.remove('on'); });
    typed.textContent = ''; review.classList.remove('has-shot','ready','sent');
    pay.setAttribute('data-state','wait'); pay.querySelector('.lx-pay-txt').textContent = 'Processing';
    var t = 900;
    checks.forEach(function(li, i){ later(function(){ li.classList.add('done'); bar.style.width = ((i + 1) / checks.length * 100) + '%'; }, t); t += 650; });
    for(var i = 0; i < 4; i++){ (function(i){ later(function(){ stars[i].classList.add('on'); }, t + i * 160); })(i); }
    t += 4 * 160 + 250;
    var n = 0;
    (function type(){
      later(function(){
        if(!visible()){ type(); return; }
        n++;
        typed.textContent = TEXT.slice(0, n);
        if(n < TEXT.length) type();
        else {
          later(function(){ review.classList.add('has-shot'); }, 300);
          later(function(){ review.classList.add('ready'); }, 700);
          later(function(){ review.classList.add('sent'); }, 1150);
          later(function(){ review.classList.remove('sent'); pay.setAttribute('data-state','done'); pay.querySelector('.lx-pay-txt').textContent = 'Sent'; }, 1500);
          later(story, 6200);
        }
      }, n === 0 ? t : (TEXT.charAt(n - 1) === '.' ? 240 : 18 + Math.random() * 24));
    })();
  }
  if(stage) setTimeout(story, 600);

  /* the statement fills in word by word as it scrolls past */
  var say = root.querySelector('.lx-say-text'), words = [];
  if(say){
    say.innerHTML = say.textContent.trim().split(/\s+/).map(function(w){ return '<span class="w">' + w.replace(/[&<>]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]; }) + '</span>'; }).join(' ');
    words = [].slice.call(say.querySelectorAll('.w'));
  }

  /* gentle depth on scroll + the step rail */
  var cards = stage ? [stage.querySelector('.lx-task'), stage.querySelector('.lx-review'), stage.querySelector('.lx-pay')] : [];
  var depth = [-0.05, 0.035, -0.02];
  var steps = root.querySelectorAll('.lx-step'), list = document.getElementById('lxSteps');
  var rail = list ? list.querySelector('.lx-steps-rail') : null;
  var ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      ticking = false;
      if(!visible()) return;
      var vh = window.innerHeight;
      if(stage && !reduce){
        var r = stage.getBoundingClientRect();
        if(r.bottom > 0 && r.top < vh){
          var y = Math.max(-200, Math.min(400, -r.top));
          cards.forEach(function(c, i){ if(c) c.style.transform = 'translate3d(0,' + (y * depth[i]).toFixed(1) + 'px,0)'; });
        }
      }
      if(say && words.length){
        var sr = say.getBoundingClientRect();
        var k = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.86 - sr.top) / (sr.height + vh * 0.42)));
        var lit = Math.round(k * words.length);
        words.forEach(function(w, i){ w.classList.toggle('on', i < lit); });
      }
      if(list && rail){
        var lr = list.getBoundingClientRect(), mark = vh * 0.62;
        var p = Math.max(0, Math.min(1, (mark - lr.top) / lr.height));
        rail.style.setProperty('--p', p.toFixed(3));
        steps.forEach(function(s){ s.classList.toggle('is-on', s.getBoundingClientRect().top < mark); });
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
