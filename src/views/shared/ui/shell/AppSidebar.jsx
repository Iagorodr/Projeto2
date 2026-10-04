// Sidebar (documento de design, 3.1/3.2): ≥1024 (PC) sidebar completa
// 236 px, gradiente vertical #16483A → #0F3129, brilho radial clay 18% no
// canto superior esquerdo; item ativo com fundo rgba(255,255,255,.13),
// contorno interior rgba(255,255,255,.07) e barra de 4px clay à esquerda,
// texto branco; itens 42px (gerência) / 48px (supervisor); bloco de
// utilizador em cima (avatar + nome + email/papel); "Sair" em baixo.
// 640–1023 (tablet): gerência recolhe a ícones (76px, com `title`);
// supervisor/funcionário vira faixa de 108px com ícone 24 + nome 12px.
// Selos numéricos: fundo clay, texto #3A1A0D (secção 3.1).
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4,
// mas só para o lado funcionário/supervisor em PC/tablet — a gerência
// continua de propósito com a `Sidebar` antiga (views/shared/Layout.jsx),
// troca essa que fica fora do escopo das etapas já fechadas (ver
// comentário em App.jsx, perto de `empTier`). Não é um esquecimento,
// é a mesma decisão documentada nos dois ficheiros. Comentário antigo
// corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento.
import { LogOut } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { FONT } from "../../../../styles/tokens.js";
import { Avatar } from "../Avatar.jsx";

// collapsed: false (PC, 236px) | "icons" (tablet gerência, 76px) | "rail" (tablet supervisor/funcionário, 108px)
function AppSidebar({
  items, activeKey, onNavigate, density = "gerencia",
  collapsed = false, user, onLogout, logoutLabel = "Sair",
}) {
  const itemHeight = density === "supervisor" ? 48 : 42;
  const iconsOnly = collapsed === "icons";
  const rail = collapsed === "rail";
  const width = iconsOnly ? 76 : rail ? 108 : 236;

  return (
    <div
      style={{
        // Lote 4, 4.2 (achado da Marta): era `minHeight: "100%"`, que só
        // estica junto com o `shell` (flex) — numa tela longa o shell
        // cresce junto com o conteúdo e o "Sair" do rodapé passa a exigir
        // rolar a página inteira para aparecer. `position: sticky` +
        // `height: 100dvh` prendem a barra à janela (o `shell`, em
        // styles.js, usa `overflow: "clip"` em vez de `"hidden"` — do
        // contrário o próprio shell virava a referência de rolagem do
        // sticky, e ele nunca prenderia à janela de verdade).
        width, flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100dvh", alignSelf: "flex-start",
        padding: iconsOnly || rail ? "20px 8px" : "20px 16px",
        background:
          "radial-gradient(circle at 10% 8%, rgba(226,138,101,.18), transparent 45%), " +
          "linear-gradient(180deg, #16483A 0%, #0F3129 100%)",
        boxSizing: "border-box",
      }}
    >
      {user && !iconsOnly && !rail && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
          <Avatar name={user.name} photoUrl={user.photoUrl} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ color: "rgba(255,255,255,.65)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.subtitle}</div>
          </div>
        </div>
      )}
      {user && (iconsOnly || rail) && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Avatar name={user.name} photoUrl={user.photoUrl} size={32} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              title={iconsOnly ? item.label : undefined}
              onClick={() => onNavigate(item.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, position: "relative",
                height: rail ? "auto" : itemHeight, padding: rail ? "10px 4px" : iconsOnly ? "0" : "0 10px",
                flexDirection: rail ? "column" : "row", justifyContent: iconsOnly ? "center" : "flex-start",
                borderRadius: 10, border: "1px solid transparent", cursor: "pointer", fontFamily: "inherit",
                background: active ? "rgba(255,255,255,.13)" : "transparent",
                borderColor: active ? "rgba(255,255,255,.07)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,.72)",
              }}
            >
              {active && (
                <span style={{ position: "absolute", left: rail ? "50%" : 0, top: rail ? "auto" : 0, bottom: rail ? 0 : 0, transform: rail ? "translateX(-50%)" : "none", width: rail ? 28 : 4, height: rail ? 3 : "100%", borderRadius: 2, background: COLORS.clay }} />
              )}
              <span style={{ position: "relative", display: "flex" }}>
                <Icon size={rail ? 24 : 17} strokeWidth={1.8} />
                {item.badge != null && item.badge > 0 && (
                  <span
                    style={{
                      position: "absolute", top: -6, right: -8, minWidth: 15, height: 15, borderRadius: 999,
                      background: COLORS.clay, color: "#3A1A0D", fontSize: 9.5, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              {!iconsOnly && (
                <span style={{ fontSize: rail ? 12 : 13, fontWeight: active ? 700 : 500, textAlign: rail ? "center" : "left" }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lote 4, 4.2: trocado o caractere "⏻" por um botão com o ícone
          `LogOut` de verdade — altura igual à dos itens de navegação
          (42/48, `itemHeight`), ícone+rótulo no modo completo, só o
          ícone (com aria-label e tooltip) nos modos recolhidos. */}
      <button
        type="button"
        onClick={onLogout}
        aria-label={logoutLabel}
        title={iconsOnly ? logoutLabel : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxSizing: "border-box",
          height: rail ? "auto" : itemHeight,
          padding: rail ? "10px 4px" : iconsOnly ? "10px 0" : "10px 10px 0",
          marginTop: 10, borderTop: "1px solid rgba(255,255,255,.12)",
          borderLeft: "none", borderRight: "none", borderBottom: "none",
          background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 12.5, cursor: "pointer",
          justifyContent: iconsOnly || rail ? "center" : "flex-start", flexDirection: rail ? "column" : "row",
          textAlign: iconsOnly || rail ? "center" : "left", fontFamily: "inherit",
        }}
      >
        <LogOut size={rail ? 22 : 16} />
        {!iconsOnly && <span style={{ fontSize: rail ? 12 : 12.5 }}>{logoutLabel}</span>}
      </button>
    </div>
  );
}

export { AppSidebar };
