import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Building2, QrCode, Copy, Check, Dumbbell, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { makeGymCode, joinUrl, displayUrl } from '../lib/gym';

// Gym owner flow: create a gym, get its join code + QR poster link.
export default function OwnerView({ user }) {
  const [gym, setGym] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const loadGym = useCallback(async () => {
    const { data } = await supabase.from('gyms').select('*').eq('owner_id', user.id).maybeSingle();
    setGym(data || null);
    if (data) {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('gym_id', data.id);
      setMemberCount(count || 0);
      QRCode.toDataURL(joinUrl(data.code), { width: 512, margin: 2 }).then(setQrDataUrl).catch(() => {});
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadGym(); }, [loadGym]);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let code = makeGymCode(name);
      // Retry with a fresh code if the generated one is somehow taken.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from('gyms').insert({
          name: name.trim(),
          logo_url: logoUrl.trim() || null,
          primary_color: primaryColor,
          code,
          owner_id: user.id,
        });
        if (!error) break;
        if (error.code === '23505') { code = makeGymCode(name); continue; }
        throw error;
      }
      await loadGym();
    } catch (err) {
      setError(err.message || 'Could not create your gym. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function copy(text, which) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500';

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans"><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">Gym Owner Setup</h1>
            <p className="text-xs text-slate-400">Create your gym, share the code, fill the screen.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-800 flex items-center gap-2">
            <Dumbbell className="w-4 h-4" /> Member app
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-800 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {!gym ? (
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-4">
            <h2 className="text-2xl font-bold">Set up your gym</h2>
            <p className="text-sm text-slate-400">Members will join with the code your gym gets. You can print it or post it at the front desk.</p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. REPS Gym" required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo image URL (optional)</label>
              <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Accent color</label>
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-10 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50">
              {busy ? 'Creating…' : 'Create my gym'}
            </button>
          </form>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{gym.name}</h2>
              <p className="text-sm text-slate-400">{memberCount} member{memberCount === 1 ? '' : 's'} joined</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Gym code</p>
              <p className="text-4xl font-black tracking-widest text-amber-400">{gym.code}</p>
              <p className="text-xs text-slate-500 mt-2">Members type this code when they sign up.</p>
            </div>
            {qrDataUrl && (
              <div className="bg-white rounded-xl p-4 mx-auto w-fit">
                <img src={qrDataUrl} alt={`QR code to join ${gym.name}`} className="w-56 h-56" />
              </div>
            )}
            <p className="text-sm text-slate-400 text-center flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-amber-400" /> Print the QR code at the front desk — scanning it opens the sign-up page with your code filled in.
            </p>
            <div className="space-y-3">
              <button onClick={() => copy(joinUrl(gym.code), 'join')} className="w-full bg-slate-800 hover:bg-slate-700 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
                {copied === 'join' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                {copied === 'join' ? 'Join link copied' : 'Copy member join link'}
              </button>
              <button onClick={() => copy(displayUrl(gym.code), 'display')} className="w-full bg-slate-800 hover:bg-slate-700 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
                {copied === 'display' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                {copied === 'display' ? 'Display link copied' : 'Copy gym screen link'}
              </button>
              <a href={displayUrl(gym.code)} target="_blank" rel="noreferrer" className="block text-center w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20">
                Open the gym screen
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
