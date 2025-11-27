let selectedLat = null;
let selectedLon = null;
let selectedResolvedName = null;
let selectedCountry = null;


const autoBox = document.getElementById("autocompleteBox");


const OPENWEATHER_API_KEY = "e2c346193a2645f7b3de8d8e515cd0dd";

const WEATHERAPI_KEY = "YOUR_WEATHERAPI_KEY_HERE"; // optional
const WEATHERAPI_URL = "https://api.weatherapi.com/v1";
const OPENMETEO_URL = "https://api.open-meteo.com/v1";
const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5";

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locBtn = document.getElementById("locBtn");

const errorMessage = document.getElementById("errorMessage");
const currentWeather = document.getElementById("currentWeather");
const forecast = document.getElementById("forecast");
const hourlyBox = document.getElementById("hourly");
const aqiBox = document.getElementById("aqiBox");
const alertsBox = document.getElementById("alertsBox");
const body = document.getElementById("appBody");


// canvas for animations
const canvas = document.getElementById("weatherCanvas");
const ctx = canvas.getContext("2d");
let W, H;
let animationMode = "clear";
let particles = [];

// ============ EVENT LISTENERS ============

searchBtn.addEventListener("click", handleSearch);
cityInput.addEventListener("input", () => {
    showAutocomplete(cityInput.value.trim());
});

cityInput.addEventListener("keypress", e => { if (e.key === "Enter") handleSearch(); });


cityInput.addEventListener("input", async () => {
    const query = cityInput.value.trim();
    if (!query) {
        suggestions.innerHTML = "";
        return;
    }

    const geo = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${OPENWEATHER_API_KEY}`
    ).then(r => r.json());

    suggestions.innerHTML = geo.map(r => `
        <div class="suggestion-item"
             data-lat="${r.lat}"
             data-lon="${r.lon}"
             data-name="${r.name}"
             data-country="${r.country}">
            ${r.name}, ${r.state ? r.state + ", " : ""}${r.country}
        </div>
    `).join("");
});



document.addEventListener("click", e => {

    if (!e.target.classList.contains("suggestion-item")) return;

    const lat = e.target.dataset.lat;
    const lon = e.target.dataset.lon;
    const name = e.target.dataset.name;
    const country = e.target.dataset.country;

    cityInput.value = `${name}, ${country}`;
    suggestions.innerHTML = "";  // clear dropdown

    // IMPORTANT: Fetch weather by coordinates
    handleSearchByCoordinates(lat, lon, name, country);
});



locBtn.addEventListener("click", getLocationWeather);

window.addEventListener("resize", resizeCanvas);

// init
body.classList.add("base-bg");
resizeCanvas();
startCanvasLoop();

// ============ MAIN FLOW ============

async function handleSearch() {

    // 1️⃣ If user selected from autocomplete, we already have coordinates.
    if (selectedLat !== null && selectedLon !== null) {
        try {
            hideError();

            const lat = selectedLat;
            const lon = selectedLon;

            const resolvedName = selectedResolvedName || cityInput.value.trim();
            const country = selectedCountry || "Unknown";

            // Name-based API (OpenWeather current)
            const avgData = await fetchMultipleAPIs(resolvedName);

            const minmax = await fetchMinMaxByCoords(lat, lon);
            const sun = await fetchSunTimes(resolvedName);

            // Hybrid AQI (India → CPCB, others → Global AQI)
            const aqiData = await getHybridAQI(resolvedName, country);
            const alerts = await fetchAlerts(resolvedName);

            avgData.temp_min = minmax.min;
            avgData.temp_max = minmax.max;
            avgData.sunrise = sun.sunrise;
            avgData.sunset = sun.sunset;
            avgData.aqi = aqiData.aqi;
            avgData.aqiCategory = aqiData.category;
            avgData.aqiColor = aqiData.color;
            avgData.aqiEmoji = aqiData.emoji;

            updateThemeAndAnimation(avgData.description);

            displayCurrentWeather(avgData);
            displayAQI(aqiData);
            displayAlerts(alerts);
            await displayHourlyByCoords(lat, lon);
            await fetchForecastByCoords(lat, lon);

            // Reset so next manual search works normally
            selectedLat = null;
            selectedLon = null;

            return;

        } catch (err) {
            showError(err.message || "Something went wrong.");
            return;
        }
    }

    // 2️⃣ If no autocomplete selection, follow your normal city-name lookup.
    let raw = cityInput.value.trim();
    let city = sanitizeCity(raw);
    if (!city) return showError("Please enter a city name");

    try {
        hideError();

        const place = await resolvePlace(city);
        const { lat, lon, resolvedName, country } = place;

        const avgData = await fetchMultipleAPIs(resolvedName);
        const minmax = await fetchMinMaxByCoords(lat, lon);
        const sun = await fetchSunTimes(resolvedName);
        const aqiData = await getHybridAQI(resolvedName, country);
        const alerts = await fetchAlerts(resolvedName);

        avgData.temp_min = minmax.min;
        avgData.temp_max = minmax.max;
        avgData.sunrise = sun.sunrise;
        avgData.sunset = sun.sunset;
        avgData.aqi = aqiData.aqi;
        avgData.aqiCategory = aqiData.category;
        avgData.aqiColor = aqiData.color;
        avgData.aqiEmoji = aqiData.emoji;

        updateThemeAndAnimation(avgData.description);

        displayCurrentWeather(avgData);
        displayAQI(aqiData);
        displayAlerts(alerts);
        await displayHourlyByCoords(lat, lon);
        await fetchForecastByCoords(lat, lon);

    } catch (err) {
        showError(err.message || "Something went wrong.");
    }
}


async function getLocationWeather() {
    navigator.geolocation.getCurrentPosition(async pos => {
        try {
            hideError();

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            const geoURL = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`;
            const geoRes = await fetch(geoURL);
            const geo = await geoRes.json();

            if (!geo || !geo.length || !geo[0].name) {
                throw new Error("Unable to detect city from GPS.");
            }

            cityInput.value = sanitizeCity(geo[0].name);
            handleSearch();
        } catch (err) {
            showError("Location detected, but city name not found. Try entering manually.");
        }
    }, () => showError("Location permission denied."));
}

