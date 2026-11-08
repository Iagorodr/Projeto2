# Servix — Passagem de trabalho (Eric → próximo agente dev)

**Período coberto:** 4 a 8 de novembro de 2026
**Último commit em produção:** `729f846` (8/11/2026, `servix-empresa-x` e `projeto-fin` READY)
**Repositório:** github.com/Iagorodr/Projeto2 (ramo `main`)
**Produção:** Vercel — projetos `servix-empresa-x` (servix-empresa-x.vercel.app) e `projeto-fin`, ambos com deploy automático a partir do `main`
**Base de dados:** Supabase, projeto "Projeto Servix Oficial" (`zoizwdungwtioppvupcl`, eu-west-1)
**Empresas em produção:** `1` = L & A (código `lea`, a empresa real) · `2` = EMPRESATESTE (código **`teste-interno`**, empresa de testes com dados no banco — ver secção 13)
**Última atualização deste documento:** 8/11/2026

Este documento continua o `HANDOFF_SERVIX.md` do Toni. Tudo o que está aqui foi feito por cima do redesign **B1** (commits até `99fc627`, do Toni). Os meus commits vão de `c2b88dc` a `622f7fd` e têm todos o trailer `Claude-Session: …session_016bupjkLjwZrPU5FRBfHrVv`.

---

## 0. Ler primeiro (resumo em 10 linhas)

1. **As horas registadas nunca mudam sozinhas.** É a regra mais importante, por causa do caso ACTE 3 (secção 6). Há um campo `manualBase` nas linhas de horas que congela o valor. Qualquer código novo que recalcule horas tem de o respeitar.
2. **Publicar só quando o Iago disser "publica".** O fluxo usa um *git bundle* e o `.\publicar.cmd` no PC dele (secção 2).
3. **SQL em produção:** o agente gera o `.sql`, o Iago corre-o no SQL Editor e o agente verifica só com leitura (secção 2).
4. **IBAN e NIF vivem em `staff_private`** (só a gerência lê). Nunca voltar a pôr dados pessoais em `staff` nem em `app_data` (secção 5).
5. **Visita avulsa** = cobertura com `kind: "visit"`. Põe um cliente na agenda de alguém só num dia, sem mexer na ficha nem na semana-tipo (secção 8).
6. **A demonstração** (`/demo`, código `demo` ou `teste`) corre só no browser, com dados gerados para o dia de hoje, e nunca toca no Supabase (secção 13).
7. **A app atualiza-se sozinha** quando há deploy novo (`src/versionCheck.js`).
8. **Testes da lógica:** `npm test` (33 verificações, devem passar todas).
9. **Textos sempre em pt/en/fr** (`src/models/i18n.js`, chaves novas com prefixo `b1…` ou dentro do bloco do ecrã). Responder ao Iago sempre em **português de Portugal**.
10. **Ferramentas SQL das horas** já instaladas em produção: `private.horas_ver/fixar/definir/rasto` e histórico de gravações (secção 7).

---

## 1. Quem decide o quê

- **Iago** é o dono do produto e decide. **Tomás** escreveu o documento de design "Servix — Decisões de redesign para o Toni" (37 pp.). **Toni** é o dev anterior.
- **Decisão do Iago sobre o documento:**
  - A parte aprovada (até à **p. 31**) prevalece sobre as pp. 33–35.
  - Das pp. 33–35 aproveitam-se só três coisas: cartões de Clientes no telemóvel, Histórico agrupado e os botões flutuantes "+".
  - Ignoram-se de propósito: auditoria completa, agenda só de segunda a sexta, e título + autor nas Notas.
- Ordem de trabalho que o Iago pediu (já cumprida): fichas de Clientes e Funcionários → Histórico → PDFs → cor de funcionário/supervisor → code splitting. Depois disso vieram os pedidos do dia a dia (secções 4 a 14).

---

## 2. Regras de trabalho (continuam em vigor)

