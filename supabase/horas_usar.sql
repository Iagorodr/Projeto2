-- Servix — USAR as ferramentas das horas (precisa de horas_ferramentas.sql instalado)
--
-- Como usar: copie SÓ o bloco que precisa, troque os valores e carregue em Run.
-- Empresa L&A = 1. Datas no formato 'AAAA-MM-DD'. Cliente/funcionário pelo nome.
-- Depois de mudar horas: recarregar a app (F5) nos aparelhos abertos.

-- ── A. VER antes de mexer ───────────────────────────────────────────────
select * from private.horas_ver(1, '2026-10-21', '2026-11-20', 'ACTE 3');
--   (sem cliente = todos)      private.horas_ver(1, '2026-10-21', '2026-11-20')
--   (só um funcionário)        private.horas_ver(1, '2026-10-21', '2026-11-20', null, 'Iago')

-- ── B. CORRIGIR uma linha para um valor certo (fica fixa) ───────────────
--   horas = horas da visita SEM extra.
select private.horas_definir(1, 'Iago', '2026-10-28', 'ACTE 3', 4);

-- ── C. FIXAR as horas atuais de um cliente/período (não muda números) ───
select private.horas_fixar(1, '2026-10-21', '2026-11-20', 'ACTE 3');
--   (um funcionário só)        private.horas_fixar(1, '2026-10-21', '2026-11-20', null, 'Iago')

-- ── D. RASTO: quem mexeu num dia (só regista a partir da instalação) ────
select * from private.horas_rasto(1, 'Jadson Salles', '2026-10-28', 'ACTE 3');

-- ── E. Conferir no fim ──────────────────────────────────────────────────
select funcionario, dia, cliente, horas, fixa, anulada
  from private.horas_ver(1, '2026-10-21', '2026-11-20', 'ACTE 3');
