$ErrorActionPreference = "Stop"

Write-Host "=== TEST 1: Unauthenticated Admin Endpoint Access ==="
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/users" -Method Get
    Write-Host "FAILED: Expected 401, got 200"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host "SUCCESS: Got HTTP $code (Expected 401)"
}

Write-Host "`n=== TEST 2: Normal User (testuser) Admin Endpoint Access ==="
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{
    usernameOrEmail = "testuser"
    password = "User@123456"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $userSession
Write-Host "Logged in as testuser: $($loginRes.data.user.username)"

try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/users" -Method Get -WebSession $userSession
    Write-Host "FAILED: Expected 403, got 200"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Write-Host "SUCCESS: Got HTTP $code (Expected 403 Forbidden)"
}

Write-Host "`n=== TEST 3: Admin (admin) Admin Endpoint Access ==="
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$adminLoginBody = @{
    usernameOrEmail = "admin"
    password = "Admin@123456"
} | ConvertTo-Json

$adminLoginRes = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json" -WebSession $adminSession
Write-Host "Logged in as admin: $($adminLoginRes.data.user.username)"

$adminRes = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/users" -Method Get -WebSession $adminSession
Write-Host "SUCCESS: Admin retrieved users count: $($adminRes.data.content.Count)"

$statsRes = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/stats" -Method Get -WebSession $adminSession
Write-Host "SUCCESS: Admin stats retrieved: Total Users=$($statsRes.data.totalUsers), Active Users=$($statsRes.data.activeUsers), Locked Users=$($statsRes.data.lockedUsers)"

$rolesRes = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/roles" -Method Get -WebSession $adminSession
Write-Host "SUCCESS: Admin roles retrieved: $($rolesRes.data.Count) roles"

$eventsRes = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/security-events" -Method Get -WebSession $adminSession
Write-Host "SUCCESS: Admin security events retrieved: $($eventsRes.data.content.Count) events"
