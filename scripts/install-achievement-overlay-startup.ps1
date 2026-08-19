param([switch]$Remove)

$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Japanese Dashboard Achievement Overlay.lnk"

if ($Remove) {
  if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath
    Write-Output "Removed the achievement overlay from Windows startup."
  } else {
    Write-Output "The achievement overlay is not installed in Windows startup."
  }
  exit 0
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot "run-achievement-overlay.vbs"
$wscriptPath = Join-Path $env:WINDIR "System32\wscript.exe"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscriptPath
$shortcut.Arguments = "`"$launcherPath`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Start the Japanese Dashboard in-game achievement overlay"
$shortcut.Save()

Write-Output "Installed the achievement overlay in Windows startup."
