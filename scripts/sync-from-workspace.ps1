param([switch]$Push)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$source=[IO.Path]::GetFullPath((Join-Path $repo '../이직관리'))
$files=@('build.mjs','client-extra.js','profiles-client.js','todos-client.js','status-client.js','list-order-client.js','template.html','worker.mjs','package.json')
foreach($name in $files) {
  $text=Get-Content -LiteralPath (Join-Path $source $name) -Raw
  if($name -eq 'worker.mjs') {
    $text=[regex]::Replace($text,'(?s) const seedTodos=\{.*?\r?\n \};',' const seedTodos={};')
  }
  if($name -eq 'template.html') {
    $text=$text.Replace('경찬의 이직 관리','이직 관리')
    $text=$text.Replace('이전 HTML의 7개 회사는 모두 접수가 확인되어 지원 후보에서 제외했습니다. 새 후보는 다음 검색 실행 후 여기에 추가합니다.','등록된 지원 후보가 없습니다.')
  }
  Set-Content -LiteralPath (Join-Path $repo $name) -Value $text -Encoding utf8
}
# Only the allowlisted source files are copied. data.json and live state never enter this repository.
if($Push) {
  Push-Location $repo
  try {
    & git add -- build.mjs client-extra.js profiles-client.js todos-client.js status-client.js list-order-client.js template.html worker.mjs package.json scripts README.md .gitignore data.example.json schema.sql
    if($LASTEXITCODE -ne 0){throw 'git add failed'}
    & git diff --cached --quiet
    if($LASTEXITCODE -eq 1){& git commit -m 'Update sanitized career tracker source';if($LASTEXITCODE -ne 0){throw 'git commit failed'}}
    elseif($LASTEXITCODE -ne 0){throw 'git diff failed'}
    & git push origin main
    if($LASTEXITCODE -ne 0){throw 'git push failed'}
  }finally{Pop-Location}
}
