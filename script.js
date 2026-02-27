/* ═══════════════════════════════════════════════════════════════
   ATMOS — script.js
   Weather Intelligence · All logic
═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   LIVE CLOCK
───────────────────────────────────────────── */
(function initClock() {
  const el = document.getElementById('liveTime');
  const fmt = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.textContent = fmt();
  setInterval(() => el.textContent = fmt(), 1000);
})();

/* ─────────────────────────────────────────────
   LOADING BAR
───────────────────────────────────────────── */
const lb = document.getElementById('loadingBar');
let lbW = 0, lbT = null;

function startLoad() {
  clearInterval(lbT);
  lbW = 0;
  lb.style.width = '0';
  lb.style.opacity = '1';
  lbT = setInterval(() => {
    lbW = Math.min(lbW + Math.random() * 7, 90);
    lb.style.width = lbW + '%';
  }, 200);
}

function endLoad() {
  clearInterval(lbT);
  lb.style.width = '100%';
  setTimeout(() => { lb.style.opacity = '0'; lb.style.width = '0'; }, 400);
}

/* ─────────────────────────────────────────────
   CANVAS BACKGROUND & PARTICLE SYSTEM
───────────────────────────────────────────── */
const bgC = document.getElementById('bgCanvas');
const bx  = bgC.getContext('2d');
let cW, cH, cMode = 'idle', pts = [];

// Background gradient colours per weather mode
const BG_THEMES = {
  idle:   { a: '#03050d', b: '#080e24' },
  sunny:  { a: '#1a0800', b: '#030508' },
  rain:   { a: '#020c1e', b: '#010408' },
  snow:   { a: '#050d1a', b: '#020608' },
  clouds: { a: '#080e1c', b: '#030508' },
  fog:    { a: '#090e18', b: '#030507' },
  storm:  { a: '#04010f', b: '#010005' },
};

// Current interpolated RGB values
let cA = { r: 3,  g: 5,  b: 13 };
let cB = { r: 8,  g: 14, b: 36 };
// Target RGB values (lerped toward smoothly)
let tA = { r: 3,  g: 5,  b: 13 };
let tB = { r: 8,  g: 14, b: 36 };

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

function lerp(a, b, t) { return a + (b - a) * t; }

function setBgTheme(mode) {
  const theme = BG_THEMES[mode] || BG_THEMES.idle;
  tA = hexToRgb(theme.a);
  tB = hexToRgb(theme.b);
}

function resizeCanvas() {
  cW = bgC.width  = window.innerWidth;
  cH = bgC.height = window.innerHeight;
  buildParticles();
}

window.addEventListener('resize', resizeCanvas);

function buildParticles() {
  pts = [];

  if (cMode === 'rain' || cMode === 'storm') {
    for (let i = 0; i < 190; i++)
      pts.push({ x: Math.random() * cW, y: Math.random() * cH, len: 11 + Math.random() * 18, spd: 9 + Math.random() * 9, op: 0.3 + Math.random() * 0.5 });

  } else if (cMode === 'snow') {
    for (let i = 0; i < 130; i++)
      pts.push({ x: Math.random() * cW, y: Math.random() * cH, r: 1 + Math.random() * 2.5, vy: 0.5 + Math.random() * 1.2, vx: -0.3 + Math.random() * 0.6, op: 0.5 + Math.random() * 0.5 });

  } else if (cMode === 'clouds' || cMode === 'fog') {
    for (let i = 0; i < 7; i++)
      pts.push({ x: Math.random() * cW, y: 60 + Math.random() * cH * 0.4, w: 260 + Math.random() * 200, h: 70 + Math.random() * 40, spd: 0.15 + Math.random() * 0.35, op: 0.05 + Math.random() * 0.07 });

  } else if (cMode === 'sunny') {
    for (let i = 0; i < 55; i++)
      pts.push({ x: Math.random() * cW, y: Math.random() * cH, r: 0.7 + Math.random() * 1.5, vy: -0.15 - 0.2 * Math.random(), op: 0.2 + Math.random() * 0.4 });

  } else {
    // idle / clear — starfield
    for (let i = 0; i < 50; i++)
      pts.push({ x: Math.random() * cW, y: Math.random() * cH, r: 0.6 + Math.random() * 1.2, vy: 0.1 + Math.random() * 0.22, op: 0.15 + Math.random() * 0.3 });
  }
}