| Regra | Detalhe |
|---|---|
| Publicar | **Só quando o Iago escrever "publica".** Antes disso, os commits ficam locais. |
| Como publicar | O ambiente do agente **não consegue fazer push** (o proxy bloqueia o repositório) e o token do GitHub que o Iago deu não serve aqui. O agente cria `git bundle create <saida>.bundle origin/main..main` e põe o ficheiro em `C:\Users\Utilizador\ProjetoFin\`, pela ponte do computador (`device_commit_files`) ou como anexo no chat se o PC não estiver ligado. O Iago corre `.\publicar.cmd` dentro de `ProjetoFin\servix`. Depois o agente confirma com `mcp__Vercel__list_deployments` que os **dois** projetos ficaram `READY` com o SHA certo. No fim: `git update-ref refs/remotes/origin/main HEAD`. |
| `publicar.cmd` | Chama `scripts/publicar.ps1`: faz fetch, fast-forward, aplica o bundle mais recente (só avança se encaixar), faz push e arquiva os bundles em `ProjetoFin\bundles-publicados`. O `$ErrorActionPreference` é **"Continue"** de propósito: o git escreve mensagens normais no stderr e o PowerShell 5.1 com "Stop" tratava-as como erro (corrigido em `3781343`). |
| SQL de produção | Exceção: quando o Iago pede explicitamente ("roda o SQL pra mim"), o agente pode correr um UPDATE pequeno e verificado (foi o caso de `empresa_teste_interno.sql`). Fora disso: gerar o `.sql` em `supabase/` → entregar ao Iago → ele corre no SQL Editor → o agente verifica com `mcp__Supabase__execute_sql` **só com leitura**. Nunca DDL/DML direto pelo agente. Scripts sempre **aditivos e seguros de repetir**, com uma query de verificação no fim. |
| Avisos do SQL Editor | No aviso "Potential issues detected", recomendar **"Run and enable RLS"**. O aviso de operação destrutiva aparece por causa de `drop trigger if exists`, que não apaga dados. |
| Conta L&A | **Nunca carregar em "Nova senha"** em Acessos na empresa L&A. |
| Mudar decisões | Avisar sempre o Iago quando uma decisão anterior muda. |
| Língua | Responder em pt-PT. Textos da app em pt/en/fr. |
| **Este documento** | **Decisão do Iago (8/11): a cada mudança ou decisão, atualizar este `HANDOFF_ERIC.md` no mesmo commit** (secção certa + "Registo de alterações" no fim + data no topo). |
| Commits | Trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_016bupjkLjwZrPU5FRBfHrVv` (o próximo agente usa os seus). |
| PC do Iago | Windows. O `device_bash` **não funciona** lá (hipervisor/BIOS), por isso só há `device_commit_files` e `device_stage_files`. O repositório local dele está em `C:\Users\Utilizador\ProjetoFin\servix`. A pasta `ProjetoFin` é a antiga cópia do projeto e tem os bundles. |

---

## 3. Estado da base de dados (o que já foi aplicado)

| Ficheiro | Estado | O que faz |
|---|---|---|
| `supabase/redesign_b1.sql` | aplicado (Toni) | tema e preferências por utilizador |
| `supabase/redesign_b1_cores_equipa.sql` | **aplicado** | `company_settings.employee_theme`, `supervisor_theme` (NULL = igual à empresa) |
| `supabase/fichas_planning_nif.sql` | **aplicado** | `clients.planning_photo jsonb`; tabela `staff_private (staff_id, company_id, nif, …)` com RLS só para a gerência |
| `supabase/iban_privado_A.sql` | **aplicado** | `staff_private.iban` + cópia dos IBAN |
| `supabase/iban_privado_B.sql` | **aplicado e verificado** | `staff.iban` anulado, trigger `staff_no_iban` impede que volte a ser gravado, IBAN retirado de `app_data.closed_periods`. Verificação: 0 em `staff`, 0 no histórico, 8 protegidos |
| `supabase/horas_ferramentas.sql` | **aplicado (RLS ativado)** | histórico de gravações das horas + funções `private.horas_*` (secção 7) |
| `supabase/empresa_teste_interno.sql` | **aplicado (8/11, pelo agente a pedido do Iago) e verificado** | código da empresa 2 passa de `teste` a `teste-interno` |
| `supabase/horas_usar.sql` | **corrido uma vez** | Iago 28/10 ACTE 3 → 4h e linhas da ACTE 3 fixadas. Fica como modelo para casos futuros |
| `private.copia_app_data_20261105` | existe | cópia integral de `app_data` antes da correção ACTE 3. **Pode apagar-se** quando o Iago confirmar (`drop table private.copia_app_data_20261105;`) |

O `fixar_horas_acte3.sql` foi **removido** e substituído pelas ferramentas genéricas.

---

## 4. Mudanças por área (o que existe agora)

### 4.1 Fichas de Clientes e Funcionários (`c2b88dc`, `5713781`)
- **Peças partilhadas** em `src/views/shared/ui/ProfileParts.jsx`: `ProfileSection`, `ProfileHero`, `MiniPlaceMap` (municípios reais, `beMapData` carregado à parte, pin animado `b1-pin-drop`), `DocSlot` + `docState(doc, today, soonDays=30)` (estados ok / soon / expired / missing), `Fab`, `HeroChip`, `ContractorBadge`.
- **Ficha do cliente** (`ClientesScreen.jsx`):
  - topo com mapa e **foto do planning** ao lado (`PlanningPhoto`: adicionar, trocar, remover com confirmação; guardada no cofre `servix-files`, referência em `clients.planning_photo`);
  - preferência de horário por dia, "O que fazer", equipa, contrato, documentos com estado, coluna Tipo com dica (i).
- **Ficha do funcionário** (`FuncionariosScreen.jsx`):
  - avatar grande, tipo, papel, dupla, alerta do título de residência;
  - **NIF** e **IBAN** numa secção "IBAN e NIF", lidos e gravados em `staff_private`;
  - coluna Dupla com dica (i).
