// Mostra um ficheiro guardado (foto ou documento): miniatura (se for imagem)
// ou ícone, nome e "Ver" (abre num separador com um link temporário —
// o cofre é privado, nunca há link público). Ver models/fileStorage.js.
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { useFileUrl } from "../../../hooks/useFileUrl.js";
import { isImageMime } from "../../../models/fileStorage.js";

function StoredFile({ file, labels, size = 44, onRemove, removeLabel, showName = true, style }) {
  const { url, loading, failed } = useFileUrl(file);
  if (!file) return null;
  const isImg = isImageMime(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name || "");
  const thumb = (
    <div
      style={{
        width: size, height: size, borderRadius: RADIUS.chip, flexShrink: 0, overflow: "hidden",
        background: COLORS.bg, border: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.ink3,
      }}
    >
      {isImg && url ? <img src={url} alt={labels.imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : isImg ? <ImageIcon size={Math.round(size * 0.4)} strokeWidth={1.6} /> : <FileText size={Math.round(size * 0.4)} strokeWidth={1.6} />}
    </div>
  );
  return (
    <div data-testid="stored-file" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, ...style }}>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={labels.view} style={{ display: "flex" }}>{thumb}</a> : thumb}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showName && <div style={{ fontSize: 12.5, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, textDecoration: "underline" }}>{labels.view}</a>
        ) : loading ? (
          <span style={{ fontSize: 12, color: COLORS.ink3 }}>…</span>
        ) : failed ? (
          <span style={{ fontSize: 12, color: COLORS.dangerInk }}>{labels.loadFailed}</span>
        ) : null}
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel || labels.remove}
          style={{ border: "none", background: "transparent", color: COLORS.ink3, cursor: "pointer", display: "flex", flexShrink: 0, padding: 6 }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export { StoredFile };