// ============ FETCH HELPERS ============

async function fetchMultipleAPIs(city) {
    const results = [];

    try { results.push(await fetchOpenWeather(city)); }
    catch (e) { console.warn("OpenWeather failed:", e.message); }

    try {
        if (WEATHERAPI_KEY !== "YOUR_WEATHERAPI_KEY_HERE") {
            results.push(await fetchWeatherAPI(city));
        }
    } catch (e) { console.warn("WeatherAPI failed:", e.message); }

    try { results.push(await fetchOpenMeteo(city)); }
    catch (e) { console.warn("OpenMeteo failed:", e.message); }

    if (results.length > 0) {
        hideError();
        return averageWeather(results);
    }

    showError("All weather APIs failed.");
    throw new Error("No data from any API.");
}

async function fetchOpenWeather(city) {
    const res = await fetch(`${OPENWEATHER_URL}/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`);
    if (!res.ok) throw new Error("City not found.");
    const d = await res.json();
    return {
        source: "OpenWeather",
        temp: d.main.temp,
        feels_like: d.main.feels_like,
        humidity: d.main.humidity,
        wind_speed: d.wind.speed,
        pressure: d.main.pressure,
        description: d.weather[0].description,
        icon: d.weather[0].icon,
        city_name: d.name,
        country: d.sys.country
    };
}

async function fetchWeatherAPI(city) {
    const res = await fetch(`${WEATHERAPI_URL}/current.json?key=${WEATHERAPI_KEY}&q=${city}`);
    const d = await res.json();
    return {
        source: "WeatherAPI",
        temp: d.current.temp_c,
        feels_like: d.current.feelslike_c,
        humidity: d.current.humidity,
        wind_speed: d.current.wind_kph / 3.6,
        pressure: d.current.pressure_mb,
        description: d.current.condition.text,
        icon: "01d",
        city_name: d.location.name,
        country: d.location.country
    };
}

async function fetchOpenMeteo(city) {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
    const g = await geo.json();

    if (!g.results || !g.results.length) {
        throw new Error("City not found OM");
    }

    const lat = g.results[0].latitude;
    const lon = g.results[0].longitude;

    const weather = await fetch(
        `${OPENMETEO_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,pressure_msl`
    );
    const w = await weather.json();

    return {
        source: "Open-Meteo",
        temp: w.current.temperature_2m,
        feels_like: w.current.apparent_temperature,
        humidity: w.current.relative_humidity_2m,
        wind_speed: w.current.wind_speed_10m / 3.6,
        pressure: w.current.pressure_msl,
        description: "Weather",
        icon: "01d",
        city_name: g.results[0].name,
        country: g.results[0].country
    };
}

