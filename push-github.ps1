# Script para subir o discordapi no GitHub (Render puxa automático)
# Repo: https://github.com/dghackingcybers/discordapi

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$repo = "https://github.com/dghackingcybers/discordapi.git"
Set-Location "$PSScriptRoot"

Write-Host "==> Status" -ForegroundColor Cyan
& $git status --short

$remotes = & $git remote
if ($remotes -notcontains "origin") {
  & $git remote add origin $repo
}

& $git branch -M main

$pending = & $git status --porcelain
if ($pending) {
  $msg = $args[0]
  if (-not $msg) {
    $msg = "Update API $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }

  Write-Host "==> Commit: $msg" -ForegroundColor Cyan
  & $git add -A
  & $git commit -m "$msg"
} else {
  Write-Host "==> Nada novo pra commit" -ForegroundColor Yellow
}

Write-Host "==> Push origin main (Render redeploy automático se estiver linkado)" -ForegroundColor Cyan
& $git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "OK! GitHub atualizado: $repo" -ForegroundColor Green
  Write-Host "No Render: Dashboard -> discordapi -> Events (deve aparecer Deploy)." -ForegroundColor Green
  Write-Host "Se nao auto-deployar: Manual Deploy -> Deploy latest commit." -ForegroundColor Yellow
  exit 0
}

Write-Host "Push falhou. Confira login/token do GitHub." -ForegroundColor Red
exit 1
