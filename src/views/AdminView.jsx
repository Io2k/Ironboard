import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Building2, LogOut, Dumbbell, Plus, Trash2, Megaphone, BarChart3, Gift, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { makeGymCode } from '../lib/gym';
import { ADMIN_EMAIL, isAdmin } from '../lib/admin';
import GymStatsPanel from './GymStatsPanel';
import GiveawayPanel from './GiveawayPanel';

// Ian's console: pick any gym, see its stats, manage its board ads, and run
// its giveaway. Locked to Ian's Gmail account (see App.jsx + migration 004).
export default function AdminView({ user }) {
  const [gyms, setGyms] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('stats'); // stats | ads | giveaway
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Create-gym form.
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newColor, setNewColor] = useState('#f59e0b');
  const [creating, setCreating] = useState(false);
  // Edit-gym form (for the selected gym).
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editColor, setEditColor] = useState('#f59e0b');
  const [editBusy, setEditBusy] = useState(false);
  // Ads for the selected gym.
  const [ads, setAds] = useState([]);
  const [adTitle, setAdTitle] = useState('');
  const [adDesc, setAdDesc] = useState('');
  const [adImage, setAdImage] = useState('');
  const [adBusy, setAdBusy] = useState(false);
  const [confirmDeleteAd, setConfirmDeleteAd] = useState(null);

  const selectedGym = gyms.find((g) => g.id === selectedId) || null;

  const loadGyms = useCallback(async () => {
    const { data } = await supabase.from('gyms').select('*').order('name');
    setGyms(data || []);
    if (data?.length && !selectedId) setSelectedId(data[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => { loadGyms(); }, [loadGyms]);

  const loadAds = useCallback(async () => {
    if (!selectedId) return;
    const { data } = await supabase.from('ads').select('*').eq('gym_id', selectedId).order('created_at', { ascending: false });
    setAds(data || []);
  }, [selectedId]);

  useEffect(() => { loadAds(); }, [loadAds]);

  useEffect(() => {
    if (selectedGym) {
      setEditName(selectedGym.name || '');
      setEditLogoUrl(selectedGym.logo_url || '');
      setEditColor(selectedGym.primary_color || '#f59e0b');
      setEditing(false);
    }
  }, [selectedGym?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="text-center max-w-md">
          <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin console</h1>
          <p className="text-slate-400">This console is only for {ADMIN_EMAIL}. You are signed in as {user.email}.</p>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="mt-6 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  async function handleCreateGym(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');
    try {
      let code = makeGymCode(newName);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: err } = await supabase.from('gyms').insert({
          name: newName.trim(),
          logo_url: newLogoUrl.trim() || null,
          primary_color: newColor,
          code,
          owner_id: user.id,
        });
        if (!err) break;
        if (err.code === '23505') { code = makeGymCode(newName); continue; }
        throw err;
      }
      setNewName('');
      setNewLogoUrl('');
      setShowCreate(false);
      setMessage(`Gym created with code ${code}.`);
      await loadGyms();
      const { data } = await supabase.from('gyms').select('id').eq('code', code).maybeSingle();
      if (data) setSelectedId(data.id);
    } catch (err) {
      setError(err.message || 'Could not create the gym. Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedGym) return;
    setEditBusy(true);
    setError('');
    setMessage('');
    const { error: err } = await supabase.from('gyms').update({
      name: editName.trim(),
      logo_url: editLogoUrl.trim() || null,
      primary_color: editColor,
    }).eq('id', selectedGym.id);
    setEditBusy(false);
    if (err) {
      setError('Could not save those changes. Try again.');
      return;
    }
    setMessage('Gym updated.');
    setEditing(false);
    await loadGyms();
  }

  async function handleAddAd(e) {
    e.preventDefault();
    if (!selectedGym) return;
    setAdBusy(true);
    setError('');
    const { error: err } = await supabase.from('ads').insert({
      gym_id: selectedGym.id,
      title: adTitle.trim(),
      description: adDesc.trim() || null,
      image_url: adImage.trim() || null,
    });
    setAdBusy(false);
    if (err) {
      setError('Could not add the ad — the ads table may not be set up yet (run migration 004 in Supabase).');
      return;
    }
    setAdTitle('');
    setAdDesc('');
    setAdImage('');
    setMessage('Ad added — it will rotate on the gym board.');
    await loadAds();
  }

  async function handleDeleteAd(ad) {
    if (confirmDeleteAd !== ad.id) {
      setConfirmDeleteAd(ad.id);
      return;
    }
    setConfirmDeleteAd(null);
    const { error: err } = await supabase.from('ads').delete().eq('id', ad.id);
    if (err) {
      setError('Could not delete the ad. Try again.');
      return;
    }
    setMessage('Ad removed from the board.');
    await loadAds();
  }

  const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500';
  const tabBtn = (id, label, Icon) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${tab === id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans"><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg tracking-wide truncate">Admin Console</h1>
            <p className="text-xs text-slate-400 truncate">Signed in as {user.email} • IronBoard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-800 flex items-center gap-2">
            <Dumbbell className="w-4 h-4" /> Member app
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-800 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        {/* Gym picker + create */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" /> Gyms ({gyms.length})
            </h2>
            <button onClick={() => setShowCreate((v) => !v)} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> {showCreate ? 'Close' : 'Create a gym'}
            </button>
          </div>
          {gyms.length === 0 ? (
            <p className="text-sm text-slate-400">No gyms yet. Create the first one, or ask a gym owner to set theirs up from the owner page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-3 font-semibold">Gym</th>
                    <th className="py-2 pr-3 font-semibold">Code</th>
                    <th className="py-2 pr-3 font-semibold">Giveaway</th>
                    <th className="py-2 font-semibold">Board</th>
                  </tr>
                </thead>
                <tbody>
                  {gyms.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedId(g.id)}
                      className={`border-b border-slate-800/60 last:border-0 cursor-pointer ${g.id === selectedId ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-100">{g.name}</td>
                      <td className="py-2.5 pr-3 text-amber-400 font-bold tracking-wider">{g.code}</td>
                      <td className="py-2.5 pr-3">{g.giveaway_enabled ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">On</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Off</span>}</td>
                      <td className="py-2.5">
                        <a href={`/display/${encodeURIComponent(g.code)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-amber-400 hover:text-amber-300 text-xs font-semibold">Open board ↗</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showCreate && (
            <form onSubmit={handleCreateGym} className="space-y-3 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym name</label>
                <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. REPS Gym" required />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo image URL (optional)</label>
                <input className={inputCls} value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Accent color</label>
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-16 h-10 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" />
              </div>
              <p className="text-xs text-slate-500">Gyms created here belong to this admin account. To hand one to its owner, change its owner in the Supabase dashboard (gyms table) — or let the owner create it themselves from the owner page.</p>
              <button type="submit" disabled={creating} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl disabled:opacity-50">
                {creating ? 'Creating…' : 'Create gym'}
              </button>
            </form>
          )}
        </div>

        {selectedGym && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{selectedGym.name}</h2>
                <p className="text-sm text-slate-400">Code <span className="font-bold text-amber-400 tracking-wider">{selectedGym.code}</span></p>
              </div>
              <button onClick={() => setEditing((v) => !v)} className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 flex items-center gap-2">
                <Pencil className="w-4 h-4" /> {editing ? 'Close edit' : 'Edit gym'}
              </button>
            </div>

            {editing && (
              <form onSubmit={handleSaveEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym name</label>
                  <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Logo image URL</label>
                  <input className={inputCls} value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Accent color</label>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-16 h-10 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer" />
                </div>
                <button type="submit" disabled={editBusy} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl disabled:opacity-50">
                  {editBusy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {tabBtn('stats', 'Stats', BarChart3)}
              {tabBtn('ads', `Board ads (${ads.length})`, Megaphone)}
              {tabBtn('giveaway', 'Giveaway', Gift)}
            </div>

            {tab === 'stats' && <GymStatsPanel gym={selectedGym} />}

            {tab === 'ads' && (
              <div className="space-y-6">
                <form onSubmit={handleAddAd} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold">Add an advertisement</h3>
                  <p className="text-xs text-slate-400">Ads are title, description, and image only. They rotate on this gym&apos;s board.</p>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Title</label>
                    <input className={inputCls} value={adTitle} onChange={(e) => setAdTitle(e.target.value)} placeholder="e.g. Apex Meal Prep" required />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Description</label>
                    <textarea className={inputCls} value={adDesc} onChange={(e) => setAdDesc(e.target.value)} placeholder="What should members see?" rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Image URL</label>
                    <input className={inputCls} value={adImage} onChange={(e) => setAdImage(e.target.value)} placeholder="https://example.com/ad.jpg" />
                  </div>
                  <button type="submit" disabled={adBusy} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl disabled:opacity-50">
                    {adBusy ? 'Adding…' : 'Add ad to the board'}
                  </button>
                </form>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                  <h3 className="text-lg font-bold">Ads on this board ({ads.length})</h3>
                  {ads.length === 0 ? (
                    <p className="text-sm text-slate-400">No ads yet — the board will skip the sponsor screen until you add one.</p>
                  ) : (
                    ads.map((ad) => (
                      <div key={ad.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-4 items-start">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt={ad.title} className="w-20 h-20 rounded-lg object-cover border border-slate-800 shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-slate-500 text-xs">No image</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-100">{ad.title}</h4>
                          {ad.description && <p className="text-sm text-slate-400 mt-0.5">{ad.description}</p>}
                          <p className="text-xs text-slate-500 mt-1">Added {ad.created_at?.split('T')[0]}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAd(ad)}
                          className={`px-2.5 py-2 rounded-lg text-sm font-medium border flex items-center gap-1.5 shrink-0 ${
                            confirmDeleteAd === ad.id
                              ? 'bg-red-500/20 text-red-300 border-red-500/50'
                              : 'text-slate-400 hover:text-red-300 border-slate-800 hover:border-red-500/40'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                          {confirmDeleteAd === ad.id ? 'Sure?' : 'Delete'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'giveaway' && (
              <GiveawayPanel gym={selectedGym} user={user} onGymUpdated={loadGyms} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
