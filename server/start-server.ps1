$port = 5000

# Find any processes using the port
$conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "Port $port in use by PIDs: $($pids -join ',') - attempting to stop them"
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "Stopped PID $pid"
        } catch {
            Write-Host ("Failed to stop PID {0}: {1}" -f $pid, $_.Exception.Message)
        }
    }
} else {
    Write-Host "Port $port not in use"
}

# Ensure dependencies
if (!(Test-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) 'node_modules'))) {
    Write-Host 'Installing dependencies (npm install)...'
    Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Definition)
    npm install
    Pop-Location
} else {
    Write-Host 'node_modules already present'
}

# Start server in background
Write-Host 'Starting server (npm start) in background...'
Start-Process -NoNewWindow -FilePath 'cmd.exe' -ArgumentList '/c','npm start' -WorkingDirectory (Split-Path -Parent $MyInvocation.MyCommand.Definition)
Write-Host 'Server start command sent.'
