/* app.js — رفيق v0.3 (محسّن)
   - إصلاح دعم اللغات (ترجمات إضافية)
   - إصلاح التحميل المحلي للأحاديث (bukhari.json) مع fallback للـ API
   - تحميل قائمة القرّاء من CDN إن أمكن، fallback للعفاسي
   - إضافة عدّاد الصلاة القادمة (Next prayer countdown)
   - تحسينات عامة على الأخطاء والملاحظات
*/

const i18n = {
  ar: {
    home:"الرئيسية", quran:"القرآن", hadith:"الحديث", prayer:"الصلاة",
    qibla:"القبلة", hijri:"التقويم الهجري", tasbih:"المسبحة",
    adhkar:"الأذكار", duas:"الأدعية", reminders:"التذكيرات",
    settings:"الإعدادات", ayahOfDay:"آية اليوم", v03soon:"النسخة 0.4 قريبًا",
    dev:"المطور", read:"قراءة", listen:"استماع", surah:"السورة", reciter:"القارئ",
    rangeStart:"من رقم", count:"عدد", load:"تحميل", detect:"تحديد موقعي",
    adhanNote:"سيتم تذكيرك عند الأذان أثناء فتح الصفحة.",
    reset:"تصفير", progress:"التقدّم", start:"ابدأ", stop:"أوقف",
    remNote:"التذكيرات تعمل ما دامت الصفحة مفتوحة. يمكنك تفعيل إشعارات المتصفح للحصول على تنبيهات.",
    theme:"السمة", language:"اللغة", enableCompass:"تفعيل البوصلة",
    ramadanCountdown:"عدّاد قدوم رمضان", nextPrayer:"الصلاة القادمة"
  },
  en: {
    home:"Home", quran:"Qur'an", hadith:"Hadith", prayer:"Prayer",
    qibla:"Qibla", hijri:"Hijri Calendar", tasbih:"Tasbih",
    adhkar:"Adhkar", duas:"Duas", reminders:"Reminders",
    settings:"Settings", ayahOfDay:"Ayah of the Day", v03soon:"v0.4 coming soon",
    dev:"Developer", read:"Read", listen:"Listen", surah:"Surah", reciter:"Reciter",
    rangeStart:"Start", count:"Count", load:"Load", detect:"Detect Location",
    adhanNote:"You’ll be reminded at adhan while this page is open.",
    reset:"Reset", progress:"Progress", start:"Start", stop:"Stop",
    remNote:"Reminders run while the page stays open. Enable browser notifications for alerts.",
    theme:"Theme", language:"Language", enableCompass:"Enable Compass",
    ramadanCountdown:"Ramadan Countdown", nextPrayer:"Next prayer"
  },
  tr: {
    home:"Ana Sayfa", quran:"Kur'an", hadith:"Hadis", prayer:"Namaz",
    qibla:"Kıble", hijri:"Hicri Takvim", tasbih:"Tespih",
    adhkar:"Zikirler", duas:"Dualar", reminders:"Hatırlatıcılar",
    settings:"Ayarlar", ayahOfDay:"Günün Ayeti", v03soon:"v0.4 yakında",
    dev:"Geliştirici", read:"Oku", listen:"Dinle", surah:"Sure", reciter:"Kari",
    rangeStart:"Başlangıç", count:"Adet", load:"Yükle", detect:"Konumu Bul",
    adhanNote:"Sayfa açıkken ezan vaktinde hatırlatılacaksın.",
    reset:"Sıfırla", progress:"İlerleme", start:"Başlat", stop:"Durdur",
    remNote:"Sayfa açık olduğu sürece hatırlatıcı çalışır. Tarayıcı bildirimlerini açabilirsin.",
    theme:"Tema", language:"Dil", enableCompass:"Pusulayı Etkinleştir",
    ramadanCountdown:"Ramazan Sayacı", nextPrayer:"Gelecek namaz"
  }
};

