while( -not (Test-Path -Path .\*ERRORS.txt) ) {
    echo "Waiting for .\*ERRORS.txt file..."
    $waitCounter = 0
    while( -not (Test-Path -Path .\*ERRORS.txt) -and ($waitCounter -lt 60 )) {
        Start-Sleep -Milliseconds 500
        $waitCounter ++
    }
}
Get-Content .\*ERRORS.txt -Wait -tail 1