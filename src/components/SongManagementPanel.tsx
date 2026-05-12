"use client";

import { useRef, useState, useEffect, type DragEvent } from "react";
import type { Song, Slide, TextStyle } from "@/src/types/production";
import * as songStore from "@/src/lib/songStore";
import * as setlistMembershipStore from "@/src/lib/setlistMembershipStore";

const WEB_FONTS = ["Inter", "Arial", "Georgia", "Merriweather", "Roboto", "Oswald", "Playfair Display", "Montserrat", "Open Sans", "Lato"];

function TextStyleControls({ style = {}, onChange }: { style?: TextStyle; onChange: (s: TextStyle) => void }) {
  return (
    <div className="text-style-controls" style={{ marginTop: 6 }}>
      <div className="tsc-row">
        <label>Font</label>
        <select style={{ flex: 1, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 11 }} value={style.fontFamily ?? ""} onChange={(e) => onChange({ ...style, fontFamily: e.target.value || undefined })}>
          <option value="">Default</option>
          {WEB_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="tsc-row">
        <label>Size</label>
        <input type="number" min={16} max={120} style={{ width: 60, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 11 }} value={style.fontSize ?? ""} placeholder="–" onChange={(e) => onChange({ ...style, fontSize: e.target.value ? Number(e.target.value) : undefined })} />
        <span style={{ fontSize: 10, color: "var(--muted)" }}>px</span>
        <label style={{ marginLeft: 8 }}>Color</label>
        <input type="color" value={style.color ?? "#ffffff"} onChange={(e) => onChange({ ...style, color: e.target.value })} style={{ width: 30, height: 22, border: "none", borderRadius: 4, cursor: "pointer", background: "none", padding: 0 }} />
      </div>
      <div className="tsc-row">
        <label>Align</label>
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" style={{ padding: "2px 7px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: style.align === a ? "var(--accent)" : "transparent", color: style.align === a ? "#000" : "var(--text)", cursor: "pointer" }} onClick={() => onChange({ ...style, align: style.align === a ? undefined : a })}>
            {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
          </button>
        ))}
        <button type="button" style={{ marginLeft: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, borderRadius: 4, border: "1px solid var(--border)", background: style.bold ? "var(--accent)" : "transparent", color: style.bold ? "#000" : "var(--text)", cursor: "pointer" }} onClick={() => onChange({ ...style, bold: !style.bold })}>B</button>
        <button type="button" style={{ padding: "2px 7px", fontSize: 11, fontStyle: "italic", borderRadius: 4, border: "1px solid var(--border)", background: style.italic ? "var(--accent)" : "transparent", color: style.italic ? "#000" : "var(--text)", cursor: "pointer" }} onClick={() => onChange({ ...style, italic: !style.italic })}>I</button>
      </div>
    </div>
  );
}

type SongManagementPanelProps = {
  songs: Song[];
  onImportSong?: (files: FileList | File[], category: "song" | "message" | "announcement") => void;
  onAddSong?: (song: Song) => void;
  onUpdateSong?: (song: Song) => void;
  onDeleteSong?: (songId: string) => void;
};

function emptySong(category: "song" | "message" | "announcement" = "song"): Song {
  return {
    id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    artist: category === "song" ? "" : "System",
    key: "C",
    tempo: 0,
    currentSection: "Verse 1",
    slides: [{ id: `slide-${Date.now()}`, section: "Verse 1", text: "" }],
    favorite: false,
    templateMetadata: {
      originalFormat: category,
    },
  };
}

