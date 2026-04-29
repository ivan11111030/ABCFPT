/**
 * Export a scene configuration back to PPTX format.
 *
 * Uses JSZip to build a minimal PPTX package that preserves
 * text, background colors, and layout positioning. If the scene
 * has rawSlideXml from an original import, that XML is kept intact.
 */

import JSZip from "jszip";
import type { SceneConfig, SceneOverlay } from "@/src/types/scene";

// OOXML boilerplate
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

const PRESENTATION_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
</p:presentation>`;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert percentage position to EMU (English Metric Units) */
function pctToEmu(pct: number, totalEmu: number): number {
  return Math.round((pct / 100) * totalEmu);
}

function buildSlideXml(config: SceneConfig): string {
  // If we have preserved raw PPTX XML, use it directly
  if (config.rawSlideXml) {
    return config.rawSlideXml;
  }

  const slideW = 9144000; // 10 inches
  const slideH = 6858000; // 7.5 inches

  // Build background element
  let bgXml = "";
  if (config.background.type === "color") {
    const hex = config.background.value.replace("#", "");
    bgXml = `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${escapeXml(hex)}"/></a:solidFill></p:bgPr></p:bg>`;
  }

  // Build transition element
  let transXml = "";
  if (config.transition) {
    const speedMap: Record<string, string> = {};
    if (config.transition.duration <= 300) speedMap.spd = "fast";
    else if (config.transition.duration >= 800) speedMap.spd = "slow";
    else speedMap.spd = "med";

    const advTm = config.transition.advanceAfter ? ` advTm="${config.transition.advanceAfter}"` : "";
    transXml = `<p:transition spd="${speedMap.spd}"${advTm}><p:${escapeXml(config.transition.type)}/></p:transition>`;
  }

  // Build shape tree from overlays
  const shapes = config.overlays
    .filter((o) => o.visible)
    .map((overlay, idx) => overlayToShape(overlay, idx + 2, slideW, slideH))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    ${bgXml}
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      ${shapes}
    </p:spTree>
  </p:cSld>
  ${transXml}
</p:sld>`;
}

function overlayToShape(overlay: SceneOverlay, shapeId: number, slideW: number, slideH: number): string {
  const x = pctToEmu(overlay.position.x, slideW);
  const y = pctToEmu(overlay.position.y, slideH);
  const cx = pctToEmu(overlay.position.width, slideW);
  const cy = pctToEmu(overlay.height, slideH);

  const lines: string[] = [];
  if (overlay.text) lines.push(overlay.text);
  if (overlay.subtitle) lines.push(overlay.subtitle);

  const textBody = lines
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="en-US" sz="2400" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
    )
    .join("\n");

  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXml(overlay.id)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/>
    <a:lstStyle/>
    ${textBody}
  </p:txBody>
</p:sp>`;
}

/**
 * Export a SceneConfig to a downloadable .pptx Blob.
 */
export async function exportSceneToPptx(config: SceneConfig, fileName?: string): Promise<void> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("ppt/presentation.xml", PRESENTATION_XML);
  zip.file("ppt/_rels/presentation.xml.rels", PRESENTATION_RELS);
  zip.file("ppt/slides/slide1.xml", buildSlideXml(config));

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

  // Trigger download
  const name = fileName || "scene-export.pptx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
