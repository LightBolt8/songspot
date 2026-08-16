const S = window.SongspotSpotify;
const STAGES_MS = [500, 1500, 3000, 5000, 8000, 16000];
const app = document.getElementById("app");

const state = {
  me: null,
  artists: [],
  playlists: [],
  savedTracks: [],
  savedCount: 0,
  playerReady: false,
  view: "boot",
  game: null,
};

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imgOr(url, letter) {
  if (url) return `<img src="${esc(url)}" alt="" />`;
  return `<span class="fallback">${esc(letter || "?")}</span>`;
}

function header(active) {
  const name = state.me?.display_name || "You";
  const pic = state.me?.images?.[0]?.url;
  return `
    <header class="nav">
      <a class="logo" href="#home" data-nav="home">
        <span class="logo-mark"></span>
        Songspot
      </a>
      <div class="nav-right">
        <span class="user-chip">
          ${imgOr(pic, name[0])}
          ${esc(name)}
        </span>
        <button type="button" class="text-btn" data-action="logout">Log out</button>
      </div>
    </header>
  `;
}

function renderLogin(error) {
  const savedId = S.getClientId();
  const uri = S.redirectUri();
  app.innerHTML = `
    <header class="nav">
      <span class="logo"><span class="logo-mark"></span> Songspot</span>
    </header>
    <main class="login">
      <p class="kicker">Your music. Your clips.</p>
      <h1>Log in with Spotify, then play Songless with your library.</h1>
      <p class="lede">
        See the playlists saved in your Spotify library, pick one, and guess
        the track from a growing snippet — 0.5s up to 16s.
      </p>
      ${error ? `<p class="banner error">${esc(error)}</p>` : ""}
      <form class="setup" id="login-form">
        <label for="client-id">Spotify Client ID</label>
        <input id="client-id" name="clientId" value="${esc(savedId)}" placeholder="paste from the Spotify dashboard" required />
        <p class="hint">
          Create an app at
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a>,
          then add this Redirect URI exactly:
        </p>
        <code class="uri">${esc(uri)}</code>
        <button type="submit">Continue with Spotify</button>
        <p class="hint">Playback of real clips needs Spotify Premium. Free accounts may only hear 30s previews when Spotify provides them.</p>
      </form>
    </main>
  `;
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    S.setClientId(document.getElementById("client-id").value);
    try {
      await S.loginWithSpotify();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function renderLibrary() {
  const premium = state.me?.product === "premium";
  app.innerHTML = `
    ${header("home")}
    <main class="library">
      <section class="hero-row">
        <div>
          <p class="kicker">Library</p>
          <h1>Good to see you, ${esc(state.me.display_name.split(" ")[0])}.</h1>
          <p class="lede">These are the playlists saved in your Spotify library. Click one to play Songless with those tracks.</p>
        </div>
        <p class="status-pill ${premium && state.playerReady ? "ok" : ""}">
          ${
            premium
              ? state.playerReady
                ? "Player ready"
                : "Connecting player…"
              : "Free account — previews only when available"
          }
        </p>
      </section>
      <section class="upload-panel">
        <div class="section-head">
          <h2>Upload a playlist</h2>
          <p>Drop a .txt, .csv, .m3u, or .json list of tracks</p>
        </div>
        <div class="upload-form">
          <label class="file-btn btn">
            Choose file
            <input id="playlist-file" type="file" accept=".txt,.csv,.m3u,.m3u8,.json,text/plain,text/csv,application/json" hidden />
          </label>
        </div>
        <p class="hint" id="upload-status">
          One track per line like <code>Song Title - Artist</code>, or CSV columns title,artist.
        </p>
      </section>
      <section>
        <div class="section-head">
          <h2>Saved playlists</h2>
          <p>Liked Songs plus playlists you created or follow</p>
        </div>
        <div class="card-grid playlists" id="playlists"></div>
      </section>
      <section>
        <div class="section-head">
          <h2>Top artists</h2>
          <p>Optional — play Songless from an artist’s top tracks</p>
        </div>
        <div class="card-grid" id="artists"></div>
      </section>
    </main>
  `;

  const artistsEl = document.getElementById("artists");
  if (!state.artists.length) {
    artistsEl.innerHTML = `<p class="empty">No top artists yet. Play more on Spotify, then come back.</p>`;
  } else {
    artistsEl.innerHTML = state.artists
      .map(
        (a) => `
        <button type="button" class="card artist" data-kind="artist" data-id="${esc(a.id)}" data-name="${esc(a.name)}">
          <div class="cover round">${imgOr(a.images?.[0]?.url, a.name[0])}</div>
          <strong>${esc(a.name)}</strong>
          <span>${esc((a.genres || []).slice(0, 2).join(" · ") || "Artist")}</span>
        </button>`
      )
      .join("");
  }

  const playlistsEl = document.getElementById("playlists");
  const likedCount = state.savedCount;
  const likedCard = `
      <button type="button" class="card" data-kind="saved" data-id="liked" data-name="Liked Songs">
        <div class="cover liked">${imgOr("", "♥")}</div>
        <strong>Liked Songs</strong>
        <span>${likedCount ? `${likedCount}+ saved` : "Your saved tracks"}</span>
      </button>`;
  const playlistCards = state.playlists
    .map((p) => {
      const owner = p.owner?.display_name ? ` · ${p.owner.display_name}` : "";
      const total = p.tracks?.total ?? 0;
      return `
      <button type="button" class="card" data-kind="playlist" data-id="${esc(p.id)}" data-name="${esc(p.name)}">
        <div class="cover">${imgOr(p.images?.[0]?.url, p.name[0])}</div>
        <strong>${esc(p.name)}</strong>
        <span>${total} tracks${esc(owner)}</span>
      </button>`;
    })
    .join("");
  playlistsEl.innerHTML =
    likedCard +
    (playlistCards || `<p class="empty">No playlists in your library yet.</p>`);

  app.querySelectorAll(".card").forEach((btn) => {
    btn.addEventListener("click", () =>
      startGame({
        kind: btn.dataset.kind,
        id: btn.dataset.id,
        name: btn.dataset.name,
      })
    );
  });
  bindUpload();
  bindChrome();
}

function bindUpload() {
  const status = document.getElementById("upload-status");
  const fileInput = document.getElementById("playlist-file");
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.classList.remove("error");
    status.textContent = `Reading ${file.name}…`;
    try {
      const text = await file.text();
      const lines = parsePlaylistFile(text, file.name);
      if (!lines.length) {
        throw new Error("No tracks found in that file.");
      }
      status.textContent = `Matching ${Math.min(lines.length, 100)} tracks on Spotify…`;
      const market = state.me?.country || "US";
      const tracks = await S.resolveUploadedLines(lines, market, (done, total, q) => {
        status.textContent = `Matching ${done}/${total}: ${q}`;
      });
      if (!tracks.length) {
        throw new Error("Couldn’t match any lines to Spotify tracks.");
      }
      status.textContent = `Matched ${tracks.length} tracks. Starting Songless…`;
      startGame({
        kind: "upload",
        id: "upload",
        name: file.name.replace(/\.[^.]+$/, "") || "Uploaded playlist",
        tracks,
      });
    } catch (err) {
      status.classList.add("error");
      status.textContent = err.message;
    } finally {
      fileInput.value = "";
    }
  });
}

