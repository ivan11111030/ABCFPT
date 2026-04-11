import type { Slide, Song } from "@/src/types/production";

export function parseTxtFile(content: string, fileName: string): Song {
  const title = fileName.replace(/\.txt$/i, "").replace(/[-_]/g, " ");
  const rawLines = content.split(/\n/);

  const slides: Slide[] = [];
  let currentSection = "Verse 1";
  let slideBuffer: string[] = [];

  const sectionRegex = /^\[(.*?)\]$|^(Verse|Chorus|Bridge|Tag|Pre-Chorus|Outro|Intro)\s*\d*\s*:?\s*$/i;

  for (const line of rawLines) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(sectionRegex);

    if (sectionMatch) {
      if (slideBuffer.length > 0) {
        slides.push({
          id: `slide-imp-${Date.now()}-${slides.length}`,
          section: currentSection,
          text: slideBuffer.join("\n"),
        });
        slideBuffer = [];
      }
      currentSection = sectionMatch[1] || sectionMatch[0].replace(/:$/, "").trim();
    } else if (trimmed === "") {
      if (slideBuffer.length > 0) {
        slides.push({
          id: `slide-imp-${Date.now()}-${slides.length}`,
          section: currentSection,
          text: slideBuffer.join("\n"),
        });
        slideBuffer = [];
      }
    } else {
      slideBuffer.push(trimmed);
    }
  }

  if (slideBuffer.length > 0) {
    slides.push({
      id: `slide-imp-${Date.now()}-${slides.length}`,
      section: currentSection,
      text: slideBuffer.join("\n"),
    });
  }

  if (slides.length === 0) {
    const allLines = rawLines.filter((l) => l.trim());
    for (let i = 0; i < allLines.length; i += 4) {
      slides.push({
        id: `slide-imp-${Date.now()}-${slides.length}`,
        section: `Slide ${slides.length + 1}`,
        text: allLines.slice(i, i + 4).join("\n"),
      });
    }
  }

  return {
    id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist: "Imported",
    key: "C",
    tempo: 0,
    currentSection: slides[0]?.section || "Verse 1",
    slides,
    favorite: false,
  };
}

export function parseLrcFile(content: string, fileName: string): Song {
  let title = fileName.replace(/\.lrc$/i, "").replace(/[-_]/g, " ");
  let artist = "Imported";
  const slides: Slide[] = [];
  const lines = content.split(/\n/);

  for (const line of lines) {
    const metaMatch = line.match(/^\[(\w+):(.+)\]$/);
    if (metaMatch) {
      if (metaMatch[1] === "ti") title = metaMatch[2].trim();
      if (metaMatch[1] === "ar") artist = metaMatch[2].trim();
      continue;
    }

    const lyricMatch = line.match(/^\[(\d+:\d+[\.\d]*)\](.*)$/);
    if (lyricMatch && lyricMatch[2].trim()) {
      slides.push({
        id: `slide-imp-${Date.now()}-${slides.length}`,
        section: `Line ${slides.length + 1}`,
        text: lyricMatch[2].trim(),
      });
    }
  }

  return {
    id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist,
    key: "C",
    tempo: 0,
    currentSection: slides[0]?.section || "Line 1",
    slides,
    favorite: false,
  };
}

export async function parseFile(file: File): Promise<Song | null> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const content = await file.text();

  if (ext === "txt") return parseTxtFile(content, file.name);
  if (ext === "lrc") return parseLrcFile(content, file.name);

  return null;
}
