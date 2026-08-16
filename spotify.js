const STORAGE = {
  clientId: "songspot_client_id",
  verifier: "songspot_pkce_verifier",
  token: "songspot_token",
};

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
].join(" ");

function redirectUri() {
  const path = location.pathname.replace(/index\.html$/, "");
  return `${location.origin}${path.endsWith("/") ? path : `${path}/`}`;
}

function getClientId() {
  return localStorage.getItem(STORAGE.clientId) || "";
}

function setClientId(id) {
  localStorage.setItem(STORAGE.clientId, id.trim());
}

function getToken() {
  try {
    const raw = localStorage.getItem(STORAGE.token);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setToken(data) {
  localStorage.setItem(
    STORAGE.token,
    JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token || getToken()?.refresh_token,
      expires_at: Date.now() + (data.expires_in - 60) * 1000,
    })
  );
}

function clearSession() {
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.verifier);
}

function b64url(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkce() {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(random);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return { verifier, challenge: b64url(digest) };
}

async function loginWithSpotify() {
  const clientId = getClientId();
  if (!clientId) throw new Error("Missing Spotify client ID");
  const { verifier, challenge } = await pkce();
  localStorage.setItem(STORAGE.verifier, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state: crypto.randomUUID(),
  });
  location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code) {
  const clientId = getClientId();
  const verifier = localStorage.getItem(STORAGE.verifier);
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Could not finish Spotify login");
  setToken(await res.json());
  localStorage.removeItem(STORAGE.verifier);
}

async function refreshAccessToken() {
  const token = getToken();
  if (!token?.refresh_token) return null;
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  setToken(await res.json());
  return getToken();
}

async function accessToken() {
  let token = getToken();
  if (!token) return null;
  if (Date.now() >= token.expires_at) token = await refreshAccessToken();
  return token?.access_token || null;
}