function parsePlaylistFile(text, filename = "") {
  const name = filename.toLowerCase();
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];

  if (name.endsWith(".json") || raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data)
        ? data
        : data.tracks || data.items || data.songs || [];
      return items
        .map((item) => {
          if (typeof item === "string") return item;
          const title = item.name || item.title || item.track || item.song || "";
          const artist =
            item.artist ||
            item.artists ||
            (Array.isArray(item.artists) ? item.artists.join(", ") : "") ||
            "";
          if (title && artist) return `${title} - ${artist}`;
          return title || artist;
        })
        .filter(Boolean);
    } catch {
      // fall through to line parsing
    }
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.toLowerCase().startsWith("extinf")) continue;
    if (/^https?:\/\//i.test(line) || line.startsWith("spotify:")) {
      // skip bare URLs/URIs in m3u without titles
      continue;
    }

    if (line.includes(",") && !line.includes(" - ")) {
      const parts = splitCsvLine(line);
      if (parts.length >= 2) {
        const [a, b] = parts;
        if (/title|track|song|name/i.test(a) && /artist/i.test(b)) continue;
        if (/title|track|song|name/i.test(b) && /artist/i.test(a)) continue;
        out.push(`${a} - ${b}`);
        continue;
      }
    }

    out.push(line.replace(/\t+/g, " - "));
  }
  return out;
}

