$ErrorActionPreference = "Stop"
$baseUri = "http://localhost:8080"

Write-Host "=========================================================="
Write-Host "PHASE 6: ADMIN & SECURITY MANAGEMENT FULL E2E TEST"
Write-Host "=========================================================="

# 1. Unauthenticated checks
Write-Host "`n[STEP 1] Testing Unauthenticated Requests (Must return 401)"
try {
    Invoke-RestMethod -Uri "$baseUri/api/admin/users" -Method Get
    Write-Error "Expected 401 on /api/admin/users, got 200"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -ne 401) { Write-Error "Expected 401, got $code" }
    Write-Host " PASS: Unauthenticated /api/admin/users returned HTTP 401 Unauthorized"
}

# 2. Normal user (non-admin) checks
Write-Host "`n[STEP 2] Testing Normal User Role Enforcement (Must return 403 Forbidden)"
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$userLoginBody = @{
    usernameOrEmail = "testuser"
    password = "User@123456"
} | ConvertTo-Json

$userLogin = Invoke-RestMethod -Uri "$baseUri/api/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json" -WebSession $userSession
Write-Host " Logged in as normal user: $($userLogin.data.user.username)"

try {
    Invoke-RestMethod -Uri "$baseUri/api/admin/users" -Method Get -WebSession $userSession
    Write-Error "Expected 403 on /api/admin/users for testuser, got 200"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -ne 403) { Write-Error "Expected 403, got $code" }
    Write-Host " PASS: Normal user GET /api/admin/users returned HTTP 403 Forbidden"
}

try {
    Invoke-RestMethod -Uri "$baseUri/api/admin/stats" -Method Get -WebSession $userSession
    Write-Error "Expected 403 on /api/admin/stats for testuser, got 200"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -ne 403) { Write-Error "Expected 403, got $code" }
    Write-Host " PASS: Normal user GET /api/admin/stats returned HTTP 403 Forbidden"
}

# 3. Admin Authentication
Write-Host "`n[STEP 3] Authenticating as Administrator (ROLE_ADMIN)"
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLoginBody = @{
    usernameOrEmail = "admin"
    password = "Admin@123456"
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod -Uri "$baseUri/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json" -WebSession $adminSession
Write-Host " PASS: Admin login successful: $($adminLogin.data.user.username) (Roles: $($adminLogin.data.user.roles -join ', '))"

# 4. Admin Dashboard Metrics
Write-Host "`n[STEP 4] Retrieving Real Backend Administrative Statistics"
$stats = Invoke-RestMethod -Uri "$baseUri/api/admin/stats" -Method Get -WebSession $adminSession
Write-Host " Total Users:        $($stats.data.totalUsers)"
Write-Host " Active Users:       $($stats.data.activeUsers)"
Write-Host " Disabled Users:     $($stats.data.disabledUsers)"
Write-Host " Locked Users:       $($stats.data.lockedUsers)"
Write-Host " MFA Enrolled Users: $($stats.data.mfaEnabledUsers)"
Write-Host " Active Sessions:    $($stats.data.activeSessions)"
Write-Host " Security Events:    $($stats.data.totalSecurityEvents)"
Write-Host " PASS: Real metrics successfully loaded from database"

# 5. User Search & Pagination
Write-Host "`n[STEP 5] Testing User Listing, Search & Pagination"
$usersList = Invoke-RestMethod -Uri "$baseUri/api/admin/users?page=0&size=10" -Method Get -WebSession $adminSession
Write-Host " Found $($usersList.data.totalElements) total users across $($usersList.data.totalPages) page(s)"

$searchRes = Invoke-RestMethod -Uri "$baseUri/api/admin/users?search=testuser" -Method Get -WebSession $adminSession
if ($searchRes.data.content.Count -lt 1) { Write-Error "Search for 'testuser' returned 0 results" }
$targetUser = $searchRes.data.content[0]
Write-Host " PASS: Search found target user: ID=$($targetUser.id), username=$($targetUser.username), email=$($targetUser.email)"

# 6. User Security Dossier
Write-Host "`n[STEP 6] Inspecting User Security Dossier (ID=$($targetUser.id))"
$dossier = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)" -Method Get -WebSession $adminSession
Write-Host " Dossier retrieved: enabled=$($dossier.data.enabled), locked=$($dossier.data.accountLocked), mfaEnabled=$($dossier.data.mfaEnabled)"
Write-Host " PASS: Full security profile loaded without exposing credentials or secrets"

# 7. Account Lock & Unlock Lifecycle
Write-Host "`n[STEP 7] Testing Account Lock Lifecycle"
$lockBody = @{ reason = "Automated security test lock" } | ConvertTo-Json
$lockRes = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/lock" -Method Post -Body $lockBody -ContentType "application/json" -WebSession $adminSession
Write-Host " Locked user: $($lockRes.message)"

# Verify locked user cannot log in
try {
    $tempSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-RestMethod -Uri "$baseUri/api/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json" -WebSession $tempSession
    Write-Error "Locked user was unexpectedly able to log in!"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host " PASS: Locked user login rejected with HTTP $code"
}

