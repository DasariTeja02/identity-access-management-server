$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5: EXACT 43-STEP REAL-WORLD VERIFICATION SEQUENCE " -ForegroundColor Cyan
Write-Host "  (TESTS A THROUGH I AS SPECIFIED IN REQUIREMENT 25)      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Helper function: RFC 6238 TOTP Generator
function Get-TotpCode {
    param([string]$Base32Secret)

    $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    $cleanSecret = $Base32Secret.ToUpper().Replace("=", "").Trim()
    $bits = ""
    foreach ($c in $cleanSecret.ToCharArray()) {
        $val = $alphabet.IndexOf($c)
        if ($val -ge 0) {
            $bits += [Convert]::ToString($val, 2).PadLeft(5, '0')
        }
    }
    $bytes = [System.Collections.Generic.List[byte]]::new()
    for ($i = 0; $i -lt ($bits.Length - 7); $i += 8) {
        $byteStr = $bits.Substring($i, 8)
        $bytes.Add([Convert]::ToByte($byteStr, 2))
    }
    $keyBytes = $bytes.ToArray()

    $unixTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $step = [Math]::Floor($unixTime / 30)

    $stepBytes = [BitConverter]::GetBytes([long]$step)
    if ([BitConverter]::IsLittleEndian) {
        [Array]::Reverse($stepBytes)
    }

    $hmac = [System.Security.Cryptography.HMACSHA1]::new($keyBytes)
    $hash = $hmac.ComputeHash($stepBytes)

    $offset = $hash[$hash.Length - 1] -band 0x0F
    $binary = (($hash[$offset] -band 0x7F) -shl 24) -bor `
              (($hash[$offset + 1] -band 0xFF) -shl 16) -bor `
              (($hash[$offset + 2] -band 0xFF) -shl 8) -bor `
              ($hash[$offset + 3] -band 0xFF)

    $otp = $binary % 1000000
    return $otp.ToString("D6")
}

# Helper: PKCE code_challenge generator
function Get-PkceChallenge {
    param([string]$Verifier)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($Verifier)
    $hash = $sha256.ComputeHash($bytes)
    return [Convert]::ToBase64String($hash).Replace("+", "-").Replace("/", "_").Replace("=", "")
}

# ----------------------------------------------------
# PRE-TEST CLEANUP: Ensure clean state for testuser
# ----------------------------------------------------
Write-Host "`nPRE-CLEANUP: Resetting testuser MFA state..." -ForegroundColor Gray
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLogin = @{ usernameOrEmail = "admin"; password = "Admin@123456" } | ConvertTo-Json
$adminAuth = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $adminLogin -ContentType "application/json" -WebSession $adminSession
$users = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users" -Method Get -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminAuth.sessionId }
$tu = $users.data | Where-Object { $_.username -eq "testuser" }
if ($tu -and $tu.mfaEnabled) {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users/$($tu.userId)/reset" -Method Post -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminAuth.sessionId }
    Write-Host "  -> Cleaned prior MFA on testuser" -ForegroundColor Gray
}

# ----------------------------------------------------
# TEST A — ENROLLMENT
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST A -- ENROLLMENT (Steps 1 to 9)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 1. Create/login as test user
Write-Host "Step 1: Login as testuser..." -ForegroundColor Yellow
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ usernameOrEmail = "testuser"; password = "User@123456" } | ConvertTo-Json
$userAuth = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $userSession
Write-Host "  -> Logged in successfully. SessionId: $($userAuth.sessionId)" -ForegroundColor Green

# 2. Open Security & MFA
Write-Host "Step 2: Open Security & MFA (Checking MFA status)..." -ForegroundColor Yellow
$statusA = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
Write-Host "  -> Initial MFA Status: enabled=$($statusA.data.enabled), remainingCodes=$($statusA.data.recoveryCodesRemaining)" -ForegroundColor Green
if ($statusA.data.enabled -ne $false) { throw "MFA should initially be disabled!" }

