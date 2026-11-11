import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Building2, QrCode, Copy, Check, Dumbbell, LogOut, BarChart3, Gift, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { makeGymCode, joinUrl, displayUrl } from '../lib/gym';
import GymStatsPanel from './GymStatsPanel';
import GiveawayPanel from './GiveawayPanel';

// Gym owner flow: create a gym, get its join code + QR poster link.
export default function OwnerView({ user }) {
  const [gym, setGym] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  // Edit form (shown once the gym exists).
  const [editName, setEditName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editColor, setEditColor] = useState('#f59e0b');
  const [editBusy, setEditBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  // Board ads for this gym (managed by the IronBoard admin; owners can see them here).
  const [ads, setAds] = useState([]);

  // Upload a logo file to the public gym-logos bucket and return its URL.
  // Needs migration 003 run in Supabase (bucket + policies) or this fails.
  async function uploadLogoFile(file, folder) {
    const clean = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${folder}/${Date.now()}-${clean}`;
    const { error: uploadError } = await supabase.storage.from('gym-logos').upload(path, file);
    if (uploadError) throw uploadError;
    return supabase.storage.from('gym-logos').getPublicUrl(path).data.publicUrl;
  }

  const loadGym = useCallback(async () => {
    const { data } = await supabase.from('gyms').select('*').eq('owner_id', user.id).maybeSingle();
    setGym(data || null);
    if (data) {
      setEditName(data.name || '');
      setEditLogoUrl(data.logo_url || '');
      setEditColor(data.primary_color || '#f59e0b');
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('gym_id', data.id);
      setMemberCount(count || 0);
      const { data: adRows } = await supabase.from('ads').select('*').eq('gym_id', data.id).order('created_at', { ascending: false });
      setAds(adRows || []);
      QRCode.toDataURL(joinUrl(data.code), { width: 512, margin: 2 }).then(setQrDataUrl).catch(() => {});
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadGym(); }, [loadGym]);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    // If the owner picked a logo file, upload it first so the gym is
    // created with its public URL. A URL pasted below works without this.
    let finalLogoUrl = logoUrl.trim() || null;
    if (pendingLogoFile) {
      try {
        finalLogoUrl = await uploadLogoFile(pendingLogoFile, `pending/${user.id}`);
      } catch {
        setError('Logo upload failed — the gym-logos storage bucket may not be set up yet (run migration 003 in Supabase), or try pasting an image URL instead.');
        setBusy(false);
        return;
      }
    }
    try {
      let code = makeGymCode(name);
      // Retry with a fresh code if the generated one is somehow taken.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from('gyms').insert({
          name: name.trim(),
          logo_url: finalLogoUrl,
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

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!gym) return;
    setEditBusy(true);
    setEditMessage('');
    setError('');
    const { error } = await supabase
      .from('gyms')
      .update({
        name: editName.trim(),
        logo_url: editLogoUrl.trim() || null,
        primary_color: editColor,
      })
      .eq('id', gym.id);
    setEditBusy(false);
    if (error) {
      setError('Could not save those changes. Try again.');
      return;
    }
    setEditMessage('Saved — your gym name, logo and colour are updated everywhere.');
    await loadGym();
  }

  async function handleEditLogoUpload(file) {
    if (!file || !gym) return;
    setUploading(true);
    setError('');
    setEditMessage('');
    try {
      const url = await uploadLogoFile(file, gym.id);
      setEditLogoUrl(url);
      setEditMessage('Logo uploaded — tap Save changes to use it.');
    } catch {
      setError('Logo upload failed — the gym-logos storage bucket may not be set up yet (run migration 003 in Supabase), or paste an image URL instead.');
    } finally {
      setUploading(false);
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

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {!gym ? (
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-4">
            <h2 className="text-2xl font-bold">Set up your gym</h2>
            <p className="text-sm text-slate-400">Members will join with the code your gym gets. You can print it or post it at the front desk.</p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. REPS Gym" required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo — upload a file</label>
              <input type="file" accept="image/*" onChange={(e) => setPendingLogoFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-950 file:font-semibold" />
              {pendingLogoFile && <p className="text-xs text-slate-400 mt-1">Selected: {pendingLogoFile.name}</p>}
              <p className="text-xs text-slate-500 mt-1">Or paste an image URL below instead. Upload needs the gym-logos storage bucket (migration 003).</p>
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
          <>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{gym.name}</h2>
              <p className="text-sm text-slate-400">{memberCount} member{memberCount === 1 ? '' : 's'} joined</p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-lg font-bold">Edit your gym</h3>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym name</label>
                <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo — upload a file</label>
                <input type="file" accept="image/*" onChange={(e) => handleEditLogoUpload(e.target.files?.[0])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-950 file:font-semibold" />
                <p className="text-xs text-slate-500 mt-1">Upload needs the gym-logos storage bucket (migration 003). Or paste an image URL below instead.</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo image URL</label>
                <input className={inputCls} value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
              </div>
              {editLogoUrl && (
                <div className="flex items-center gap-3">
                  <img src={editLogoUrl} alt="Gym logo preview" className="w-12 h-12 rounded-lg object-cover border border-amber-500/50" />
                  <p className="text-xs text-slate-400">This logo replaces the dumbbell icon in the member app and on the gym screen.</p>
                </div>
              )}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Accent color</label>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-16 h-10 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {editMessage && <p className="text-sm text-emerald-400">{editMessage}</p>}
              <button type="submit" disabled={editBusy || uploading} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50">
                {uploading ? 'Uploading logo…' : editBusy ? 'Saving…' : 'Save changes'}
              </button>
            </form>

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

          <div className="space-y-6 mt-6">
            <section>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" /> Your gym&apos;s stats
              </h2>
              <p className="text-xs text-slate-400 mb-3">These are the numbers local advertisers see — members, activity, and lifts logged. No member names or emails are ever shared with advertisers.</p>
              <GymStatsPanel gym={gym} />
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" /> Monthly giveaway
              </h2>
              <GiveawayPanel gym={gym} user={user} onGymUpdated={loadGym} />
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-500" /> Ads on your board ({ads.length})
              </h2>
              <p className="text-xs text-slate-400 mb-4">Ads are added by the IronBoard admin. Want a local business on your board? Tell Ian and he&apos;ll add it.</p>
              {ads.length === 0 ? (
                <p className="text-sm text-slate-400">No ads on your board yet.</p>
              ) : (
                <div className="space-y-3">
                  {ads.map((ad) => (
                    <div key={ad.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-4 items-start">
                      {ad.image_url ? (
                        <img src={ad.image_url} alt={ad.title} className="w-20 h-20 rounded-lg object-cover border border-slate-800 shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-slate-500 text-xs">No image</div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-100">{ad.title}</h4>
                        {ad.description && <p className="text-sm text-slate-400 mt-0.5">{ad.description}</p>}
                        <p className="text-xs text-slate-500 mt-1">Added {ad.created_at?.split('T')[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          </>
        )}
      </main>
    </div>
  );
}