function splitCsvLine(line) {
  const parts = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

function bindChrome() {
  app.querySelector("[data-nav='home']")?.addEventListener("click", (e) => {
    e.preventDefault();
    S.stopSnippet();
    state.game = null;
    renderLibrary();
  });
  app.querySelector("[data-action='logout']")?.addEventListener("click", () => {
    S.stopSnippet();
    S.clearSession();
    state.me = null;
    renderLogin();
  });
}

async function startGame(source) {
  app.innerHTML = `
    ${header()}
    <main class="game"><p class="boot">Loading tracks from ${esc(source.name)}…</p></main>
  `;
  bindChrome();
  try {
    const market = state.me?.country || "US";
    const tracks =
      source.kind === "upload"
        ? source.tracks || []
        : source.kind === "saved"
          ? state.savedTracks?.length
            ? state.savedTracks
            : await S.getSavedTracks()
          : source.kind === "artist"
            ? await S.getArtistTopTracks(source.id, market)
            : await S.getPlaylistTracks(source.id);
    const unique = [];
    const seen = new Set();
    for (const t of tracks) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      unique.push(t);
    }
    if (unique.length < 1) throw new Error("No playable tracks in that crate.");
    state.game = {
      source,
      pool: unique,
      used: new Set(),
      round: 0,
    };
    nextRound();
  } catch (err) {
    app.querySelector("main").innerHTML = `
      <p class="banner error">${esc(err.message)}</p>
      <button type="button" class="btn" data-nav="home">Back to library</button>
    `;
    bindChrome();
  }
}

function pickTrack() {
  const g = state.game;
  const left = g.pool.filter((t) => !g.used.has(t.id));
  const bag = left.length ? left : g.pool;
  if (!left.length) g.used.clear();
  const track = bag[Math.floor(Math.random() * bag.length)];
  g.used.add(track.id);
  return track;
}

function nextRound() {
  const g = state.game;
  g.round += 1;
  g.secret = pickTrack();
  g.stage = 0;
  g.guesses = [];
  g.over = false;
  g.won = false;
  renderGame();
  playCurrentClip();
}

