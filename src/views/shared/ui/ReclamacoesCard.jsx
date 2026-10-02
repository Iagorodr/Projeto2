// Cartão "Reclamações" (documento de design, 2.13) — substitui o
// velocímetro (`ComplaintsGauge`, que existia em DashboardWidgets.jsx).
// Cartão de estado positivo/atenção/crítico conforme a faixa; número
// grande; pílula com a faixa; régua horizontal de 3 segmentos com
// marcador na posição do valor; últimas 2 reclamações (cliente + data).
//
// Faixas: reproduz exatamente a fórmula que já está em produção
// (DashboardScreen.jsx): excelenteThreshold/razoavelThreshold calculados
// a partir de reclamacaoBaseClients/reclamacaoExcelenteCount/
// reclamacaoRazoavelCount — este componente RECEBE os limiares já
// calculados (não recalcula), pra não duplicar essa lógica em dois
// sítios; quem o usar continua a calcular do mesmo jeito que
// DashboardScreen.jsx já faz.
//
// NOTA (fora do alcance deste componente, é lógica de dados, não de UI):
// o documento pede que, nos períodos fechados, o `clientCount` daquele
// período fique gravado no snapshot — senão a faixa de um mês antigo muda
// sozinha quando o nº de clientes de hoje muda. Isso é trabalho de
// Etapa 4 (ou antes, se mexermos no histórico), não deste componente.
//
// Introduzido na Etapa 2 (componentes); já troca o `ComplaintsGauge`
// antigo em Dashboard e Histórico desde a Etapa 4. `DashboardWidgets.jsx`
// (que tinha esse `ComplaintsGauge` e também `BarChart`/`LineChart`,
// todos já órfãos) foi removido do projeto na limpeza pós-Etapa 4.
import { COLORS } from "../../../styles/colors.js";
import { FONT } from "../../../styles/tokens.js";
import { Card } from "./Card.jsx";
import { Pill } from "./Pill.jsx";

function bandFor(current, excelenteThreshold, razoavelThreshold) {
  if (current <= excelenteThreshold) return "excelente";
  if (current <= razoavelThreshold) return "razoavel";
  return "critico";
}

const BAND_STYLE = {
  excelente: { cardVariant: "tintOk", pillVariant: "paid", markerColor: COLORS.ok },
  razoavel: { cardVariant: "default", pillVariant: "pending", markerColor: COLORS.amberInk, ruleBg: "#FFF6E0" },
  critico: { cardVariant: "alert", pillVariant: "missing", markerColor: COLORS.alert },
};

// Régua de 3 segmentos: Excelente (largura proporcional ao limiar),
// Razoável (idem) e Crítico (sem limite superior — usa a mesma largura do
// segmento Razoável só pra efeito visual, já que "13+" não tem topo).
function Ruler({ current, excelenteThreshold, razoavelThreshold, band }) {
  const segExcelente = Math.max(excelenteThreshold, 1);
  const segRazoavel = Math.max(razoavelThreshold - excelenteThreshold, 1);
  const segCritico = segRazoavel; // largura de referência, sem teto real
  const total = segExcelente + segRazoavel + segCritico;
  const wExcelente = (segExcelente / total) * 100;
  const wRazoavel = (segRazoavel / total) * 100;
  const wCritico = (segCritico / total) * 100;

  let markerPct;
  if (current <= excelenteThreshold) {
    markerPct = (current / segExcelente) * wExcelente;
  } else if (current <= razoavelThreshold) {
    markerPct = wExcelente + ((current - excelenteThreshold) / segRazoavel) * wRazoavel;
  } else {
    const over = Math.min(current - razoavelThreshold, segCritico);
    markerPct = wExcelente + wRazoavel + (over / segCritico) * wCritico;
  }

  const style = BAND_STYLE[band];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: "relative", display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${wExcelente}%`, background: COLORS.okTint }} />
        <div style={{ width: `${wRazoavel}%`, background: style.ruleBg || "#FFF6E0" }} />
        <div style={{ width: `${wCritico}%`, background: COLORS.alertTint }} />
        <div
          style={{
            position: "absolute", top: -3, left: `calc(${markerPct}% - 8px)`,
            width: 16, height: 16, borderRadius: "50%", background: style.markerColor,
            border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: COLORS.ink3 }}>
        <span>0</span>
        <span>{excelenteThreshold}</span>
        <span>{razoavelThreshold}</span>
        <span>{razoavelThreshold + 1}+</span>
      </div>
    </div>
  );
}

function ReclamacoesCard({
  current, excelenteThreshold, razoavelThreshold, recent = [],
  title = "Reclamações", subtitle = "este mês",
  labels = { excelente: "Excelente", razoavel: "Razoável", critico: "Crítico" },
}) {
  const band = bandFor(current, excelenteThreshold, razoavelThreshold);
  const style = BAND_STYLE[band];

  return (
    <Card variant={style.cardVariant}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{title}</div>
          <div style={{ fontSize: 12, color: COLORS.ink3 }}>{subtitle}</div>
        </div>
        <Pill variant={style.pillVariant}>{labels[band]}</Pill>
      </div>

      <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 64, lineHeight: 1, color: COLORS.ink, marginTop: 8 }}>
        {current}
      </div>

      <Ruler current={current} excelenteThreshold={excelenteThreshold} razoavelThreshold={razoavelThreshold} band={band} />

      {recent.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {recent.slice(0, 2).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.ink2 }}>
              <span>{item.client}</span>
              <span>{item.date}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export { ReclamacoesCard };