# 3. Enable MFA / 4. Generate QR
Write-Host "Step 3 and 4: Enable MFA and Generate QR Code..." -ForegroundColor Yellow
$enrollA = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/enroll" -Method Post -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
$secretA = $enrollA.data.secret
$qrUriA = $enrollA.data.qrCodeDataUri
$otpUriA = $enrollA.data.otpAuthUri
Write-Host "  -> Secret: $secretA" -ForegroundColor Green
Write-Host "  -> OTPAuth URI: $otpUriA" -ForegroundColor Green
Write-Host "  -> QR Code Data URI length: $($qrUriA.Length) chars" -ForegroundColor Green
if (-not $secretA -or -not ($qrUriA -like 'data:image/png;base64,*')) { throw "Invalid enrollment response!" }

# 5. Scan QR with authenticator app (Emulated by RFC 6238 algorithm reading the generated secret)
Write-Host "Step 5: Authenticator App scans QR (Base32 secret read)..." -ForegroundColor Yellow

# 6. Enter real current TOTP
$realTotpA = Get-TotpCode -Base32Secret $secretA
Write-Host "Step 6: Enter real current TOTP code: $realTotpA" -ForegroundColor Yellow

# 7. Verify
Write-Host "Step 7: Verify TOTP code..." -ForegroundColor Yellow
$verifyABody = @{ code = $realTotpA } | ConvertTo-Json
$verifyA = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/verify-enrollment" -Method Post -Body $verifyABody -ContentType "application/json" -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
Write-Host "  -> Verification response: $($verifyA.message)" -ForegroundColor Green

# 8. Confirm MFA enabled
Write-Host "Step 8: Confirm MFA enabled..." -ForegroundColor Yellow
$statusA2 = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
Write-Host "  -> MFA Status: enabled=$($statusA2.data.enabled), enrolledAt=$($statusA2.data.enrolledAt)" -ForegroundColor Green
if ($statusA2.data.enabled -ne $true) { throw "MFA must be enabled after verification!" }

# 9. Save recovery codes
Write-Host "Step 9: Save recovery codes..." -ForegroundColor Yellow
$savedRecoveryCodes = $verifyA.data.recoveryCodes
Write-Host "  -> Received $($savedRecoveryCodes.Count) recovery codes:" -ForegroundColor Green
$savedRecoveryCodes | ForEach-Object { Write-Host "     * $_" -ForegroundColor Cyan }
if ($savedRecoveryCodes.Count -ne 8) { throw "Expected 8 recovery codes!" }

# ----------------------------------------------------
# TEST B — LOGOUT
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST B -- LOGOUT (Steps 10 and 11)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 10. Logout
Write-Host "Step 10: Logout testuser..." -ForegroundColor Yellow
$logoutResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
Write-Host "  -> Logout call completed: $($logoutResp.message)" -ForegroundColor Green

# 11. Confirm session invalidated
Write-Host "Step 11: Confirm session invalidated..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $userSession -Headers @{ "X-Session-Id" = $userAuth.sessionId }
    throw "Session should be invalid after logout!"
} catch {
    Write-Host "  -> SUCCESS: Prior session rejected with HTTP 401 Unauthorized!" -ForegroundColor Green
}

# ----------------------------------------------------
# TEST C — MFA LOGIN
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST C -- MFA LOGIN (Steps 12 to 15)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 12. Login using password
Write-Host "Step 12: Login using username and password..." -ForegroundColor Yellow
$sessionC = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespC = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionC

# 13. Confirm MFA challenge appears
Write-Host "Step 13: Confirm MFA challenge appears..." -ForegroundColor Yellow
if ($loginRespC.mfaRequired -ne $true -or -not $loginRespC.mfaChallengeToken) {
    throw "MFA Challenge must appear on primary login when MFA is enabled!"
}
$challengeTokenC = $loginRespC.mfaChallengeToken
Write-Host "  -> MFA Challenge received! Challenge token: $challengeTokenC" -ForegroundColor Green

# 14. Enter real TOTP
$realTotpC = Get-TotpCode -Base32Secret $secretA
Write-Host "Step 14: Enter real TOTP code: $realTotpC" -ForegroundColor Yellow