- `DataTable` ganhou `activeId` (linha aberta marcada) e `rowAccent` (borda na cor do contratante). Cabeçalhos sem ordenação passaram a `<div>`, para poderem levar uma dica (i) lá dentro sem ficar dentro de um `<button>`.
- **Correção importante:** `.sx-page` usa animação com `fill-mode: backwards`. Antes usava `both`, que criava um contexto de empilhamento permanente e deixava as gavetas por baixo do "?" e da barra de baixo. Tentei usar portal nas gavetas e **reverti**, porque taparia os diálogos.

### 4.2 Histórico (`118b8c7`)
- `LastPeriodSummary`: horas e valor pago com variação face ao período anterior, reclamações, pessoas, botão "Abrir".
- `PeriodStamps`: carimbos **PAGO**, "N por pagar" e **REABERTO**, com animação `b1-stamp-hit` em cascata.
- O fecho do período passa a guardar `reopened` por funcionário (aditivo).
- No telemóvel: `MobilePeriodList` agrupada por ano.

### 4.3 PDFs (`24111b3`) — `src/models/pdfExport.js`
- Padrão fixo:
  - cabeçalho assíncrono com o **logo da empresa** à esquerda (convertido para PNG por canvas em `loadLogoPng`), marca Servix à direita e faixa fina na cor do tema;
  - tabelas neutras, números alinhados à direita também no cabeçalho;
  - caixa de totais com acento;
  - rodapé "empresa · relatório · Página X de Y";
  - marca d'água "Provisório" em todas as páginas.
- O jsPDF é carregado dinamicamente (`loadPdf`). O valor por linha usa `entryRate` (secção 6).

### 4.4 Cor por papel (`fae9aa1`)
- Em Definições → Cor e aparência, a gerência escolhe a cor da app de **funcionários** e de **supervisores** (por defeito, igual à empresa).
- Aplica-se na perspetiva de funcionário (incluindo "Ver como funcionário") e volta à cor da empresa ao sair.
- O cartão só aparece quando o banco já tem as colunas, para nunca fazer falhar a gravação das definições.

### 4.5 Menu lateral — opção B (`9ef56c4`, `bcc15da`, `5713781`) — `GroupedSidebar.jsx`
- O Iago escolheu a **opção B** entre 3 desenhos: Acessos, Definições, Ajuda e Sair são **4 botões com ícone fixos no fundo**. Com o menu recolhido ficam numa grelha 2×2.
- As páginas de trabalho passam para o «•••» **item a item** (nunca grupos inteiros), quando a altura não chega. Nunca há espaço vazio nem páginas cortadas a 1366×768.
- z-index próprio (40); o popover abre por cima do conteúdo.
- **Ícones da marca** (favicon, apple-touch, PWA 64/192/512, maskable): símbolo provisório de duas fitas em `#1E8C5A`. Manifest com `theme_color #1E8C5A` e `?v=2` para forçar a troca.

### 4.6 Desempenho — code splitting (`7a4e894`)
- `src/views/shared/lazyPage.jsx`: cada página, o Tutorial e a Ajuda são `React.lazy` com o seu próprio `Suspense`, e são pré-carregados em `requestIdleCallback` depois de entrar.
- Se um *chunk* falhar porque houve deploy novo, a app recarrega uma vez.
- Pacote inicial passou de 2,3 MB para cerca de 0,88 MB (≈257 kB gzip). `HelpFab` está num ficheiro próprio; os manuais só carregam ao abrir a Ajuda.

### 4.7 Dashboard e telemóvel (`551a319`, `8e05e95`)
- **Personalizar no telemóvel:** botão redondo com lápis abre uma folha para subir/descer, mostrar/ocultar, repor e escolher a cor.
- **Primeiros passos:** botão "Esconder" (`prefs.stepsHidden`, guardado por utilizador).
- **"+" flutuante** (`Fab`) no telemóvel em Clientes, Funcionários, Avisos e Notas.
- **Folha "Mais" do funcionário** em grelha, igual à da gerência (`MoreSheet variant="grid"`), com a língua no topo e "Sair" à parte.

### 4.8 Ações leves com Desfazer (`975e1ec`)
- Sem diálogo de confirmação; mostram um toast com **Desfazer**:
  - aprovar hora extra;
  - decisões das Revisões (o Desfazer repõe só os funcionários alterados);
  - "Lembrar" no Monitoramento;
  - retirar cliente conhecido;
  - mover ou acrescentar na agenda.
- `Toast` tem `zIndex 96`, acima das gavetas. `InfoTip` faz `stopPropagation`, para tocar na dica não abrir a linha.

### 4.9 Avisos (`975e1ec`)
- Caixas **Recebidos** e **Enviados**, com dica (i). As contagens a 0 ficam ocultas.
- Recebidos: Por tratar · Produto · Correções · Outros · Resolvidos.
- Enviados: Todos · Reclamações · Elogios · Avisos gerais.

### 4.10 Login no computador (`975e79a`) — `src/views/shared/AuthShell.jsx`
- O painel da esquerda é animado:
  - símbolo com anéis que "respiram" e um rodopio 3D a cada 9 s;
  - frases a rodar (`company.gateFeatures`);
  - faixa de temas em loop (`company.gateChips`);
  - bolas de fundo com mais movimento.
