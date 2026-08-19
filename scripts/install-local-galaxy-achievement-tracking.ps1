param(
  [switch]$Restore,
  [ValidateSet("All", "God of War", "SILENT HILL 2")]
  [string]$TargetGame = "All"
)

$ErrorActionPreference = "Stop"

$releaseTag = "648"
$releaseRoot = "https://github.com/grasmanek94/UniverseLAN/releases/download/$releaseTag"
$centralBackupRoot = Join-Path $env:LOCALAPPDATA "JapaneseDashboard\AchievementOverlay\GalaxyBackups"

$games = @(
  @{
    Name = "God of War"
    GalaxyVersion = "1.144.1"
    Archive = "UniverseLAN-1.144.1-Build-648-x64_x86.zip"
    ArchiveSha256 = "D52664BFD94940E58DF4F33DD9F49AC20FD61EC1B107E91406C6D7717865951C"
    OriginalSha256 = "CDC1DD81E6287B169B0921C5011ADD80BCD5512D0B9E5F977E178EF16D0D924A"
    TargetDll = "C:\Users\CosmicPie\Games\God of War\Galaxy64.dll"
    BackupName = "God-of-War-Galaxy64-1.144.1.dll"
    ConfigRoot = "C:\Users\CosmicPie\Games\God of War"
    ConfigLocations = @("C:\Users\CosmicPie\Games\God of War")
    AchievementIds = @(
      "ACHIEVEMENT_1", "ACHIEVEMENT_2", "ACHIEVEMENT_3", "ACHIEVEMENT_4", "ACHIEVEMENT_5", "ACHIEVEMENT_6",
      "ACHIEVEMENT_7", "ACHIEVEMENT_8", "ACHIEVEMENT_9", "ACHIEVEMENT_10", "ACHIEVEMENT_11", "ACHIEVEMENT_12",
      "ACHIEVEMENT_13", "ACHIEVEMENT_14", "ACHIEVEMENT_15", "ACHIEVEMENT_16", "ACHIEVEMENT_17", "ACHIEVEMENT_18",
      "ACHIEVEMENT_19", "ACHIEVEMENT_20", "ACHIEVEMENT_21", "ACHIEVEMENT_22", "ACHIEVEMENT_23", "ACHIEVEMENT_24",
      "ACHIEVEMENT_25", "ACHIEVEMENT_26", "ACHIEVEMENT_27", "ACHIEVEMENT_28", "ACHIEVEMENT_29", "ACHIEVEMENT_30",
      "ACHIEVEMENT_31", "ACHIEVEMENT_32", "ACHIEVEMENT_33", "ACHIEVEMENT_34", "ACHIEVEMENT_35", "ACHIEVEMENT_36",
      "ACHIEVEMENT_ALL"
    )
  },
  @{
    Name = "SILENT HILL 2"
    GalaxyVersion = "1.152.11"
    Archive = "UniverseLAN-1.152.11-Build-648-x64_x86.zip"
    ArchiveSha256 = "4A487D75DE609734C06F33CEAA2B268929BE2707F108052B6DB95262A8052388"
    OriginalSha256 = "9A45C55D622585EC6B72BF33C5AC322F2CCC1DE2FF785AC1FC1230BD90C847D0"
    TargetDll = "C:\Users\CosmicPie\Games\Silent Hill 2\SILENT HILL 2\SHProto\Plugins\OnlineSubsystemGOG\Source\ThirdParty\GalaxySDK\Libraries\Galaxy64.dll"
    BackupName = "Silent-Hill-2-Galaxy64-1.152.10.dll"
    ConfigRoot = "C:\Users\CosmicPie\Games\Silent Hill 2\SILENT HILL 2"
    ConfigLocations = @(
      "C:\Users\CosmicPie\Games\Silent Hill 2\SILENT HILL 2",
      "C:\Users\CosmicPie\Games\Silent Hill 2\SILENT HILL 2\SHProto\Binaries\Win64",
      "C:\Users\CosmicPie\Games\Silent Hill 2\SILENT HILL 2\SHProto\Plugins\OnlineSubsystemGOG\Source\ThirdParty\GalaxySDK\Libraries"
    )
    AchievementIds = @(
      "Archivist", "CompleteNewGamePlus", "DefeatAbstractDaddy", "DefeatBossMary", "DefeatEddy", "DefeatFleshLip",
      "DefeatPyramidHead", "DefeatPyramidHeadTwins", "EndingDog", "EndingInWater", "EndingLeave", "EndingMaria",
      "EndingRebirth", "EndingUFO", "FastAsFog", "FindAllPastLocations", "FindChainsaw", "FindPhotos",
      "FindPyramindHeadRoom", "FinishEnemiesWithStomp", "FinishGameNoRangeWeapon", "InteractWithBread", "KillEnemiesMelee",
      "KillEnemiesRanged", "LongSwimInTolucaLake", "MeetMaria", "PizzaInBowling", "RadioSilence",
      "ReachBlueCreekApartments", "ReachBrookhavenHospital", "ReachLakeViewHotel", "ReachLongStaircaseEnd", "ReachRoom312",
      "ReachSilentHill", "ReachWoodsideApartments", "SeeAllCanonEndings", "SelfLoathing", "SH3Reference",
      "ShootBalloonsWoodsideApart", "SurvivePyramidHeadChase", "TryToLeaveObservationDeck", "TryToOpenClosedDoors", "UseAllWeapons"
    )
  }
)
$selectedGames = if ($TargetGame -eq "All") { $games } else { @($games | Where-Object { $_.Name -eq $TargetGame }) }

