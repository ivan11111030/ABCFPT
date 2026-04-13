"use client";

import { useCallback, useRef, useState } from "react";
import type { CanvaDesign, BackgroundConfig } from "@/src/types/production";

/**
 * Canva integration panel – supports two modes:
 *
 * 1. **API mode** (Canva Connect API): When a Canva API key is configured, the user
 *    can browse their Canva designs and import them directly. The Canva Connect API
 *    (https://www.canva.dev/docs/connect/) provides design listing & export endpoints.
 *
 * 2. **File export mode** (fallback): The user exports a design from Canva as PNG/JPG/
 *    PDF and uploads the file here. This works without any API key.
 */

type CanvaIntegrationPanelProps = {
  onApplyAsOverlay: (imageUrl: string) => void;
  onApplyAsBackground: (bg: BackgroundConfig) => void;
};

const CANVA_API_BASE = "https://api.canva.com/rest/v1";

export function CanvaIntegrationPanel({ onApplyAsOverlay, onApplyAsBackground }: CanvaIntegrationPanelProps) {
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("canva_api_key") || "" : ""
  );
  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"api" | "file">(apiKey ? "api" : "file");
  const [importedFiles, setImportedFiles] = useState<CanvaDesign[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (typeof window !== "undefined") {
      if (key) localStorage.setItem("canva_api_key", key);
      else localStorage.removeItem("canva_api_key");
    }
  };

  const fetchDesigns = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Canva API key");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${CANVA_API_BASE}/designs`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Canva API error: ${res.status}`);
      }

      const data = await res.json();
      const items: CanvaDesign[] = (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.title || "Untitled Design",
        thumbnailUrl: item.thumbnail?.url || "",
        exportUrl: "",
        type: "background" as const,
        importedAt: Date.now(),
      }));

      setDesigns(items);
    } catch (err: any) {
      setError(err.message || "Failed to fetch Canva designs");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const exportDesign = useCallback(async (designId: string) => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");

    try {
      // Request PNG export
      const exportRes = await fetch(`${CANVA_API_BASE}/designs/${encodeURIComponent(designId)}/exports`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ format: { type: "png" } }),
      });

      if (!exportRes.ok) {
        throw new Error(`Export failed: ${exportRes.status}`);
      }

      const exportData = await exportRes.json();
      const exportUrl = exportData.export?.url || exportData.urls?.[0];

      if (exportUrl) {
        setDesigns((prev) =>
          prev.map((d) => (d.id === designId ? { ...d, exportUrl } : d))
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to export design");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) continue; // 10MB limit

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const design: CanvaDesign = {
          id: `canva-file-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title: file.name.replace(/\.[^.]+$/, ""),
          thumbnailUrl: dataUrl,
          exportUrl: dataUrl,
          type: "background",
          importedAt: Date.now(),
        };
        setImportedFiles((prev) => [...prev, design]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyDesign = (design: CanvaDesign, applyAs: "overlay" | "background") => {
    const imageUrl = design.exportUrl || design.thumbnailUrl;
    if (!imageUrl) return;

    if (applyAs === "overlay") {
      onApplyAsOverlay(imageUrl);
    } else {
      onApplyAsBackground({ type: "image", value: imageUrl, opacity: 100 });
    }
  };

  const allDesigns = [...designs, ...importedFiles];

  return (
    <section className="scene-panel canva-panel">
      <div className="panel-header"><p>Canva Integration</p></div>

      {/* Mode tabs */}
      <div className="bg-tabs" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`button ${mode === "api" ? "primary" : "subtle"}`}
          onClick={() => setMode("api")}
          style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}
        >
          API Connect
        </button>
        <button
          type="button"
          className={`button ${mode === "file" ? "primary" : "subtle"}`}
          onClick={() => setMode("file")}
          style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}
        >
          File Import
        </button>
      </div>

      {/* API mode */}
      {mode === "api" && (
        <div className="canva-api-section">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <input
              type="password"
              placeholder="Canva API Key"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              className="setlist-search"
              style={{ flex: 1, fontSize: 11, padding: "6px 10px" }}
            />
            <button
              type="button"
              className="button primary"
              onClick={fetchDesigns}
              disabled={loading || !apiKey.trim()}
              style={{ padding: "6px 12px", fontSize: 11 }}
            >
              {loading ? "…" : "Fetch"}
            </button>
          </div>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
            Get your API key from{" "}
            <a href="https://www.canva.dev/docs/connect/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              canva.dev/docs/connect
            </a>
          </p>
        </div>
      )}

      {/* File import mode */}
      {mode === "file" && (
        <div style={{ marginBottom: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="button outline"
            style={{ width: "100%", fontSize: 12 }}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Import Canva Export (PNG/JPG)
          </button>
          <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Export your Canva design as PNG/JPG, then upload here
          </p>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8 }}>{error}</p>
      )}

      {/* Design grid */}
      {allDesigns.length > 0 && (
        <div className="canva-design-grid">
          {allDesigns.map((design) => (
            <div key={design.id} className="canva-design-card">
              {design.thumbnailUrl && (
                <img
                  src={design.thumbnailUrl}
                  alt={design.title}
                  className="canva-design-thumb"
                />
              )}
              <p className="canva-design-title">{design.title}</p>
              <div className="canva-design-actions">
                {!design.exportUrl && mode === "api" && (
                  <button
                    type="button"
                    className="button subtle"
                    style={{ fontSize: 10, padding: "3px 6px" }}
                    onClick={() => exportDesign(design.id)}
                    disabled={loading}
                  >
                    Export
                  </button>
                )}
                {(design.exportUrl || design.thumbnailUrl) && (
                  <>
                    <button
                      type="button"
                      className="button subtle"
                      style={{ fontSize: 10, padding: "3px 6px" }}
                      onClick={() => applyDesign(design, "overlay")}
                    >
                      As Overlay
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      style={{ fontSize: 10, padding: "3px 6px" }}
                      onClick={() => applyDesign(design, "background")}
                    >
                      As BG
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