- Respeita `prefers-reduced-motion`. No telemóvel não muda.

---

## 5. Segurança — dados pessoais

- **Problema encontrado:** `staff` e `app_data` são lidos por toda a equipa através da API (RLS por empresa). O IBAN estava em `staff.iban`, e também era copiado para `closed_periods`. Qualquer funcionário conseguia ver o IBAN dos colegas.
- **Solução:**
  - IBAN e NIF ficam em `staff_private` (RLS: só gerência lê e grava). O controller faz upsert de `staff_private` depois do upsert de `staff` (`toDbStaffPrivate { staff_id, nif, iban }`) e junta-o na leitura.
  - `toDbStaff` já não envia o iban, e `buildClosedPeriodSnapshot` já não inclui o iban.
  - O trigger `staff_no_iban` anula qualquer IBAN gravado em `staff`, por exemplo vindo de um telemóvel ainda com a versão antiga.
- O backup do `/admin` inclui `staff_private`.
- **Regra para o futuro:** qualquer dado sensível novo vai para `staff_private` ou para uma tabela com RLS de gerência, nunca para `staff` nem para `app_data`.

---

## 6. Horas protegidas — caso ACTE 3 (`0c0f5aa`) ⚠️ crítico

### O que aconteceu (4/11)
- A gerência mudou o cliente ACTE 3 de "dividida" para "individual". O diálogo de recálculo tinha "Sim, atualizar" como ação principal, e o recálculo pôs **8h em todas as marcações já feitas**.
- Além disso, as correções manuais da gerência voltavam ao cálculo automático sempre que um colega marcava o mesmo cliente no mesmo dia, ou quando se aplicava "Horas diferentes" nas Revisões.
- Não havia backups (`company_backups` vazia), por isso os valores originais **não eram recuperáveis**. O Iago corrigiu à mão.

### O que existe agora (`src/models/utils.js`)
- **`manualBase`** (número) numa linha de horas significa **horas fixas**: `hours = manualBase + extraMinutes/60`.
  - `recomputeSharedHours` respeita-o nos ramos individual e partilhado (`isManual(e)` e `manualHoursOf(e)`), e `needsReview` exclui estas linhas.
- **Ficam fixas automaticamente:**
  - edição manual na gaveta de Horas (`saveEditRow`);
  - "Está certo" nas Revisões (`confirmHoursOk`);
  - mudar duração, duração por dia ou forma de contar de um cliente: `pinClientHours` fixa todas as linhas do período aberto;
  - mudanças na agenda que alterem a equipa prevista de um dia já registado (`pinTeamChanges`, secção 8.3).
- **Mudar duração ou forma de contar** abre o diálogo `b1KeptTitle` com a lista "pessoa · dia · antes → depois" e o total. Por defeito fica **"Manter como estão"**; "Recalcular N marcações" é a ação destrutiva e explícita (`unpinHours`).
- **Selo "Horas fixas"** (cadeado + dica) na gaveta de Horas, com botão **"Recalcular"**, que faz `unpinVisit` e depois recalcula.
- **Valor/hora a meio do período:**
  - antes o pagamento usava o valor atual do cliente, o que mudava o passado;
  - agora pergunta, e por defeito **"Só as novas marcações"**: `snapshotClientRate` grava `rate` nas linhas já feitas;
  - `entryRate(e, clients)` usa `e.rate` se existir; é usado em `staffTotalPay`, nos PDFs e no valor por linha.
- **Apagar cliente:** as horas guardam `rate` e `clientName` antes de apagar (`deleteClient`), e `entryClientName` usa `e.clientName` como alternativa.
- **Apagar funcionário** com horas no período aberto (`hasOpenHours`) é bloqueado; o ecrã propõe "Desativar". Também no apagar em lote.
- **Testes:** `tests/horas.test.mjs` (13 verificações).

### Regra para quem mexer nas horas
> Nenhum cálculo automático pode alterar uma linha com `manualBase`. Recalcular horas registadas só com ação explícita da gerência e mostrando o "antes → depois". Na dúvida, fixar (`manualBase`) em vez de recalcular.

---

## 7. Ferramentas SQL das horas e histórico (`cb36117`) — instaladas em produção

`supabase/horas_ferramentas.sql` (instalar uma vez) e `supabase/horas_usar.sql` (exemplos para copiar):

| Função (esquema `private`, só SQL Editor) | Uso |
|---|---|
| `horas_ver(empresa, de, até, [cliente], [funcionário])` | lista as linhas para conferir |
| `horas_fixar(empresa, de, até, [cliente], [funcionário])` | fixa as horas **atuais** (`manualBase`), sem mudar números |
| `horas_definir(empresa, funcionário, dia, cliente, horas)` | põe uma linha num valor (horas sem extra) e fixa-a. Falha se houver 0 ou mais de 1 linha ativa |
| `horas_rasto(empresa, funcionário, dia, [cliente])` | mostra no histórico quem mexeu nesse dia: antes, depois, conta |

