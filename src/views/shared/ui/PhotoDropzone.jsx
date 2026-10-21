// Zona de anexar foto (documento, 4.7/5.6: "'Anexar foto (opcional)' como zona
// de largada com pré-visualização"). Partilhada: gaveta "Novo aviso" da
// gerência, sheet "Reportar sobre um colega" do supervisor e despesas.
//
// Dois modos de dar a foto: "Tirar foto" (abre a câmara do telemóvel; só
// aparece em ecrãs de toque) e "Escolher" (galeria/ficheiros, ou arrastar).
// A foto escolhida (`file`, um File) fica só na memória com pré-visualização;
// quem usa envia-a para o cofre (models/fileStorage.js → uploadFile) quando a
// pessoa grava. `existing` é uma foto já guardada antes (mostra "Ver" e
// permite remover com `onClearExisting`).
import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { validateFile } from "../../../models/fileStorage.js";
import { StoredFile } from "./StoredFile.jsx";

function hasCamera() {
  try { return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
}

function PhotoDropzone({ file, onChange, label, removeLabel, labels, existing, onClearExisting, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const showCamera = !!labels && hasCamera();

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f) {
    if (!f || disabled) return;
    const bad = validateFile(f, { imagesOnly: true });
    if (bad) { setError(bad === "size" ? labels?.tooBig || "" : labels?.badType || ""); return; }
    setError("");
    onChange(f);
  }

  if (file && previewUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: 8 }}>
        <img src={previewUrl} alt="" style={{ width: 44, height: 44, borderRadius: RADIUS.chip, objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} aria-label={removeLabel}
            style={{ border: "none", background: "transparent", color: COLORS.ink3, cursor: "pointer", display: "flex", flexShrink: 0 }}>
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  if (existing) {
    return (
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: 8 }}>
        <StoredFile file={existing} labels={labels} onRemove={disabled ? undefined : onClearExisting} removeLabel={removeLabel} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {showCamera && (
          <button
            type="button" disabled={disabled} onClick={() => cameraRef.current?.click()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 64, padding: "0 16px", flexShrink: 0, cursor: "pointer",
              border: `1.5px solid ${COLORS.forest500}`, borderRadius: RADIUS.control, background: COLORS.forest50, color: COLORS.forest500,
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            }}
          >
            <Camera size={18} strokeWidth={1.8} />
            {labels.takePhoto}
          </button>
        )}
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 64, cursor: "pointer",
            border: `1.5px dashed ${dragOver ? COLORS.forest500 : COLORS.lineInput}`, borderRadius: RADIUS.control,
            background: dragOver ? COLORS.forest50 : "transparent", color: COLORS.ink2, fontSize: 13, textAlign: "center",
          }}
        >
          <ImageIcon size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span>{label}</span>
          <input
            ref={inputRef} type="file" accept="image/*" data-testid="photo-input" style={{ display: "none" }}
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      </div>
      {showCamera && (
        <input
          ref={cameraRef} type="file" accept="image/*" capture="environment" data-testid="camera-input" style={{ display: "none" }}
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      )}
      {error && <div style={{ fontSize: 12.5, color: COLORS.dangerInk, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

export { PhotoDropzone };
