# Script para subir o projeto no GitHub
# Repo: https://github.com/dghackingcybers/discordapi

$git = "C:\Program Files\Git\bin\git.exe"
$repo = "https://github.com/dghackingcybers/discordapi.git"

$env:GIT_AUTHOR_NAME = "Saddam57"
$env:GIT_AUTHOR_EMAIL = "saddam57@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "Saddam57"
$env:GIT_COMMITTER_EMAIL = "saddam57@users.noreply.github.com"

Set-Location "$PSScriptRoot"

function Run-Git {
  param([string[]]$Args)
  & $git @Args
  return $LASTEXITCODE
}

Write-Host "Preparando repositorio..." -ForegroundColor Cyan
Run-Git @("branch", "-M", "main") | Out-Null

$remotes = & $git remote
if ($remotes -contains "origin") {
  Run-Git @("remote", "remove", "origin") | Out-Null
}

Run-Git @("remote", "add", "origin", $repo) | Out-Null

Write-Host "Enviando para $repo ..." -ForegroundColor Cyan
$pushCode = Run-Git @("push", "-u", "origin", "main")

if ($pushCode -ne 0) {
  Write-Host "Remote ja tem arquivos. Fazendo merge..." -ForegroundColor Yellow
  $pullCode = Run-Git @("pull", "origin", "main", "--allow-unrelated-histories", "--no-edit")

  if ($pullCode -ne 0) {
    Write-Host ""
    Write-Host "Merge falhou. Rode manualmente:" -ForegroundColor Red
    Write-Host '  git push -u origin main --force'
    exit 1
  }

  $pushCode = Run-Git @("push", "-u", "origin", "main")
}

if ($pushCode -ne 0) {
  Write-Host ""
  Write-Host "Push falhou. Verifique login no GitHub ou rode:" -ForegroundColor Red
  Write-Host '  git push -u origin main --force'
  exit 1
}

Write-Host ""
Write-Host "Pronto! Repo publicado em $repo" -ForegroundColor Green
