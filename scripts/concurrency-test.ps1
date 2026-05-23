# Concurrent reservation test
# Fires two requests at the exact same time targeting the last unit of SoundWave at Mumbai.
# Exactly ONE must succeed (201) and the other must fail (409).

$productId  = "10000000-0000-0000-0000-000000000004"
$warehouseId = "00000000-0000-0000-0000-000000000001"
$url = "http://localhost:3000/api/reservations"

$body = @{
    productId   = $productId
    warehouseId = $warehouseId
    quantity    = 1
} | ConvertTo-Json

Write-Output "=== Firing 2 concurrent requests for 1 remaining unit ==="
Write-Output "Target: SoundWave Pro Headphones @ Mumbai Central (1 unit)"
Write-Output ""

# Launch both as background jobs so they run in parallel
$job1 = Start-Job -ScriptBlock {
    param($url, $body)
    try {
        $r = Invoke-WebRequest $url -Method POST -ContentType "application/json" `
             -Body $body -Headers @{"Idempotency-Key"="race-A-$(Get-Random)"} `
             -UseBasicParsing -ErrorAction Stop
        return "JOB-A: $($r.StatusCode) — $($r.Content)"
    } catch {
        $s = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($s)
        return "JOB-A: $($_.Exception.Response.StatusCode.value__) — $($reader.ReadToEnd())"
    }
} -ArgumentList $url, $body

$job2 = Start-Job -ScriptBlock {
    param($url, $body)
    try {
        $r = Invoke-WebRequest $url -Method POST -ContentType "application/json" `
             -Body $body -Headers @{"Idempotency-Key"="race-B-$(Get-Random)"} `
             -UseBasicParsing -ErrorAction Stop
        return "JOB-B: $($r.StatusCode) — $($r.Content)"
    } catch {
        $s = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($s)
        return "JOB-B: $($_.Exception.Response.StatusCode.value__) — $($reader.ReadToEnd())"
    }
} -ArgumentList $url, $body

# Wait for both to finish
$results = Wait-Job $job1, $job2 | Receive-Job
Remove-Job $job1, $job2

Write-Output $results[0]
Write-Output $results[1]

# Count outcomes
$s201 = ($results | Where-Object { $_ -like "*201*" }).Count
$s409 = ($results | Where-Object { $_ -like "*409*" }).Count

Write-Output ""
Write-Output "=== RESULT ==="
Write-Output "201 (success): $s201"
Write-Output "409 (conflict): $s409"

if ($s201 -eq 1 -and $s409 -eq 1) {
    Write-Output "CONCURRENCY TEST: PASSED ✅ — exactly 1 succeeded, 1 rejected"
} elseif ($s201 -eq 2) {
    Write-Output "CONCURRENCY TEST: FAILED ❌ — BOTH succeeded (oversell!)"
} elseif ($s409 -eq 2) {
    Write-Output "CONCURRENCY TEST: UNEXPECTED — both failed"
} else {
    Write-Output "CONCURRENCY TEST: UNEXPECTED — $s201 succeeded, $s409 failed"
}
