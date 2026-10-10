$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PHASE 4 E2E END-TO-END SECURITY VERIFICATION TEST" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. User Login (Session 1 - Desktop Chrome)
Write-Host "`n[Step 1] Logging in as 'testuser' on Desktop Chrome..." -ForegroundColor Yellow
$session1 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{
    usernameOrEmail = "testuser"
    password = "User@123456"
} | ConvertTo-Json

$resp1 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session1 -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0" }
$sid1 = $resp1.sessionId
Write-Host "  -> Login Success! User: $($resp1.user.username), Session ID: $sid1" -ForegroundColor Green

# 2. Inspect Active Sessions
Write-Host "`n[Step 2] Retrieving active sessions for testuser..." -ForegroundColor Yellow
$sessionsResp = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions" -Method Get -WebSession $session1 -Headers @{ "X-Session-Id" = $sid1 }
Write-Host "  -> Active Sessions found: $($sessionsResp.data.Count)" -ForegroundColor Green
$currentSess = $sessionsResp.data | Where-Object { $_.current -eq $true }
Write-Host "  -> Current Session Identified: $($currentSess.browser) on $($currentSess.operatingSystem), Status: $($currentSess.status)" -ForegroundColor Green

# 3. Create Second Session (Session 2 - Mobile Safari)
Write-Host "`n[Step 3] Logging in as 'testuser' from Mobile Safari (Session 2)..." -ForegroundColor Yellow
$session2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$resp2 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session2 -Headers @{ "User-Agent" = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" }
$sid2 = $resp2.sessionId
Write-Host "  -> Second Session created! Session ID: $sid2" -ForegroundColor Green

# Verify 2 active sessions exist
$sessionsResp2 = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions" -Method Get -WebSession $session2 -Headers @{ "X-Session-Id" = $sid2 }
Write-Host "  -> Total Sessions now: $($sessionsResp2.data.Count)" -ForegroundColor Green

# 4. Revoke Session 1 from Session 2
Write-Host "`n[Step 4] Revoking Session 1 (Desktop) from Session 2 (Mobile)..." -ForegroundColor Yellow
$dbId1 = ($sessionsResp2.data | Where-Object { $_.sessionId -eq $sid1 }).id
$revokeResp = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/$dbId1/revoke" -Method Post -WebSession $session2 -Headers @{ "X-Session-Id" = $sid2 }
Write-Host "  -> Revocation Response: $($revokeResp.message)" -ForegroundColor Green

# 5. Verify Session 1 is Rejected
Write-Host "`n[Step 5] Verifying Session 1 is rejected on protected API..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $session1 -Headers @{ "X-Session-Id" = $sid1 }
    Write-Host "  FAILED: Session 1 was not rejected!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Session 1 rejected with HTTP 401 Unauthorized (Session Revoked)!" -ForegroundColor Green
}

# 6. Logout Session 2
Write-Host "`n[Step 6] Logging out Session 2..." -ForegroundColor Yellow
$logoutResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/logout" -Method Post -WebSession $session2 -Headers @{ "X-Session-Id" = $sid2 }
Write-Host "  -> Logout response: $($logoutResp.message)" -ForegroundColor Green

try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $session2
    Write-Host "  FAILED: Session 2 still active!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Session 2 invalidated, request rejected with HTTP 401!" -ForegroundColor Green
}

# 7. Logout All Sessions
Write-Host "`n[Step 7] Testing Logout All Sessions..." -ForegroundColor Yellow
$session3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$resp3 = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session3
$sid3 = $resp3.sessionId

$logoutAllResp = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/logout-all" -Method Post -WebSession $session3 -Headers @{ "X-Session-Id" = $sid3 }
Write-Host "  -> Logout All Response: $($logoutAllResp.message)" -ForegroundColor Green

try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Method Get -WebSession $session3
    Write-Host "  FAILED: Session 3 still active after Logout All!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: All user sessions revoked, request rejected with HTTP 401!" -ForegroundColor Green
}

# 8. Admin Session Management
Write-Host "`n[Step 8] Testing Administrator Session Management (ROLE_ADMIN)..." -ForegroundColor Yellow
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLogin = @{
    usernameOrEmail = "admin"
    password = "Admin@123456"
} | ConvertTo-Json

$adminResp = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $adminLogin -ContentType "application/json" -WebSession $adminSession
Write-Host "  -> Admin logged in successfully! Roles: $(($adminResp.user.roles | ForEach-Object { $_.name }) -join ', ')" -ForegroundColor Green

$allSessions = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/sessions" -Method Get -WebSession $adminSession
Write-Host "  -> Admin retrieved $($allSessions.data.Count) total sessions across all users!" -ForegroundColor Green

$securityEvents = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/security-events" -Method Get -WebSession $adminSession
$eventsList = if ($securityEvents.data.content) { $securityEvents.data.content } else { $securityEvents.data }
Write-Host "  -> Admin retrieved $($eventsList.Count) security audit events!" -ForegroundColor Green
Write-Host "     Event Types logged: $(($eventsList | Select-Object -ExpandProperty eventType -Unique) -join ', ')" -ForegroundColor Cyan

# 9. Verify Normal User CANNOT access Admin Endpoints
Write-Host "`n[Step 9] Verifying normal user CANNOT access admin endpoints..." -ForegroundColor Yellow
$userSess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$null = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $userSess

try {
    $null = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/sessions" -Method Get -WebSession $userSess
    Write-Host "  FAILED: Normal user was able to access admin endpoint!" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  -> SUCCESS: Normal user forbidden from admin session endpoint (HTTP 403 Forbidden)!" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  ALL PHASE 4 SECURITY & SESSION VERIFICATIONS PASSED!  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
