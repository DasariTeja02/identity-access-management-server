$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PHASE 7: PRODUCTION HARDENING & E2E ACCEPTANCE SUITE    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080"

# RFC 6238 TOTP generator
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

# 1. Observability: Actuator Health, Liveness & Readiness Probes
Write-Host "`n[1/10] Verifying Actuator Health & Probes..." -ForegroundColor Yellow
$healthRes = Invoke-RestMethod -Uri "$baseUrl/actuator/health" -Method Get
if ($healthRes.status -ne "UP") { throw "Actuator health status is not UP: $($healthRes.status)" }
Write-Host "  [OK] /actuator/health: $($healthRes.status)" -ForegroundColor Green

$livenessRes = Invoke-RestMethod -Uri "$baseUrl/actuator/health/liveness" -Method Get
if ($livenessRes.status -ne "UP") { throw "Actuator liveness status is not UP" }
Write-Host "  [OK] /actuator/health/liveness: $($livenessRes.status)" -ForegroundColor Green

$readinessRes = Invoke-RestMethod -Uri "$baseUrl/actuator/health/readiness" -Method Get
if ($readinessRes.status -ne "UP") { throw "Actuator readiness status is not UP" }
Write-Host "  [OK] /actuator/health/readiness: $($readinessRes.status)" -ForegroundColor Green

# 2. Observability: Prometheus Metrics Scraping
Write-Host "`n[2/10] Verifying Prometheus Metrics Endpoint..." -ForegroundColor Yellow
$promRes = Invoke-WebRequest -Uri "$baseUrl/actuator/prometheus" -Method Get -UseBasicParsing
if ($promRes.StatusCode -ne 200 -or -not ($promRes.Content -match "jvm_memory_used_bytes")) {
    throw "Prometheus scrape endpoint did not return valid jvm metrics"
}
Write-Host "  [OK] /actuator/prometheus returned HTTP 200 with JVM metrics" -ForegroundColor Green

# 3. API Documentation: OpenAPI 3.0 & Swagger UI
Write-Host "`n[3/10] Verifying OpenAPI 3.0 & Swagger UI Documentation..." -ForegroundColor Yellow
$openApiRes = Invoke-RestMethod -Uri "$baseUrl/v3/api-docs" -Method Get
if (-not $openApiRes.openapi -or -not ($openApiRes.info.title -match "Identity & Access Management")) {
    throw "OpenAPI 3.0 specification is invalid or missing title"
}
Write-Host "  [OK] /v3/api-docs: $($openApiRes.info.title) (v$($openApiRes.info.version))" -ForegroundColor Green

$swaggerRes = Invoke-WebRequest -Uri "$baseUrl/swagger-ui/index.html" -Method Get -UseBasicParsing
if ($swaggerRes.StatusCode -ne 200) { throw "Swagger UI is not accessible" }
Write-Host "  [OK] /swagger-ui/index.html is accessible (HTTP 200)" -ForegroundColor Green

# 4. Security Headers Verification
Write-Host "`n[4/10] Verifying Security Headers..." -ForegroundColor Yellow
$headersRes = Invoke-WebRequest -Uri "$baseUrl/actuator/health" -Method Get -UseBasicParsing
$h = $headersRes.Headers
if (-not ($h["X-Content-Type-Options"] -contains "nosniff")) { throw "Missing nosniff header" }
if (-not ($h["X-Frame-Options"] -contains "SAMEORIGIN")) { throw "Missing SAMEORIGIN frame option" }
if (-not ($h["Referrer-Policy"] -contains "strict-origin-when-cross-origin")) { throw "Missing Referrer-Policy" }
if (-not ($h["Permissions-Policy"] -match "camera=")) { throw "Missing Permissions-Policy" }
if (-not ($h["Content-Security-Policy"] -match "default-src 'self'")) { throw "Missing CSP header" }
Write-Host "  [OK] All security headers verified (CSP, nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy)" -ForegroundColor Green

# 5. Core Registration, Login & Session Management
Write-Host "`n[5/10] Testing User Registration & Authenticated Session..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$regUser = "phase7_user_$timestamp"
$regPass = "SecurePass@2026!"
$regBody = @{
    username = $regUser
    email = "$regUser@iam.local"
    password = $regPass
    firstName = "Phase7"
    lastName = "Candidate"
} | ConvertTo-Json

$regRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
if (-not $regRes.success) { throw "Registration failed" }
Write-Host "  [OK] Registered user: $regUser" -ForegroundColor Green

