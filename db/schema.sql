-- ABCF Production Team database schema for worship production

-- Content items can be songs, messages, or announcements
CREATE TYPE item_category AS ENUM ('song', 'message', 'announcement');

-- Items table holds all content metadata (songs, messages, announcements)
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  category item_category NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  "key" TEXT,
  tempo INTEGER,
  favorite BOOLEAN DEFAULT FALSE,
  template_metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Slides are ordered content within items
CREATE TABLE slides (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  background_url TEXT,
  text_style JSONB,
  rendered_image TEXT,
  raw_xml TEXT,
  transition JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Legacy songs table maintained for backwards compatibility
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  "key" TEXT NOT NULL,
  tempo INTEGER NOT NULL,
  favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Legacy song sections and lyrics for backwards compatibility
CREATE TABLE song_slides (
  id TEXT PRIMARY KEY,
  song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  background_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Setlists define order of content for a service
CREATE TABLE setlists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Setlist memberships track which items are explicitly added to a setlist
CREATE TABLE setlist_memberships (
  id TEXT PRIMARY KEY,
  setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  item_category item_category NOT NULL,
  position INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(setlist_id, item_id, item_category)
);

-- Legacy setlist_items table maintained for backwards compatibility
CREATE TABLE setlist_items (
  id TEXT PRIMARY KEY,
  setlist_id TEXT REFERENCES setlists(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,
  position INTEGER NOT NULL
);

-- Users manage access and roles in the production app.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Audio input and mixer session metadata.
CREATE TABLE audio_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Connected camera sources including network and mobile devices.
CREATE TABLE camera_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  ip_address TEXT,
  stream_url TEXT NOT NULL,
  status TEXT NOT NULL,
  supports_ptz BOOLEAN DEFAULT FALSE,
  is_mobile BOOLEAN DEFAULT FALSE,
  signal_strength TEXT,
  preset_positions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE mobile_camera_devices (
  id TEXT PRIMARY KEY,
  camera_source_id TEXT REFERENCES camera_sources(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  connection_token TEXT NOT NULL,
  last_connected TIMESTAMP WITH TIME ZONE,
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE rtmp_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  ingest_url TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optional scripture and slide overlays for worship services.
CREATE TABLE scripture_slides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  verse TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  background_url TEXT
);
