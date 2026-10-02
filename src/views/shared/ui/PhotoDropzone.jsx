// Zona de largada com pré-visualização (documento, 4.7/5.6: "'Anexar foto
// (opcional)' como zona de largada com pré-visualização"). Padrão novo, ad
// hoc (mesmo raciocínio do `SearchSelect.jsx`: é preciso em mais de um
// ecrã já nesta etapa — a gaveta "Novo aviso" da gerência e o sheet
// "Reportar sobre um colega" do supervisor — por isso fica partilhado em
// vez de duplicado).
//
// Importante: o app não tem backend pra guardar ficheiros (mesma nota já
// existe nos slots de Documentos de Funcionários/Clientes — "fica guardado
// só durante esta sessão"). Aqui vai um passo além só porque o documento
// pede literalmente "pré-visualização": usa `URL.createObjectURL` pra
// mostrar a imagem antes de enviar, mas a própria imagem nunca é guardada
// em lado nenhum — ao enviar, só o booleano `hasPhoto` (já existente em
// `sentItems`) é que persiste, exatamente como já era antes desta etapa.
import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";

function PhotoDropzone({ file, onChange, label, removeLabel }) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f) {
    if (f && f.type.startsWith("image/")) onChange(f);
  }

  if (file && previewUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: 8 }}>
        <img src={previewUrl} alt="" style={{ width: 44, height: 44, borderRadius: RADIUS.chip, objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={removeLabel}
          style={{ border: "none", background: "transparent", color: COLORS.ink3, cursor: "pointer", display: "flex", flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 64, cursor: "pointer",
        border: `1.5px dashed ${dragOver ? COLORS.forest500 : COLORS.lineInput}`, borderRadius: RADIUS.control,
        background: dragOver ? COLORS.forest50 : "transparent", color: COLORS.ink2, fontSize: 13,
      }}
    >
      <ImageIcon size={16} strokeWidth={1.8} />
      {label}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => pickFile(e.target.files?.[0])}
      />
    </div>
  );
}

export { PhotoDropzone };
