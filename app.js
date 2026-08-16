const tracks = [
  {
    title: "Glass on the Overpass",
    artist: "Northbound Echo",
    tags: "neon rain midnight drive",
    duration: 214,
  },
  {
    title: "Slow Horns, Open Window",
    artist: "Clara Voss Quartet",
    tags: "slow horns jazz night air",
    duration: 268,
  },
  {
    title: "Taxi After the Show",
    artist: "Red Line",
    tags: "midnight drive city brass",
    duration: 193,
  },
  {
    title: "Kitchen Light at 2am",
    artist: "Mara Finch",
    tags: "quiet folk late kitchen",
    duration: 181,
  },
  {
    title: "Static Between Stations",
    artist: "Low Voltage",
    tags: "radio haze analog",
    duration: 241,
  },
  {
    title: "Harbor in August",
    artist: "Salt & Cedar",
    tags: "warm water dusk",
    duration: 226,
  },
  {
    title: "Last Call Chromatic",
    artist: "The After Hours",
    tags: "bar neon brass",
    duration: 199,
  },
  {
    title: "Paper Moon / Wet Streets",
    artist: "June Hollow",
    tags: "rain lyric night",
    duration: 252,
  },
  {
    title: "Bassline You Can't Shake",
    artist: "Kite District",
    tags: "bass groove club",
    duration: 208,
  },
  {
    title: "Corridor Hum",
    artist: "Atlas Motel",
    tags: "ambient hallway hush",
    duration: 275,
  },
  {
    title: "Gold Leaf Sunday",
    artist: "Pines & Co.",
    tags: "sun porch acoustic",
    duration: 187,
  },
  {
    title: "Return Ticket",
    artist: "Eastbound",
    tags: "train window dusk",
    duration: 221,
  },
];

const listEl = document.getElementById("track-list");
const form = document.getElementById("search-form");
const queryEl = document.getElementById("query");
const hintEl = document.getElementById("search-hint");
const playBtn = document.getElementById("play-btn");
const vinyl = document.getElementById("vinyl");
const vinylTitle = document.getElementById("vinyl-title");
const vinylArtist = document.getElementById("vinyl-artist");
const nowTitle = document.getElementById("now-title");
const nowMeta = document.getElementById("now-meta");
const bar = document.getElementById("progress-bar");
const timeLabel = document.getElementById("time-label");

let current = null;
let playing = false;
let elapsed = 0;
let timer = null;

function score(track, q) {
  const hay = `${track.title} ${track.artist} ${track.tags}`.toLowerCase();
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  return words.reduce((sum, w) => sum + (hay.includes(w) ? 2 : 0) + (hay.split(w).length - 1), 0);
}

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderList(items) {
  listEl.innerHTML = "";
  items.forEach((track, i) => {
    const li = document.createElement("li");
    if (current && current.title === track.title) li.classList.add("active");
    li.innerHTML = `
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <div class="track-meta">
        <strong>${track.title}</strong>
        <span>${track.artist}</span>
      </div>
      <span class="tags">${fmt(track.duration)} · ${track.tags.split(" ").slice(0, 2).join(" · ")}</span>
    `;
    li.addEventListener("click", () => cue(track, true));
    listEl.appendChild(li);
  });
}

function cue(track, autoplay) {
  current = track;
  elapsed = 0;
  vinylTitle.textContent = track.title;
  vinylArtist.textContent = track.artist;
  nowTitle.textContent = track.title;
  nowMeta.textContent = `${track.artist} · ${fmt(track.duration)} · ${track.tags}`;
  playBtn.disabled = false;
  bar.style.width = "0%";
  timeLabel.textContent = "0:00";
  renderList(filterTracks(queryEl.value));
  if (autoplay) setPlaying(true);
}

function setPlaying(on) {
  if (!current) return;
  playing = on;
  vinyl.dataset.spinning = on ? "true" : "false";
  playBtn.textContent = on ? "Pause" : "Play";
  clearInterval(timer);
  if (!on) return;
  timer = setInterval(() => {
    elapsed += 0.2;
    if (elapsed >= current.duration) {
      elapsed = current.duration;
      setPlaying(false);
    }
    bar.style.width = `${(elapsed / current.duration) * 100}%`;
    timeLabel.textContent = fmt(elapsed);
  }, 200);
}

function filterTracks(q) {
  const ranked = tracks
    .map((t) => ({ t, s: score(t, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
  return ranked.length ? ranked : tracks;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = queryEl.value.trim();
  const results = filterTracks(q);
  renderList(results);
  hintEl.textContent = q
    ? `${results.length} match${results.length === 1 ? "" : "es"} for “${q}”.`
    : "12 tracks in the house catalog.";
  if (q && results[0]) cue(results[0], true);
});

playBtn.addEventListener("click", () => setPlaying(!playing));

renderList(tracks);