- **Cliente e funcionário** aceitam o nome (ex.: `'ACTE 3'`, `'Iago'`) ou o id.
- **Histórico:**
  - o trigger `app_data_horas_historico` (AFTER UPDATE OF horas_data) grava em `private.horas_historico` o **antes e depois só dos funcionários que mudaram**, mais `auth.uid()` e a data;
  - guarda 180 dias; a limpeza é feita no próprio trigger, com 2% de probabilidade;
  - nunca bloqueia uma gravação (tem `exception when others`);
  - tem RLS ativo.
- Depois de mexer por SQL, o Iago deve carregar **F5** nos aparelhos abertos.

---

## 8. Agendas

### 8.1 Visita avulsa (`bd49106`)
- **Pedido do Iago:** clientes de outras empresas que ele faz como replacement de vez em quando. Estão na lista de clientes, mas ninguém os faz de forma fixa. Queria pô-los na agenda de alguém **só em dias específicos**, sem editar a ficha. A cobertura de férias não servia, porque só cobre a agenda de alguém que já faz o cliente.
- **Modelo:** é uma cobertura (`covers`) com
  `{ id, kind: "visit", groupId, clientId, fromStaffId: null, toStaffId, from: dia, to: dia, createdAt }`, uma por pessoa e por dia.
- **Lógica** (`utils.js`): `isVisitCover`, `visitScheduledOn(covers, clientId, date, [staffId])`.
  - `agendaClientIdsOn` e `coveringOn` incluem as visitas avulsas.
  - `clientAppliesOnDate(client, date, covers)` devolve **true** se houver visita nesse dia, mesmo fora dos dias, da frequência ou da validade da ficha. Todas as chamadas que têm `covers` passam-no.
  - Por isso `expectedTeamIds`, a divisão de horas, as Revisões (não aparece como "visita extra"), as horas previstas (`clientExpectedHours`) e o relatório do contratante (`buildContractorReport` recebe `covers`) contam a visita.
  - `coverOverlaps` ignora visitas.
- **UI:**
  - botão "Visita avulsa" em Agendas (`VisitDialog` em `CoverDialog.jsx`): cliente, quem faz (várias pessoas), dias (vários);
  - painel "Visitas avulsas" (`VisitsPanel`), em que se remove uma a uma ou o grupo, com Desfazer;
  - no "+" da célula, opção "Todas as semanas | Só dd/mm"; a dupla vai junto;
  - etiqueta **"avulsa"** na célula (gerência) e na agenda do funcionário.
- **Duração:** usa sempre a da ficha do cliente. *Pendente se o Iago pedir: duração própria por visita.*

### 8.2 Arrastar e "+" no telemóvel (`2952e9c`)
- **Arrastar no computador** (HTML5 drag & drop):
  - um cliente da semana-tipo passa para outro dia ou outra pessoa (`moveClient`);
  - se só muda o dia, a **dupla** que tem o mesmo cliente nesse dia muda junto;
  - as visitas avulsas também se arrastam (mudam pessoa e data); as coberturas de férias não;
  - a célula de destino acende e o chip "encaixa" (`.b1-snap` em `index.css`);
  - toast "Cliente: Maria qua → Maria sáb · Desfazer" (repõe só as chaves afetadas).
- **"+" flutuante no telemóvel** (a Agenda abre em "Por dia") abre "Adicionar à agenda" com dois modos: **Todas as semanas** (dias da semana → `assignments`) ou **Só em dias escolhidos** (visita avulsa).

### 8.3 Agenda protegida
- `useAppController` expõe `setAssignments` e `setCovers` **com guarda** (`setAssignmentsGuarded`, `setCoversGuarded`).
- Quando a gerência muda a agenda, `pinTeamChanges(horasData, clients, antes, depois, início do período aberto, hoje)` fixa (`manualBase`) as linhas de clientes **"dividida"** cuja equipa prevista mudou nesse dia.
- As atualizações vindas do servidor usam os setters "crus" e não disparam a guarda.
- Testes: `tests/agenda.test.mjs` (18 verificações).

---

## 9. Atualização automática da app (`07c0e30`) — `src/versionCheck.js`
- O app instalado no telemóvel ficava aberto dias seguidos com o código antigo. Caso real: o Jadson não via as visitas avulsas.
- Compara o ficheiro principal em execução (`/assets/index-*.js`) com o do `index.html` no servidor (`fetch` com `no-store`):
  - ao **voltar ao app** depois de mais de 30 s fora → `location.reload()`;
  - com o app à frente → faixa "Há uma versão nova do Servix · Atualizar";
  - verifica 1 minuto depois de abrir e depois de 15 em 15 minutos.
- Só em produção (`import.meta.env.PROD`). O `sw.js` não faz cache, existe só para a PWA e para as notificações.

---