function sanitizeCity(city) {
    return city
        .replace(/municipal corporation/i, "")
        .replace(/corporation/i, "")
        .replace(/district/i, "")
        .replace(/city/i, "")
        .replace(/,/g, "")
        .trim();
}

function averageWeather(arr) {
    const avg = key => arr.reduce((s, x) => s + x[key], 0) / arr.length;
    return {
        temp: avg("temp"),
        feels_like: avg("feels_like"),
        humidity: avg("humidity"),
        wind_speed: avg("wind_speed"),
        pressure: avg("pressure"),
        description: arr[0].description,
        icon: arr[0].icon,
        city_name: arr[0].city_name,
        country: arr[0].country
    };
}

// min/max using 24h forecast
async function fetchMinMaxByCoords(lat, lon) {
    const res = await fetch(
        `${OPENWEATHER_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );
    const data = await res.json();

    if (!res.ok || !data.list) {
        throw new Error("Forecast not available for this location.");
    }

    const nextDay = data.list.slice(0, 8);
    return {
        min: Math.min(...nextDay.map(i => i.main.temp_min)),
        max: Math.max(...nextDay.map(i => i.main.temp_max))
    };
}


// sunrise/sunset
async function fetchSunTimes(city) {
    const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${OPENWEATHER_API_KEY}`;
    const geo = await fetch(geoURL).then(r => r.json());
    const lat = geo[0].lat;
    const lon = geo[0].lon;
    const url = `${OPENWEATHER_URL}/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
    const w = await fetch(url).then(r => r.json());
    return {
        sunrise: w.sys.sunrise * 1000,
        sunset: w.sys.sunset * 1000
    };
}

// ============================
// AQI HELPERS
// ============================

function getAQIEmoji(category) {
    if (!category) return "😐";
    const c = category.toLowerCase();
    if (c.includes("good") || c.includes("satisfactory")) return "😊";
    if (c.includes("moderate")) return "😐";
    if (c.includes("unhealthy for sensitive")) return "😷";
    if (c.includes("poor") || c.includes("unhealthy")) return "😷";
    if (c.includes("very poor") || c.includes("very unhealthy") || c.includes("severe")) return "☠️";
    if (c.includes("hazardous")) return "☠️";
    return "😐";
}

// CPCB AQI (India only)
async function fetchCPCB_AQI(city) {
    try {
        const url = "https://app.cpcbccr.com/ccr/api/v1/aqi?page=1&limit=5000";
        const res = await fetch(url);
        const json = await res.json();

        const stations = json.data;

        const match = stations.find(s =>
            s.city && s.city.toLowerCase() === city.toLowerCase()
        );

        if (!match) {
            return { aqi: null, category: "Not Available", color: "#999", emoji: "😐" };
        }

        const aqiColors = {
            "Good": "#00e400",
            "Satisfactory": "#a7d934",
            "Moderate": "#ffbf00",
            "Poor": "#ff7e00",
            "Very Poor": "#ff0000",
            "Severe": "#7e0023"
        };

        const category = match.aqiCategory;
        const color = aqiColors[category] || "#999";
        const emoji = getAQIEmoji(category);

        return {
            aqi: match.aqi,
            category,
            color,
            emoji
        };

    } catch (err) {
        console.error("CPCB AQI error:", err);
        return { aqi: null, category: "Not Available", color: "#999", emoji: "😐" };
    }
}

// GLOBAL AQI (Open-Meteo World)
async function fetchGlobalAQI(lat, lon) {
    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi`;
        const res = await fetch(url);
        const data = await res.json();

        const aqi = data.hourly.us_aqi[0];

        let category = "Good";
        let color = "#00e400";

        if (aqi >= 300) { category = "Hazardous"; color = "#7e0023"; }
        else if (aqi >= 200) { category = "Very Unhealthy"; color = "#8f3f97"; }
        else if (aqi >= 150) { category = "Unhealthy"; color = "#ff0000"; }
        else if (aqi >= 100) { category = "Unhealthy for Sensitive Groups"; color = "#ff7e00"; }
        else if (aqi >= 50) { category = "Moderate"; color = "#ffbf00"; }

        const emoji = getAQIEmoji(category);

        return { aqi, category, color, emoji };

    } catch (err) {
        console.error("Global AQI error:", err);
        return {
            aqi: null,
            category: "Not Available",
            color: "#999",
            emoji: "😐"
        };
    }
}

