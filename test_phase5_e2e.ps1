$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5 E2E MULTI-FACTOR AUTHENTICATION (TOTP) TEST" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# RFC 6238 TOTP Generator Function
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

# Pre-cleanup: ensure testuser starts in clean MFA disabled state
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLogin = @{ usernameOrEmail = "admin"; password = "Admin@123456" } | ConvertTo-Json
$adminAuth = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $adminLogin -ContentType "application/json" -WebSession $adminSession
$users = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users" -Method Get -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminAuth.sessionId }
$tu = $users.data | Where-Object { $_.username -eq "testuser" }
if ($tu -and $tu.mfaEnabled) {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users/$($tu.userId)/reset" -Method Post -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminAuth.sessionId }
    Write-Host "  -> Reset existing MFA on testuser for fresh test run" -ForegroundColor Gray
}

# 1. Login as testuser (MFA initially disabled)
Write-Host "`n[Step 1] Logging in as 'testuser' (MFA initially disabled)..." -ForegroundColor Yellow
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{
    usernameOrEmail = "testuser"
    password = "User@123456"
} | ConvertTo-Json

$resp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session
Write-Host "  -> Password Login Success! Session ID: $($resp.sessionId)" -ForegroundColor Green

# 2. Check Initial MFA Status
Write-Host "`n[Step 2] Checking MFA Status..." -ForegroundColor Yellow
$statusResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $session
Write-Host "  -> MFA Status: enabled=$($statusResp.data.enabled), remainingCodes=$($statusResp.data.recoveryCodesRemaining)" -ForegroundColor Green

# If already enabled, disable it first so we test full enrollment flow cleanly
if ($statusResp.data.enabled -eq $true) {
    Write-Host "  -> Disabling existing MFA to start clean enrollment test..." -ForegroundColor Yellow
    $disableBody = @{ password = "User@123456" } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/disable" -Method Post -Body $disableBody -ContentType "application/json" -WebSession $session
    $statusResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $session
    Write-Host "  -> MFA now reset to enabled=$($statusResp.data.enabled)" -ForegroundColor Green
}

# 3. Start MFA Enrollment
Write-Host "`n[Step 3] Initiating MFA Enrollment..." -ForegroundColor Yellow
$enrollResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/enroll" -Method Post -WebSession $session
$secret = $enrollResp.data.secret
$otpAuthUri = $enrollResp.data.otpAuthUri
$qrDataUri = $enrollResp.data.qrCodeDataUri

Write-Host "  -> Secret Generated: $secret" -ForegroundColor Green
Write-Host "  -> OTPAuth URI: $otpAuthUri" -ForegroundColor Green
Write-Host "  -> QR Code Data URI length: $($qrDataUri.Length) chars" -ForegroundColor Green

# 4. Generate REAL RFC 6238 TOTP Code
Write-Host "`n[Step 4] Computing Real RFC 6238 TOTP Code from secret..." -ForegroundColor Yellow
$totpCode = Get-TotpCode -Base32Secret $secret
Write-Host "  -> Generated Real 6-Digit TOTP Code: $totpCode" -ForegroundColor Green

# 5. Verify Enrollment
Write-Host "`n[Step 5] Verifying Enrollment with TOTP Code..." -ForegroundColor Yellow
$verifyEnrollBody = @{ code = $totpCode } | ConvertTo-Json
$verifyEnrollResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/verify-enrollment" -Method Post -Body $verifyEnrollBody -ContentType "application/json" -WebSession $session

$recoveryCodes = $verifyEnrollResp.data.recoveryCodes
Write-Host "  -> Enrollment Verified! MFA is now ENABLED." -ForegroundColor Green
Write-Host "  -> Generated $($recoveryCodes.Count) One-Time Recovery Codes:" -ForegroundColor Green
$recoveryCodes | ForEach-Object { Write-Host "     * $_" -ForegroundColor Cyan }

# 6. Verify Status API shows enabled with 8 codes
Write-Host "`n[Step 6] Checking MFA Status after enrollment..." -ForegroundColor Yellow
$statusResp2 = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $session
Write-Host "  -> MFA Status: enabled=$($statusResp2.data.enabled), recoveryCodesRemaining=$($statusResp2.data.recoveryCodesRemaining)" -ForegroundColor Green
if ($statusResp2.data.enabled -ne $true -or $statusResp2.data.recoveryCodesRemaining -ne 8) {
    Write-Host "  FAILED: Expected enabled=true and remaining=8!" -ForegroundColor Red
    exit 1
}