## 10. Investigação: marcação do Jadson em 28/10 (ACTE 3)
- Linha `{date: 2026-10-28, clientId: ACTE 3, hours: 5, voided: true}` **sem `byManagement`**. Conclusão: foi criada pela conta dele, na app do funcionário; a app nunca cria linhas sozinha.
- `voided` só aparece por três vias de gerência: Anular em Horas, "Anular horas" nas Revisões, ou "só uma pessoa fez" num conflito.
- **Hipótese mais provável:** marcou o dia errado, a gerência anulou-a nas Revisões, e esse anular recalculou o dia e deu 8h ao Iago. Isso já não acontece desde `0c0f5aa`.
- Não havia rasto para confirmar. O histórico de gravações (secção 7) resolve isto daqui para a frente.

---

## 11. Modelo de dados — o que é novo

**Linha de horas** (`app_data.horas_data[staffId].entries[]`), campos novos:
- `manualBase: number` — horas fixas (sem extra);
- `rate: number` — valor/hora congelado na linha;
- `clientName: string` — nome guardado quando o cliente é apagado.

**`app_data.covers[]`:**
- cobertura de férias: `{ id, clientId, fromStaffId, toStaffId, from, to, createdAt }`;
- **visita avulsa:** `{ …, kind: "visit", groupId, fromStaffId: null, from === to }`.

**Supabase:**
- `clients.planning_photo jsonb` (`{ path, name, type, size }`);
- `company_settings.employee_theme`, `company_settings.supervisor_theme`;
- `staff_private (staff_id PK, company_id, nif, iban, updated_at)` — RLS só para a gerência;
- `private.horas_historico (id, company_id, changed_at, changed_by, antes, depois)`;
- `staff.iban` fica sempre NULL (trigger `staff_no_iban`).

---

## 12. Decisões tomadas (e porquê)

| Decisão | Porquê |
|---|---|
| Menu opção B (Sistema e Sair fixos no fundo) | escolha do Iago entre 3 desenhos; nada fica cortado em ecrãs baixos |
| Gavetas sem portal | o portal tapava os diálogos; resolvido com `fill-mode: backwards` |
| Desfazer em vez de confirmação nas ações leves | documento do Tomás: "ações leves (lembrar, mover na agenda, aprovar extra…) sem pop-up" |
| Por defeito **manter** horas ao mudar cliente ou agenda | caso ACTE 3: o dinheiro já registado não muda sem pedido explícito |
| Valor/hora novo só para marcações novas (por defeito) | pagar o passado com o valor antigo |
| IBAN e NIF fora de `staff` e `app_data` | a equipa lê essas tabelas pela API |
| Ferramentas SQL genéricas em vez de SQL por caso | pedido do Iago: "tem de servir para problemas futuros" |
| Visita avulsa como `covers` com `kind` | reutiliza toda a lógica de agenda, divisão e revisões sem tabela nova |
| Demo no browser, sem banco | escolha do Iago: sempre fresca, sem custos nem agendamentos, cada visita começa limpa |
| Demo com entrada sem palavra-passe | escolha do Iago: mais rápido para mostrar e não expõe contas reais |
| App atualiza-se sozinha | telemóveis com a app aberta há dias ficavam com o código antigo |
| Folha "Mais" do funcionário em grelha | coerência com a gerência e com a opção B |

---

## 13. Empresa de demonstração (`622f7fd`)

- **Entrada:** `servix-empresa-x.vercel.app/demo`, ou o código **`demo`** ou **`teste`** no ecrã "Qual é a sua empresa?".
- **Ligação** (`src/models/supabaseClient.js`):
  - `isDemoMode` guarda a sessão em `sessionStorage` (`servix_demo`), por isso fica só naquele separador;
  - em demo, `isSupabaseConfigured = false`: a app corre com o caminho de demonstração que já existia e nada é lido nem gravado no Supabase;
  - `enterDemo()` e `exitDemo()`; rewrite `/demo` no `vercel.json`.
- **Ecrã de entrada da demo** (`LoginScreen`): nota "Demonstração…", "Entrar como gerência", 6 pessoas para entrar como funcionário, "Sair da demonstração".
- **Dados** (`src/models/demoState.js`, `buildDemoState()`), gerados para **hoje** a partir de `INITIAL_CLIENTS/STAFF/ASSIGNMENTS` com as regras do app (`dayScheduledClients`, `expectedShare`):
  - 6 períodos anteriores fechados e pagos (`buildClosedPeriodSnapshot`);
  - período atual registado até hoje; 3 pessoas ainda sem o dia de hoje; semanas anteriores finalizadas;
  - Carlos (id 4) com 2 dias em falta na semana passada;
  - 2 extras por aprovar;
  - pedidos e avisos com datas recentes;
  - uma cobertura de férias em curso (Beatriz → Sofia), uma visita avulsa amanhã (Miguel) e uma falta avisada;
  - datas de contrato e validade deslocadas em semanas inteiras desde 15/10/2026.
