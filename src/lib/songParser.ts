import type { Slide, Song, SlideTransition } from "@/src/types/production";
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

  // ── Extract theme/master fonts for reference ──
  const embeddedFonts: string[] = [];
  const themeFile = zip.file("ppt/theme/theme1.xml");
  if (themeFile) {
    try {
      const themeXml = await themeFile.async("text");
      const fontRegex = /<a:latin\s+typeface="([^"]+)"/g;
      let fontMatch: RegExpExecArray | null;
      while ((fontMatch = fontRegex.exec(themeXml)) !== null) {
        if (!embeddedFonts.includes(fontMatch[1])) embeddedFonts.push(fontMatch[1]);
      }
      const eastAsianFontRegex = /<a:ea\s+typeface="([^"]+)"/g;
      while ((fontMatch = eastAsianFontRegex.exec(themeXml)) !== null) {
        if (!embeddedFonts.includes(fontMatch[1])) embeddedFonts.push(fontMatch[1]);
      }
    } catch { /* theme unreadable */ }
  }

  // ── Extract presentation-level slide size ──
  let slideWidth = 9144000; // default EMU (10in)
  let slideHeight = 6858000; // default EMU (7.5in)
  const presentationFile = zip.file("ppt/presentation.xml");
  if (presentationFile) {
    try {
      const presXml = await presentationFile.async("text");
      const sizeMatch = presXml.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
      if (sizeMatch) {
        slideWidth = parseInt(sizeMatch[1], 10);
        slideHeight = parseInt(sizeMatch[2], 10);
      }
    } catch { /* fallback to defaults */ }
  }

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

    // ── Preserve raw XML for faithful rendering ──
    const rawXml = xmlContent;

    // ── Extract transition metadata ──
    let transition: SlideTransition | undefined;
    const transMatch = xmlContent.match(/<p:transition(?:\s+spd="([^"]*)")?(?:\s+advTm="(\d+)")?[^>]*>([\s\S]*?)<\/p:transition>/);
    if (transMatch) {
      const speed = transMatch[1] || "med";
      const advanceAfter = transMatch[2] ? parseInt(transMatch[2], 10) : undefined;
      // Extract transition type from child element
      const typeMatch = transMatch[3]?.match(/<p:(\w+)/);
      const transType = typeMatch?.[1] || "fade";
      const durationMap: Record<string, number> = { slow: 1000, med: 500, fast: 250 };
      transition = {
        type: transType,
        duration: durationMap[speed] || 500,
        ...(advanceAfter !== undefined ? { advanceAfter } : {}),
      };
    }

    // ── Extract all text runs preserving formatting ──
    const textParts: string[] = [];
    const textRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match: RegExpExecArray | null;
    while ((match = textRegex.exec(xmlContent)) !== null) {
      const text = match[1].trim();
      if (text) textParts.push(text);
    }

    // ── Extract per-slide background ──
    let slideBackground: string | undefined;
    const bgFillMatch = xmlContent.match(/<p:bg>[\s\S]*?<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
    if (bgFillMatch) {
      slideBackground = `#${bgFillMatch[1]}`;
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

    // ── Render slide to image via canvas for faithful preview ──
    let renderedImage: string | undefined;
    try {
      renderedImage = await renderSlideToImage(xmlContent, embeddedFonts, slideWidth, slideHeight);
    } catch {
      // rendering failed; text fallback will be used
    }

    const slideText = textParts.join("\n").trim();
    if (slideText || renderedImage) {
      slides.push({
        id: `slide-pptx-${Date.now()}-${slides.length}`,
        section: `Slide ${slides.length + 1}`,
        text: slideText || "(Visual slide – no text)",
        ...(speakerNotes ? { notes: speakerNotes } : {}),
        ...(slideBackground ? { background: slideBackground } : {}),
        ...(renderedImage ? { renderedImage } : {}),
        rawXml,
        ...(transition ? { transition } : {}),
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

/**
 * Render a PPTX slide XML to a base64 PNG image using an offscreen canvas.
 * Extracts text runs with position/font info and draws them faithfully.
 */
async function renderSlideToImage(
  slideXml: string,
  themeFonts: string[],
  slideWidthEmu: number,
  slideHeightEmu: number,
): Promise<string | undefined> {
  if (typeof document === "undefined") return undefined; // SSR guard

  const canvasWidth = 960;
  const canvasHeight = Math.round(canvasWidth * (slideHeightEmu / slideWidthEmu));
  const scaleX = canvasWidth / slideWidthEmu;
  const scaleY = canvasHeight / slideHeightEmu;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  // Background
  ctx.fillStyle = "#000000";
  const bgMatch = slideXml.match(/<p:bg>[\s\S]*?<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
  if (bgMatch) ctx.fillStyle = `#${bgMatch[1]}`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Extract shape positions and text
  const shapeRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let shapeMatch: RegExpExecArray | null;

  while ((shapeMatch = shapeRegex.exec(slideXml)) !== null) {
    const shapeXml = shapeMatch[1];

    // Position from <a:off> and <a:ext>
    const offMatch = shapeXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
    const extMatch = shapeXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (!offMatch) continue;

    const x = parseInt(offMatch[1], 10) * scaleX;
    const y = parseInt(offMatch[2], 10) * scaleY;
    const w = extMatch ? parseInt(extMatch[1], 10) * scaleX : canvasWidth;

    // Extract text runs
    const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
    let runMatch: RegExpExecArray | null;
    let lineY = y + 20;

    while ((runMatch = runRegex.exec(shapeXml)) !== null) {
      const runXml = runMatch[1];
      const textMatch = runXml.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (!textMatch) continue;

      const text = textMatch[1].trim();
      if (!text) continue;

      // Font properties
      const sizeMatch = runXml.match(/sz="(\d+)"/);
      const boldMatch = runXml.match(/b="1"/);
      const italicMatch = runXml.match(/i="1"/);
      const fontMatch = runXml.match(/<a:latin\s+typeface="([^"]+)"/);
      const colorMatch = runXml.match(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);

      const fontSize = sizeMatch ? parseInt(sizeMatch[1], 10) / 100 * scaleX * 10 : 16;
      const fontFamily = fontMatch?.[1] || themeFonts[0] || "sans-serif";
      const bold = boldMatch ? "bold " : "";
      const italic = italicMatch ? "italic " : "";

      ctx.font = `${italic}${bold}${Math.max(10, fontSize)}px "${fontFamily}", sans-serif`;
      ctx.fillStyle = colorMatch ? `#${colorMatch[1]}` : "#ffffff";
      ctx.textBaseline = "top";

      // Word wrap within shape width
      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > w - 10) {
          ctx.fillText(line, x + 5, lineY);
          lineY += fontSize * 1.3;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, x + 5, lineY);
        lineY += fontSize * 1.3;
      }
    }
  }

  return canvas.toDataURL("image/png", 0.85);
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