const state = {
  lang: localStorage.getItem('lang') || 'ar',
  theme: localStorage.getItem('theme') || 'system',
  geo: { lat:null, lon:null },
  reminders: { intervalId: null },
  bukhariLocal: null,
  hadithLoaded: [],
  hadithPage: 0,
  hadithPageSize: 20,
  quranCache: {},
  quranRecitersList: null,
  quranReciter: 'ar.alafasy',
  tasbih: {
    count: Number(localStorage.getItem('tasbih_count') || 0),
    target: Number(localStorage.getItem('tasbih_target') || 33)
  },
  nextPrayerTimerId: null,
  ramadanIntervalId: null
};

/* helpers */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function toast(msg, ms=3000){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=> t.classList.remove('show'), ms); }

/* I18n & theme */
function applyI18n(lang){
  state.lang = lang; localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.body.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    if (i18n[lang] && i18n[lang][key]) el.textContent = i18n[lang][key];
  });
  // placeholders
  $('#hadith-search')?.setAttribute('placeholder', lang==='ar' ? 'ابحث ضمن المعروض…' : lang==='tr' ? 'Listede ara…' : 'Search in list…');
  $('#adhkar-search')?.setAttribute('placeholder', lang==='ar' ? 'ابحث…' : lang==='tr' ? 'Ara…' : 'Search…');
  $('#duas-search')?.setAttribute('placeholder', lang==='ar' ? 'ابحث…' : lang==='tr' ? 'Ara…' : 'Search…');
  $$('#lang-select, #lang-select-2').forEach(s => s.value = lang);
}
function applyTheme(theme){
  state.theme = theme; localStorage.setItem('theme', theme);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = (theme === 'dark') || (theme === 'system' && prefersDark);
  document.body.classList.toggle('light', !useDark);
}

/* Navigation & splash */
function showPage(id){
  const prev = $('.page.active'); if (prev && prev.id === id) return;
  if (prev){ prev.classList.remove('active'); prev.style.opacity='0'; prev.style.transform='translateY(6px)'; }
  const next = $('#'+id); if (next){ next.classList.add('active'); next.style.opacity='1'; next.style.transform='none'; window.scrollTo({top:0,behavior:'smooth'}); }
}
function initNav(){ $$('.nav-btn').forEach(b => b.onclick = ()=> showPage(b.dataset.section)); }
function initSplash(){
  $('#enter-btn').onclick = ()=> {
    $('#splash').classList.add('hidden'); $('#app').classList.remove('hidden');
    loadAyahOfDay(); loadSurahs(); initTasbih(); initAdhkar(); initDuas(); initHadithLoader(); requestNotifyPermission();
    detectAndLoadLocation();
    toast('أهلًا بك — رفيق 0.3');
  };
}

/* Ayah of the day (cache) */
async function loadAyahOfDay(){
  const wrap = $('#ayah-wrap'); wrap.innerHTML = `<div class="skeleton-ayah"></div>`;
  try{
    const cache = JSON.parse(localStorage.getItem('ayah_cache')||'{}');
    if (cache.timestamp && (Date.now()-cache.timestamp) < 1000*60*30 && cache.html){ wrap.innerHTML = cache.html; return; }
    const res = await fetch('https://api.alquran.cloud/v1/ayah/random');
    const j = await res.json(); const a = j.data;
    const html = `<div class="ayah-text">${a.text}</div><div class="note">${a.surah.englishName} — ${a.numberInSurah}</div>`;
    wrap.innerHTML = html; localStorage.setItem('ayah_cache', JSON.stringify({ timestamp:Date.now(), html }));
  }catch(e){ wrap.innerHTML = `<div class="note">تعذر جلب آية اليوم.</div>`; }
}

/* Quran surahs + reciters list (try CDN list, fallback to default) */
const QURAN = { surahs: [] };
async function loadSurahs(){
  const sel = $('#surah-select'); sel.innerHTML = `<option>…</option>`; $('#quran-content').innerHTML = `<div class="skeleton-lines"></div>`;
  try{
    const res = await fetch('https://api.alquran.cloud/v1/surah');
    const j = await res.json();
    QURAN.surahs = j.data;
    sel.innerHTML = QURAN.surahs.map(s=>`<option value="${s.number}">${s.number}. ${s.name} — ${s.englishName}</option>`).join('');
    sel.value='1';
    await loadRecitersList(); renderQuran();
  }catch(e){
    sel.innerHTML = `<option>تعذر تحميل السور</option>`;
  }
  $('#q-read').onclick = ()=> toggleQMode('read');
  $('#q-listen').onclick = ()=> toggleQMode('listen');
  $('#reciter-select').onchange = e => { state.quranReciter = e.target.value; renderQuran(); };
  sel.onchange = renderQuran;
}