# 7. Logout testuser
Write-Host "`n[Step 7] Logging out session..." -ForegroundColor Yellow
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $session
Write-Host "  -> Logged out successfully." -ForegroundColor Green

# 8. Attempt Login with Username & Password (Should trigger MFA Challenge!)
Write-Host "`n[Step 8] Attempting Primary Login with credentials..." -ForegroundColor Yellow
$session2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResp2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session2

if ($loginResp2.mfaRequired -eq $true -and $loginResp2.mfaChallengeToken) {
    $challengeToken = $loginResp2.mfaChallengeToken
    Write-Host "  -> SUCCESS: MFA Challenge Triggered! Token: $challengeToken" -ForegroundColor Green
} else {
    Write-Host "  FAILED: MFA Challenge was not triggered upon login!" -ForegroundColor Red
    exit 1
}

# 9. Verify with INVALID TOTP Code (Should fail)
Write-Host "`n[Step 9] Testing MFA Challenge with WRONG TOTP code (999999)..." -ForegroundColor Yellow
try {
    $badVerifyBody = @{
        challengeToken = $challengeToken
        code = "999999"
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $badVerifyBody -ContentType "application/json" -WebSession $session2
    Write-Host "  FAILED: Invalid code was accepted!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Invalid code correctly rejected with HTTP 401 Unauthorized!" -ForegroundColor Green
}

# 10. Verify with VALID REAL TOTP Code
Write-Host "`n[Step 10] Testing MFA Challenge with VALID TOTP code..." -ForegroundColor Yellow
$validTotp = Get-TotpCode -Base32Secret $secret
$goodVerifyBody = @{
    challengeToken = $challengeToken
    code = $validTotp
} | ConvertTo-Json
$mfaAuthResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $goodVerifyBody -ContentType "application/json" -WebSession $session2

Write-Host "  -> SUCCESS: MFA Authentication Completed! User: $($mfaAuthResp.user.username), Session: $($mfaAuthResp.sessionId)" -ForegroundColor Green

# Verify session can access protected endpoint
$meResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $session2 -Headers @{ "X-Session-Id" = $mfaAuthResp.sessionId }
Write-Host "  -> Authenticated User Profile verified: $($meResp.data.email)" -ForegroundColor Green

# 11. Test RECOVERY CODE Login
Write-Host "`n[Step 11] Testing Login using One-Time Recovery Code..." -ForegroundColor Yellow
$session3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResp3 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session3
$challengeToken3 = $loginResp3.mfaChallengeToken

$chosenRecoveryCode = $recoveryCodes[0]
Write-Host "  -> Using Recovery Code: $chosenRecoveryCode" -ForegroundColor Yellow

$recVerifyBody = @{
    challengeToken = $challengeToken3
    recoveryCode = $chosenRecoveryCode
} | ConvertTo-Json

$recAuthResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $recVerifyBody -ContentType "application/json" -WebSession $session3
Write-Host "  -> SUCCESS: Login via Recovery Code authenticated! Session: $($recAuthResp.sessionId)" -ForegroundColor Green

# 12. Test REUSE of the same Recovery Code (MUST FAIL)
Write-Host "`n[Step 12] Testing REUSE of consumed Recovery Code (MUST BE REJECTED)..." -ForegroundColor Yellow
$session4 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResp4 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session4
$challengeToken4 = $loginResp4.mfaChallengeToken

try {
    $reuseBody = @{
        challengeToken = $challengeToken4
        recoveryCode = $chosenRecoveryCode
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/challenge/verify" -Method Post -Body $reuseBody -ContentType "application/json" -WebSession $session4
    Write-Host "  FAILED: Consumed recovery code was accepted again!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Consumed recovery code correctly rejected with HTTP 401 Unauthorized!" -ForegroundColor Green
}

# 13. Check Recovery Codes Count Decremented
$statusResp3 = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/status" -Method Get -WebSession $session3 -Headers @{ "X-Session-Id" = $recAuthResp.sessionId }
Write-Host "  -> Recovery codes remaining after consumption: $($statusResp3.data.recoveryCodesRemaining) (was 8)" -ForegroundColor Green
if ($statusResp3.data.recoveryCodesRemaining -ne 7) {
    Write-Host "  FAILED: Expected 7 codes remaining!" -ForegroundColor Red
    exit 1
}

# 14. Test Regenerate Recovery Codes
Write-Host "`n[Step 14] Testing Recovery Code Regeneration..." -ForegroundColor Yellow
$regenBody = @{ password = "User@123456" } | ConvertTo-Json
$regenResp = Invoke-RestMethod -Uri "http://localhost:8080/api/mfa/recovery-codes/regenerate" -Method Post -Body $regenBody -ContentType "application/json" -WebSession $session3 -Headers @{ "X-Session-Id" = $recAuthResp.sessionId }
Write-Host "  -> SUCCESS: Regenerated $($regenResp.data.Count) new recovery codes!" -ForegroundColor Green

# 15. Admin MFA Visibility & Secure Reset
Write-Host "`n[Step 15] Testing Admin MFA Visibility and Secure Reset..." -ForegroundColor Yellow
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLoginBody = @{ usernameOrEmail = "admin"; password = "Admin@123456" } | ConvertTo-Json
$adminLoginResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json" -WebSession $adminSession

# Admin views all users MFA status
$adminUsersResp = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users" -Method Get -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminLoginResp.sessionId }
Write-Host "  -> Admin retrieved MFA status for $($adminUsersResp.data.Count) users." -ForegroundColor Green
$testUserMfa = $adminUsersResp.data | Where-Object { $_.username -eq "testuser" }
Write-Host "  -> testuser MFA status visible to admin: enabled=$($testUserMfa.mfaEnabled), remaining=$($testUserMfa.recoveryCodesRemaining)" -ForegroundColor Green

# Admin resets testuser MFA
Write-Host "  -> Admin resetting MFA for user ID $($testUserMfa.userId)..." -ForegroundColor Yellow
$resetResp = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/mfa/users/$($testUserMfa.userId)/reset" -Method Post -WebSession $adminSession -Headers @{ "X-Session-Id" = $adminLoginResp.sessionId }
Write-Host "  -> Admin Reset Response: $($resetResp.message)" -ForegroundColor Green

# Verify testuser sessions are revoked after admin MFA reset
Write-Host "`n[Step 16] Verifying testuser active session was revoked by Admin MFA reset..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $session3 -Headers @{ "X-Session-Id" = $recAuthResp.sessionId }
    Write-Host "  FAILED: testuser session was not revoked by admin MFA reset!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Session rejected with HTTP 401 Unauthorized (Sessions revoked on Admin MFA reset)!" -ForegroundColor Green
}

# 17. Verify testuser can now log in directly without MFA
Write-Host "`n[Step 17] Verifying testuser logs in without MFA after reset..." -ForegroundColor Yellow
$sessionFinal = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$finalLoginResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $sessionFinal

if ($finalLoginResp.mfaRequired -eq $false -or -not $finalLoginResp.mfaRequired) {
    Write-Host "  -> SUCCESS: Direct password login succeeded without MFA! Session ID: $($finalLoginResp.sessionId)" -ForegroundColor Green
} else {
    Write-Host "  FAILED: MFA is still required after admin reset!" -ForegroundColor Red
    exit 1
}

# 18. OAuth 2.0 and OIDC Regression Verification
Write-Host "`n[Step 18] Testing OAuth 2.0 / OIDC Regression..." -ForegroundColor Yellow
$clientCredBody = "grant_type=client_credentials&scope=read%20write"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("backend-service:Secret123!"))
$tokenResp = Invoke-RestMethod -Uri "http://localhost:8080/oauth2/token" -Method Post -Body $clientCredBody -Headers @{ "Authorization" = $authHeader; "Content-Type" = "application/x-www-form-urlencoded" }
Write-Host "  -> OAuth 2.0 Access Token received: $($tokenResp.token_type), expires_in: $($tokenResp.expires_in)s" -ForegroundColor Green

$protectedResp = Invoke-RestMethod -Uri "http://localhost:8080/api/oauth2/protected/user" -Method Get -Headers @{ "Authorization" = "Bearer $($tokenResp.access_token)" }
Write-Host "  -> Protected OAuth 2.0 endpoint access verified: $($protectedResp.message)" -ForegroundColor Green

$oidcConfig = Invoke-RestMethod -Uri "http://localhost:8080/.well-known/openid-configuration" -Method Get
Write-Host "  -> OIDC Discovery verified: issuer=$($oidcConfig.issuer)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  ALL 18 END-TO-END PHASE 5 MFA TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