- Foi removido `seedHistory.js` e o `INITIAL_HORAS` estático (datas fixas que envelheciam). O dev local sem `.env` usa o mesmo gerador.
- **Decisão do Iago (8/11):** `demo` e `teste` abrem a **demonstração** (para mostrar a clientes novos). A empresa de testes **com dados no banco** (id 2, EMPRESATESTE) mantém-se para testar o que precisa de banco (ficheiros, sincronização entre aparelhos, notificações, permissões) e passa a ter o código **`teste-interno`** (`supabase/empresa_teste_interno.sql`). Não é uma empresa de clientes reais. Os dados dela estão parados em 17/10 (horas de 21/09 a 17/10, nenhum período fechado), por isso mostra atrasos — é normal.
- Diferenças demo × empresa de testes do banco: a demo gera dados para hoje, não grava nada, entra sem palavra-passe e cada aparelho tem a sua; a empresa do banco grava, usa contas com email, sincroniza entre aparelhos e tem ficheiros e notificações a sério.

---

## 13b. Revisão geral do sistema (8/11)

**Matriz completa (8/11):** 3 papéis (gerência, supervisor, funcionário) × 4 ecrãs (computador 1366×768, tablet deitado 1024×700, tablet em pé 768×1024, telemóvel 390×844), todas as páginas de cada papel — 0 problemas (consola, texto partido, conteúdo fora do ecrã). Script de referência: abrir `/demo`, entrar por cada papel e percorrer o menu.

**Verificações automáticas (todas sem problemas):** todas as páginas da gerência (computador 1366×768, tablet 1024, telemóvel 390), do funcionário e do supervisor (telemóvel e computador): sem erros na consola, sem texto "undefined/NaN", sem nada a sair do ecrã. Textos pt/en/fr completos (nenhuma chave em falta). `npm test` 33/33.

**Corrigido:**
- **Contratantes — variação errada:** a seta (ex.: "↓ 37%") comparava o período atual, ainda a meio, com o período anterior inteiro → mostrava sempre uma queda. Agora compara com o anterior **até ao mesmo ponto** (proporcional aos dias passados). Em `ContractorsOverview.jsx` (lista e cartões) e `ContractorDetail.jsx` (gráficos do detalhe).
- **"Em falta" no próprio dia:** o dia de hoje contava como em falta logo de manhã (Monitoramento, Dashboard, "Dias por registar", faixa "Falta registar…" nas Horas do funcionário, pontos da semana). Agora **só conta a partir de amanhã**; no Monitoramento o dia de hoje aparece como "hoje" (âmbar, com dica). Funções: `periodMissingDays`, `staffWithGaps(Count)`, `thisWeekSummary` (`d < today`), `MonitoramentoScreen` (estado `"today"`), `EmployeeHorasScreen.missingDaysInChunk`.
- **Notas × Dashboard:** o Dashboard mostrava feriados no bloco Notas e a página Notas dizia "Sem lembretes". A página Notas passa a ter "Feriados próximos" (só leitura, 45 dias).
- **Avisos:** os pedidos de correção de horas tinham o ícone de produto em falta. O ícone segue agora o assunto (produto, correção = relógio, local, outro) — `avisosTypeMeta.jsx` (`TypeIconBlock kind`).
- **Funcionários (tabela):** "Replacement temporário · até 28/12" ficava cortado; passa a pílula + data por baixo. A pílula "Inativo" já não estica a toda a largura. "Novo Funcionário" → "Novo funcionário" (consistente com "Novo cliente").
- **Ajuda no menu do funcionário e do supervisor (computador e tablet):** só existia no "Mais" do telemóvel e no botão "?"; agora também no menu lateral (`App.jsx`, `sidebarItems`).
- **Demonstração:** contratantes com valor/hora e clientes diretos com preço de venda (Contratantes deixava de mostrar "sem preço"/"—"); contratos já vencidos renovados (evita "Expirado" e "8h de 0h" previstas). Fica 1 contrato "a acabar".

**Decidido pelo Iago (8/11) — contrato terminado × agenda = opção B:** nos clientes **fixos**, o fim do contrato é só um **alerta para renovar** ("Expirado", "Contratos vencidos" nas Pendências). O cliente continua na agenda e as **horas previstas continuam a seguir a agenda** (antes `clientExpectedHours` cortava no fim do contrato e aparecia "8h de 0h"). Nos **replacement** a validade (início/fim) continua a mandar na agenda e nas previstas, via `clientAppliesOnDate`. Testes em `tests/agenda.test.mjs`.

**Ideia em aberto (não pedida):**
- **Mini-linhas (sparklines)** do período atual descem sempre no último ponto, porque o período ainda vai a meio. Pode passar a tracejado ou a mostrar a projeção.

## 14. Pendentes, ideias e riscos conhecidos

**Publicado:** este documento, `tests/`, `npm test` e `supabase/empresa_teste_interno.sql` (8/11).

**Pendentes ou à espera do Iago:**
1. Apagar `private.copia_app_data_20261105` quando o Iago confirmar que está tudo bem.
2. Duração própria por visita avulsa (se for pedida).
3. Se um dia a empresa de testes do banco deixar de ser usada, pode ser arquivada no `/admin`.