async function loadRecitersList(){
  const sel = $('#reciter-select');
  sel.innerHTML = `<option value="ar.alafasy">العفاسي (افتراضي)</option>`;
  try{
    // يحاول جلب ملف reciters من repo CDN (يمكن أن يفشل عند الحماية)
    const url = 'https://raw.githubusercontent.com/islamic-network/cdn/master/info/cdn_surah_audio.json';
    const res = await fetch(url);
    if (!res.ok) throw new Error('no reciters json');
    const j = await res.json();
    // json structure: array objects with id/name etc. We'll map to id and displayName
    const list = Array.isArray(j) ? j : (j?.reciters || []);
    if (list && list.length){
      state.quranRecitersList = list;
      sel.innerHTML = list.slice(0,60).map(r => {
        const id = r.id || r.name || r.reciter || r.reader || r.file || '';
        const label = r.name || r.title || id;
        return `<option value="${id}">${label}</option>`;
      }).join('');
      // ensure default exists
      if (!Array.from(sel.options).some(o=>o.value==='ar.alafasy')) sel.insertAdjacentHTML('beforeend', `<option value="ar.alafasy">العفاسي (افتراضي)</option>`);
      sel.value = state.quranReciter || 'ar.alafasy';
      toast('قائمة القرّاء مُحَمَّلة');
      return;
    }
  }catch(e){
    console.log('reciters list failed', e);
  }
  // fallback keep default alafasy
  state.quranReciter = 'ar.alafasy';
  sel.value = 'ar.alafasy';
}

function toggleQMode(mode){
  $('#q-read').classList.toggle('active', mode === 'read'); $('#q-listen').classList.toggle('active', mode === 'listen');
  renderQuran();
}