function renderGame() {
  const g = state.game;
  const stageLabel = g.over
    ? g.won
      ? "Got it"
      : "Revealed"
    : `${(STAGES_MS[g.stage] / 1000).toFixed(g.stage === 0 ? 1 : 0)}s clip`;
  const remaining = STAGES_MS.length - g.guesses.length;

  app.innerHTML = `
    ${header()}
    <main class="game">
      <button type="button" class="text-btn back" data-nav="home">← Library</button>
      <p class="kicker">${esc(g.source.name)} · Round ${g.round}</p>
      <div class="board">
        <div class="vinyl ${!g.over ? "" : ""}" id="vinyl" data-spinning="false">
          <div class="vinyl-label">
            <strong>${g.over ? esc(g.secret.name) : "???"}</strong>
            <span>${g.over ? esc(g.secret.artists) : "listen"}</span>
          </div>
        </div>
        <div>
          <h1>${g.over ? esc(g.secret.name) : "Name that track"}</h1>
          <p class="lede">${
            g.over
              ? esc(g.secret.artists)
              : `${remaining} ${remaining === 1 ? "try" : "tries"} left · ${stageLabel}`
          }</p>
          <div class="pips" aria-hidden="true">
            ${STAGES_MS.map((_, i) => {
              const guess = g.guesses[i];
              const cls = guess ? (guess.ok ? "hit" : "miss") : i === g.stage && !g.over ? "now" : "";
              return `<span class="${cls}"></span>`;
            }).join("")}
          </div>
          <div class="player-row">
            <button type="button" class="btn" id="replay">Play clip</button>
            ${
              g.over
                ? `<button type="button" class="btn ghost" id="next">Next song</button>`
                : `<button type="button" class="btn ghost" id="skip">Skip</button>`
            }
          </div>
          <p class="hint" id="play-status"></p>
          ${
            g.over
              ? ""
              : `<form class="guess-form" id="guess-form" autocomplete="off">
                  <input id="guess" placeholder="Search a title or artist from this crate" />
                  <button type="submit">Guess</button>
                  <ul class="suggest" id="suggest"></ul>
                </form>`
          }
          <ul class="guess-log">
            ${g.guesses
              .map(
                (x) =>
                  `<li class="${x.ok ? "hit" : "miss"}">${esc(x.label)}</li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    </main>
  `;
  bindChrome();
  document.getElementById("replay")?.addEventListener("click", playCurrentClip);
  document.getElementById("skip")?.addEventListener("click", () => submitGuess(null));
  document.getElementById("next")?.addEventListener("click", nextRound);
  const input = document.getElementById("guess");
  const suggest = document.getElementById("suggest");
  if (input) {
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        suggest.innerHTML = "";
        return;
      }
      const hits = g.pool
        .filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.artists.toLowerCase().includes(q)
        )
        .slice(0, 8);
      suggest.innerHTML = hits
        .map(
          (t) =>
            `<li><button type="button" data-id="${esc(t.id)}"><strong>${esc(t.name)}</strong> · ${esc(t.artists)}</button></li>`
        )
        .join("");
      suggest.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", () => {
          const track = g.pool.find((t) => t.id === b.dataset.id);
          submitGuess(track);
        });
      });
    });
    document.getElementById("guess-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      const track = g.pool.find(
        (t) =>
          t.name.toLowerCase() === q ||
          `${t.name} ${t.artists}`.toLowerCase() === q
      );
      if (!track) {
        document.getElementById("play-status").textContent =
          "Pick a suggestion from the crate so the guess can match.";
        return;
      }
      submitGuess(track);
    });
    input.focus();
  }
}

async function playCurrentClip() {
  const g = state.game;
  if (!g) return;
  const ms = STAGES_MS[Math.min(g.stage, STAGES_MS.length - 1)];
  const status = document.getElementById("play-status");
  const vinyl = document.getElementById("vinyl");
  if (status) status.textContent = "Starting clip…";
  try {
    await S.playSnippet(g.secret, ms);
    if (vinyl) vinyl.dataset.spinning = "true";
    if (status) status.textContent = `Playing ${(ms / 1000).toFixed(ms < 1000 ? 1 : 0)}s`;
    setTimeout(() => {
      if (vinyl) vinyl.dataset.spinning = "false";
    }, ms + 50);
  } catch (err) {
    if (status) status.textContent = err.message;
  }
}

function submitGuess(track) {
  const g = state.game;
  if (!g || g.over) return;
  S.stopSnippet();
  if (!track) {
    g.guesses.push({ ok: false, label: "Skipped" });
  } else {
    const ok = track.id === g.secret.id;
    g.guesses.push({
      ok,
      label: `${track.name} — ${track.artists}`,
    });
    if (ok) {
      g.over = true;
      g.won = true;
      g.stage = STAGES_MS.length - 1;
      renderGame();
      playCurrentClip();
      return;
    }
  }
  if (g.guesses.length >= STAGES_MS.length) {
    g.over = true;
    g.won = false;
    renderGame();
    playCurrentClip();
    return;
  }
  g.stage = g.guesses.length;
  renderGame();
  playCurrentClip();
}

async function loadLibrary() {
  app.innerHTML = `<p class="boot">Opening your Spotify library…</p>`;
  try {
    state.me = await S.getMe();
    const [artists, playlists, saved] = await Promise.all([
      S.getTopArtists().catch(() => []),
      S.getPlaylists().catch(() => []),
      S.getSavedTracks().catch(() => []),
    ]);
    state.artists = artists;
    state.playlists = playlists;
    state.savedCount = saved.length;
    state.savedTracks = saved;
    renderLibrary();
  } catch (err) {
    S.clearSession();
    renderLogin(err.message || "Could not load your Spotify library.");
    return;
  }

  if (state.me.product === "premium") {
    S.connectPlayer()
      .then((ready) => {
        state.playerReady = ready;
        if (!state.game) renderLibrary();
      })
      .catch(() => {
        state.playerReady = false;
        if (!state.game) renderLibrary();
      });
  }
}

async function boot() {
  try {
    if (!window.SongspotSpotify) {
      app.innerHTML = `<main class="login"><p class="banner error">App scripts failed to load. Hard-refresh the page.</p></main>`;
      return;
    }
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const authError = params.get("error");
    if (code || authError) {
      history.replaceState({}, "", S.redirectUri());
    }
    if (authError) {
      renderLogin("Spotify login was cancelled.");
      return;
    }
    if (code) await S.exchangeCode(code);
    const token = await S.accessToken();
    if (!token || !S.getClientId()) {
      renderLogin();
      return;
    }
    await loadLibrary();
  } catch (err) {
    try {
      S.clearSession();
    } catch {
      // ignore
    }
    renderLogin(err.message || "Something went wrong starting Songspot.");
  }
}

boot();
