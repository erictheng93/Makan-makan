# Quick SQL Verification Script

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  SQL Files Verification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$MIGRATIONS_DIR = "packages\database\migrations_v2"

Write-Host "[1/2] Checking SQL files..." -ForegroundColor Yellow

$migrations = Get-ChildItem -Path $MIGRATIONS_DIR -Filter "*.sql" | Sort-Object Name

$validCount = 0

foreach ($file in $migrations) {
    Write-Host "  Checking: $($file.Name)" -ForegroundColor Cyan

    $content = Get-Content $file.FullName -Raw

    $hasCreateTable = $content -match "CREATE TABLE"
    $hasSemicolons = $content -match ";"

    if ($hasCreateTable -and $hasSemicolons) {
        Write-Host "    OK" -ForegroundColor Green
        $validCount++
    } else {
        Write-Host "    FAIL" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Result: $validCount/$($migrations.Count) files validated" -ForegroundColor Green
Write-Host ""

Write-Host "[2/2] Counting SQL objects..." -ForegroundColor Yellow

$totalTables = 0
$totalIndexes = 0
$totalViews = 0
$totalTriggers = 0

foreach ($file in $migrations) {
    $content = Get-Content $file.FullName -Raw

    $tables = ([regex]::Matches($content, "CREATE TABLE IF NOT EXISTS")).Count
    $indexes = ([regex]::Matches($content, "CREATE INDEX")).Count
    $views = ([regex]::Matches($content, "CREATE VIEW")).Count
    $triggers = ([regex]::Matches($content, "CREATE TRIGGER")).Count

    $totalTables += $tables
    $totalIndexes += $indexes
    $totalViews += $views
    $totalTriggers += $triggers

    Write-Host "  $($file.Name): Tables=$tables Indexes=$indexes Views=$views Triggers=$triggers" -ForegroundColor White
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "Total Summary:" -ForegroundColor Green
Write-Host "  Tables:   $totalTables" -ForegroundColor White
Write-Host "  Indexes:  $totalIndexes" -ForegroundColor White
Write-Host "  Views:    $totalViews" -ForegroundColor White
Write-Host "  Triggers: $totalTriggers" -ForegroundColor White
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

if ($validCount -eq $migrations.Count -and $totalTables -gt 0) {
    Write-Host "SUCCESS! All SQL files look good." -ForegroundColor Green
    Write-Host ""
    Write-Host "Expected totals:" -ForegroundColor Yellow
    Write-Host "  Tables:   67" -ForegroundColor White
    Write-Host "  Indexes:  461" -ForegroundColor White
    Write-Host "  Views:    60" -ForegroundColor White
    Write-Host "  Triggers: 108" -ForegroundColor White
    Write-Host ""

    $tablesMatch = $totalTables -eq 67
    $indexesMatch = $totalIndexes -eq 461
    $viewsMatch = $totalViews -eq 60
    $triggersMatch = $totalTriggers -eq 108

    Write-Host "Validation:" -ForegroundColor Yellow
    Write-Host "  Tables:   $(if ($tablesMatch) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($tablesMatch) { 'Green' } else { 'Red' })
    Write-Host "  Indexes:  $(if ($indexesMatch) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($indexesMatch) { 'Green' } else { 'Red' })
    Write-Host "  Views:    $(if ($viewsMatch) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($viewsMatch) { 'Green' } else { 'Red' })
    Write-Host "  Triggers: $(if ($triggersMatch) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($triggersMatch) { 'Green' } else { 'Red' })
} else {
    Write-Host "WARNING: Issues found in SQL files" -ForegroundColor Yellow
}

Write-Host ""