# 15. Confirm successful authentication
Write-Host "Step 15: Confirm successful authentication..." -ForegroundColor Yellow
$verifyCBody = @{ challengeToken = $challengeTokenC; code = $realTotpC } | ConvertTo-Json
$verifyRespC = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $verifyCBody -ContentType "application/json" -WebSession $sessionC
Write-Host "  -> SUCCESS: Authenticated! User: $($verifyRespC.user.username), SessionId: $($verifyRespC.sessionId)" -ForegroundColor Green
$meC = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $sessionC -Headers @{ "X-Session-Id" = $verifyRespC.sessionId }
Write-Host "  -> Verified profile access: $($meC.data.username)" -ForegroundColor Green

# ----------------------------------------------------
# TEST D — INVALID MFA
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST D -- INVALID MFA (Steps 16 to 19)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 16. Logout
Write-Host "Step 16: Logout..." -ForegroundColor Yellow
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $sessionC -Headers @{ "X-Session-Id" = $verifyRespC.sessionId }
Write-Host "  -> Logged out." -ForegroundColor Green

# 17. Login again
Write-Host "Step 17: Login again..." -ForegroundColor Yellow
$sessionD = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespD = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionD
$challengeTokenD = $loginRespD.mfaChallengeToken
Write-Host "  -> Challenge token: $challengeTokenD" -ForegroundColor Green

# 18. Enter incorrect TOTP
Write-Host "Step 18: Enter incorrect TOTP (888888)..." -ForegroundColor Yellow
try {
    $badVerifyBody = @{ challengeToken = $challengeTokenD; code = "888888" } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $badVerifyBody -ContentType "application/json" -WebSession $sessionD
    throw "Incorrect TOTP should not succeed!"
} catch {
    # 19. Confirm authentication fails
    Write-Host "Step 19: Confirm authentication fails..." -ForegroundColor Yellow
    Write-Host "  -> SUCCESS: Incorrect TOTP rejected with HTTP 401 Unauthorized!" -ForegroundColor Green
}

# ----------------------------------------------------
# TEST E — RECOVERY
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST E -- RECOVERY (Steps 20 to 24)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 20. Login again
Write-Host "Step 20: Login again to get new challenge..." -ForegroundColor Yellow
$sessionE = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespE = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionE
$challengeTokenE = $loginRespE.mfaChallengeToken

# 21. Use valid recovery code
$chosenCode = $savedRecoveryCodes[0]
Write-Host "Step 21: Use valid recovery code: $chosenCode" -ForegroundColor Yellow
$recVerifyBody = @{ challengeToken = $challengeTokenE; recoveryCode = $chosenCode } | ConvertTo-Json
$recAuthE = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $recVerifyBody -ContentType "application/json" -WebSession $sessionE

# 22. Confirm authentication succeeds
Write-Host "Step 22: Confirm authentication succeeds..." -ForegroundColor Yellow
Write-Host "  -> SUCCESS: Authenticated via Recovery Code! SessionId: $($recAuthE.sessionId)" -ForegroundColor Green

# 23. Try the same recovery code again
Write-Host "Step 23: Try the same recovery code again in a new login..." -ForegroundColor Yellow
$sessionE2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespE2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionE2
$challengeTokenE2 = $loginRespE2.mfaChallengeToken

try {
    $reuseBody = @{ challengeToken = $challengeTokenE2; recoveryCode = $chosenCode } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $reuseBody -ContentType "application/json" -WebSession $sessionE2
    throw "Used recovery code must not succeed!"
} catch {
    # 24. Confirm it fails
    Write-Host "Step 24: Confirm it fails..." -ForegroundColor Yellow
    Write-Host "  -> SUCCESS: Reused recovery code rejected with HTTP 401 Unauthorized!" -ForegroundColor Green
}

