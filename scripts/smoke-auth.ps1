# Auth smoke test. Run with the API up:  pwsh ./scripts/smoke-auth.ps1   (or powershell)
$base = "http://localhost:4000/api/v1"
$web = New-Object Microsoft.PowerShell.Commands.WebRequestSession   # keeps the refresh cookie
$email = "smoke$(Get-Random)@example.com"
$password = "CorrectHorseBattery1"

function Step($name, [scriptblock]$run) {
  try { $out = & $run; Write-Host "PASS  $name" -ForegroundColor Green; return $out }
  catch { Write-Host "FAIL  $name -> $($_.ErrorDetails.Message)" -ForegroundColor Red }
}
function ExpectError($name, $code, [scriptblock]$run) {
  try { & $run | Out-Null; Write-Host "FAIL  $name (expected $code, got success)" -ForegroundColor Red }
  catch {
    $got = ($_.ErrorDetails.Message | ConvertFrom-Json).error.code
    if ($got -eq $code) { Write-Host "PASS  $name ($code)" -ForegroundColor Green }
    else { Write-Host "FAIL  $name (expected $code, got $got)" -ForegroundColor Red }
  }
}
function Post($path, $body) {
  Invoke-RestMethod "$base$path" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -WebSession $web
}

$reg = Step "register organization" {
  Post "/auth/register" @{ organizationName = "Smoke Test Hotels"; firstName = "Sam"; lastName = "Tester"; email = $email; password = $password }
}
$auth = @{ Authorization = "Bearer $($reg.data.accessToken)" }

Step "GET /auth/me returns Owner role" {
  $me = Invoke-RestMethod "$base/auth/me" -Headers $auth
  if ($me.data.roles[0].key -ne "OWNER") { throw "no OWNER role" }
} | Out-Null

Step "GET /auth/sessions lists this device" {
  $s = Invoke-RestMethod "$base/auth/sessions" -Headers $auth
  if (-not $s.data[0].current) { throw "current device not flagged" }
} | Out-Null

$refreshed = Step "refresh rotates the token" { Post "/auth/refresh" @{} }
$auth = @{ Authorization = "Bearer $($refreshed.data.accessToken)" }

ExpectError "no token is rejected" "UNAUTHENTICATED" { Invoke-RestMethod "$base/auth/me" }
ExpectError "wrong password" "INVALID_CREDENTIALS" { Post "/auth/login" @{ email = $email; password = "wrong-password-123" } }
ExpectError "weak password rejected" "VALIDATION_ERROR" { Post "/auth/register" @{ organizationName = "X Hotels"; firstName = "A"; lastName = "B"; email = "a$(Get-Random)@example.com"; password = "short" } }

Step "logout" { Post "/auth/logout" @{} } | Out-Null
ExpectError "refresh after logout is rejected" "SESSION_INVALID" { Post "/auth/refresh" @{} }
ExpectError "old access token is revoked after logout" "UNAUTHENTICATED" { Invoke-RestMethod "$base/auth/me" -Headers $auth }

Step "login again" { Post "/auth/login" @{ email = $email; password = $password } } | Out-Null
Write-Host "`nDone. Check the API console for the verification email link (dev mail prints there)."
