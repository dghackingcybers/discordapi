# Script para subir o projeto no GitHub
# Repo: https://github.com/dghackingcybers/discordapi

$git = "C:\Program Files\Git\bin\git.exe"
$repo = "https://github.com/dghackingcybers/discordapi.git"

Set-Location "$PSScriptRoot"

function Run-Git {
  param([string[]]$GitArgs)
  & $git @GitArgs
  return $LASTEXITCODE
}

$remotes = & $git remote
if ($remotes -notcontains "origin") {
  Run-Git @("remote", "add", "origin", $repo) | Out-Null
}

Run-Git @("branch", "-M", "main") | Out-Null

Write-Host "Enviando para $repo ..." -ForegroundColor Cyan
$pushCode = Run-Git @("push", "-u", "origin", "main")

if ($pushCode -eq 0) {
  Write-Host ""
  Write-Host "Pronto! Repo publicado em $repo" -ForegroundColor Green
  exit 0
}

Write-Host ""
Write-Host "Push falhou. Rode manualmente:" -ForegroundColor Yellow
Write-Host '  & "C:\Program Files\Git\bin\git.exe" push -u origin main'
exit 1