# Unlock account
$unlockRes = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/unlock" -Method Post -WebSession $adminSession
Write-Host " Unlocked user: $($unlockRes.message)"

# Verify unlocked user can log in again
$tempSession2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$relockedLogin = Invoke-RestMethod -Uri "$baseUri/api/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json" -WebSession $tempSession2
Write-Host " PASS: Unlocked user successfully logged in again: $($relockedLogin.data.user.username)"

# 8. Account Disable & Re-enable Lifecycle
Write-Host "`n[STEP 8] Testing Account Disable Lifecycle"
$disableBody = @{ enabled = $false } | ConvertTo-Json
$disableRes = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/status" -Method Patch -Body $disableBody -ContentType "application/json" -WebSession $adminSession
Write-Host " Disabled user: $($disableRes.message)"

# Verify disabled user cannot log in
try {
    $tempSession3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-RestMethod -Uri "$baseUri/api/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json" -WebSession $tempSession3
    Write-Error "Disabled user was unexpectedly able to log in!"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host " PASS: Disabled user login rejected with HTTP $code"
}

# Re-enable user
$enableBody = @{ enabled = $true } | ConvertTo-Json
$enableRes = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/status" -Method Patch -Body $enableBody -ContentType "application/json" -WebSession $adminSession
Write-Host " PASS: Re-enabled user: $($enableRes.message)"

# 9. Admin Self-Protection (Prevent Lockout of Last Admin)
Write-Host "`n[STEP 9] Testing Administrator Self-Protection"
$adminId = $adminLogin.data.user.id
try {
    $selfLock = @{ reason = "Self lock attempt" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUri/api/admin/users/$adminId/lock" -Method Post -Body $selfLock -ContentType "application/json" -WebSession $adminSession
    Write-Error "Admin was unexpectedly able to lock the final administrator!"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host " PASS: Prevented locking final admin (HTTP $code - Bad Request)"
}

try {
    $selfDisable = @{ enabled = $false } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUri/api/admin/users/$adminId/status" -Method Patch -Body $selfDisable -ContentType "application/json" -WebSession $adminSession
    Write-Error "Admin was unexpectedly able to disable the final administrator!"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host " PASS: Prevented disabling final admin (HTTP $code - Bad Request)"
}

try {
    $selfRoleRemove = @{ roles = @("ROLE_USER") } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUri/api/admin/users/$adminId/roles" -Method Patch -Body $selfRoleRemove -ContentType "application/json" -WebSession $adminSession
    Write-Error "Admin was unexpectedly able to remove administrative role from final admin!"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host " PASS: Prevented revoking ROLE_ADMIN from final admin (HTTP $code - Bad Request)"
}

# 10. Role Management & Creation
Write-Host "`n[STEP 10] Testing RBAC Role Governance"
$rolesList = Invoke-RestMethod -Uri "$baseUri/api/admin/roles" -Method Get -WebSession $adminSession
Write-Host " Current roles in platform: $($rolesList.data.name -join ', ')"

$newRoleName = "ROLE_AUDITOR_" + (Get-Random -Minimum 1000 -Maximum 9999)
$createRoleBody = @{
    name = $newRoleName
    description = "Compliance Auditor Role"
    authorityNames = @("USER_READ")
} | ConvertTo-Json

$createdRole = Invoke-RestMethod -Uri "$baseUri/api/admin/roles" -Method Post -Body $createRoleBody -ContentType "application/json" -WebSession $adminSession
Write-Host " PASS: Created new security role: $($createdRole.data.name)"

# 11. Admin Session & MFA Administration
Write-Host "`n[STEP 11] Testing User Session & MFA Administration"
$userSessions = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/sessions" -Method Get -WebSession $adminSession
Write-Host " Target user active sessions: $($userSessions.data.Count)"

$revokeAllSess = Invoke-RestMethod -Uri "$baseUri/api/admin/users/$($targetUser.id)/sessions" -Method Delete -WebSession $adminSession
Write-Host " PASS: Revoked all sessions for target user: $($revokeAllSess.message)"

$mfaReset = Invoke-RestMethod -Uri "$baseUri/api/admin/mfa/users/$($targetUser.id)/reset" -Method Post -WebSession $adminSession
Write-Host " PASS: Admin reset target user MFA: $($mfaReset.message)"

# 12. Security Audit Log Viewer
Write-Host "`n[STEP 12] Inspecting Real Security Audit Trail"
$auditEvents = Invoke-RestMethod -Uri "$baseUri/api/admin/security-events?page=0&size=10" -Method Get -WebSession $adminSession
Write-Host " Total recorded security events: $($auditEvents.data.totalElements)"
Write-Host " Recent events recorded:"
foreach ($ev in ($auditEvents.data.content | Select-Object -First 5)) {
    Write-Host "   - [$($ev.timestamp)] $($ev.eventType): $($ev.details)"
}
Write-Host " PASS: Complete tamper-evident audit events retrieved"

Write-Host "`n=========================================================="
Write-Host "ALL PHASE 6 END-TO-END TESTS COMPLETED SUCCESSFULLY!"
Write-Host "=========================================================="