export function SongManagementPanel({ songs, onImportSong, onAddSong, onUpdateSong, onDeleteSong }: SongManagementPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSong, setNewSong] = useState<Song>(emptySong());
  const [searchQuery, setSearchQuery] = useState("");
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"songs" | "messages" | "announcements" | "actions">("songs");
  const [itemCategory, setItemCategory] = useState<"song" | "message" | "announcement">("song");
  const [setlistItems, setSetlistItems] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to membership changes
  useEffect(() => {
    const unsubscribe = setlistMembershipStore.subscribe(() => {
      const items = setlistMembershipStore.getSetlistItems();
      setSetlistItems(new Set(items.map((m) => m.itemId)));
    });

    // Load initial membership data
    const items = setlistMembershipStore.getSetlistItems();
    setSetlistItems(new Set(items.map((m) => m.itemId)));

    return unsubscribe;
  }, []);

  const getItemsForCategory = (category: "song" | "message" | "announcement") => {
    return songs.filter((s) => s.templateMetadata?.originalFormat === category || (category === "song" && !s.templateMetadata?.originalFormat));
  };

  const handleAddToSetlist = (songId: string) => {
    try {
      setlistMembershipStore.addItemToSetlist(songId, itemCategory);
    } catch (error) {
      console.warn("Item already in setlist or error:", error);
    }
  };

  const handleRemoveFromSetlist = (songId: string) => {
    setlistMembershipStore.removeItemFromSetlist(songId, itemCategory);
  };

  const handleAddAllToSetlist = (category: "song" | "message" | "announcement") => {
    const categoryItems = getItemsForCategory(category);
    const itemsToAdd = categoryItems
      .filter((s) => !setlistItems.has(s.id))
      .map((s) => ({ itemId: s.id, itemCategory: category }));
    
    if (itemsToAdd.length > 0) {
      setlistMembershipStore.addItemsToSetlist(itemsToAdd);
    }
  };

  const handleUploadToCloud = async () => {
    setCloudBusy(true);
    setCloudStatus("");
    const result = await songStore.uploadToCloud();
    setCloudStatus(result.ok ? `☁️ ${result.message}` : `⚠️ ${result.message}`);
    setCloudBusy(false);
    setTimeout(() => setCloudStatus(""), 6000);
  };

  const handleDownloadFromCloud = async () => {
    setCloudBusy(true);
    setCloudStatus("");
    const result = await songStore.downloadFromCloud(true);
    setCloudStatus(result.ok ? `☁️ ${result.message}` : `⚠️ ${result.message}`);
    setCloudBusy(false);
    setTimeout(() => setCloudStatus(""), 6000);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setDroppedFiles(fileArray);
    onImportSong?.(files, itemCategory);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFileSelect(event.dataTransfer.files);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddSlide = (song: Song, setSong: (s: Song) => void) => {
    const slide: Slide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      section: "Verse",
      text: "",
    };
    setSong({ ...song, slides: [...song.slides, slide] });
  };

  const handleUpdateSlide = (song: Song, setSong: (s: Song) => void, slideIndex: number, field: keyof Slide, value: string) => {
    const slides = [...song.slides];
    slides[slideIndex] = { ...slides[slideIndex], [field]: value };
    setSong({ ...song, slides });
  };

  const handleRemoveSlide = (song: Song, setSong: (s: Song) => void, slideIndex: number) => {
    if (song.slides.length <= 1) return;
    const slides = song.slides.filter((_, i) => i !== slideIndex);
    setSong({ ...song, slides });
  };

  const handleSaveNew = () => {
    if (!newSong.title.trim()) return;
    onAddSong?.({ ...newSong, templateMetadata: { originalFormat: itemCategory } });
    setNewSong(emptySong(itemCategory));
    setShowAddForm(false);
  };

  const handleSaveEdit = () => {
    if (!editingSong || !editingSong.title.trim()) return;
    onUpdateSong?.(editingSong);
    setEditingSong(null);
  };

  const handleDelete = (songId: string) => {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    onDeleteSong?.(songId);
    if (editingSong?.id === songId) setEditingSong(null);
  };

  const currentCategoryItems = activeTab === "songs" ? getItemsForCategory("song") : activeTab === "messages" ? getItemsForCategory("message") : getItemsForCategory("announcement");

  const filteredSongs = currentCategoryItems.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
  });

  const renderSongForm = (song: Song, setSong: (s: Song) => void, onSave: () => void, onCancel: () => void, title: string) => (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 12px" }}>{title}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Title</span>
          <input type="text" value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value })}
            placeholder="Title" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }} />
        </label>
        {itemCategory === "song" && (
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Artist</span>
            <input type="text" value={song.artist} onChange={(e) => setSong({ ...song, artist: e.target.value })}
              placeholder="Artist" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }} />
          </label>
        )}
        {itemCategory === "song" && (
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Key</span>
            <select value={song.key} onChange={(e) => setSong({ ...song, key: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}>
              {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        )}
        {itemCategory === "song" && (
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Tempo (BPM)</span>
            <input type="number" value={song.tempo || ""} onChange={(e) => setSong({ ...song, tempo: Number(e.target.value) || 0 })}
              placeholder="120" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }} />
          </label>
        )}
      </div>

      <h4 style={{ margin: "12px 0 8px", fontSize: 14 }}>Slides ({song.slides.length})</h4>
      {song.slides.map((slide, i) => (
        <div key={slide.id} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, padding: "8px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ minWidth: 24, textAlign: "center", paddingTop: 8, color: "var(--muted)", fontSize: 12 }}>{i + 1}</span>
            <select value={slide.section} onChange={(e) => handleUpdateSlide(song, setSong, i, "section", e.target.value)}
              style={{ width: 120, padding: "8px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 12 }}>
              {[slide.section, "Verse 1", "Verse 2", "Verse 3", "Chorus", "Pre-Chorus", "Bridge", "Tag", "Outro", "Intro"]
                .filter((s, idx, arr) => arr.indexOf(s) === idx)
                .map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={slide.text} onChange={(e) => handleUpdateSlide(song, setSong, i, "text", e.target.value)}
              placeholder="Content..." rows={2}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
            <button type="button" onClick={() => handleRemoveSlide(song, setSong, i)} disabled={song.slides.length <= 1}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginLeft: 32 }}>
            <textarea value={slide.notes ?? ""} onChange={(e) => handleUpdateSlide(song, setSong, i, "notes", e.target.value)}
              placeholder="Notes (optional)..." rows={1}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, resize: "vertical", fontStyle: "italic" }} />
          </div>
          <div style={{ marginLeft: 32 }}>
            <TextStyleControls
              style={slide.textStyle}
              onChange={(ts) => {
                const slides = [...song.slides];
                slides[i] = { ...slides[i], textStyle: ts };
                setSong({ ...song, slides });
              }}
            />
          </div>
        </div>
      ))}
      <button type="button" className="button subtle" onClick={() => handleAddSlide(song, setSong)} style={{ width: "100%", marginBottom: 12 }}>
        + Add Slide
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="button primary" onClick={onSave}>Save</button>
        <button type="button" className="button outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );

  return (
    <section className="song-panel">
      <div className="panel-header">
        <p>Content Library</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="button primary" onClick={() => { setActiveTab("songs"); setItemCategory("song"); setShowAddForm(true); setNewSong(emptySong("song")); }}>
            + Add
          </button>
          <button type="button" className="button outline" onClick={handleImportClick}>
            Import File
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 12, overflowX: "auto" }}>
        {(["songs", "messages", "announcements", "actions"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className="button subtle"
            onClick={() => { setActiveTab(tab); if (tab !== "actions") setItemCategory(tab === "songs" ? "song" : tab === "messages" ? "message" : "announcement"); }}
            style={{
              minWidth: 120,
              padding: "8px 12px",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "none",
              borderRadius: 0,
              background: "transparent",
              color: activeTab === tab ? "var(--accent)" : "var(--muted)",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {tab === "songs" ? `Songs (${getItemsForCategory("song").length})` : tab === "messages" ? `Messages (${getItemsForCategory("message").length})` : tab === "announcements" ? `Announcements (${getItemsForCategory("announcement").length})` : "Actions"}
          </button>
        ))}
      </div>

      {/* Setlist Actions Tab */}
      {activeTab === "actions" && (
        <div style={{ background: "var(--panel)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13 }}>Bulk Operations</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button type="button" className="button primary" onClick={() => handleAddAllToSetlist("song")} style={{ fontSize: 12 }}>
              ➕ Add All Songs
            </button>
            <button type="button" className="button primary" onClick={() => handleAddAllToSetlist("message")} style={{ fontSize: 12 }}>
              ➕ Add All Messages
            </button>
            <button type="button" className="button primary" onClick={() => handleAddAllToSetlist("announcement")} style={{ fontSize: 12 }}>
              ➕ Add All Announcements
            </button>
          </div>
          
          {/* Cloud Sync Bar */}
          <h4 style={{ margin: "12px 0 8px", fontSize: 13 }}>Cloud Sync</h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="button outline" disabled={cloudBusy} onClick={handleUploadToCloud}
              style={{ flex: 1, padding: "8px 12px", fontSize: 12 }}>
              {cloudBusy ? "…" : "⬆ Upload"}
            </button>
            <button type="button" className="button outline" disabled={cloudBusy} onClick={handleDownloadFromCloud}
              style={{ flex: 1, padding: "8px 12px", fontSize: 12 }}>
              {cloudBusy ? "…" : "⬇ Download"}
            </button>
          </div>
          {cloudStatus && (
            <div style={{ padding: "8px 12px", borderRadius: 8, marginTop: 8, fontSize: 13,
              background: cloudStatus.startsWith("⚠️") ? "var(--danger)" : "var(--success)", color: "#fff" }}>
              {cloudStatus}
            </div>
          )}
        </div>
      )}

      {/* Content Tabs */}
      {activeTab !== "actions" && (
        <>
          <div
            className={`drop-zone ${dragging ? "drag-over" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <p>Drop .txt, .lrc, or .pptx files here to import content</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.lrc,.pptx"
            multiple
            hidden
            onChange={(event) => handleFileSelect(event.target.files)}
          />

          {droppedFiles.length > 0 && (
            <div className="import-list">
              <p className="muted-note">Imported files:</p>
              <ul>{droppedFiles.map((file) => <li key={file.name}>{file.name}</li>)}</ul>
            </div>
          )}

          {/* Add Form */}
          {showAddForm && renderSongForm(newSong, setNewSong, handleSaveNew, () => setShowAddForm(false), `Add New ${activeTab === "songs" ? "Song" : activeTab === "messages" ? "Message" : "Announcement"}`)}

          {/* Edit Form */}
          {editingSong && renderSongForm(editingSong, setEditingSong as any, handleSaveEdit, () => setEditingSong(null), `Edit: ${editingSong.title}`)}

          <div className="song-search-row">
            <input type="search" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          <div className="song-list">
            {filteredSongs.map((song) => {
              const isInSetlist = setlistItems.has(song.id);
              return (
                <article key={song.id} className="song-card">
                  <div>
                    <strong>{song.title}</strong>
                    <p>{activeTab === "songs" || song.artist.startsWith("System") ? song.artist : ""} {activeTab === "songs" ? `• ${song.key} • ${song.tempo ? `${song.tempo} BPM` : "No tempo"}` : ""} • {song.slides.length} slides</p>
                  </div>
                  <div className="song-meta" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {song.favorite && <span className="status favorite">★ Favorite</span>}
                    {isInSetlist && <span className="status success" style={{ background: "var(--success)", color: "#000" }}>✓ In Setlist</span>}
                    {isInSetlist ? (
                      <button 
                        type="button" 
                        className="button subtle" 
                        style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}
                        onClick={() => handleRemoveFromSetlist(song.id)}
                        title="Remove from setlist"
                      >
                        ➖ Remove
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="button subtle" 
                        style={{ padding: "4px 10px", fontSize: 12, color: "var(--success)" }}
                        onClick={() => handleAddToSetlist(song.id)}
                        title="Add to setlist"
                      >
                        ➕ Add
                      </button>
                    )}
                    <button type="button" className="button subtle" style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => { setEditingSong({ ...song, slides: song.slides.map((s) => ({ ...s })) }); setShowAddForm(false); }}>
                      ✏️ Edit
                    </button>
                    <button type="button" className="button subtle" style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}
                      onClick={() => handleDelete(song.id)}>
                      🗑️ Delete
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredSongs.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                {songs.length === 0 ? "No content yet. Add or import files." : "No items match your search."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
