// DayPanel (documento de design, 2.15 + detalhe em 5.2.4): moldura do
// painel do dia — título ("Terça-feira, 29/09"), "Previsto 3h30", selo
// opcional (ex.: "🔒 Semana finalizada"), lista de ClientCheckCard (via
// `children`) e o botão tracejado "+ Adicionar outro cliente".
//
// Puramente apresentacional — os vários ESTADOS do dia que o documento
// exige (por registar / registado / finalizado / sem clientes / sem
// atendimento / adiantado / já feito noutro dia — 5.2.5) decidem o QUE
// entra como `children`/`emptyState`, mas essa decisão é de quem usa o
// componente (a Etapa 4, com os dados reais de agenda/horas), não deste
// componente.
import { Plus } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS } from "../../../../styles/tokens.js";

// QA (achado do Iago): "+" duplicado — este componente já desenha o
// `<Plus>` abaixo como ícone separado, então um rótulo com "+ " embutido
// (era o padrão daqui E o valor passado por EmployeeHorasScreen.jsx via
// `t.addClientButton`) mostrava dois sinais de mais seguidos.
function DayPanel({ title, forecastLabel, lockBadge, children, emptyState, onAddClient, addClientLabel = "Adicionar outro cliente" }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{title}</div>
          {forecastLabel && <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 2 }}>{forecastLabel}</div>}
        </div>
        {lockBadge && (
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2, background: COLORS.lineSoft, borderRadius: 999, padding: "4px 10px" }}>
            {lockBadge}
          </span>
        )}
      </div>

      {emptyState ? (
        <div style={{ fontSize: 13.5, color: COLORS.ink2, padding: "20px 4px" }}>{emptyState}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {children}
        </div>
      )}

      {onAddClient && (
        <button
          type="button"
          onClick={onAddClient}
          style={{
            width: "100%", height: 58, marginTop: 10, borderRadius: RADIUS.controlMobile,
            border: `1.5px dashed ${COLORS.lineInput}`, background: "transparent", color: COLORS.forest700,
            fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "inherit",
          }}
        >
          <Plus size={16} strokeWidth={1.8} />
          {addClientLabel}
        </button>
      )}
    </div>
  );
}

export { DayPanel };
