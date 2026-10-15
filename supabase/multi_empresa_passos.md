# Várias empresas no mesmo banco — passo a passo

Ordem em **cada** projeto Supabase (primeiro o de TESTE, depois a produção L & A).
Cada ficheiro SQL: SQL Editor → New query → colar → Run. São seguros de repetir.

| # | O quê | Esperado |
|---|-------|----------|
| 1 | `multi_empresa.sql` | termina sem erro |
| 2 | `multi_empresa_funcoes.sql` | termina sem erro |
| 3 | `multi_empresa_admin.sql` | termina sem erro |
| 3b | `multi_empresa_arquivo.sql` (arquivar / restaurar / excluir empresas em `/admin`) | termina sem erro |
| 4 | Código definitivo da empresa 1: `update public.companies set code = 'lea' where id = 1;` (teste: `'demo'`) | 1 linha |
| 5 | Edge Functions: publicar `update-staff-password`, `send-note-reminders` e `admin-company-login` | as 3 ativas |
| 6 | Conta de administração: Authentication → Users → Add user (e-mail + senha, "Auto Confirm User"); depois `insert into public.platform_admins (email) values ('o-seu-email') on conflict do nothing;` | — |
| 7 | Publicar o app (push no `main`) | `/admin` abre |

**Só no projeto de teste** (nunca em produção — criam uma empresa fictícia numa transação
que é desfeita): `multi_empresa_test.sql` (92 OK), `multi_empresa_funcoes_test.sql` (17 OK),
`multi_empresa_admin_test.sql` (55 OK), `multi_empresa_arquivo_test.sql` (38 OK). Cada um termina com um ERRO "RESULT" cheio de
linhas "OK"; não pode aparecer "FALHOU" nem "ERRO NO TESTE".

## Estado (2026-10-15)
| Passo | TESTE (`svtqldpfljvznetuscri`) | Produção L & A (`zoizwdungwtioppvupcl`) |
|-------|-------------------------------|------------------------------------------|
| 1 `multi_empresa.sql` | feito (92 OK) | feito em 2026-10-15 (dados idênticos ao backup) |
| 2 `multi_empresa_funcoes.sql` | feito (17 OK) | feito em 2026-10-15 |
| 3 `multi_empresa_admin.sql` | feito (55 OK) | feito em 2026-10-15 |
| 3b `multi_empresa_arquivo.sql` | feito em 2026-10-15 (38 OK) | **ainda não aplicado** (só depois do OK do dono) |
| 4 código da empresa 1 | `demo` | `lea` (sem validade) |
| 5 Edge Functions | publicadas (update-staff-password v2, send-note-reminders v5, admin-company-login v1) | publicadas (update-staff-password v4, send-note-reminders v4, admin-company-login v1) |
| 6 conta de administração | feito; fluxo completo testado em `/admin` (criar empresa, senha da gerência, 1.º login e troca de senha) | feito em 2026-10-15 (`admin@servix.com` em `platform_admins`; permissões conferidas no banco). Falta o teste em `/admin` com a senha |

Backup anterior à migração da produção: schema fechado `backup_pre_multi_20261015` no banco da
L & A (tabelas + definições antigas de funções, políticas e índices). Pode ser apagado quando
a produção estiver estável: `drop schema backup_pre_multi_20261015 cascade;`.

## Pontos de atenção
- Faça o passo 5 **antes** de existir uma segunda empresa: as versões antigas das funções
  não conhecem empresas.
- O app aguenta um banco sem estes SQL (usa a empresa 1 e não pede código), mas aí não há
  separação entre empresas.
- Janelas/PWAs abertos com a versão antiga continuam a funcionar na empresa 1; peça à equipa
  para recarregar (ou reabrir) para ver os avisos de validade.
- A gerência (conta da empresa, gerência e gerência-supervisor) volta a pedir a palavra-passe
  depois de 30 minutos sem usar o app (`IDLE_MINUTES` em `src/models/companyContext.js`).
- Validade: dia inclusivo no fuso da empresa; depois, 7 dias de tolerância com aviso forte;
  depois, bloqueio total (os dados ficam guardados). `valid_until` vazio = sem prazo.
- Links de acesso: `https://<endereço>/?e=<código>` guarda o código no aparelho.
- Administração: `https://<endereço>/admin` (conta listada em `platform_admins`).
- Apagar empresas (`multi_empresa_arquivo.sql`): só uma empresa **suspensa** pode ser excluída, e isso a
  manda para as **Arquivadas** (lixeira; nada é apagado). Em Arquivadas: **Restaurar** (volta à lista,
  ainda suspensa) ou **Excluir definitivamente** (apaga clientes, funcionários, definições, dados e os
  logins da gerência e dos funcionários; é preciso digitar o código da empresa; sem volta). A empresa 1
  (L & A em produção) nunca pode ser arquivada nem excluída. Enquanto o SQL não estiver aplicado num
  projeto, a página mostra a lista normalmente e avisa o que falta ao tentar excluir.