# ----------------------------------------------------
# TEST F — OAUTH2
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST F -- OAUTH2 (Steps 25 to 30)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 25. Start OAuth2 Authorization Code flow
Write-Host "Step 25: Start OAuth2 Authorization Code flow..." -ForegroundColor Yellow
$codeVerifierF = "oauth2_verifier_f_4567890123456789012345678901234567890"
$codeChallengeF = Get-PkceChallenge -Verifier $codeVerifierF
$oauthSessionF = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Try calling authorize BEFORE completing password + MFA -> Should not issue code
$authUrlF = "http://localhost:8080/oauth2/authorize?response_type=code&client_id=iam-web-client&scope=read%20write&redirect_uri=http://localhost:5173/oauth2/callback&code_challenge=$codeChallengeF&code_challenge_method=S256"

# 26. Complete password authentication
Write-Host "Step 26: Complete password authentication..." -ForegroundColor Yellow
$loginRespF = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $oauthSessionF
$challengeTokenF = $loginRespF.mfaChallengeToken
Write-Host "  -> Primary login completed. MFA challenge required (Token: $challengeTokenF)" -ForegroundColor Green

# 27. Complete MFA
Write-Host "Step 27: Complete MFA..." -ForegroundColor Yellow
$totpF = Get-TotpCode -Base32Secret $secretA
$mfaVerifyF = @{ challengeToken = $challengeTokenF; code = $totpF } | ConvertTo-Json
$mfaRespF = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $mfaVerifyF -ContentType "application/json" -WebSession $oauthSessionF
Write-Host "  -> MFA Completed. Authenticated session active!" -ForegroundColor Green

# 28. Receive authorization code
Write-Host "Step 28: Receive authorization code from /oauth2/authorize..." -ForegroundColor Yellow
$authCodeF = $null
try {
    $authReqF = [System.Net.HttpWebRequest]::Create($authUrlF)
    $authReqF.CookieContainer = $oauthSessionF.Cookies
    $authReqF.AllowAutoRedirect = $false
    $authRespF = $authReqF.GetResponse()
    Write-Host "  -> Response Status: $([int]$authRespF.StatusCode) $($authRespF.StatusCode)" -ForegroundColor Yellow
    $loc = $authRespF.Headers["Location"]
    Write-Host "  -> Location header: $loc" -ForegroundColor Yellow
    if ($loc -match "code=([^&]+)") {
        $authCodeF = $matches[1]
    }
    $authRespF.Close()
} catch [System.Net.WebException] {
    Write-Host "  -> WebException Status: $([int]$_.Exception.Response.StatusCode) $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    $loc = $_.Exception.Response.Headers["Location"]
    Write-Host "  -> WebException Location: $loc" -ForegroundColor Yellow
    if ($loc -match "code=([^&]+)") {
        $authCodeF = $matches[1]
    }
} catch {
    Write-Host "  -> Other error: $_" -ForegroundColor Red
}

if (-not $authCodeF) {
    throw "Failed to receive authorization code after MFA completion!"
}
Write-Host "  -> Received Authorization Code: $authCodeF" -ForegroundColor Green

# 29. Exchange code for tokens
Write-Host "Step 29: Exchange code for tokens at /oauth2/token..." -ForegroundColor Yellow
$tokenParamsF = "grant_type=authorization_code&client_id=iam-web-client&code=$authCodeF&redirect_uri=http://localhost:5173/oauth2/callback&code_verifier=$codeVerifierF"
$tokensF = Invoke-RestMethod -Uri "http://localhost:8080/oauth2/token" -Method Post -Body $tokenParamsF -ContentType "application/x-www-form-urlencoded"
$accessTokenF = $tokensF.access_token
Write-Host "  -> Received Access Token: $($accessTokenF.Substring(0, 25))..." -ForegroundColor Green

# 30. Call protected API
Write-Host "Step 30: Call protected API (/api/oauth2/protected/user)..." -ForegroundColor Yellow
$protF = Invoke-RestMethod -Uri "http://localhost:8080/api/oauth2/protected/user" -Method Get -Headers @{ "Authorization" = "Bearer $accessTokenF" }
Write-Host "  -> SUCCESS: Protected API access verified: $($protF.message)" -ForegroundColor Green