async function renderQuran(){
  const box = $('#quran-content'); const audio = $('#audio'); const sNo = Number($('#surah-select').value || 1);
  const mode = $('#q-listen').classList.contains('active') ? 'listen' : 'read';
  if (mode === 'read'){
    $('#reciter-box').classList.add('hidden'); audio.classList.add('hidden'); box.innerHTML = `<div class="skeleton-lines"></div>`;
    try{
      if (state.quranCache[sNo]) { box.innerHTML = state.quranCache[sNo]; return; }
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${sNo}`);
      const j = await res.json();
      const ayat = j.data.ayahs;
      const html = ayat.map(a=>`<div class="ayah-text">${a.text} <span class="ayah-num">﴿${a.numberInSurah}﴾</span></div>`).join('');
      box.innerHTML = html; state.quranCache[sNo] = html;
    }catch(e){ box.innerHTML = `<div class="note">تعذر عرض السورة.</div>`; }
  } else {
    $('#reciter-box').classList.remove('hidden'); box.innerHTML = '';
    const reciter = $('#reciter-select').value || state.quranReciter || 'ar.alafasy';
    state.quranReciter = reciter;
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${sNo}.mp3`;
    audio.src = url; audio.classList.remove('hidden');
    // handle audio error fallback to alafasy
    audio.onerror = () => {
      if (reciter !== 'ar.alafasy'){
        toast('تعذر تشغيل القارئ المختار — سيتم التحويل للعفاسي');
        audio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${sNo}.mp3`;
        $('#reciter-select').value = 'ar.alafasy';
      } else {
        toast('تعذر تشغيل التلاوة الصوتية');
        audio.classList.add('hidden');
      }
    };
    audio.play().catch(()=>{ /* might be blocked by autoplay policy */ });
  }
}

/* Hadith loader: simplified and robust (local bukhari.json or fallback API) */
async function tryLoadLocalBukhariSimple(){
  try{
    const res = await fetch('bukhari.json');
    if (!res.ok) throw new Error('no local bukhari.json');
    const json = await res.json();
    state.bukhariLocal = Array.isArray(json) ? json : (json.data || []);
    toast(`تم تحميل bukhari.json محليًا (${state.bukhariLocal.length})`);
    $('#hadith-source').textContent = 'المصدر: محلي';
    return true;
  }catch(e){
    state.bukhariLocal = null;
    $('#hadith-source').textContent = 'المصدر: API (fallback)';
    return false;
  }
}

async function fetchBukhariRangeAPI(start, count){
  const maxChunk = 50;
  const end = start + count - 1;
  const all = [];
  for (let s = start; s <= end; s += maxChunk){
    const e = Math.min(end, s + maxChunk - 1);
    $('#hadith-progress').textContent = `جلب ${s}-${e}…`;
    try{
      const url = `https://hadith.gading.dev/books/bukhari?range=${s}-${e}`;
      const res = await fetch(url);
      const j = await res.json();
      const items = (j?.data?.hadiths || []).map(h => ({ number: h.number, arab: h.arab, id: h.id }));
      all.push(...items);
    }catch(err){
      console.error('api err chunk', err);
    }
    await new Promise(r=>setTimeout(r, 120));
  }
  return all;
}

function renderHadithCards(items){
  const container = $('#hadith-list');
  if (!items || !items.length) { container.innerHTML = `<div class="note">لا توجد نتائج.</div>`; return; }
  container.innerHTML = items.map(h => `
    <article class="hadith-card" role="article">
      <h4>(${h.number})</h4>
      <div class="hadith-body">${h.arab || h.text || ''}</div>
      <div class="hadith-meta">مصدر: صحيح البخاري</div>
    </article>
  `).join('');
}

function hadithShowPage(page){
  const all = state.hadithLoaded || [];
  const startIndex = page * state.hadithPageSize;
  const slice = all.slice(startIndex, startIndex + state.hadithPageSize);
  renderHadithCards(slice);
  $('#hadith-progress').textContent = `عرض ${startIndex+1} - ${startIndex + slice.length} من ${all.length}`;
  state.hadithPage = page;
}

function initHadithLoader(){
  tryLoadLocalBukhariSimple();
  $('#hadith-load').onclick = async ()=>{
    const start = Number($('#hadith-start').value || 1);
    const count = Math.min(5000, Math.max(1, Number($('#hadith-count').value || 20)));
    $('#hadith-list').innerHTML = `<div class="skeleton-lines"></div>`;
    // local first
    if (state.bukhariLocal){
      const s = start, e = start + count - 1;
      const filtered = state.bukhariLocal.filter(h => h.number >= s && h.number <= e);
      state.hadithLoaded = filtered;
      state.hadithPage = 0;
      hadithShowPage(0);
      return;
    }
    // fallback API
    const apiRes = await fetchBukhariRangeAPI(start, count);
    if (apiRes && apiRes.length){
      state.hadithLoaded = apiRes;
      state.hadithPage = 0;
      hadithShowPage(0);
    } else {
      $('#hadith-list').innerHTML = `<div class="note">تعذر تحميل الأحاديث. ضع ملف bukhari.json في نفس المجلد لتشغيل أوفلاين.</div>`;
    }
  };

  $('#hadith-next').onclick = ()=> {
    const next = state.hadithPage + 1;
    if (next * state.hadithPageSize >= (state.hadithLoaded?.length || 0)) return;
    hadithShowPage(next);
  };
  $('#hadith-prev').onclick = ()=> {
    const prev = Math.max(0, state.hadithPage - 1);
    hadithShowPage(prev);
  };

  $('#hadith-search').oninput = ()=>{
    const q = $('#hadith-search').value.trim();
    if (!q){ hadithShowPage(0); return; }
    const filtered = (state.hadithLoaded || []).filter(h => (h.arab && h.arab.includes(q)) || String(h.number) === q || (h.text && h.text.includes(q)));
    renderHadithCards(filtered);
  };
}

/* Prayer times + next-prayer countdown */
function inTurkey(lat, lon){ return lat > 35 && lat < 43 && lon > 25 && lon < 46; }
async function fetchPrayerTimes(lat, lon){
  const method = inTurkey(lat, lon) ? 13 : 3;
  const today = new Date(); const d = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${d}?latitude=${lat}&longitude=${lon}&method=${method}`;
  const res = await fetch(url); const j = await res.json(); return j.data;
}
function renderPrayerTimes(data){
  const box = $('#prayer-times');
  if (!data || !data.timings){ box.innerHTML = `<div class="note">تعذر جلب المواقيت</div>`; return; }
  const t = data.timings;
  const map = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  const names = { ar:{Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'}, en:{Fajr:'Fajr',Sunrise:'Sunrise',Dhuhr:'Dhuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'}, tr:{Fajr:'İmsak',Sunrise:'Güneş',Dhuhr:'Öğle',Asr:'İkindi',Maghrib:'Akşam',Isha:'Yatsı'}};
  box.innerHTML = map.map(k => `<div class="time-card" data-prayer="${k}"><div class="meta">${names[state.lang][k]}</div><div><b>${t[k]}</b></div></div>`).join('');
  scheduleAdhanNotifications(t);
  startNextPrayerCountdown(t);
}

function scheduleAdhanNotifications(timings){
  if (window._adhanTimers) window._adhanTimers.forEach(clearTimeout);
  window._adhanTimers = [];
  const now = new Date();
  ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(name=>{
    const time = timings[name];
    if (!time) return;
    const [h,m] = time.split(':').map(Number);
    const d = new Date(); d.setHours(h,m,0,0);
    if (d > now){
      const ms = d - now;
      const id = setTimeout(()=> notify(state.lang==='ar' ? 'موعد الأذان' : 'Adhan Time', name), ms);
      window._adhanTimers.push(id);
    }
  });
}

/* Next prayer countdown */
function startNextPrayerCountdown(timings){
  stopNextPrayerCountdown();
  function parseTimeToDate(timeStr){
    const [h,m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  function computeNext(){
    const now = new Date();
    const prayers = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
    let next = null;
    for (let p of prayers){
      if (!timings[p]) continue;
      const tDate = parseTimeToDate(timings[p]);
      if (tDate > now){ next = { name: p, time: tDate }; break; }
    }
    // if none today, next is tomorrow's Fajr (approx) — fallback use tomorrow's timings by adding 1 day to first available
    if (!next){
      // set next to tomorrow Fajr by adding 24h to today's Fajr
      if (timings['Fajr']){
        const tDate = parseTimeToDate(timings['Fajr']);
        tDate.setDate(tDate.getDate() + 1);
        next = { name: 'Fajr', time: tDate };
      }
    }
    return next;
  }

  function updateBanner(){
    const next = computeNext();
    if (!next){ $('#next-prayer-banner').textContent = 'العدّاد: غير متاح'; return; }
    function tick(){
      const now = new Date(); let diff = next.time - now;
      if (diff < 0) diff = 0;
      const h = Math.floor(diff / (1000*60*60)); const m = Math.floor((diff / (1000*60)) % 60); const s = Math.floor((diff/1000) % 60);
      const names = { ar:{Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'}, en:{Fajr:'Fajr',Dhuhr:'Dhuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'}, tr:{Fajr:'İmsak',Dhuhr:'Öğle',Asr:'İkindi',Maghrib:'Akşam',Isha:'Yatsı'}};
      $('#next-prayer-banner').textContent = `${i18n[state.lang].nextPrayer || 'Next'}: ${names[state.lang][next.name]} — ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      // also push to home area
      $('#next-prayer').textContent = `${i18n[state.lang].nextPrayer || 'Next'}: ${names[state.lang][next.name]} — ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (diff <= 0) {
        // refresh prayer times after the prayer passes (try refetch)
        if (state.geo.lat && state.geo.lon) fetchPrayerTimes(state.geo.lat, state.geo.lon).then(d=>renderPrayerTimes(d)).catch(()=>{});
      }
    }
    tick();
    state.nextPrayerTimerId = setInterval(tick, 1000);
  }
  updateBanner();
}

function stopNextPrayerCountdown(){ if (state.nextPrayerTimerId) clearInterval(state.nextPrayerTimerId); state.nextPrayerTimerId = null; }

/* detect location */
function detectAndLoadLocation(){
  if (!navigator.geolocation){ toast('الموقع غير متاح في هذا المتصفح'); return; }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    state.geo.lat = lat; state.geo.lon = lon;
    $('#lat').value = lat.toFixed(4); $('#lon').value = lon.toFixed(4);
    try{ const data = await fetchPrayerTimes(lat, lon); renderPrayerTimes(data); loadHijriAndRamadan(lat, lon); initCompass(lat, lon); }catch(e){ toast('تعذر جلب مواقيت الصلاة'); }
  }, err=>{ toast('رفض الحصول على الموقع أو خطأ'); }, { enableHighAccuracy:true, timeout:8000 });
}
$('#detect-location')?.addEventListener('click', detectAndLoadLocation);
$('#lat')?.addEventListener('change', manualLatLon); $('#lon')?.addEventListener('change', manualLatLon);
async function manualLatLon(){
  const lat = parseFloat($('#lat').value); const lon = parseFloat($('#lon').value);
  if (isNaN(lat) || isNaN(lon)) { toast('ادخل إحداثيات صحيحة'); return; }
  state.geo.lat = lat; state.geo.lon = lon;
  try{ const data = await fetchPrayerTimes(lat, lon); renderPrayerTimes(data); loadHijriAndRamadan(lat, lon); initCompass(lat, lon); }catch(e){ toast('تعذر جلب مواقيت الصلاة للموقع المحدد'); }
}

/* Qibla */
const KAABA = { lat:21.4225, lon:39.8262 };
function toRad(d){ return d * Math.PI / 180; } function toDeg(r){ return r * 180 / Math.PI; }
function qiblaBearing(lat, lon){ const φ1 = toRad(lat), λ1 = toRad(lon), φ2 = toRad(KAABA.lat), λ2 = toRad(KAABA.lon); const y = Math.sin(λ2-λ1)*Math.cos(φ2); const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1); const θ = Math.atan2(y,x); return (toDeg(θ)+360)%360; }
function initCompass(lat, lon){
  const bearing = qiblaBearing(lat, lon);
  $('#qibla-info').textContent = `Qibla: ${bearing.toFixed(1)}°`;
  const needle = $('#needle');
  function rotate(by){ needle.style.transform = `rotate(${by}deg)`; }
  rotate(bearing);
  $('#enable-compass').onclick = async ()=>{
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{ const perm = await DeviceOrientationEvent.requestPermission(); if (perm !== 'granted'){ toast('رفض إذن البوصلة'); return; } }catch(e){}
    }
    window.addEventListener('deviceorientation', e=>{
      const heading = (e.alpha !== null && e.alpha !== undefined) ? e.alpha : null;
      if (heading == null) return;
      const deg = bearing - heading;
      rotate(deg);
    }, true);
    toast('تم تفعيل البوصلة');
  };
}

/* Hijri & Ramadan countdown (robust) */
async function loadHijriAndRamadan(lat, lon){
  try{
    const today = new Date(); const d = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
    // convert to hijri
    const gToH = await fetch(`https://api.aladhan.com/v1/gToH?date=${d}`).then(r=>r.json());
    const hdate = gToH.data.hijri;
    $('#hijri-today').innerHTML = `<div>${hdate.day} ${hdate.month.ar} ${hdate.year} هـ</div><div class="note">${hdate.weekday.ar}</div>`;

    // determine target hijri year for next Ramadan
    const hYear = parseInt(hdate.year,10); const monthNum = parseInt(hdate.month.number,10), dayNum = parseInt(hdate.day,10);
    let targetYear = (monthNum > 9 || (monthNum === 9 && dayNum >= 1)) ? hYear + 1 : hYear;

    // try to fetch first day of Ramadan via hijriCalendarByMonth
    let target = null;
    try{
      const calRes = await fetch(`https://api.aladhan.com/v1/hijriCalendarByMonth/${targetYear}/9`).then(r=>r.json());
      if (calRes?.data?.length){
        const firstDayG = calRes.data[0].gregorian.date; // "DD-MM-YYYY"
        const [DD,MM,YYYY] = firstDayG.split('-').map(Number);
        target = new Date(YYYY, MM-1, DD, 0, 0, 0);
      }
    }catch(e){
      console.log('hijriCalendarByMonth failed', e);
    }

    // fallback: if failed, approximate Ramadan by adding (365/354)*days? Simpler: find next 1 Ramadan by scanning next 400 days and checking gToH
    if (!target){
      let found = false;
      for (let add=0; add < 400; add++){
        const check = new Date(); check.setDate(check.getDate() + add);
        const cd = `${check.getDate()}-${check.getMonth()+1}-${check.getFullYear()}`;
        try{
          const r = await fetch(`https://api.aladhan.com/v1/gToH?date=${cd}`).then(x=>x.json());
          const hd = r.data.hijri;
          if (parseInt(hd.month.number,10) === 9 && parseInt(hd.day,10) === 1){
            const [dD,dM,dY] = r.data.gregorian.date.split('-').map(Number);
            target = new Date(dY, dM-1, dD, 0,0,0);
            found = true; break;
          }
        }catch(e){}
      }
      if (!found){
        // as last resort set target to next year's approx Ramadan: add 300 days
        target = new Date(); target.setDate(target.getDate() + 300);
      }
    }

    // countdown
    function updateRamadan(){
      const now = new Date(); let diff = target - now; if (diff < 0) diff = 0;
      const days = Math.floor(diff/(1000*60*60*24)); const hours = Math.floor((diff/(1000*60*60))%24); const mins = Math.floor((diff/(1000*60))%60); const secs = Math.floor((diff/1000)%60);
      $('#ramadan-countdown').textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
    }
    updateRamadan(); clearInterval(state.ramadanIntervalId); state.ramadanIntervalId = setInterval(updateRamadan, 1000);
  }catch(e){
    $('#hijri-today').textContent = 'تعذر جلب التقويم الهجري';
  }
}

/* Tasbih */
function initTasbih(){
  $('#tasbih-count').textContent = state.tasbih.count;
  $('#tasbih-target').value = state.tasbih.target;
  updateTasbihUI();
  $('#tasbih-inc').onclick = ()=> {
    state.tasbih.count++; localStorage.setItem('tasbih_count', state.tasbih.count); $('#tasbih-count').textContent = state.tasbih.count; updateTasbihUI();
    if ([33,100,1000].includes(state.tasbih.count)) notify('مبارك', `وصلت إلى ${state.tasbih.count}`);
  };
  $('#tasbih-reset').onclick = ()=> { state.tasbih.count = 0; localStorage.setItem('tasbih_count',0); $('#tasbih-count').textContent = 0; updateTasbihUI(); };
  $('#tasbih-target').onchange = e => { const v = Math.max(1, Number(e.target.value || 1)); state.tasbih.target = v; localStorage.setItem('tasbih_target', v); updateTasbihUI(); };
}
function updateTasbihUI(){
  const count = state.tasbih.count; const target = Math.max(1, state.tasbih.target); const pct = Math.min(100, Math.round((count/target)*100));
  $('#tasbih-progress').textContent = `${pct}%`;
  const offset = 302 - Math.round((pct/100)*302);
  document.querySelectorAll('.ring-progress').forEach(el=> el.style.strokeDashoffset = offset);
}

/* Adhkar & Duas */
const ADHKAR = [
  {cat:'أذكار الصباح', text:'أصبحنا وأصبح الملك لله…', repeat:1, src:'أحاديث صحيحة'},
  {cat:'أذكار المساء', text:'أمسينا وأمسى الملك لله…', repeat:1, src:'أحاديث صحيحة'},
  {cat:'الخروج من المنزل', text:'بسم الله، توكلت على الله…', repeat:1, src:'سنن'},
  {cat:'النوم', text:'باسمك اللهم أموت وأحيا', repeat:1, src:'صحيح'},
  {cat:'الاستغفار', text:'أستغفر الله وأتوب إليه', repeat:100, src:'صحيح'}
];
const DUAS = [
  {cat:'قرآنية', text:'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', src:'البقرة:201'},
  {cat:'قرآنية', text:'رَبِّ زِدْنِي عِلْمًا', src:'طه:114'},
  {cat:'نبوية', text:'اللهم آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار', src:'متفق عليه'},
  {cat:'نبوية', text:'اللهم إنك عفو تحب العفو فاعفُ عني', src:'ترمذي'}
];

function initAdhkar(){
  const cat = $('#adhkar-category'); const cats = Array.from(new Set(ADHKAR.map(a=>a.cat)));
  cat.innerHTML = ['الكل', ...cats].map(c=>`<option value="${c}">${c}</option>`).join('');
  $('#adhkar-search').oninput = render; cat.onchange = render; render();
  function render(){ const q = $('#adhkar-search').value.trim(); const c = cat.value; const filtered = ADHKAR.filter(a => (c==='الكل' || a.cat===c) && (!q || a.text.includes(q))); $('#adhkar-list').innerHTML = filtered.map(a=>`<div class="item"><h4>${a.cat}</h4><div>${a.text}</div><div class="meta">${a.src} — تكرار: ${a.repeat}</div></div>`).join('') || '<div class="note">لا نتائج</div>'; }
}

function initDuas(){ const s = $('#duas-search'); s.oninput = render; render(); function render(){ const q = s.value.trim(); const filtered = DUAS.filter(d=>!q || d.text.includes(q) || d.cat.includes(q)); $('#duas-list').innerHTML = filtered.map(d=>`<div class="item"><h4>${d.cat}</h4><div>${d.text}</div><div class="meta">${d.src}</div></div>`).join('') || '<div class="note">لا نتائج</div>'; } }

/* Reminders */
function startReminders(){ stopReminders(); const msg = $('#rem-msg').value.trim() || 'ذكر من رفيق'; const val = Number($('#rem-interval').value || 60); const unit = $('#rem-unit').value; let ms = val * 1000; if (unit==='minutes') ms = val * 60 * 1000; if (unit==='hours') ms = val * 60 * 60 * 1000; state.reminders.intervalId = setInterval(()=> notify(state.lang==='ar' ? 'تذكير' : 'Reminder', msg), ms); toast('بدأت التذكيرات'); }
function stopReminders(){ if (state.reminders.intervalId){ clearInterval(state.reminders.intervalId); state.reminders.intervalId = null; toast('أوقفت التذكيرات'); } }
$('#rem-start').onclick = startReminders; $('#rem-stop').onclick = stopReminders;

/* Notifications */
async function requestNotifyPermission(){ try{ if (!('Notification' in window)) return; if (Notification.permission === 'default') await Notification.requestPermission(); }catch{} }
function notify(title, body){ try{ if ('Notification' in window && Notification.permission === 'granted'){ new Notification(title, { body }); } }catch(e){} toast(`${title} — ${body}`, 4000); }

/* Init */
document.addEventListener('DOMContentLoaded', ()=>{
  applyI18n(state.lang); applyTheme(state.theme); initNav(); initSplash();
  $$('#lang-select, #lang-select-2').forEach(el => el.onchange = (e)=> applyI18n(e.target.value));
  ['theme-light','theme-dark','theme-system','set-light','set-dark','set-system'].forEach(id => { const el = $('#'+id); if (!el) return; el.onclick = ()=> applyTheme(id.includes('light') ? 'light' : id.includes('dark') ? 'dark' : 'system'); });
  initAdhkar(); initDuas(); initHadithLoader();
  // set up tasbih ring stroke
  document.querySelectorAll('.ring-progress').forEach(r=>{ r.style.strokeDasharray='302'; r.style.strokeDashoffset='302'; });
  // prefill reciter-select with default (will be replaced if list loaded)
  const recSel = $('#reciter-select'); if (recSel) recSel.innerHTML = `<option value="ar.alafasy">العفاسي (افتراضي)</option>`;
  // show first page
  $$('.nav-btn')[0].onclick = ()=> showPage('home');
});
