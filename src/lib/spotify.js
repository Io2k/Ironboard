import { supabase } from './supabase';

// Spotify connection for the gym board.
//
// How it works:
// - The gym owner signs in to Spotify once from the owner console. The
//   sign-in uses PKCE (no client secret — the right flow for a browser app).
// - The refresh token is saved in the `spotify_tokens` table (migration 005)
//   and is readable only by that gym's owner and the IronBoard admin. The
//   browser mints short-lived access tokens from it; the refresh token is
//   never kept in localStorage.
// - Playback itself happens on the gym's own Spotify device (a phone or
//   tablet on the gym speakers, or Spotify on a computer) via Spotify
//   Connect. The owner console can start a playlist, pause, skip, and set
//   the volume from anywhere. The board ticker reads the public
//   `music_now_playing` snapshot, which the owner console keeps fresh while
//   it is open.
//
// SETUP — one step Ian has to do once:
//   1. Create an app at https://developer.spotify.com/dashboard
//   2. In the app settings, add this exact Redirect URI:
//        https://iron-board.netlify.app/owner
//   3. Copy the app's Client ID and replace YOUR_SPOTIFY_CLIENT_ID below.
//   Until then, the Connect Spotify button shows a setup message.
//   The gym owner's Spotify account must be Premium — Spotify only allows
//   playback control and now-playing for Premium accounts.

export const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
export const SPOTIFY_CONFIGURED = SPOTIFY_CLIENT_ID !== 'YOUR_SPOTIFY_CLIENT_ID';

const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
].join(' ');

function redirectUri() {
  return `${window.location.origin}/owner`;
}

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(text) {
  const data = new TextEncoder().encode(text);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Step 1 of sign-in: send the owner to Spotify to approve the connection.
export async function startSpotifyAuth(gymId) {
  if (!SPOTIFY_CONFIGURED) return false;
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomString(16);
  sessionStorage.setItem('spotify_pkce_verifier', verifier);
  sessionStorage.setItem('spotify_oauth_state', state);
  sessionStorage.setItem('spotify_gym_id', gymId);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  return true;
}

// Step 2: Spotify redirected back to /owner with ?code= — exchange it for tokens.
export async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const gymId = sessionStorage.getItem('spotify_gym_id');
  const verifier = sessionStorage.getItem('spotify_pkce_verifier');
  const savedState = sessionStorage.getItem('spotify_oauth_state');
  if (!code || !verifier || !gymId || state !== savedState) return null;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokens = await res.json();
  if (!res.ok || !tokens.refresh_token) {
    throw new Error(tokens.error_description || 'Spotify sign-in failed. Try connecting again.');
  }
  // Tidy the address bar so the code is not left in the URL.
  window.history.replaceState({}, '', '/owner');
  sessionStorage.removeItem('spotify_pkce_verifier');
  sessionStorage.removeItem('spotify_oauth_state');
  sessionStorage.removeItem('spotify_gym_id');
  const { error } = await supabase.from('spotify_tokens').upsert({
    gym_id: gymId,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Signed in to Spotify, but the connection could not be saved. Try again.');
  return { accessToken: tokens.access_token, expiresIn: tokens.expires_in, gymId };
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error('Spotify session expired — reconnect Spotify from the owner console.');
  return tokens;
}

// In-memory access token cache (per gym) so we don't refresh on every call.
const accessCache = {};

export async function getSpotifyAccessToken(gymId) {
  const cached = accessCache[gymId];
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;
  const { data, error } = await supabase
    .from('spotify_tokens').select('refresh_token').eq('gym_id', gymId).maybeSingle();
  if (error || !data?.refresh_token) return null;
  const tokens = await refreshAccessToken(data.refresh_token);
  accessCache[gymId] = {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
  };
  return tokens.access_token;
}

export async function getSpotifyConnection(gymId) {
  const { data } = await supabase
    .from('spotify_tokens').select('gym_id, updated_at').eq('gym_id', gymId).maybeSingle();
  return data || null;
}

export async function disconnectSpotify(gymId) {
  delete accessCache[gymId];
  await supabase.from('spotify_tokens').delete().eq('gym_id', gymId);
  await supabase.from('music_now_playing').delete().eq('gym_id', gymId);
}

async function spotifyApi(path, accessToken, options = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || 'Spotify request failed.');
  return data;
}

export async function getSpotifyProfile(accessToken) {
  return spotifyApi('/me', accessToken);
}

export async function getSpotifyPlaylists(accessToken) {
  const data = await spotifyApi('/me/playlists?limit=50', accessToken);
  return data?.items || [];
}

export async function getCurrentlyPlaying(accessToken) {
  return spotifyApi('/me/player/currently-playing', accessToken);
}

export async function playSpotifyPlaylist(accessToken, playlistId) {
  return spotifyApi('/me/player/play', accessToken, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
  });
}

export async function pauseSpotifyPlayback(accessToken) {
  return spotifyApi('/me/player/pause', accessToken, { method: 'PUT' });
}

export async function nextSpotifyTrack(accessToken) {
  return spotifyApi('/me/player/next', accessToken, { method: 'POST' });
}

export async function setSpotifyVolume(accessToken, percent) {
  return spotifyApi(`/me/player/volume?volume_percent=${percent}`, accessToken, { method: 'PUT' });
}

// Keep the board ticker fresh: the owner console writes the current track to
// the public music_now_playing row while it is open.
export async function publishNowPlaying(gymId, playback, playlistName) {
  const item = playback?.item;
  await supabase.from('music_now_playing').upsert({
    gym_id: gymId,
    source: 'spotify',
    track_name: item?.name || null,
    artist_name: item?.artists?.map((a) => a.name).join(', ') || null,
    playlist_name: playlistName || null,
    is_playing: !!playback?.is_playing,
    updated_at: new Date().toISOString(),
  });
}
