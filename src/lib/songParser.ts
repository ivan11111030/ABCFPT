import type { Slide, Song } from "@/src/types/production";
import JSZip from "jszip";

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

export async function parsePptxFile(file: File): Promise<Song> {
  const title = file.name.replace(/\.pptx?$/i, "").replace(/[-_]/g, " ");
  const zip = await JSZip.loadAsync(file);
  const slides: Slide[] = [];

  // PPTX slides are in ppt/slides/slide1.xml, slide2.xml, etc.
  const slideEntries: { num: number; path: string }[] = [];
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) {
      slideEntries.push({ num: parseInt(match[1], 10), path: relativePath });
    }
  });

  // Sort by slide number
  slideEntries.sort((a, b) => a.num - b.num);

  for (const entry of slideEntries) {
    const xmlContent = await zip.file(entry.path)?.async("text");
    if (!xmlContent) continue;

    // Extract all text from <a:t> tags in the slide XML
    const textParts: string[] = [];
    const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match: RegExpExecArray | null;
    while ((match = textRegex.exec(xmlContent)) !== null) {
      const text = match[1].trim();
      if (text) textParts.push(text);
    }

    // Extract speaker notes from the corresponding notesSlide XML
    let speakerNotes = "";
    const notesPath = `ppt/notesSlides/notesSlide${entry.num}.xml`;
    const notesFile = zip.file(notesPath);
    if (notesFile) {
      try {
        const notesXml = await notesFile.async("text");
        const notesParts: string[] = [];
        const notesRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
        let notesMatch: RegExpExecArray | null;
        while ((notesMatch = notesRegex.exec(notesXml)) !== null) {
          const nt = notesMatch[1].trim();
          if (nt) notesParts.push(nt);
        }
        // Filter out the auto-generated slide number placeholder text
        const filtered = notesParts.filter(
          (t) => !/^\d+$/.test(t) && t !== "<number>" && t.toLowerCase() !== "slide" && t.length > 1
        );
        speakerNotes = filtered.join("\n").trim();
      } catch {
        // notes file unreadable — skip
      }
    }

    const slideText = textParts.join("\n").trim();
    if (slideText) {
      slides.push({
        id: `slide-pptx-${Date.now()}-${slides.length}`,
        section: `Slide ${slides.length + 1}`,
        text: slideText,
        ...(speakerNotes ? { notes: speakerNotes } : {}),
      });
    }
  }

  // If no slides extracted, create a placeholder
  if (slides.length === 0) {
    slides.push({
      id: `slide-pptx-${Date.now()}-0`,
      section: "Slide 1",
      text: "(No text content found in presentation)",
    });
  }

  return {
    id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist: "Imported from PPT",
    key: "C",
    tempo: 0,
    currentSection: slides[0]?.section || "Slide 1",
    slides,
    favorite: false,
  };
}

export async function parseFile(file: File): Promise<Song | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase();

    let song: Song | null = null;

    if (ext === "pptx") {
      song = await parsePptxFile(file);
    } else {
      const content = await file.text();
      if (ext === "txt") song = parseTxtFile(content, file.name);
      else if (ext === "lrc") song = parseLrcFile(content, file.name);
    }

    if (!song) return null;

    // Validate: must have a title and at least one slide with text
    if (!song.title.trim()) song.title = file.name.replace(/\.[^.]+$/, "");
    if (!song.slides.length) {
      song.slides = [{ id: `slide-fallback-${Date.now()}`, section: "Slide 1", text: "(Empty file)" }];
    }

    return song;
  } catch (err) {
    console.error(`Failed to parse file "${file.name}":`, err);
    return null;
  }
}