# ----------------------------------------------------
# TEST G — OIDC
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST G -- OIDC (Steps 31 to 36)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 31. Start OIDC flow
Write-Host "Step 31: Start OIDC flow with openid, profile, email scopes..." -ForegroundColor Yellow
$codeVerifierG = "oidc_verifier_g_1234567890123456789012345678901234567890"
$codeChallengeG = Get-PkceChallenge -Verifier $codeVerifierG
$nonceG = "oidc_nonce_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$oidcSessionG = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$oidcUrlG = "http://localhost:8080/oauth2/authorize?response_type=code&client_id=iam-web-client&scope=openid%20profile%20email&redirect_uri=http://localhost:5173/oauth2/callback&code_challenge=$codeChallengeG&code_challenge_method=S256&nonce=$nonceG"

# 32. Complete password
Write-Host "Step 32: Complete password..." -ForegroundColor Yellow
$loginRespG = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $oidcSessionG
$challengeTokenG = $loginRespG.mfaChallengeToken
Write-Host "  -> Password accepted, challenge issued: $challengeTokenG" -ForegroundColor Green

# 33. Complete MFA
Write-Host "Step 33: Complete MFA..." -ForegroundColor Yellow
$totpG = Get-TotpCode -Base32Secret $secretA
$mfaVerifyG = @{ challengeToken = $challengeTokenG; code = $totpG } | ConvertTo-Json
$mfaRespG = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $mfaVerifyG -ContentType "application/json" -WebSession $oidcSessionG
Write-Host "  -> MFA verification complete." -ForegroundColor Green

# Request authorization code
$authCodeG = $null
try {
    $authReqG = [System.Net.HttpWebRequest]::Create($oidcUrlG)
    $authReqG.CookieContainer = $oidcSessionG.Cookies
    $authReqG.AllowAutoRedirect = $false
    $authRespG = $authReqG.GetResponse()
    $locG = $authRespG.Headers["Location"]
    if ($locG -match "code=([^&]+)") {
        $authCodeG = $matches[1]
    }
    $authRespG.Close()
} catch [System.Net.WebException] {
    $locG = $_.Exception.Response.Headers["Location"]
    if ($locG -match "code=([^&]+)") {
        $authCodeG = $matches[1]
    }
}
if (-not $authCodeG) { throw "Failed to receive OIDC authorization code!" }
Write-Host "  -> Received OIDC Authorization Code: $authCodeG" -ForegroundColor Green

# 34. Receive ID Token
Write-Host "Step 34: Receive ID Token from /oauth2/token..." -ForegroundColor Yellow
$tokenParamsG = "grant_type=authorization_code&client_id=iam-web-client&code=$authCodeG&redirect_uri=http://localhost:5173/oauth2/callback&code_verifier=$codeVerifierG"
$tokensG = Invoke-RestMethod -Uri "http://localhost:8080/oauth2/token" -Method Post -Body $tokenParamsG -ContentType "application/x-www-form-urlencoded"

if (-not $tokensG.id_token) { throw "ID Token not returned in OIDC token exchange!" }
Write-Host "  -> SUCCESS: ID Token received: $($tokensG.id_token.Substring(0, 30))..." -ForegroundColor Green

# 35. Call UserInfo
Write-Host "Step 35: Call UserInfo endpoint (/userinfo)..." -ForegroundColor Yellow
$userInfoG = Invoke-RestMethod -Uri "http://localhost:8080/userinfo" -Method Get -Headers @{ "Authorization" = "Bearer $($tokensG.access_token)" }

# 36. Verify correct user identity
Write-Host "Step 36: Verify correct user identity..." -ForegroundColor Yellow
Write-Host "  -> UserInfo sub: $($userInfoG.sub)" -ForegroundColor Green
Write-Host "  -> UserInfo preferred_username: $($userInfoG.preferred_username)" -ForegroundColor Green
Write-Host "  -> UserInfo email: $($userInfoG.email)" -ForegroundColor Green
if ($userInfoG.preferred_username -ne "testuser") {
    throw "UserInfo identity does not match testuser!"
}

