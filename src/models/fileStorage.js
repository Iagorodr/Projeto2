// Fotos e ficheiros guardados no Supabase Storage (cofre privado `servix-files`,
// ver supabase/armazenamento.sql). Nunca há link público: para ver um ficheiro
// pede-se um link temporário (assinado) a quem tem permissão.
//
// Uma "referência" de ficheiro (a única coisa que fica nos dados do app) é
//   { name, path, size, type }            (+ validUntil nos docs de funcionários)
// Sem Supabase configurado (modo demonstração) o ficheiro fica só em memória,
// na própria referência (`dataUrl`), e nunca é gravado — igual ao que já era.
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

export const BUCKET = "servix-files";
// Limite do cofre (o servidor recusa acima disto).
export const MAX_BYTES = 10 * 1024 * 1024;
// Uma foto de telemóvel pode ter 8-15 MB; encolhemos antes de enviar, por isso
// aceitamos até aqui à entrada.
export const MAX_IMAGE_INPUT_BYTES = 30 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;
const IMAGE_QUALITY = 0.82;
// Imagens abaixo disto e já pequenas em pixéis não valem a pena recomprimir.
const SKIP_COMPRESS_BELOW = 250 * 1024;

export const KINDS = {
  receipts: "receipts",
  avisos: "avisos",
  docsClients: "docs-clients",
  docsStaff: "docs-staff",
};

const DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const EXT_MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Empresa cujas pastas usamos (o controller define-a ao entrar).
let currentCompanyId = 1;
export function setStorageCompany(id) {
  const n = Number(id);
  if (Number.isInteger(n) && n > 0) currentCompanyId = n;
}
export function getStorageCompany() { return currentCompanyId; }

function extOf(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

// O tipo real do ficheiro (alguns telemóveis/browsers deixam `type` vazio).
export function fileMime(file) {
  if (file && file.type) return file.type.toLowerCase();
  return EXT_MIME[extOf(file && file.name)] || "";
}
export function isImageMime(mime) { return String(mime || "").toLowerCase().startsWith("image/"); }
export function isImageFile(file) { return isImageMime(fileMime(file)); }

// Valida à entrada. Devolve null se ok, ou um código: "type" | "size".
// `imagesOnly`: só fotos (avisos, recibos); senão aceita também PDF/Word/Excel.
export function validateFile(file, { imagesOnly = false } = {}) {
  if (!file) return "type";
  const mime = fileMime(file);
  if (isImageMime(mime)) return file.size > MAX_IMAGE_INPUT_BYTES ? "size" : null;
  if (imagesOnly || !DOC_MIMES.has(mime)) return "type";
  return file.size > MAX_BYTES ? "size" : null;
}

function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  return Promise.reject(new Error("sem createImageBitmap"));
}

// Encolhe fotos grandes (lado maior 1600 px, JPEG) para poupar espaço e dados
// móveis. Qualquer falha (formato que o browser não lê, ex. HEIC no desktop)
// devolve o ficheiro original, sem erro.
export async function prepareFile(file) {
  const mime = fileMime(file);
  if (!isImageMime(mime) || mime === "image/gif") return file;
  try {
    const bmp = await loadBitmap(file);
    const { width, height } = bmp;
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height));
    if (scale === 1 && file.size < SKIP_COMPRESS_BELOW) { bmp.close && bmp.close(); return file; }
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // fundo branco: PNG com transparência não fica preto em JPEG
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", IMAGE_QUALITY));
    if (!blob || (blob.size >= file.size && scale === 1)) return file;
    const base = String(file.name || "foto").replace(/\.[a-z0-9]{1,5}$/i, "") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("leitura falhou"));
    r.readAsDataURL(file);
  });
}

function randomId() {
  try {
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(16).slice(2, 14).padEnd(12, "0");
  }
}

// Caminho no cofre: <empresa>/<tipo>/[<dono>/]<único>.<ext>
export function buildPath(kind, ownerId, file, companyId = currentCompanyId) {
  const mime = fileMime(file);
  const ext = extOf(file.name) || Object.keys(EXT_MIME).find((k) => EXT_MIME[k] === mime) || "bin";
  const owner = ownerId != null && ownerId !== "" ? `${String(ownerId).replace(/[^a-z0-9_-]/gi, "")}/` : "";
  return `${companyId}/${kind}/${owner}${Date.now().toString(36)}-${randomId()}.${ext}`;
}

// Envia um ficheiro e devolve a referência para guardar nos dados.
// Lança Error com `.code` = "size" | "type" | "upload".
export async function uploadFile(file, { kind, ownerId = null, imagesOnly = false } = {}) {
  const bad = validateFile(file, { imagesOnly });
  if (bad) { const e = new Error(bad); e.code = bad; throw e; }
  const ready = await prepareFile(file);
  if (ready.size > MAX_BYTES) { const e = new Error("size"); e.code = "size"; throw e; }
  const mime = fileMime(ready);
  const ref = { name: file.name || ready.name || "ficheiro", size: ready.size, type: mime };
  if (!isSupabaseConfigured || !supabase) {
    return { ...ref, path: null, dataUrl: await readAsDataUrl(ready) };
  }
  const path = buildPath(kind, ownerId, ready);
  const { error } = await supabase.storage.from(BUCKET).upload(path, ready, { contentType: mime || undefined, upsert: false, cacheControl: "3600" });
  if (error) { const e = new Error(error.message || "upload"); e.code = "upload"; throw e; }
  return { ...ref, path };
}

// Link temporário (1 hora) para ver/abrir o ficheiro. Guardado em cache.
const urlCache = new Map(); // path -> { url, exp }
const SIGN_SECONDS = 3600;
export async function fileUrl(ref) {
  if (!ref) return null;
  if (ref.dataUrl) return ref.dataUrl;
  if (!ref.path || !supabase) return null;
  const hit = urlCache.get(ref.path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ref.path, SIGN_SECONDS);
  if (error || !data?.signedUrl) return null;
  urlCache.set(ref.path, { url: data.signedUrl, exp: Date.now() + SIGN_SECONDS * 1000 });
  return data.signedUrl;
}

// Apaga do cofre (melhor esforço — se falhar, só fica um ficheiro órfão).
export async function removeFile(ref) {
  if (!ref || !ref.path || !supabase) return false;
  urlCache.delete(ref.path);
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([ref.path]);
    return !error;
  } catch { return false; }
}

// Mensagem curta (pt/en/fr via T[lang].files) para um erro de envio.
export function uploadErrorKey(err) {
  return err && err.code === "size" ? "tooBig" : err && err.code === "type" ? "badType" : "uploadFailed";
}