let fr = 0;

function drawBg() {
  // Guard: skip frame if canvas isn't sized yet
  if (!cW || !cH || !isFinite(cW) || !isFinite(cH)) return;

  // Smooth background colour transition
  cA.r = lerp(cA.r, tA.r, 0.02); cA.g = lerp(cA.g, tA.g, 0.02); cA.b = lerp(cA.b, tA.b, 0.02);
  cB.r = lerp(cB.r, tB.r, 0.02); cB.g = lerp(cB.g, tB.g, 0.02); cB.b = lerp(cB.b, tB.b, 0.02);

  const gr = bx.createLinearGradient(0, 0, 0, cH);
  gr.addColorStop(0, `rgb(${Math.round(cA.r)},${Math.round(cA.g)},${Math.round(cA.b)})`);
  gr.addColorStop(1, `rgb(${Math.round(cB.r)},${Math.round(cB.g)},${Math.round(cB.b)})`);
  bx.fillStyle = gr;
  bx.fillRect(0, 0, cW, cH);
  fr++;

  if (cMode === 'rain' || cMode === 'storm') {
    bx.save();
    bx.strokeStyle = cMode === 'storm' ? 'rgba(180,200,255,0.5)' : 'rgba(130,180,255,0.4)';
    bx.lineWidth = 1;
    pts.forEach(p => {
      bx.globalAlpha = p.op;
      bx.beginPath(); bx.moveTo(p.x, p.y); bx.lineTo(p.x + 1.5, p.y + p.len); bx.stroke();
      p.y += p.spd; p.x += 0.5;
      if (p.y > cH) { p.y = -20; p.x = Math.random() * cW; }
    });
    bx.restore();
    if (cMode === 'storm' && Math.random() < 0.004) {
      bx.fillStyle = 'rgba(200,220,255,0.05)';
      bx.fillRect(0, 0, cW, cH);
    }

  } else if (cMode === 'snow') {
    bx.save();
    pts.forEach(p => {
      bx.globalAlpha = p.op;
      bx.fillStyle = 'rgba(210,228,255,0.9)';
      bx.beginPath(); bx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bx.fill();
      p.y += p.vy;
      p.x += p.vx + Math.sin(fr * 0.01 + p.x) * 0.2;
      if (p.y > cH) p.y = -5;
      if (p.x > cW) p.x = 0;
      if (p.x < 0)  p.x = cW;
    });
    bx.restore();

  } else if (cMode === 'clouds' || cMode === 'fog') {
    bx.save();
    pts.forEach(p => {
      const g2 = bx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, 10, p.x + p.w / 2, p.y + p.h / 2, p.w);
      g2.addColorStop(0, `rgba(160,178,218,${p.op})`);
      g2.addColorStop(1, 'transparent');
      bx.fillStyle = g2;
      bx.fillRect(p.x, p.y, p.w, p.h);
      p.x += p.spd;
      if (p.x - p.w > cW) p.x = -p.w;
    });
    bx.restore();

  } else if (cMode === 'sunny') {
    // Warm glow orb top-right
    const og = bx.createRadialGradient(cW * 0.84, cH * 0.08, 0, cW * 0.84, cH * 0.08, cW * 0.28);
    og.addColorStop(0, 'rgba(255,175,40,0.07)');
    og.addColorStop(1, 'transparent');
    bx.fillStyle = og; bx.fillRect(0, 0, cW, cH);
    // Rising dust motes
    bx.save();
    pts.forEach(p => {
      bx.globalAlpha = p.op * (0.5 + 0.5 * Math.sin(fr * 0.02 + p.x));
      bx.fillStyle = 'rgba(255,195,90,0.8)';
      bx.beginPath(); bx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bx.fill();
      p.y += p.vy;
      if (p.y < -5) p.y = cH;
    });
    bx.restore();

  } else {
    // Idle — starfield
    bx.save();
    pts.forEach(p => {
      bx.globalAlpha = p.op * (0.4 + 0.6 * Math.sin(fr * 0.018 + p.x));
      bx.fillStyle = 'rgba(170,195,255,0.9)';
      bx.beginPath(); bx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bx.fill();
      p.y += p.vy;
      if (p.y > cH) { p.y = -5; p.x = Math.random() * cW; }
    });
    bx.restore();
  }
}