function Write-AchievementDefinitions($FilePath, $AchievementIds) {
  $lines = foreach ($id in $AchievementIds) {
    "[$id]"
    "Description ="
    "Unlocked = 0"
    "UnlockTime = 0"
    "Visible = 1"
    "VisibleWhileLocked = 1"
  }
  Set-Content -LiteralPath $FilePath -Value $lines -Encoding UTF8
}

function Restore-Game($Game) {
  $sidecarBackup = "$($Game.TargetDll).achievement-tracker-original.bak"
  $centralBackup = Join-Path $centralBackupRoot $Game.BackupName
  $backup = @($sidecarBackup, $centralBackup) | Where-Object {
    (Test-Path -LiteralPath $_) -and (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash -eq $Game.OriginalSha256
  } | Select-Object -First 1
  if (!$backup) {
    throw "$($Game.Name): neither verified original DLL backup is available; refusing to restore."
  }
  Copy-Item -LiteralPath $backup -Destination $Game.TargetDll -Force
  if ((Get-FileHash -LiteralPath $Game.TargetDll -Algorithm SHA256).Hash -ne $Game.OriginalSha256) {
    throw "$($Game.Name): the restored DLL failed verification. The verified backups were retained."
  }
  Write-Output "$($Game.Name): restored the original Galaxy64.dll. UniverseLAN data was retained."
}

if ($Restore) {
  foreach ($game in $selectedGames) { Restore-Game $game }
  exit 0
}

$downloadRoot = Join-Path $env:TEMP "achievement-tracker-universelan"
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
New-Item -ItemType Directory -Path $centralBackupRoot -Force | Out-Null

foreach ($game in $selectedGames) {
  if (!(Test-Path -LiteralPath $game.TargetDll)) {
    throw "$($game.Name): Galaxy64.dll was not found at $($game.TargetDll)"
  }

  $currentHash = (Get-FileHash -LiteralPath $game.TargetDll -Algorithm SHA256).Hash
  $backup = "$($game.TargetDll).achievement-tracker-original.bak"
  $centralBackup = Join-Path $centralBackupRoot $game.BackupName
  if ($currentHash -eq $game.OriginalSha256) {
    if (!(Test-Path -LiteralPath $backup)) {
      Copy-Item -LiteralPath $game.TargetDll -Destination $backup
    }
    if (!(Test-Path -LiteralPath $centralBackup)) {
      Copy-Item -LiteralPath $game.TargetDll -Destination $centralBackup
    }
  } elseif (!(Test-Path -LiteralPath $backup) -and !(Test-Path -LiteralPath $centralBackup)) {
    throw "$($game.Name): the installed Galaxy64.dll is not the inspected original and no safe backup exists."
  }
  foreach ($backupPath in @($backup, $centralBackup)) {
    if (!(Test-Path -LiteralPath $backupPath) -or (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash -ne $game.OriginalSha256) {
      throw "$($game.Name): original DLL backup verification failed at $backupPath"
    }
  }

  $archivePath = Join-Path $downloadRoot $game.Archive
  if (!(Test-Path -LiteralPath $archivePath) -or (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $game.ArchiveSha256) {
    Invoke-WebRequest -Uri "$releaseRoot/$($game.Archive)" -OutFile $archivePath -Headers @{ "User-Agent" = "achievement-overlay-setup" }
  }
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $game.ArchiveSha256) {
    throw "$($game.Name): the downloaded UniverseLAN archive failed its SHA-256 check."
  }

  $extractRoot = Join-Path $downloadRoot ("extract-" + [Guid]::NewGuid().ToString("N"))
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot
  Copy-Item -LiteralPath (Join-Path $extractRoot "Galaxy64.dll") -Destination $game.TargetDll -Force
  $installedHash = (Get-FileHash -LiteralPath $game.TargetDll -Algorithm SHA256).Hash
  if ($installedHash -eq $game.OriginalSha256 -or (Get-Item -LiteralPath $game.TargetDll).Length -lt 100000) {
    throw "$($game.Name): wrapper installation verification failed. Run this script with -Restore."
  }

  $dataRoot = Join-Path $game.ConfigRoot "UniverseLANData"
  New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $extractRoot "UniverseLANData\*") -Destination $dataRoot -Recurse -Force

  $configPath = Join-Path $dataRoot "Config.ini"
  $config = Get-Content -LiteralPath $configPath -Raw
  $config = $config -replace "(?m)^EnableConsole\s*=\s*1\s*$", "EnableConsole = 0"
  Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8
  Write-AchievementDefinitions (Join-Path $dataRoot "Achievements.ini") $game.AchievementIds

  foreach ($location in $game.ConfigLocations) {
    New-Item -ItemType Directory -Path $location -Force | Out-Null
    $pointer = @(
      "; Achievement tracker local Galaxy configuration",
      "[Storage]",
      "GameDataPath = $dataRoot",
      "ServerDataPath = UniverseLANServerData",
      "",
      "[Tracing]",
      "CallTracing = 0",
      "UnhandledExceptionLogging = 0"
    )
    Set-Content -LiteralPath (Join-Path $location "UniverseLAN.ini") -Value $pointer -Encoding UTF8
  }

  Write-Output "$($game.Name): installed local Galaxy $($game.GalaxyVersion) achievement capture with $($game.AchievementIds.Count) definitions."
}

Write-Output "Done. Launch each game normally; the companion will watch UniverseLANData\Achievements.ini."
