# Publica o bundle mais recente que o Claude deixou na pasta acima (ProjetoFin).
# Uso (no terminal do VS Code, dentro de ProjetoFin\servix):  .\publicar.cmd
#
# 1. vai buscar o estado atual do GitHub;
# 2. aplica o bundle mais recente (só avança se encaixar sem conflitos);
# 3. envia para o GitHub (o Vercel faz o deploy sozinho);
# 4. arquiva os bundles já usados em ProjetoFin\bundles-publicados.

# "Continue": o git escreve mensagens normais no stderr ("is okay", "From ...") e o
# Windows PowerShell 5.1 com "Stop" trata-as como erro. Os erros reais vêm do $LASTEXITCODE.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
$parent = Split-Path -Parent (Get-Location)

function Fail($msg) { Write-Host ""; Write-Host "X $msg" -ForegroundColor Red; Write-Host "Nada foi publicado. Manda um print ao Claude." -ForegroundColor Red; exit 1 }

$bundle = Get-ChildItem -Path $parent -Filter *.bundle -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $bundle) { Write-Host "Nao ha nenhum ficheiro .bundle em $parent. Nada para publicar." -ForegroundColor Yellow; exit 0 }
Write-Host "-> Bundle: $($bundle.Name)" -ForegroundColor Cyan

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") { Fail "Esta pasta nao esta no ramo main (esta em '$branch')." }
if (git status --porcelain) { Fail "Ha alteracoes locais por guardar nesta pasta. Nao mexo para nao as perder." }

Write-Host "-> A atualizar a partir do GitHub..."
git fetch origin main
if ($LASTEXITCODE -ne 0) { Fail "Nao consegui ligar ao GitHub." }
git merge --ff-only origin/main | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "A pasta local divergiu do GitHub." }

Write-Host "-> A aplicar o bundle..."
$null = cmd /c "git bundle verify `"$($bundle.FullName)`" 2>&1"
if ($LASTEXITCODE -ne 0) { Fail "O bundle nao encaixa nesta versao (falta um envio anterior?)." }
git pull --ff-only $bundle.FullName main
if ($LASTEXITCODE -ne 0) { Fail "O bundle nao encaixa sem conflitos." }

Write-Host "-> A enviar para o GitHub..."
git push origin main
if ($LASTEXITCODE -ne 0) { Fail "O envio para o GitHub falhou." }

$archive = Join-Path $parent "bundles-publicados"
New-Item -ItemType Directory -Force -Path $archive | Out-Null
Get-ChildItem -Path $parent -Filter *.bundle -File | Move-Item -Destination $archive -Force

Write-Host ""
Write-Host "OK Publicado! O Vercel faz o deploy em 1-2 minutos." -ForegroundColor Green
git log -1 --format="   %h %s"
