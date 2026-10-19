import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API = '/api';

async function request(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error?.message || message; } catch { /* empty response */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      onAuthenticated(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark"><Icon>♫</Icon></div>
      <p className="eyebrow">YOUR MUSIC, IN ONE PLACE</p>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Make it yours.'}</h1>
      <p className="muted">A private home for the music you love.</p>
      <div className="auth-tabs" role="tablist">
        <button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
        <button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
      </div>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && <label>Your name<input required minLength="2" maxLength="40" autoComplete="name" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></label>}
        <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input required type="password" minLength="8" maxLength="72" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
      </form>
      <p className="auth-footnote"><Icon>◈</Icon> Your library stays private to your account.</p>
    </section>
    <aside className="auth-art"><div className="orb orb-one" /><div className="orb orb-two" /><div className="art-copy"><span>01 / LISTEN</span><h2>Every track<br />has a place.</h2><p>Upload your collection. Build your mood.</p></div><div className="art-bars">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--bar': `${18 + (i * 37 % 71)}%` }} />)}</div></aside>
  </main>;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('music-manager-session')); } catch { return null; }
  });
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [view, setView] = useState('library');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistDraft, setPlaylistDraft] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [audioState, setAudioState] = useState({ playing: false, current: 0, duration: 0 });
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  const token = session?.token;
  const visibleTracks = useMemo(() => {
    if (view === 'playlist' && activePlaylist) return activePlaylist.tracks || [];
    return tracks;
  }, [activePlaylist, tracks, view]);

  const refreshLibrary = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ sort, order });
      if (query.trim()) params.set('q', query.trim());
      const [library, collections] = await Promise.all([
        request(`/tracks?${params}`, { token }),
        request('/playlists', { token })
      ]);
      setTracks(library.tracks);
      setPlaylists(collections.playlists);
      setActivePlaylist(previous => previous ? collections.playlists.find(p => p._id === previous._id) || null : null);
    } catch (err) { setError(err.message); }
  }, [token, sort, order, query]);

  useEffect(() => { if (session) localStorage.setItem('music-manager-session', JSON.stringify(session)); else localStorage.removeItem('music-manager-session'); }, [session]);
  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  async function playTrack(track) {
    setError('');
    try {
      if (currentTrack?._id === track._id && audioRef.current) {
        if (audioRef.current.paused) await audioRef.current.play(); else audioRef.current.pause();
        return;
      }
      const response = await fetch(`${API}/tracks/${track._id}/stream`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to play this track');
      const file = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(file);
      setCurrentTrack(track);
      requestAnimationFrame(async () => {
        if (!audioRef.current) return;
        audioRef.current.src = objectUrlRef.current;
        audioRef.current.load();
        try { await audioRef.current.play(); } catch { setError('Press play to start this track.'); }
      });
    } catch (err) { setError(err.message); }
  }

  async function uploadTrack(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/tracks', { method: 'POST', token, body: form });
      setUploadOpen(false); event.currentTarget.reset(); setNotice('Track added to your library'); await refreshLibrary();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function savePlaylist(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const editing = playlistDraft?._id;
      const data = await request(editing ? `/playlists/${editing}` : '/playlists', {
        method: editing ? 'PATCH' : 'POST', token,
        body: JSON.stringify({ name: playlistName, description: playlistDescription })
      });
      setPlaylistOpen(false); setPlaylistDraft(null); setPlaylistName(''); setPlaylistDescription(''); setActivePlaylist(data.playlist); setView('playlist'); await refreshLibrary();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function removeFromPlaylist(playlist, track) {
    try {
      await request(`/playlists/${playlist._id}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ tracks: playlist.tracks.filter(item => item._id !== track._id).map(item => item._id) })
      });
      setNotice(`Removed from ${playlist.name}`); await refreshLibrary();
    } catch (err) { setError(err.message); }
  }

  async function addToPlaylist(playlist, track = currentTrack) {
    if (!track) return;
    try {
      await request(`/playlists/${playlist._id}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ tracks: [...new Set([...(playlist.tracks || []).map(item => item._id), track._id])] })
      });
      setNotice(`Added to ${playlist.name}`); await refreshLibrary();
    } catch (err) { setError(err.message); }
  }

  async function deleteTrack(track) {
    if (!window.confirm(`Remove “${track.title}” from your library?`)) return;
    try {
      await request(`/tracks/${track._id}`, { method: 'DELETE', token });
      if (currentTrack?._id === track._id) { audioRef.current?.pause(); setCurrentTrack(null); }
      await refreshLibrary(); setNotice('Track removed');
    } catch (err) { setError(err.message); }
  }

  async function deletePlaylist(playlist) {
    if (!window.confirm(`Delete the playlist “${playlist.name}”?`)) return;
    try {
      await request(`/playlists/${playlist._id}`, { method: 'DELETE', token });
      setActivePlaylist(null); setView('library'); await refreshLibrary(); setNotice('Playlist deleted');
    } catch (err) { setError(err.message); }
  }

  function onAuth(data) { setSession(data); setError(''); }
  function signOut() { audioRef.current?.pause(); setCurrentTrack(null); setSession(null); setTracks([]); setPlaylists([]); }
  function openCreatePlaylist() { setPlaylistDraft(null); setPlaylistName(''); setPlaylistDescription(''); setPlaylistOpen(true); }

  if (!session) return <AuthScreen onAuthenticated={onAuth} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={e => { e.preventDefault(); setView('library'); setActivePlaylist(null); }}><span className="brand-symbol">♫</span><span>sound<span className="brand-light">room</span></span></a>
      <div className="side-label">YOUR SPACE</div>
      <button className={`nav-link ${view === 'library' ? 'active' : ''}`} onClick={() => { setView('library'); setActivePlaylist(null); }}><Icon>▤</Icon> Library <span className="nav-count">{tracks.length}</span></button>
      <div className="playlist-heading"><span className="side-label">PLAYLISTS</span><button title="Create playlist" onClick={openCreatePlaylist}>＋</button></div>
      <div className="playlist-nav">
        {playlists.map(playlist => <button key={playlist._id} className={`nav-link playlist-link ${activePlaylist?._id === playlist._id ? 'active' : ''}`} onClick={() => { setActivePlaylist(playlist); setView('playlist'); }}><Icon>▧</Icon><span>{playlist.name}</span></button>)}
        {!playlists.length && <p className="empty-side">Your playlists will live here.</p>}
      </div>
      <div className="sidebar-bottom"><div className="privacy-note"><span>◈</span><div><strong>Your space.</strong><small>Only you can see your music.</small></div></div><button className="account-button" onClick={signOut}><span className="avatar">{session.user.displayName.charAt(0).toUpperCase()}</span><span className="account-name">{session.user.displayName}<small>Personal account</small></span><span className="signout">↗</span></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">HOME <span>/</span> <strong>{view === 'playlist' ? 'PLAYLIST' : 'YOUR LIBRARY'}</strong></div><div className="top-actions"><div className="search-box"><Icon>⌕</Icon><input aria-label="Search tracks" placeholder="Search your music" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div><button className="upload-button" onClick={() => setUploadOpen(true)}><span>＋</span> Add music</button></div></header>
      <section className="content-wrap">
        <div className="welcome-row"><div><p className="eyebrow">{view === 'playlist' ? 'A LITTLE COLLECTION' : 'YOUR SOUND, YOUR RULES'}</p><h1>{view === 'playlist' ? activePlaylist?.name || 'Playlist' : 'Your library.'}</h1><p className="section-subtitle">{view === 'playlist' ? activePlaylist?.description || 'A collection made for the moment.' : `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} in your collection`}</p></div>{view === 'playlist' && activePlaylist ? <div className="playlist-actions"><button onClick={() => { setPlaylistDraft(activePlaylist); setPlaylistName(activePlaylist.name); setPlaylistDescription(activePlaylist.description || ''); setPlaylistOpen(true); }}>Edit playlist</button><button className="danger-action" onClick={() => deletePlaylist(activePlaylist)}>Delete</button></div> : <div className="hero-note"><span className="hero-note-icon">✳</span><span>CURATED BY YOU</span></div>}</div>
        {(error || notice) && <div className={`toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}<button onClick={() => { setError(''); setNotice(''); }}>×</button></div>}
        <div className="library-tools"><div className="track-title-label">{view === 'playlist' ? 'IN THIS PLAYLIST' : 'ALL TRACKS'} <span>{visibleTracks.length}</span></div><div className="sort-tools"><label htmlFor="sort-select">SORT BY</label><select id="sort-select" value={sort} onChange={e => setSort(e.target.value)}><option value="createdAt">Recently added</option><option value="title">Title</option><option value="artist">Artist</option><option value="album">Album</option></select><button className="order-button" title={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}>{order === 'asc' ? '↑' : '↓'}</button></div></div>
        <div className="track-table"><div className="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>ADDED</span><span></span></div>
          {visibleTracks.map((track, index) => <div className={`track-row ${currentTrack?._id === track._id ? 'now-playing' : ''}`} key={track._id}>
            <button className="row-play" onClick={() => playTrack(track)} aria-label={currentTrack?._id === track._id && audioState.playing ? 'Pause' : `Play ${track.title}`}><span>{currentTrack?._id === track._id && audioState.playing ? 'Ⅱ' : '▶'}</span><em>{String(index + 1).padStart(2, '0')}</em></button>
            <button className="track-main" onClick={() => playTrack(track)}><span className="album-art" style={{ '--art-hue': `${(index * 61 + 189) % 360}` }}><span>♫</span></span><span className="track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span></button>
            <span className="track-album">{track.album || '—'}</span><span className="track-date">{new Date(track.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <div className="track-actions"><div className="add-menu"><button className="more-button" title="Track options">•••</button><div className="menu-popover"><strong>Add to playlist</strong>{playlists.map(playlist => <button key={playlist._id} onClick={() => addToPlaylist(playlist, track)}>{playlist.name}</button>)}{view === 'playlist' && activePlaylist && <button className="danger-action" onClick={() => removeFromPlaylist(activePlaylist, track)}>Remove from this playlist</button>}<button className="danger-action" onClick={() => deleteTrack(track)}>Remove track</button></div></div></div>
          </div>)}
          {!visibleTracks.length && <div className="empty-library"><div className="empty-disc">♫</div><h3>{query ? 'No matches found' : view === 'playlist' ? 'A fresh start.' : 'Your library is waiting.'}</h3><p>{query ? 'Try another title, artist, or album.' : view === 'playlist' ? 'Add tracks using the menu beside any song.' : 'Add a track to start building your own collection.'}</p>{!query && view !== 'playlist' && <button className="primary-button" onClick={() => setUploadOpen(true)}>＋ Add your first track</button>}</div>}
        </div>
      </section>
    </main>

    <footer className="player-bar">
      <div className="player-track">{currentTrack ? <><span className="album-art player-art"><span>♫</span></span><span className="track-copy"><strong>{currentTrack.title}</strong><small>{currentTrack.artist}</small></span><button className="player-add" title="Add current track to a playlist" onClick={() => playlists[0] && addToPlaylist(playlists[0])}>＋</button></> : <><span className="album-art idle-art">♫</span><span className="track-copy"><strong>Nothing playing</strong><small>Pick a track to begin</small></span></>}</div>
      <div className="player-controls"><div className="control-buttons"><button title="Previous track" onClick={() => { const i = visibleTracks.findIndex(t => t._id === currentTrack?._id); if (visibleTracks[i - 1]) playTrack(visibleTracks[i - 1]); }}>|◀</button><button className="play-toggle" title={audioState.playing ? 'Pause' : 'Play'} onClick={() => currentTrack && playTrack(currentTrack)}>{audioState.playing ? 'Ⅱ' : '▶'}</button><button title="Next track" onClick={() => { const i = visibleTracks.findIndex(t => t._id === currentTrack?._id); if (visibleTracks[i + 1]) playTrack(visibleTracks[i + 1]); }}>▶|</button></div><div className="timeline"><span>{formatTime(audioState.current)}</span><input aria-label="Seek" type="range" min="0" max={audioState.duration || 0} step="0.1" value={audioState.current} onChange={e => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }} /><span>{formatTime(audioState.duration)}</span></div><audio ref={audioRef} onTimeUpdate={() => setAudioState(state => ({ ...state, current: audioRef.current?.currentTime || 0 }))} onLoadedMetadata={() => setAudioState(state => ({ ...state, duration: audioRef.current?.duration || 0 }))} onPlay={() => setAudioState(state => ({ ...state, playing: true }))} onPause={() => setAudioState(state => ({ ...state, playing: false }))} onEnded={() => setAudioState(state => ({ ...state, playing: false }))} /></div>
      <div className="player-volume"><Icon>◖</Icon><input aria-label="Volume" type="range" min="0" max="1" step="0.01" defaultValue="0.8" onChange={e => { if (audioRef.current) audioRef.current.volume = Number(e.target.value); }} /></div>
    </footer>

    {uploadOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setUploadOpen(false)}><section className="modal-card"><button className="modal-close" onClick={() => setUploadOpen(false)}>×</button><p className="eyebrow">GROW YOUR COLLECTION</p><h2>Add a track</h2><p className="muted">Audio files up to 25 MB. MP3, WAV, OGG, FLAC, AAC or WebM.</p><form onSubmit={uploadTrack} className="modal-form"><label>Track title<input required name="title" maxLength="120" placeholder="Midnight City" /></label><label>Artist<input required name="artist" maxLength="120" placeholder="M83" /></label><label>Album <span className="optional">OPTIONAL</span><input name="album" maxLength="120" placeholder="Hurry Up, We're Dreaming" /></label><label className="file-drop"><span className="file-symbol">↑</span><strong>Choose an audio file</strong><small>or drop it here · up to 25 MB</small><input required name="audio" type="file" accept="audio/*" /></label><button className="primary-button full" disabled={busy}>{busy ? 'Uploading…' : 'Add to library'} <span>→</span></button></form></section></div>}
    {playlistOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setPlaylistOpen(false)}><section className="modal-card"><button className="modal-close" onClick={() => setPlaylistOpen(false)}>×</button><p className="eyebrow">MAKE A COLLECTION</p><h2>{playlistDraft ? 'Edit playlist' : 'New playlist'}</h2><p className="muted">{playlistDraft ? 'Update this collection.' : 'Give the moment a name.'}</p><form onSubmit={savePlaylist} className="modal-form"><label>Playlist name<input autoFocus required maxLength="80" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="Late night listening" /></label><label>Description <span className="optional">OPTIONAL</span><input maxLength="280" value={playlistDescription} onChange={e => setPlaylistDescription(e.target.value)} placeholder="Songs for the long way home" /></label><button className="primary-button full" disabled={busy}>{playlistDraft ? 'Save changes' : 'Create playlist'} <span>→</span></button></form></section></div>}
  </div>;
}