// Size canvas FIRST, then start the loop
resizeCanvas();

(function canvasLoop() {
  drawBg();
  requestAnimationFrame(canvasLoop);
})();

/* ─────────────────────────────────────────────
   API CONFIG
───────────────────────────────────────────── */
const OW_KEY       = 'e2c346193a2645f7b3de8d8e515cd0dd';
const WA_KEY       = 'YOUR_WEATHERAPI_KEY_HERE';
const WA_URL       = 'https://api.weatherapi.com/v1';
const OM_URL       = 'https://api.open-meteo.com/v1';
const OW_URL       = 'https://api.openweathermap.org/data/2.5';

/* ─────────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────────── */
const autoBox   = document.getElementById('autoBox');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn    = document.getElementById('locBtn');

/* ─────────────────────────────────────────────
   AUTOCOMPLETE STATE
───────────────────────────────────────────── */
let selLat = null, selLon = null, selName = null, selCountry = null;

/* ─────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────── */
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });
cityInput.addEventListener('input', () => showAuto(cityInput.value.trim()));
locBtn.addEventListener('click', getGPS);
document.addEventListener('click', e => {
  if (!e.target.closest('.search-pill')) autoBox.classList.add('hidden');
});

/* ─────────────────────────────────────────────
   MAIN SEARCH HANDLER
───────────────────────────────────────────── */
async function handleSearch() {
  startLoad();

  // If user selected from autocomplete dropdown (coords already known)
  if (selLat !== null) {
    try {
      await runWeather(selLat, selLon, selName || cityInput.value.trim(), selCountry || '');
    } catch (e) {
      showErr(e.message || 'Something went wrong.');
    }
    selLat = selLon = null;
    return;
  }

  // Manual text entry — resolve place first
  const city = sanitizeCity(cityInput.value.trim());
  if (!city) { endLoad(); return showErr('Please enter a city name'); }

  try {
    const place = await resolvePlace(city);
    await runWeather(place.lat, place.lon, place.name, place.country);
  } catch (e) {
    showErr(e.message || 'Something went wrong.');
  }
}

