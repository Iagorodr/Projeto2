import { useEffect, useState } from "react";
import { fileUrl } from "../models/fileStorage.js";

// Link temporário para ver um ficheiro guardado (ver models/fileStorage.js).
// Devolve { url, loading, failed }. Sem referência: tudo vazio.
function useFileUrl(ref) {
  const key = ref ? (ref.dataUrl ? `d:${ref.name}:${ref.size}` : ref.path || "") : "";
  const [state, setState] = useState({ url: null, loading: !!key, failed: false });
  useEffect(() => {
    let alive = true;
    if (!key) { setState({ url: null, loading: false, failed: false }); return undefined; }
    setState((s) => ({ url: s.url, loading: true, failed: false }));
    fileUrl(ref).then((url) => { if (alive) setState({ url, loading: false, failed: !url }); })
      .catch(() => { if (alive) setState({ url: null, loading: false, failed: true }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export { useFileUrl };