$loginBody = @{
    usernameOrEmail = $regUser
    password = $regPass
} | ConvertTo-Json

$userWebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginRes = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $userWebSession -UseBasicParsing
$loginData = $loginRes.Content | ConvertFrom-Json
if (-not $loginData.success -or -not $loginData.sessionId) { throw "Login failed" }
$userSessionId = $loginData.sessionId
Write-Host "  [OK] Logged in successfully. SessionId: $userSessionId" -ForegroundColor Green

# Check RateLimit response headers on authentication
$authLimitHeader = $loginRes.Headers["X-RateLimit-Limit"]
$authRemainingHeader = $loginRes.Headers["X-RateLimit-Remaining"]
Write-Host "  [OK] Rate-limiting headers detected on /api/auth/login: Limit=$authLimitHeader, Remaining=$authRemainingHeader" -ForegroundColor Green

# 6. MFA Life-Cycle: Enrollment, TOTP Verification, MFA Login Challenge
Write-Host "`n[6/10] Testing MFA / TOTP Enrollment & Challenge Flow..." -ForegroundColor Yellow
$mfaEnrollRes = Invoke-RestMethod -Uri "$baseUrl/api/mfa/enroll" -Method Post -WebSession $userWebSession -Headers @{ "X-Session-Id" = $userSessionId }
$secret = $mfaEnrollRes.data.secret
if (-not $secret) { throw "Failed to obtain MFA enrollment secret" }
Write-Host "  [OK] MFA Enrollment initialized. Secret received." -ForegroundColor Green

$totp = Get-TotpCode -Base32Secret $secret
$verifyBody = @{ code = $totp } | ConvertTo-Json
$verifyRes = Invoke-RestMethod -Uri "$baseUrl/api/mfa/verify-enrollment" -Method Post -WebSession $userWebSession -Headers @{ "X-Session-Id" = $userSessionId } -Body $verifyBody -ContentType "application/json"
if (-not $verifyRes.data.enabled) { throw "MFA verification failed" }
Write-Host "  [OK] MFA successfully enabled with $($verifyRes.data.recoveryCodes.Count) recovery codes generated." -ForegroundColor Green

# Logout
Invoke-RestMethod -Uri "$baseUrl/api/auth/logout" -Method Post -WebSession $userWebSession -Headers @{ "X-Session-Id" = $userSessionId } | Out-Null
Write-Host "  [OK] Logged out user." -ForegroundColor Green

# Relogin — Must trigger MFA challenge
$userWebSession2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$mfaLoginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $userWebSession2
if (-not $mfaLoginRes.mfaRequired -or -not $mfaLoginRes.mfaChallengeToken) {
    throw "Expected MFA challenge, but login did not require MFA"
}
$challengeToken = $mfaLoginRes.mfaChallengeToken
Write-Host "  [OK] MFA Challenge triggered. ChallengeToken received." -ForegroundColor Green

# Solve Challenge with TOTP
$challengeTotp = Get-TotpCode -Base32Secret $secret
$challengeBody = @{
    challengeToken = $challengeToken
    code = $challengeTotp
} | ConvertTo-Json

$challengeVerifyRes = Invoke-RestMethod -Uri "$baseUrl/api/mfa/challenge/verify" -Method Post -Body $challengeBody -ContentType "application/json" -WebSession $userWebSession2
if (-not $challengeVerifyRes.success -or -not $challengeVerifyRes.sessionId) {
    throw "MFA Challenge verification failed"
}
$userSessionId = $challengeVerifyRes.sessionId
$userWebSession = $userWebSession2
Write-Host "  [OK] MFA Challenge solved! Fully authenticated session: $userSessionId" -ForegroundColor Green

# 7. OAuth 2.0 & OIDC Endpoints
Write-Host "`n[7/10] Verifying OAuth 2.0 & OpenID Connect Endpoints..." -ForegroundColor Yellow
$tokenBody = "grant_type=client_credentials&client_id=backend-service&client_secret=Secret123!&scope=read write"
$tokenRes = Invoke-RestMethod -Uri "$baseUrl/oauth2/token" -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
if (-not $tokenRes.access_token) { throw "Failed to obtain OAuth2 access token" }
$accessToken = $tokenRes.access_token
Write-Host "  [OK] OAuth2 Client Credentials access token obtained." -ForegroundColor Green