**Riscos e notas técnicas:**
- `expectedTeamIds` usa a agenda **de hoje** para todas as datas: uma mudança na semana-tipo altera a equipa "prevista" de dias passados. Por isso existe `pinTeamChanges`, que só protege clientes "dividida" no período aberto. As Revisões de dias passados podem mudar depois de uma mudança na agenda; as horas não.
- Clientes "individual" não são fixados por `pinTeamChanges`, porque a equipa não muda as horas deles.
- `pinTeamChanges` corre num `queueMicrotask` dentro do updater de `setState`. É idempotente (no StrictMode corre duas vezes sem efeito).
- O histórico de gravações só existe a partir de 5/11/2026.
- O telemóvel de quem ainda tiver uma versão anterior a `07c0e30` aberta precisa de fechar e reabrir **uma última vez**.
- `company_backups` existe mas o backup é manual (botão no `/admin`). Vale a pena lembrar o Iago de o usar antes de operações grandes.

**Ideias que propus e não estão feitas:**
- Rasto por linha (`createdBy`, `createdAt`, ecrã de origem) nas próprias entradas de horas. Hoje o rasto vem do histórico SQL.
- Backup automático periódico (cron) para `company_backups`.

---

## 15. Como verificar rapidamente

```bash
npm install
npm test          # 33 verificações (horas protegidas + agenda/visitas + contratos)
npm run build     # deve compilar sem erros; index-*.js ≈ 0,87 MB (≈257 kB gzip)
npx vite --port 5199   # sem .env = modo demonstração local
```

- **Demo em produção:** abrir `/demo` → "Entrar como gerência". O Dashboard não pode mostrar "fecho em atraso".
- **Horas:** em Horas, editar uma linha à mão → aparece "Horas fixas". Pedir a um colega para marcar o mesmo cliente e dia → a linha fixa não muda.
- **Agenda:** arrastar um chip para outro dia → toast com Desfazer. "Visita avulsa" → etiqueta "avulsa" na célula e o cliente aparece nas Horas do funcionário nesse dia.
- **SQL (leitura):** `select * from private.horas_ver(1, '2026-10-21', '2026-11-20', 'ACTE 3');`

---

## 16. Ficheiros principais tocados nesta fase

- `src/models/utils.js` — horas fixas, valor/hora, visitas avulsas, `pinTeamChanges`
- `src/models/demoState.js` (novo)
- `src/models/supabaseClient.js` — modo demo
- `src/models/pdfExport.js`
- `src/models/dbMappers.js`
- `src/models/contractorReport.js`
- `src/models/i18n.js`
- `src/controllers/useAppController.js` — `staff_private`, setters com guarda, dados da demo
- `src/views/management/ClientesScreen.jsx`, `FuncionariosScreen.jsx`, `HorasScreen.jsx`, `AgendasScreen.jsx`, `CoverDialog.jsx`, `HistoricoScreen.jsx`, `DashboardScreen.jsx`, `AvisosScreen.jsx`, `MonitoramentoScreen.jsx`, `KnownClientsSection.jsx`
- `src/views/employee/EmployeeAgendaScreen.jsx`
- `src/views/shared/ui/ProfileParts.jsx` (novo), `DataTable.jsx`, `Toast.jsx`, `InfoTip.jsx`, `shell/GroupedSidebar.jsx`, `shell/MoreSheet.jsx`
- `src/views/shared/AuthShell.jsx`, `lazyPage.jsx` (novo), `HelpFab.jsx` (novo)
- `src/views/LoginScreen.jsx`, `CompanyGateScreen.jsx`
- `src/App.jsx`, `src/main.jsx`, `src/versionCheck.js` (novo), `src/index.css`
- `public/` (ícones e manifest), `vercel.json`, `publicar.cmd`, `scripts/publicar.ps1`, `tests/` (novo)
- `supabase/redesign_b1_cores_equipa.sql`, `fichas_planning_nif.sql`, `iban_privado_A.sql`, `iban_privado_B.sql`, `horas_ferramentas.sql`, `horas_usar.sql`

---

## 17. Registo de alterações deste documento

| Data | O quê |
|---|---|
| 8/11/2026 | Versão inicial (trabalho de 4 a 8/11). |
| 8/11/2026 | Decisão: código `teste` fica na demonstração; empresa 2 do banco passa a `teste-interno` (SQL por correr). Regra nova: atualizar este documento a cada mudança ou decisão. |
| 8/11/2026 | SQL `teste-interno` aplicado e verificado (empresa 2 = `teste-interno`); documento e testes publicados. |
| 8/11/2026 | Revisão geral (secção 13b): variação dos contratantes proporcional, hoje não conta como em falta, feriados nas Notas, ícones dos pedidos, tabela de Funcionários, demo com preços. |
| 8/11/2026 | Matriz 3 papéis × 4 ecrãs sem problemas; "Ajuda" no menu lateral do funcionário/supervisor. |
| 8/11/2026 | Decisão opção B (contrato de cliente fixo terminado = só alerta; previstas seguem a agenda). |
| 8/11/2026 | Publicado `729f846` (revisão, Ajuda no menu, opção B, documento e testes) — Vercel READY nos dois projetos. |