// Hybrid AQI (India = CPCB, world = Open-Meteo)
async function getHybridAQI(city, country) {
    try {
        // Just use Open-Meteo global AQI for entire world
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        const g = await geo.json();

        if (!g.results || !g.results.length) {
            throw new Error("City not found for AQI");
        }

        const lat = g.results[0].latitude;
        const lon = g.results[0].longitude;

        return await fetchGlobalAQI(lat, lon);
    } catch (err) {
        console.error("Hybrid AQI error:", err);
        return { aqi: null, category: "Not Available", color: "#999", emoji: "😐" };
    }
}


// Alerts
async function fetchAlerts(city) {
    const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${OPENWEATHER_API_KEY}`);
    const g = await geo.json();
    if (!g.length) return [];
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${g[0].lat}&lon=${g[0].lon}&appid=${OPENWEATHER_API_KEY}`;
    const d = await fetch(url).then(r => r.json());
    return d.alerts || [];
}

function displayAlerts(alerts) {
    if (!alerts.length) {
        alertsBox.classList.add("hidden");
        alertsBox.innerHTML = "";
        return;
    }
    alertsBox.innerHTML = `<strong>⚠ Weather Alert:</strong> ${alerts[0].event}<br><br>${alerts[0].description}`;
    alertsBox.classList.remove("hidden");
}

// Hourly
async function displayHourlyByCoords(lat, lon) {
    const res = await fetch(
        `${OPENWEATHER_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );
    const data = await res.json();

    if (!res.ok || !data.list) {
        throw new Error("Hourly forecast not available for this location.");
    }

    const first12 = data.list.slice(0, 12);

    const cards = first12.map(i => `
        <div class="hour-card">
            <div>${new Date(i.dt * 1000).toLocaleTimeString([], { hour: "2-digit" })}</div>
            <img src="https://openweathermap.org/img/wn/${i.weather[0].icon}.png" alt="">
            <div>${Math.round(i.main.temp)}°C</div>
        </div>
    `).join("");

    hourlyBox.innerHTML = `
        <h2>Hourly Forecast</h2>
        <div class="hourly-strip">${cards}</div>
    `;
    hourlyBox.classList.remove("hidden");
}


// 5-day forecast
async function fetchForecastByCoords(lat, lon) {
    const res = await fetch(
        `${OPENWEATHER_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const data = await res.json();

    if (!res.ok || !data.list) {
        throw new Error("5-day forecast not available for this location.");
    }

    const daily = data.list
        .filter(i => i.dt_txt.includes("12:00:00"))
        .slice(0, 5);

    const cards = daily.map(i => `
        <div class="forecast-card">
            <div class="forecast-date">
                ${new Date(i.dt * 1000).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                })}
            </div>
            <img src="https://openweathermap.org/img/wn/${i.weather[0].icon}@2x.png" alt="">
            <div class="forecast-temp">${Math.round(i.main.temp)}°C</div>
            <div class="forecast-desc">${i.weather[0].description}</div>
        </div>
    `).join("");

    forecast.innerHTML = `
        <h2>5-Day Forecast</h2>
        <div class="forecast-cards">${cards}</div>
    `;
    forecast.classList.remove("hidden");
}


// ============ UI OUTPUT ============

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.add("show");
}

function hideError() {
    errorMessage.classList.remove("show");
}

function displayCurrentWeather(data) {
    const sunrise = new Date(data.sunrise).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sunset = new Date(data.sunset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    currentWeather.innerHTML = `
        <div class="current-header">
            <div>
                <div class="city-name">${data.city_name}, ${data.country}</div>
                <div class="date">${new Date().toDateString()}</div>
            </div>
        </div>

        <div class="current-main">
            <div class="temperature">${Math.round(data.temp)}°C</div>
            <img src="https://openweathermap.org/img/wn/${data.icon}@4x.png" alt="" class="weather-icon">
            <div class="weather-info">
                <div class="weather-description">${data.description}</div>
                <div>Feels like ${Math.round(data.feels_like)}°C</div>
            </div>
        </div>

        <div class="weather-details">
            <div class="detail-item">
                <div class="detail-label">Humidity</div>
                <div class="detail-value">${Math.round(data.humidity)}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Wind</div>
                <div class="detail-value">${data.wind_speed.toFixed(1)} m/s</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Pressure</div>
                <div class="detail-value">${Math.round(data.pressure)} hPa</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Min / Max</div>
                <div class="detail-value">${Math.round(data.temp_min)}° / ${Math.round(data.temp_max)}°</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sunrise</div>
                <div class="detail-value">${sunrise}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sunset</div>
                <div class="detail-value">${sunset}</div>
            </div>
            <div class="detail-item" style="border-left: 6px solid ${data.aqiColor || "#999"};">
                <div class="detail-label">Air Quality</div>
                <div class="detail-value">
                    ${
                        data.aqi != null
                            ? `AQI ${Math.round(data.aqi)} – ${data.aqiCategory} ${data.aqiEmoji || ""}`
                            : "Not Available"
                    }
                </div>
            </div>
        </div>
    `;

    currentWeather.classList.remove("hidden");
    currentWeather.classList.add("show");
}

function displayAQI(aqiData) {
    if (!aqiData || aqiData.aqi == null) {
        aqiBox.innerHTML = `<strong>Air Quality:</strong> Not Available`;
        aqiBox.style.borderLeft = "4px solid #999";
        aqiBox.classList.remove("hidden");
        return;
    }

    aqiBox.innerHTML = `
        <strong>Air Quality:</strong> AQI ${Math.round(aqiData.aqi)} – 
        ${aqiData.category} ${aqiData.emoji || ""}
    `;
    aqiBox.style.borderLeft = `4px solid ${aqiData.color}`;
    aqiBox.classList.remove("hidden");
}

// ============ THEME & ANIMATION ============

function updateThemeAndAnimation(desc) {
    const d = desc.toLowerCase();
    body.className = "base-bg"; // reset

    if (d.includes("rain") || d.includes("drizzle")) {
        body.classList.add("rain-tint");
        animationMode = "rain";
    } else if (d.includes("snow")) {
        body.classList.add("snow-tint");
        animationMode = "snow";
    } else if (d.includes("storm") || d.includes("thunder")) {
        body.classList.add("storm-tint");
        animationMode = "storm";
    } else if (d.includes("fog") || d.includes("mist") || d.includes("haze")) {
        body.classList.add("fog-tint");
        animationMode = "fog";
    } else if (d.includes("cloud")) {
        body.classList.add("cloudy-tint");
        animationMode = "clouds";
    } else {
        body.classList.add("sunny-tint");
        animationMode = "clear";
    }

    initParticles();
}

// ============ CANVAS ANIMATIONS ============

function resizeCanvas() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initParticles();
}

function initParticles() {
    particles = [];
    if (animationMode === "rain" || animationMode === "storm") {
        for (let i = 0; i < 220; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                len: 10 + Math.random() * 20,
                speed: 8 + Math.random() * 10
            });
        }
    } else if (animationMode === "snow") {
        for (let i = 0; i < 180; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 1 + Math.random() * 3,
                speedY: 1 + Math.random() * 2,
                speedX: -0.5 + Math.random()
            });
        }
    } else if (animationMode === "clouds" || animationMode === "fog") {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * (H * 0.5),
                w: 200 + Math.random() * 200,
                h: 60 + Math.random() * 30,
                speed: 0.2 + Math.random() * 0.4,
                opacity: 0.15 + Math.random() * 0.15
            });
        }
    } else {
        // clear: subtle floating dots
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 1 + Math.random() * 2,
                speedY: 0.2 + Math.random() * 0.4
            });
        }
    }
}