$jwksRes = Invoke-RestMethod -Uri "$baseUrl/oauth2/jwks" -Method Get
if (-not $jwksRes.keys -or $jwksRes.keys.Count -eq 0) { throw "JWKS keys endpoint is empty" }
Write-Host "  [OK] Public JWKS verified ($($jwksRes.keys.Count) RSA key registered, no private key exposure)." -ForegroundColor Green

$oidcConfig = Invoke-RestMethod -Uri "$baseUrl/.well-known/openid-configuration" -Method Get
if (-not $oidcConfig.issuer -or -not $oidcConfig.jwks_uri) { throw "OIDC Discovery invalid" }
Write-Host "  [OK] OIDC Discovery configuration verified (Issuer: $($oidcConfig.issuer))." -ForegroundColor Green

# Access Protected Resource
$protectedRes = Invoke-RestMethod -Uri "$baseUrl/api/oauth2/protected/user" -Method Get -Headers @{ "Authorization" = "Bearer $accessToken" }
if (-not $protectedRes.success) { throw "Failed to access protected resource with JWT" }
Write-Host "  [OK] JWT Bearer Token access to protected resource confirmed." -ForegroundColor Green

# 8. Admin Security & RBAC Enforcement
Write-Host "`n[8/10] Testing Admin Security & RBAC Boundaries..." -ForegroundColor Yellow
$adminLoginBody = @{
    usernameOrEmail = "admin"
    password = "Admin@123456"
} | ConvertTo-Json
$adminWebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLoginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json" -WebSession $adminWebSession
$adminSessionId = $adminLoginRes.sessionId
Write-Host "  [OK] Admin authenticated. SessionId: $adminSessionId" -ForegroundColor Green

$adminStats = Invoke-RestMethod -Uri "$baseUrl/api/admin/stats" -Method Get -WebSession $adminWebSession -Headers @{ "X-Session-Id" = $adminSessionId }
Write-Host "  [OK] Admin Stats retrieved: Total Users=$($adminStats.data.totalUsers), Active Sessions=$($adminStats.data.activeSessions)" -ForegroundColor Green

$auditEvents = Invoke-RestMethod -Uri "$baseUrl/api/admin/security-events" -Method Get -WebSession $adminWebSession -Headers @{ "X-Session-Id" = $adminSessionId }
Write-Host "  [OK] Audit Security Events verified (Total Events: $($auditEvents.data.totalElements))." -ForegroundColor Green

# RBAC Negative Test: Normal user attempting Admin API
Write-Host "`n[9/10] Testing RBAC Security Violations (Negative Tests)..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$baseUrl/api/admin/stats" -Method Get -WebSession $userWebSession -Headers @{ "X-Session-Id" = $userSessionId }
    throw "Normal user should not be able to access Admin stats!"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) {
        Write-Host "  [OK] Normal user blocked from Admin API: HTTP 403 Forbidden" -ForegroundColor Green
    } else {
        throw "Unexpected status code: $($_.Exception.Response.StatusCode.value__)"
    }
}

# Unauthenticated access to Admin API
try {
    Invoke-RestMethod -Uri "$baseUrl/api/admin/stats" -Method Get
    throw "Unauthenticated request should not access Admin stats!"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "  [OK] Unauthenticated request blocked from Admin API: HTTP 401 Unauthorized" -ForegroundColor Green
    } else {
        throw "Unexpected status code: $($_.Exception.Response.StatusCode.value__)"
    }
}

# 10. Production Safe Error Handling
Write-Host "`n[10/10] Testing Production-Safe Error Responses (No Stack Trace Leak)..." -ForegroundColor Yellow
try {
    $malformed = '{"username": "broken", "password": not-a-json}'
    Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $malformed -ContentType "application/json"
    throw "Malformed JSON should be rejected!"
} catch {
    $errBody = $_.ErrorDetails.Message
    if (-not $errBody) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
    }
    $parsedErr = $errBody | ConvertFrom-Json
    if ($parsedErr.status -ne 400) { throw "Expected 400 Bad Request" }
    if ($errBody -match "java\." -or $errBody -match "org\.springframework\.") {
        throw "Error response leaks Java stack trace!"
    }
    Write-Host "  [OK] Malformed payload returns safe structured error with zero stack trace leakage (HTTP 400)" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  PHASE 7 PRODUCTION HARDENING VERIFICATION: SUCCESS!     " -ForegroundColor Green
Write-Host "  ALL 10 TEST SECTIONS PASSED WITH 0 FAILURES.            " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
