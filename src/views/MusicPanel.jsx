import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Music2, Play, Pause, SkipForward, Volume2, LogOut, Check, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  SPOTIFY_CONFIGURED,
  startSpotifyAuth,
  handleSpotifyCallback,
  getSpotifyConnection,
  getSpotifyAccessToken,
  getSpotifyProfile,
  getSpotifyPlaylists,
  getCurrentlyPlaying,
  playSpotifyPlaylist,
  pauseSpotifyPlayback,
  nextSpotifyTrack,
  setSpotifyVolume,
  publishNowPlaying,
  disconnectSpotify,
} from '../lib/spotify';

// Music on the gym board — owner console section.
// Two sources:
//   * Internet radio (free, no sign-in): the owner picks a station, the
//     board plays the stream in its browser and the ticker shows the
//     station name. Needs migration 005 (gyms.music_* columns).
//   * Spotify (owner's Premium account): sign in once, pick a playlist as
//     the station, control it from here. Needs migration 005 plus a
//     Spotify app Client ID in src/lib/spotify.js.

const RADIO_PRESETS = [
  { name: 'Groove Salad', vibe: 'Ambient beats', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
  { name: 'Secret Agent', vibe: 'Downtempo', url: 'https://ice1.somafm.com/secretagent-128-mp3' },
  { name: 'Lush', vibe: 'Chill vocals', url: 'https://ice1.somafm.com/lush-128-mp3' },
  { name: 'Metal Detector', vibe: 'Metal', url: 'https://ice1.somafm.com/metal-128-mp3' },
  { name: 'DEF CON Radio', vibe: 'Electronic', url: 'https://ice1.somafm.com/defcon-128-mp3' },
  { name: 'Radio Paradise', vibe: 'Eclectic mix', url: 'https://stream.radioparadise.com/aac-320' },
];

export default function MusicPanel({ gym, user, onGymUpdated }) {
  const [source, setSource] = useState(gym.music_source || 'off');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Spotify state.
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [volume, setVolume] = useState(80);
  const pollRef = useRef(null);

  const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500';

  async function updateGym(fields) {
    const { error: err } = await supabase.from('gyms').update(fields).eq('id', gym.id);
    if (err) throw new Error('Could not save the music setting. Try again.');
    if (fields.music_source !== undefined) setSource(fields.music_source);
    if (onGymUpdated) await onGymUpdated();
  }

  async function saveRadioStation(name, url) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateGym({ music_source: 'radio', music_station_name: name, music_station_url: url });
      setMessage(`Radio set to ${name} — the board will play it once someone taps “Start music” on the gym screen.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function turnMusicOff() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateGym({ music_source: 'off' });
      setMessage('Music off — the ticker is gone from the board.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const loadSpotifySession = useCallback(async () => {
    const conn = await getSpotifyConnection(gym.id);
    if (!conn) { setSpotifyConnected(false); setAccessToken(null); return; }
    try {
      const token = await getSpotifyAccessToken(gym.id);
      if (!token) { setSpotifyConnected(false); return; }
      setAccessToken(token);
      setSpotifyConnected(true);
      const profile = await getSpotifyProfile(token).catch(() => null);
      if (profile?.display_name) setSpotifyUser(profile.display_name);
      const list = await getSpotifyPlaylists(token).catch(() => []);
      setPlaylists(list);
    } catch {
      setSpotifyConnected(false);
      setAccessToken(null);
    }
  }, [gym.id]);

  // Handle the return from Spotify sign-in, then load any saved connection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('code')) {
        try {
          const result = await handleSpotifyCallback();
          if (result && !cancelled) {
            setAccessToken(result.accessToken);
            setSpotifyConnected(true);
            setMessage('Spotify connected — pick a playlist below to make it the gym station.');
          }
        } catch (err) {
          if (!cancelled) setError(err.message || 'Spotify sign-in failed.');
        }
      }
      if (!cancelled) await loadSpotifySession();
    })();
    return () => { cancelled = true; };
  }, [loadSpotifySession]);

  // While Spotify is connected, poll now-playing and publish it so the
  // public board ticker can show the live track. Stops when this console closes.
  useEffect(() => {
    if (!spotifyConnected || !accessToken || source !== 'spotify') return undefined;
    const poll = async () => {
      try {
        const playback = await getCurrentlyPlaying(accessToken);
        setNowPlaying(playback);
        await publishNowPlaying(gym.id, playback, gym.music_spotify_playlist_name || null);
      } catch {
        // Token expired mid-session — next load will refresh it.
      }
    };
    poll();
    pollRef.current = setInterval(poll, 15000);
    return () => clearInterval(pollRef.current);
  }, [spotifyConnected, accessToken, source, gym.id, gym.music_spotify_playlist_name]);

  async function handleConnectSpotify() {
    setError('');
    setMessage('');
    if (!SPOTIFY_CONFIGURED) {
      setError('Spotify is not wired up yet — Ian needs to add the Spotify app Client ID (see the setup steps). Radio works now.');
      return;
    }
    await startSpotifyAuth(gym.id);
  }

  async function handleSelectPlaylist(pl) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!accessToken) throw new Error('Spotify is not connected. Sign in first.');
      await updateGym({
        music_source: 'spotify',
        music_spotify_playlist_id: pl.id,
        music_spotify_playlist_name: pl.name,
      });
      await playSpotifyPlaylist(accessToken, pl.id).catch(() => {});
      setMessage(`Station set to “${pl.name}” on Spotify — playing now on the gym’s Spotify device.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectSpotify() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await disconnectSpotify(gym.id);
      await updateGym({ music_source: 'off', music_spotify_playlist_id: null, music_spotify_playlist_name: null });
      setSpotifyConnected(false);
      setAccessToken(null);
      setPlaylists([]);
      setNowPlaying(null);
      setMessage('Spotify disconnected and the board music is off.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const currentStation = gym.music_station_name || '';
  const nowTrack = nowPlaying?.item;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Music2 className="w-5 h-5 text-amber-500" /> Music on the board
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Pick what plays on the gym screen. The current track (or station) scrolls as a ticker along the bottom of the board.
          {source !== 'off' && (
            <span className="text-amber-400"> Now playing: {source === 'radio' ? currentStation : (gym.music_spotify_playlist_name || 'Spotify')}.</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'off', label: 'Off' },
          { id: 'radio', label: 'Internet radio' },
          { id: 'spotify', label: 'Spotify' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => { if (opt.id === 'off') turnMusicOff(); else setSource(opt.id); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              source === opt.id
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {source === 'radio' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Free — no sign-in. The board plays the station in its browser; someone taps “Start music” on the gym screen once in the morning (browsers won’t autoplay sound on their own).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RADIO_PRESETS.map((st) => (
              <button
                key={st.url}
                onClick={() => saveRadioStation(st.name, st.url)}
                disabled={busy}
                className={`text-left bg-slate-950 border rounded-xl p-4 transition disabled:opacity-50 ${
                  gym.music_station_url === st.url ? 'border-amber-500' : 'border-slate-800 hover:border-amber-500/60'
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-100">
                  <Radio className="w-4 h-4 text-amber-500" /> {st.name}
                  {gym.music_station_url === st.url && <Check className="w-4 h-4 text-emerald-400" />}
                </span>
                <span className="block text-xs text-slate-400 mt-1">{st.vibe}</span>
              </button>
            ))}
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-500" /> Your own station</p>
            <input className={inputCls} value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Station name (e.g. My gym mix)" />
            <input className={inputCls} value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Stream URL — https://… .mp3 or .aac" />
            <button
              onClick={() => customName.trim() && customUrl.trim() && saveRadioStation(customName.trim(), customUrl.trim())}
              disabled={busy || !customName.trim() || !customUrl.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition disabled:opacity-50"
            >
              Use this station
            </button>
            <p className="text-xs text-slate-500">Any direct audio stream works — for example a Zeno FM station URL.</p>
          </div>
        </div>
      )}

      {source === 'spotify' && (
        <div className="space-y-4">
          {!SPOTIFY_CONFIGURED && (
            <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              Spotify isn’t wired up yet — Ian has a 2-minute setup step (create a Spotify app, paste its Client ID into the code). Radio works now; Spotify unlocks once that’s done.
            </p>
          )}
          {SPOTIFY_CONFIGURED && !spotifyConnected && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Sign in with the gym’s Spotify account (it needs to be Premium — Spotify only allows playback control for Premium). The board then plays your playlists, and you control it from here.</p>
              <button onClick={handleConnectSpotify} disabled={busy} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition disabled:opacity-50">
                Connect Spotify
              </button>
            </div>
          )}
          {spotifyConnected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-300">Connected{spotifyUser ? ` as ${spotifyUser}` : ''} — Premium account</p>
                <button onClick={handleDisconnectSpotify} disabled={busy} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                  <LogOut className="w-4 h-4" /> Disconnect
                </button>
              </div>

              {nowTrack && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Now playing</p>
                  <p className="font-bold text-slate-100 mt-1">{nowTrack.name}</p>
                  <p className="text-sm text-slate-400">{nowTrack.artists?.map((a) => a.name).join(', ')}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={async () => {
                        try {
                          if (nowPlaying?.is_playing) await pauseSpotifyPlayback(accessToken);
                          else if (gym.music_spotify_playlist_id) await playSpotifyPlaylist(accessToken, gym.music_spotify_playlist_id);
                          const playback = await getCurrentlyPlaying(accessToken);
                          setNowPlaying(playback);
                        } catch { /* ignore */ }
                      }}
                      className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center"
                      aria-label={nowPlaying?.is_playing ? 'Pause' : 'Play'}
                    >
                      {nowPlaying?.is_playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={async () => {
                        try { await nextSpotifyTrack(accessToken); const playback = await getCurrentlyPlaying(accessToken); setNowPlaying(playback); } catch { /* ignore */ }
                      }}
                      className="w-10 h-10 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center"
                      aria-label="Next track"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 flex-1 ml-2">
                      <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="range" min="0" max="100" value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        onMouseUp={() => accessToken && setSpotifyVolume(accessToken, volume).catch(() => {})}
                        onTouchEnd={() => accessToken && setSpotifyVolume(accessToken, volume).catch(() => {})}
                        className="w-full accent-amber-500"
                        aria-label="Volume"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">Plays on the gym’s own Spotify device (phone or tablet on the speakers). The board ticker shows this track while this console is open.</p>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold mb-2">Your playlists — tap one to make it the gym station</p>
                {playlists.length === 0 ? (
                  <p className="text-sm text-slate-400">No playlists found on this Spotify account yet.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => handleSelectPlaylist(pl)}
                        disabled={busy}
                        className={`w-full text-left bg-slate-950 border rounded-xl px-4 py-3 transition disabled:opacity-50 ${
                          gym.music_spotify_playlist_id === pl.id ? 'border-amber-500' : 'border-slate-800 hover:border-amber-500/60'
                        }`}
                      >
                        <span className="font-semibold text-slate-100 flex items-center gap-2">
                          {gym.music_spotify_playlist_id === pl.id && <Check className="w-4 h-4 text-emerald-400" />} {pl.name}
                        </span>
                        <span className="block text-xs text-slate-400 mt-0.5">{pl.tracks?.total ?? '?'} tracks · by {pl.owner?.display_name || 'Spotify'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
}