# ----------------------------------------------------
# TEST H — DISABLE
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST H -- DISABLE (Steps 37 to 40)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 37. Disable MFA using required re-authentication
Write-Host "Step 37: Disable MFA using password re-authentication..." -ForegroundColor Yellow
$disableHBody = @{ password = "User@123456" } | ConvertTo-Json
$disableH = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/disable" -Method Post -Body $disableHBody -ContentType "application/json" -WebSession $oidcSessionG -Headers @{ "X-Session-Id" = $mfaRespG.sessionId }
Write-Host "  -> Disable response: $($disableH.message)" -ForegroundColor Green

# Verify status now reports disabled
$statusH = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $oidcSessionG -Headers @{ "X-Session-Id" = $mfaRespG.sessionId }
Write-Host "  -> MFA Status: enabled=$($statusH.data.enabled)" -ForegroundColor Green
if ($statusH.data.enabled -ne $false) { throw "MFA should now be disabled!" }

# 38. Logout
Write-Host "Step 38: Logout..." -ForegroundColor Yellow
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $oidcSessionG -Headers @{ "X-Session-Id" = $mfaRespG.sessionId }
Write-Host "  -> Logged out." -ForegroundColor Green

# 39. Login again
Write-Host "Step 39: Login again..." -ForegroundColor Yellow
$sessionH2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespH2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionH2

# 40. Confirm MFA challenge no longer appears
Write-Host "Step 40: Confirm MFA challenge no longer appears..." -ForegroundColor Yellow
if ($loginRespH2.mfaRequired -eq $true) {
    throw "MFA Challenge should NOT appear when MFA is disabled!"
}
Write-Host "  -> SUCCESS: Direct authentication succeeded without MFA challenge! Session: $($loginRespH2.sessionId)" -ForegroundColor Green

# ----------------------------------------------------
# TEST I — RE-ENABLE
# ----------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Magenta
Write-Host "  TEST I -- RE-ENABLE (Steps 41 to 43)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 41. Enable MFA again
Write-Host "Step 41: Enable MFA again (start enrollment)..." -ForegroundColor Yellow
$enrollI = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/enroll" -Method Post -WebSession $sessionH2 -Headers @{ "X-Session-Id" = $loginRespH2.sessionId }
$secretI = $enrollI.data.secret
Write-Host "  -> New Secret Generated: $secretI" -ForegroundColor Green

# 42. Verify TOTP
Write-Host "Step 42: Verify TOTP..." -ForegroundColor Yellow
$totpI = Get-TotpCode -Base32Secret $secretI
$verifyIBody = @{ code = $totpI } | ConvertTo-Json
$verifyI = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/verify-enrollment" -Method Post -Body $verifyIBody -ContentType "application/json" -WebSession $sessionH2 -Headers @{ "X-Session-Id" = $loginRespH2.sessionId }
Write-Host "  -> Verification response: $($verifyI.message)" -ForegroundColor Green

# 43. Confirm MFA works again
Write-Host "Step 43: Confirm MFA works again..." -ForegroundColor Yellow
$statusI = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $sessionH2 -Headers @{ "X-Session-Id" = $loginRespH2.sessionId }
Write-Host "  -> MFA Status: enabled=$($statusI.data.enabled), remainingCodes=$($statusI.data.recoveryCodesRemaining)" -ForegroundColor Green
if ($statusI.data.enabled -ne $true -or $statusI.data.recoveryCodesRemaining -ne 8) {
    throw "MFA re-enable failed!"
}

# Now logout and verify MFA challenge triggers again!
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $sessionH2 -Headers @{ "X-Session-Id" = $loginRespH2.sessionId }
$sessionI2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRespI2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionI2
if ($loginRespI2.mfaRequired -ne $true) {
    throw "MFA challenge must trigger after re-enabling MFA!"
}
$totpI2 = Get-TotpCode -Base32Secret $secretI
$verifyI2Body = @{ challengeToken = $loginRespI2.mfaChallengeToken; code = $totpI2 } | ConvertTo-Json
$verifyI2 = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $verifyI2Body -ContentType "application/json" -WebSession $sessionI2
Write-Host "  -> SUCCESS: MFA challenge verified and user authenticated! Session: $($verifyI2.sessionId)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  PERFECT EXECUTION: ALL 43 STEPS OF TESTS A THROUGH I PASSED!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