async function api(path, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || `Spotify error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function getMe() {
  return api("/me");
}

async function getTopArtists() {
  const data = await api("/me/top/artists?limit=20&time_range=medium_term");
  return data.items || [];
}

function nextPath(next) {
  if (!next) return null;
  return next.replace("https://api.spotify.com/v1", "");
}

async function getPlaylists() {
  const items = [];
  let url = "/me/playlists?limit=50";
  while (url) {
    const data = await api(url);
    items.push(...(data.items || []).filter(Boolean));
    url = nextPath(data.next);
  }
  return items;
}

async function getSavedTracks() {
  const tracks = [];
  let url = "/me/tracks?limit=50";
  while (url && tracks.length < 250) {
    const data = await api(url);
    for (const item of data.items || []) {
      const track = normalizeTrack(item.track);
      if (track) tracks.push(track);
    }
    url = nextPath(data.next);
  }
  return tracks;
}

async function getArtistTopTracks(artistId, market) {
  const data = await api(
    `/artists/${artistId}/top-tracks?market=${encodeURIComponent(market || "US")}`
  );
  return (data.tracks || []).map(normalizeTrack).filter(Boolean);
}

async function getPlaylist(playlistId) {
  return api(`/playlists/${playlistId}?fields=id,name,images,tracks.total`);
}
  const tracks = [];
  let url = `/playlists/${playlistId}/tracks?limit=100`;
  while (url) {
    const data = await api(url);
    for (const item of data.items || []) {
      const track = normalizeTrack(item.track);
      if (track) tracks.push(track);
    }
    url = nextPath(data.next);
  }
  return tracks;
}

function parsePlaylistId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const uri = raw.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uri) return uri[1];
  const open = raw.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (open) return open[1];
  if (/^[a-zA-Z0-9]{22}$/.test(raw)) return raw;
  return null;
}

async function searchTrack(query, market) {
  const q = query.trim();
  if (!q) return null;
  const data = await api(
    `/search?type=track&limit=1&q=${encodeURIComponent(q)}&market=${encodeURIComponent(market || "US")}`
  );
  return normalizeTrack(data.tracks?.items?.[0]);
}

async function resolveUploadedLines(lines, market, onProgress) {
  const uniqueQueries = [];
  const seen = new Set();
  for (const line of lines) {
    const q = line.trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    uniqueQueries.push(q);
    if (uniqueQueries.length >= 100) break;
  }
  const tracks = [];
  for (let i = 0; i < uniqueQueries.length; i++) {
    onProgress?.(i + 1, uniqueQueries.length, uniqueQueries[i]);
    try {
      const track = await searchTrack(uniqueQueries[i], market);
      if (track && !tracks.some((t) => t.id === track.id)) tracks.push(track);
    } catch {
      // skip failed lookups
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return tracks;
}

function normalizeTrack(track) {
  if (!track || track.is_local || !track.id || !track.uri) return null;
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: (track.artists || []).map((a) => a.name).join(", "),
    album: track.album?.name || "",
    image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || "",
    previewUrl: track.preview_url,
    durationMs: track.duration_ms || 0,
  };
}

const playerState = {
  sdkPlayer: null,
  deviceId: null,
  ready: false,
  snippetTimer: null,
  previewEl: null,
};

function waitForSdk() {
  if (window.Spotify) return Promise.resolve();
  return window.__spotifySdkReady || Promise.reject(new Error("Spotify SDK failed to load"));
}

async function connectPlayer() {
  await waitForSdk();
  const token = await accessToken();
  if (!token) throw new Error("Not logged in");

  if (playerState.sdkPlayer) {
    playerState.sdkPlayer.disconnect();
    playerState.sdkPlayer = null;
    playerState.ready = false;
  }

  const player = new Spotify.Player({
    name: "Songspot",
    getOAuthToken: async (cb) => {
      const t = await accessToken();
      cb(t);
    },
    volume: 0.85,
  });

  player.addListener("ready", ({ device_id }) => {
    playerState.deviceId = device_id;
    playerState.ready = true;
  });
  player.addListener("not_ready", () => {
    playerState.ready = false;
  });

  const connected = await player.connect();
  if (!connected) throw new Error("Could not connect the Spotify player");
  playerState.sdkPlayer = player;

  const start = Date.now();
  while (!playerState.ready && Date.now() - start < 8000) {
    await new Promise((r) => setTimeout(r, 150));
  }
  return playerState.ready;
}

function stopSnippet() {
  clearTimeout(playerState.snippetTimer);
  if (playerState.previewEl) {
    playerState.previewEl.pause();
    playerState.previewEl.currentTime = 0;
  }
  if (playerState.sdkPlayer) playerState.sdkPlayer.pause();
}

async function playSnippet(track, durationMs) {
  stopSnippet();
  if (playerState.ready && playerState.deviceId) {
    await api("/me/player", {
      method: "PUT",
      body: JSON.stringify({
        device_ids: [playerState.deviceId],
        play: false,
      }),
    }).catch(() => {});
    await api(`/me/player/play?device_id=${playerState.deviceId}`, {
      method: "PUT",
      body: JSON.stringify({ uris: [track.uri], position_ms: 0 }),
    });
    playerState.snippetTimer = setTimeout(() => {
      playerState.sdkPlayer?.pause();
    }, durationMs);
    return "sdk";
  }
  if (track.previewUrl) {
    if (!playerState.previewEl) playerState.previewEl = new Audio();
    const audio = playerState.previewEl;
    audio.src = track.previewUrl;
    audio.currentTime = 0;
    await audio.play();
    playerState.snippetTimer = setTimeout(() => audio.pause(), durationMs);
    return "preview";
  }
  throw new Error(
    "No player available. Spotify Premium is required for full Songless clips."
  );
}

window.SongspotSpotify = {
  redirectUri,
  getClientId,
  setClientId,
  loginWithSpotify,
  exchangeCode,
  accessToken,
  clearSession,
  getMe,
  getTopArtists,
  getPlaylists,
  getSavedTracks,
  getArtistTopTracks,
  getPlaylistTracks,
  getPlaylist,
  parsePlaylistId,
  searchTrack,
  resolveUploadedLines,
  connectPlayer,
  playSnippet,
  stopSnippet,
};
