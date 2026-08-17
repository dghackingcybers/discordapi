# Script para subir o projeto no GitHub
# 1. Crie um repo vazio em https://github.com/new (nome sugerido: discordapi)
# 2. Substitua SEU_USUARIO abaixo pelo seu username do GitHub
# 3. Rode este script no PowerShell

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\bin\git.exe"
$repo = "https://github.com/SEU_USUARIO/discordapi.git"

Set-Location "$PSScriptRoot"

& $git branch -M main
& $git remote remove origin 2>$null
& $git remote add origin $repo
& $git push -u origin main

Write-Host "Pronto! Repo publicado em $repo" -ForegroundColor Green