/* ─────────────────────────────────────────────
   GPS / GEOLOCATION
───────────────────────────────────────────── */
function getGPS() {
  if (!navigator.geolocation) {
    return showErr('Geolocation is not supported by your browser.');
  }
  if (location.hostname === '127.0.0.1') {
    return showErr('Please open via localhost:5500 (not 127.0.0.1:5500) for GPS to work in Chrome.');
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    startLoad();

    try {
      // Try reverse geocode but do not fail if it errors
      let cityName = 'My Location';
      let country  = '';
      try {
        const geo = await fetch(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OW_KEY}`
        ).then(r => r.json());
        if (geo?.length && geo[0].name) {
          cityName = geo[0].name;
          country  = geo[0].country || '';
        }
      } catch (_) { /* silently ignore — run with coords directly */ }

      cityInput.value = cityName;
      // Run weather directly with coords — no second geocoding round-trip needed
      await runWeather(lat, lon, cityName, country);

    } catch (e) {
      showErr(e.message || 'Could not load weather for your location.');
    }
  },
  err => {
    const msgs = {
      1: 'Location permission denied. Click the lock icon in your address bar to allow it.',
      2: 'Location unavailable. Try searching manually.',
      3: 'Location request timed out. Try again.',
    };
    showErr(msgs[err.code] || 'Location error. Try searching manually.');
  },
  { timeout: 10000, maximumAge: 60000 });
}

/* ─────────────────────────────────────────────
   CORE WEATHER RUNNER
   Fetches all data in parallel and renders
───────────────────────────────────────────── */
async function runWeather(lat, lon, name, country) {
  const [avg, mm, sun, aqi, alerts] = await Promise.all([
    fetchMultipleAPIs(name),
    fetchMinMax(lat, lon),
    fetchSunTimes(name),
    fetchHybridAQI(name, country),
    fetchAlerts(name),
  ]);

  avg.temp_min    = mm.min;
  avg.temp_max    = mm.max;
  avg.sunrise     = sun.sunrise;
  avg.sunset      = sun.sunset;
  avg.aqi         = aqi.aqi;
  avg.aqiCategory = aqi.category;
  avg.aqiColor    = aqi.color;
  avg.aqiEmoji    = aqi.emoji;

  setWeatherMode(avg.description);
  renderHero(avg, aqi);
  renderSidebar(avg, aqi, alerts);

  await Promise.all([renderHourly(lat, lon), renderForecast(lat, lon)]);
  buildTicker(avg, aqi);
  endLoad();

  document.getElementById('splash').classList.add('gone');
  document.getElementById('app').classList.add('active');
}

/* ─────────────────────────────────────────────
   FETCH — MULTI-SOURCE AVERAGE
───────────────────────────────────────────── */
async function fetchMultipleAPIs(city) {
  const results = [];
  let lastErr = '';
  try { results.push(await fetchOpenWeather(city)); } catch (e) { lastErr = e.message; console.warn('OW failed:', e.message); }
  try { if (WA_KEY !== 'YOUR_WEATHERAPI_KEY_HERE') results.push(await fetchWeatherAPI(city)); } catch (e) { console.warn('WA failed:', e.message); }
  try { results.push(await fetchOpenMeteo(city)); } catch (e) { console.warn('OM failed:', e.message); }
  if (results.length) return averageWeather(results);
  throw new Error(lastErr || 'Could not fetch weather. Check your internet connection or API key.');
}

async function fetchOpenWeather(city) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${OW_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OW_KEY}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `City not found (HTTP ${res.status})`);
    }
    const d = await res.json();
    return {
      temp: d.main.temp, feels_like: d.main.feels_like, humidity: d.main.humidity,
      wind_speed: d.wind.speed, pressure: d.main.pressure,
      description: d.weather[0].description, icon: d.weather[0].icon,
      city_name: d.name, country: d.sys.country,
    };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('OpenWeather request timed out.');
    throw e;
  }
}

async function fetchWeatherAPI(city) {
  const d = await fetch(`${WA_URL}/current.json?key=${WA_KEY}&q=${city}`).then(r => r.json());
  return {
    temp: d.current.temp_c, feels_like: d.current.feelslike_c, humidity: d.current.humidity,
    wind_speed: d.current.wind_kph / 3.6, pressure: d.current.pressure_mb,
    description: d.current.condition.text, icon: '01d',
    city_name: d.location.name, country: d.location.country,
  };
}

async function fetchOpenMeteo(city) {
  // Use OW geocoding (not Open-Meteo) to get coords — more reliable
  const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OW_KEY}`).then(r => r.json());
  if (!geo?.length) throw new Error('OM: city not found');
  const { lat, lon, name, country } = geo[0];
  const w = await fetch(
    `${OM_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,pressure_msl`
  ).then(r => r.json());
  return {
    temp: w.current.temperature_2m, feels_like: w.current.apparent_temperature,
    humidity: w.current.relative_humidity_2m, wind_speed: w.current.wind_speed_10m / 3.6,
    pressure: w.current.pressure_msl, description: 'Weather', icon: '01d',
    city_name: name, country: country,
  };
}

function averageWeather(arr) {
  const avg = key => arr.reduce((s, x) => s + x[key], 0) / arr.length;
  return {
    temp: avg('temp'), feels_like: avg('feels_like'), humidity: avg('humidity'),
    wind_speed: avg('wind_speed'), pressure: avg('pressure'),
    description: arr[0].description, icon: arr[0].icon,
    city_name: arr[0].city_name, country: arr[0].country,
  };
}

/* ─────────────────────────────────────────────
   FETCH — MIN / MAX  (24-hour forecast)
───────────────────────────────────────────── */
async function fetchMinMax(lat, lon) {
  const d = await fetch(`${OW_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OW_KEY}&units=metric`).then(r => r.json());
  if (!d.list) throw new Error('Min/max forecast unavailable');
  const next = d.list.slice(0, 8);
  return { min: Math.min(...next.map(i => i.main.temp_min)), max: Math.max(...next.map(i => i.main.temp_max)) };
}

/* ─────────────────────────────────────────────
   FETCH — SUNRISE / SUNSET
───────────────────────────────────────────── */
async function fetchSunTimes(city) {
  const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${OW_KEY}`).then(r => r.json());
  const w   = await fetch(`${OW_URL}/weather?lat=${geo[0].lat}&lon=${geo[0].lon}&appid=${OW_KEY}`).then(r => r.json());
  return { sunrise: w.sys.sunrise * 1000, sunset: w.sys.sunset * 1000 };
}

/* ─────────────────────────────────────────────
   FETCH — AQI
───────────────────────────────────────────── */
function getAQIEmoji(category) {
  if (!category) return '😐';
  const c = category.toLowerCase();
  if (c.includes('good') || c.includes('satisf'))          return '😊';
  if (c.includes('moderate'))                               return '😐';
  if (c.includes('very') || c.includes('severe') || c.includes('hazard')) return '☠️';
  if (c.includes('poor') || c.includes('unhealthy'))        return '😷';
  return '😐';
}

async function fetchGlobalAQI(lat, lon) {
  try {
    const d = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi`).then(r => r.json());
    const v = d.hourly.us_aqi[0];
    let category = 'Good', color = '#00e400';
    if      (v >= 300) { category = 'Hazardous';                    color = '#7e0023'; }
    else if (v >= 200) { category = 'Very Unhealthy';               color = '#8f3f97'; }
    else if (v >= 150) { category = 'Unhealthy';                    color = '#ff0000'; }
    else if (v >= 100) { category = 'Unhealthy for Sensitive';      color = '#ff7e00'; }
    else if (v >= 50)  { category = 'Moderate';                     color = '#ffbf00'; }
    return { aqi: v, category, color, emoji: getAQIEmoji(category) };
  } catch (e) {
    return { aqi: null, category: 'Not Available', color: '#999', emoji: '😐' };
  }
}

