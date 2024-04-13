while( -not (Test-Path -Path .\*DEBUG.txt) ) {
    echo "Waiting for .\*DEBUG.txt file..."
    $waitCounter = 0
    while( -not (Test-Path -Path .\*DEBUG.txt) -and ($waitCounter -lt 60 )) {
        Start-Sleep -Milliseconds 500
        $waitCounter ++
    }
}
Get-Content .\*DEBUG.txt -Wait -tail 1