function startCanvasLoop() {
    function loop() {
        ctx.clearRect(0, 0, W, H);

        if (animationMode === "rain" || animationMode === "storm") {
            ctx.strokeStyle = animationMode === "storm"
                ? "rgba(226,232,240,0.7)"
                : "rgba(191,219,254,0.7)";
            ctx.lineWidth = 1.2;
            ctx.lineCap = "round";
            particles.forEach(p => {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y + p.len);
                ctx.stroke();
                p.y += p.speed;
                p.x += 0.5;
                if (p.y > H) {
                    p.y = -20;
                    p.x = Math.random() * W;
                }
            });

            // occasional lightning flash
            if (animationMode === "storm" && Math.random() < 0.005) {
                ctx.fillStyle = "rgba(255,255,255,0.25)";
                ctx.fillRect(0, 0, W, H);
            }

        } else if (animationMode === "snow") {
            ctx.fillStyle = "rgba(226,232,240,0.9)";
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                p.y += p.speedY;
                p.x += p.speedX;
                if (p.y > H) p.y = -5;
                if (p.x > W) p.x = 0;
                if (p.x < 0) p.x = W;
            });

        } else if (animationMode === "clouds" || animationMode === "fog") {
            particles.forEach(p => {
                const grad = ctx.createRadialGradient(
                    p.x + p.w / 2,
                    p.y + p.h / 2,
                    10,
                    p.x + p.w / 2,
                    p.y + p.h / 2,
                    p.w
                );
                grad.addColorStop(0, `rgba(241,245,249,${p.opacity})`);
                grad.addColorStop(1, "transparent");
                ctx.fillStyle = grad;
                ctx.fillRect(p.x, p.y, p.w, p.h);
                p.x += p.speed;
                if (p.x - p.w > W) p.x = -p.w;
            });

        } else {
            // clear: floating dust
            ctx.fillStyle = "rgba(248,250,252,0.85)";
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                p.y += p.speedY;
                if (p.y > H) {
                    p.y = -5;
                    p.x = Math.random() * W;
                }
            });
        }

        requestAnimationFrame(loop);
    }
    loop();
}