async function fetchHybridAQI(city) {
  try {
    const g = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OW_KEY}`).then(r => r.json());
    if (!g?.length) throw new Error('No geo results for AQI');
    return await fetchGlobalAQI(g[0].lat, g[0].lon);
  } catch (e) {
    return { aqi: null, category: 'Not Available', color: '#999', emoji: '😐' };
  }
}

/* ─────────────────────────────────────────────
   FETCH — WEATHER ALERTS
───────────────────────────────────────────── */
async function fetchAlerts(city) {
  try {
    const g = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${OW_KEY}`).then(r => r.json());
    if (!g.length) return [];
    const d = await fetch(`${OW_URL}/onecall?lat=${g[0].lat}&lon=${g[0].lon}&appid=${OW_KEY}`).then(r => r.json());
    return d.alerts || [];
  } catch (e) { return []; }
}

/* ─────────────────────────────────────────────
   GEOCODING — resolve city name → coords
───────────────────────────────────────────── */
async function resolvePlace(name) {
  const d = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${OW_KEY}`).then(r => r.json());
  if (!d?.length) throw new Error('Place not found. Try a more specific name.');
  const r = d[0];
  return { lat: r.lat, lon: r.lon, name: r.name, country: r.country };
}

function sanitizeCity(city) {
  return city
    .replace(/municipal corporation|corporation|district|city/gi, '')
    .replace(/,/g, '')
    .trim();
}

/* ─────────────────────────────────────────────
   CANVAS MODE — sets weather theme & particles
───────────────────────────────────────────── */
function setWeatherMode(desc) {
  const d = desc.toLowerCase();
  if      (d.includes('rain') || d.includes('drizzle'))           { cMode = 'rain';   setBgTheme('rain');   }
  else if (d.includes('snow'))                                     { cMode = 'snow';   setBgTheme('snow');   }
  else if (d.includes('storm') || d.includes('thunder'))          { cMode = 'storm';  setBgTheme('storm');  }
  else if (d.includes('fog') || d.includes('mist') || d.includes('haze')) { cMode = 'fog'; setBgTheme('fog'); }
  else if (d.includes('cloud'))                                    { cMode = 'clouds'; setBgTheme('clouds'); }
  else                                                             { cMode = 'sunny';  setBgTheme('sunny');  }
  buildParticles();
}

/* ─────────────────────────────────────────────
   RENDER — HERO PANEL
───────────────────────────────────────────── */
function renderHero(data, aqi) {
  document.getElementById('heroIcon').src     = `https://openweathermap.org/img/wn/${data.icon}@4x.png`;
  document.getElementById('heroCity').textContent    = data.city_name;
  document.getElementById('heroCountry').textContent = data.country;
  document.getElementById('heroTemp').textContent    = Math.round(data.temp);
  document.getElementById('heroDesc').textContent    = data.description;
  document.getElementById('heroFeels').textContent   = `Feels like ${Math.round(data.feels_like)}°C`;
  document.getElementById('heroMM').innerHTML        = `<span class="mn">↓ ${Math.round(data.temp_min)}°</span><span class="mx">↑ ${Math.round(data.temp_max)}°</span>`;

  const sr = new Date(data.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ss = new Date(data.sunset).toLocaleTimeString([],  { hour: '2-digit', minute: '2-digit' });
  document.getElementById('sunRow').innerHTML = `
    <div class="sun-item">🌅 <span>Sunrise</span><span class="sv">${sr}</span></div>
    <div class="sun-item">🌇 <span>Sunset</span><span class="sv">${ss}</span></div>`;

  document.getElementById('heroDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  document.getElementById('statStrip').innerHTML = `
    <div class="stat-pill"><span class="sp-icon">💧</span><span class="sp-lbl">Humidity</span><span class="sp-val">${Math.round(data.humidity)}%</span></div>
    <div class="stat-pill"><span class="sp-icon">💨</span><span class="sp-lbl">Wind</span><span class="sp-val">${data.wind_speed.toFixed(1)} m/s</span></div>
    <div class="stat-pill"><span class="sp-icon">📊</span><span class="sp-lbl">Pressure</span><span class="sp-val">${Math.round(data.pressure)} hPa</span></div>
    ${aqi.aqi != null ? `<div class="stat-pill"><span class="sp-icon">🌿</span><span class="sp-lbl">AQI</span><span class="sp-val">${Math.round(aqi.aqi)} ${aqi.emoji || ''}</span></div>` : ''}`;
}

/* ─────────────────────────────────────────────
   RENDER — SIDEBAR (gauges, AQI, alerts)
───────────────────────────────────────────── */
function renderSidebar(data, aqi, alerts) {
  // Gauge grid
  const gauges = [
    { icon: '💧', label: 'Humidity',   val: `${Math.round(data.humidity)}%`,           sub: 'Relative',     bar: data.humidity },
    { icon: '💨', label: 'Wind',       val: `${data.wind_speed.toFixed(1)} m/s`,        sub: windLabel(data.wind_speed),  bar: Math.min(data.wind_speed / 20 * 100, 100) },
    { icon: '📊', label: 'Pressure',   val: `${Math.round(data.pressure)} hPa`,         sub: 'Atmospheric',  bar: Math.min(((data.pressure - 950) / 100) * 100, 100) },
    { icon: '🌡', label: 'Feels Like', val: `${Math.round(data.feels_like)}°C`,         sub: feelsLabel(data.feels_like), bar: Math.min(((data.feels_like + 20) / 80) * 100, 100) },
  ];

  document.getElementById('gaugeGrid').innerHTML = gauges.map(g => `
    <div class="gauge-card">
      <div class="g-icon">${g.icon}</div>
      <div class="g-label">${g.label}</div>
      <div class="g-val">${g.val}</div>
      <div class="g-sub">${g.sub}</div>
      <div class="g-bar"><div class="g-fill" style="width:${Math.max(5, Math.round(g.bar))}%"></div></div>
    </div>`).join('');

  // AQI block with sliding cursor
  const aqiPct = aqi.aqi != null ? Math.min(aqi.aqi / 500 * 100, 100) : 0;
  document.getElementById('aqiBlock').innerHTML = `
    <div class="aqi-block">
      <div class="aqi-number" style="color:${aqi.color || '#eef2ff'}">${aqi.aqi != null ? Math.round(aqi.aqi) : '—'}</div>
      <div class="aqi-cat"    style="color:${aqi.color || '#eef2ff'}">${aqi.category} ${aqi.emoji || ''}</div>
      <div class="aqi-bar-track">
        <div class="aqi-cursor" style="left:${aqiPct}%"></div>
      </div>
    </div>`;

  // Weather alerts
  if (alerts.length) {
    document.getElementById('alertsSec').style.display = 'block';
    document.getElementById('alertCard').innerHTML = `
      <div class="alert-card">
        <div class="alert-title">⚠ ${alerts[0].event}</div>
        ${alerts[0].description.slice(0, 200)}…
      </div>`;
  } else {
    document.getElementById('alertsSec').style.display = 'none';
  }
}

function windLabel(w) {
  if (w < 1)  return 'Calm';
  if (w < 5)  return 'Light';
  if (w < 10) return 'Moderate';
  if (w < 20) return 'Strong';
  return 'Storm';
}

function feelsLabel(f) {
  if (f < 0)  return 'Freezing';
  if (f < 10) return 'Cold';
  if (f < 18) return 'Cool';
  if (f < 24) return 'Comfortable';
  if (f < 30) return 'Warm';
  return 'Hot';
}

/* ─────────────────────────────────────────────
   RENDER — HOURLY FORECAST
───────────────────────────────────────────── */
async function renderHourly(lat, lon) {
  const d = await fetch(`${OW_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OW_KEY}&units=metric`).then(r => r.json());
  if (!d.list) return;

  document.getElementById('hourlyRow').innerHTML = d.list.slice(0, 12).map((item, idx) => `
    <div class="h-card${idx === 0 ? ' now' : ''}">
      <div class="h-time">${idx === 0 ? 'Now' : new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit' })}</div>
      <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="">
      <div class="h-temp">${Math.round(item.main.temp)}°</div>
    </div>`).join('');
}

/* ─────────────────────────────────────────────
   RENDER — 5-DAY FORECAST
───────────────────────────────────────────── */
async function renderForecast(lat, lon) {
  const d = await fetch(`${OW_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OW_KEY}`).then(r => r.json());
  if (!d.list) return;

  const daily = d.list.filter(i => i.dt_txt.includes('12:00:00')).slice(0, 5);
  document.getElementById('dayList').innerHTML = daily.map(item => `
    <div class="day-row">
      <div class="day-name">${new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</div>
      <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="">
      <div class="day-desc">${item.weather[0].description}</div>
      <div class="day-temps">
        <span class="hi">${Math.round(item.main.temp_max)}°</span>
        <span class="lo">${Math.round(item.main.temp_min)}°</span>
      </div>
    </div>`).join('');
}

/* ─────────────────────────────────────────────
   RENDER — BOTTOM LIVE TICKER
───────────────────────────────────────────── */
function buildTicker(data, aqi) {
  const items = [
    `<span>${data.city_name}, ${data.country}</span>`,
    `Temperature <span>${Math.round(data.temp)}°C</span>`,
    `Humidity <span>${Math.round(data.humidity)}%</span>`,
    `Wind <span>${data.wind_speed.toFixed(1)} m/s</span>`,
    `Pressure <span>${Math.round(data.pressure)} hPa</span>`,
    aqi.aqi != null ? `Air Quality <span>AQI ${Math.round(aqi.aqi)} · ${aqi.category}</span>` : null,
  ]
    .filter(Boolean)
    .map(s => `<div class="t-item">${s}<span class="t-sep">◇</span></div>`)
    .join('');

  // Duplicate for seamless infinite scroll
  document.getElementById('tickerInner').innerHTML = items + items;
  document.getElementById('ticker').style.display = 'flex';
}

/* ─────────────────────────────────────────────
   AUTOCOMPLETE DROPDOWN
───────────────────────────────────────────── */

// Priority India locations with precise coordinates
const PRIORITY_PLACES = {
  kashmir:     { name: 'Srinagar',   admin1: 'Jammu & Kashmir',  country: 'India', lat: 34.0837, lon: 74.7973, flag: '🇮🇳' },
  punjab:      { name: 'Chandigarh', admin1: 'Punjab',           country: 'India', lat: 30.7410, lon: 76.7683, flag: '🇮🇳' },
  uttarakhand: { name: 'Dehradun',   admin1: 'Uttarakhand',      country: 'India', lat: 30.3165, lon: 78.0322, flag: '🇮🇳' },
  himachal:    { name: 'Shimla',     admin1: 'Himachal Pradesh', country: 'India', lat: 31.1048, lon: 77.1734, flag: '🇮🇳' },
  himalayas:   { name: 'Leh',        admin1: 'Ladakh',           country: 'India', lat: 34.1526, lon: 77.5771, flag: '🇮🇳' },
  ladakh:      { name: 'Leh',        admin1: 'Ladakh',           country: 'India', lat: 34.1526, lon: 77.5771, flag: '🇮🇳' },
  jammu:       { name: 'Jammu',      admin1: 'Jammu & Kashmir',  country: 'India', lat: 32.7266, lon: 74.8570, flag: '🇮🇳' },
};

async function showAuto(query) {
  query = query.trim().toLowerCase();
  autoBox.innerHTML = '';
  if (!query || query.length < 2) { autoBox.classList.add('hidden'); return; }
  autoBox.classList.remove('hidden');

  // 1. Check priority list first
  const matched = Object.keys(PRIORITY_PLACES).find(k => query.includes(k));
  if (matched) {
    const r = PRIORITY_PLACES[matched];
    const el = buildAutoItem(`${r.flag} ${r.name}, ${r.admin1}, ${r.country}`, r.lat, r.lon, r.name, r.country);
    autoBox.appendChild(el);
    return;
  }

  // 2. OpenWeatherMap geocoding API
  try {
    const data = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=6&appid=${OW_KEY}`
    ).then(r => r.json());

    if (!data?.length) { autoBox.classList.add('hidden'); return; }

    data.forEach(loc => {
      const label = [loc.name, loc.state, loc.country].filter(Boolean).join(', ');
      const el = buildAutoItem(label, loc.lat, loc.lon, loc.name, loc.country);
      autoBox.appendChild(el);
    });
  } catch (e) {
    autoBox.classList.add('hidden');
  }
}

function buildAutoItem(label, lat, lon, name, country) {
  const el = document.createElement('div');
  el.className = 'auto-item';
  el.textContent = label;
  el.addEventListener('click', () => {
    cityInput.value = name;
    selLat = lat; selLon = lon; selName = name; selCountry = country;
    autoBox.classList.add('hidden');
    handleSearch();
  });
  return el;
}

/* ─────────────────────────────────────────────
   ERROR HELPER
───────────────────────────────────────────── */
let errTimer = null;

function showErr(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(errTimer);
  errTimer = setTimeout(() => el.classList.remove('show'), 4000);
  endLoad();
}