async function resolvePlace(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || !data.results.length) {
        throw new Error("Place not found. Try a more specific name.");
    }

    const r = data.results[0];
    return {
        lat: r.latitude,
        lon: r.longitude,
        resolvedName: r.name,
        country: r.country
    };
}




async function showAutocomplete(query) {
    query = query.trim().toLowerCase();
    autoBox.innerHTML = "";

    if (!query || query.length < 2) {
        autoBox.classList.add("hidden");
        return;
    }

    autoBox.classList.remove("hidden");

    // ---------- 1️⃣ PRIORITY INDIA PLACES (with accurate coordinates) ----------
    const PRIORITY = {
        "kashmir": {
            name: "Srinagar",
            admin1: "Jammu & Kashmir",
            country: "India",
            lat: 34.0837,
            lon: 74.7973,
            flag: "🇮🇳"
        },
        "punjab": {
            name: "Chandigarh",
            admin1: "Punjab",
            country: "India",
            lat: 30.7410,
            lon: 76.7683,
            flag: "🇮🇳"
        },
        "uttarakhand": {
            name: "Dehradun",
            admin1: "Uttarakhand",
            country: "India",
            lat: 30.3165,
            lon: 78.0322,
            flag: "🇮🇳"
        },
        "himachal": {
            name: "Shimla",
            admin1: "Himachal Pradesh",
            country: "India",
            lat: 31.1048,
            lon: 77.1734,
            flag: "🇮🇳"
        },
        "himalayas": {
            name: "Leh",
            admin1: "Ladakh",
            country: "India",
            lat: 34.1526,
            lon: 77.5771,
            flag: "🇮🇳"
        },
        "ladakh": {
            name: "Leh",
            admin1: "Ladakh",
            country: "India",
            lat: 34.1526,
            lon: 77.5771,
            flag: "🇮🇳"
        },
        "jammu": {
            name: "Jammu",
            admin1: "Jammu & Kashmir",
            country: "India",
            lat: 32.7266,
            lon: 74.8570,
            flag: "🇮🇳"
        }
    };

    const matched = Object.keys(PRIORITY).find(k => query.includes(k));

    if (matched) {
        const r = PRIORITY[matched];

        const item = document.createElement("div");
        item.className = "auto-item";
        item.textContent = `${r.flag} ${r.name}, ${r.admin1}, ${r.country}`;

        item.dataset.name = r.name;
        item.dataset.lat = r.lat;
        item.dataset.lon = r.lon;
        item.dataset.country = r.country;
        item.dataset.resolvedName = r.name;

        item.addEventListener("click", () => {
            cityInput.value = r.name;

            selectedLat = r.lat;
            selectedLon = r.lon;
            selectedResolvedName = r.name;
            selectedCountry = r.country;

            autoBox.classList.add("hidden");
            handleSearch();
        });

        autoBox.appendChild(item);
        return; // DO NOT show global results for these keywords
    }

    // ---------- 2️⃣ GLOBAL AUTOCOMPLETE ----------
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=6&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.results) {
            autoBox.classList.add("hidden");
            return;
        }

        data.results.forEach(loc => {
            const item = document.createElement("div");
            item.className = "auto-item";

            item.textContent = `${loc.name}, ${loc.admin1 || ""}, ${loc.country}`;

            item.dataset.name = loc.name;
            item.dataset.lat = loc.latitude;
            item.dataset.lon = loc.longitude;
            item.dataset.country = loc.country;
            item.dataset.resolvedName = loc.name;

            item.addEventListener("click", () => {
                cityInput.value = loc.name;

                selectedLat = loc.latitude;
                selectedLon = loc.longitude;
                selectedResolvedName = loc.name;
                selectedCountry = loc.country;

                autoBox.classList.add("hidden");
                handleSearch();
            });

            autoBox.appendChild(item);
        });

    } catch (err) {
        autoBox.classList.add("hidden");
    }
}

