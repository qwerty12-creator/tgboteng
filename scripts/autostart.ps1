<#
  Автозапуск Telegram-бота YOUR ENGLISH JOURNEY (Windows).

  Действия: install | remove | status
  Запускать через setup-autostart.cmd / remove-autostart.cmd
  или: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autostart.ps1 install

  Задача планировщика "LINGO Telegram Bot" при входе в Windows запускает
  start-bot-hidden.vbs через wscript.exe //B — без окна консоли. Обёртка держит
  бота живым и перезапускает его при падении (см. комментарии в start-bot-hidden.vbs).
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('install', 'remove', 'status')]
  [string]$Action = 'status',
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$taskName = 'LINGO Telegram Bot'
$vbsPath = Join-Path $root 'start-bot-hidden.vbs'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

function Say([string]$text) { Write-Host $text }

function Get-Task {
  return Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

function Install-Autostart {
  if (-not (Test-Path $vbsPath)) {
    Say ('Не найден ' + $vbsPath)
    return 1
  }

  $action = New-ScheduledTaskAction -Execute $wscript -Argument ('//B "' + $vbsPath + '"') -WorkingDirectory $root
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  # ExecutionTimeLimit = 0: задача не должна обрываться по таймауту, бот работает постоянно.
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
  $description = 'Telegram-бот YOUR ENGLISH JOURNEY: скрытый запуск при входе в Windows с перезапуском при падении'

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $description -Force | Out-Null

  # Задача берёт на себя запуск, поэтому «хвост» прошлой ручной остановки убираем.
  $flag = Join-Path $root 'run\stop.flag'
  Remove-Item -LiteralPath $flag -Force -ErrorAction SilentlyContinue

  Say ('Автозапуск установлен: задача "' + $taskName + '"')
  Say ('  действие: ' + $wscript + ' //B "' + $vbsPath + '"')
  Say '  триггер:  вход в Windows'
  Say '  сейчас:   бот запустится при следующем входе; чтобы не ждать — Start-ScheduledTask или start-bot.cmd'
  return 0
}

function Remove-Autostart {
  $task = Get-Task
  if (-not $task) {
    Say ('Задача "' + $taskName + '" не найдена — автозапуск уже снят.')
    return 0
  }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Say ('Автозапуск снят: задача "' + $taskName + '" удалена.')
  Say 'Сам бот, если он работает, продолжает работать до stop-bot.cmd или перезагрузки.'
  return 0
}

function Get-AutostartStatus {
  $task = Get-Task
  if (-not $task) {
    Say 'Автозапуск: не настроен.'
    Say ('Установить: ' + (Join-Path $root 'setup-autostart.cmd'))
    return 0
  }
  Say ('Автозапуск: настроен, задача "' + $taskName + '" (' + $task.State + ')')
  foreach ($t in $task.Triggers) {
    Say ('  триггер: ' + $t.CimClass.CimClassName + ' enabled=' + $t.Enabled)
  }
  foreach ($a in $task.Actions) {
    Say ('  действие: ' + $a.Execute + ' ' + $a.Arguments)
  }
  Say ('  лимит времени: ' + $task.Settings.ExecutionTimeLimit)
  return 0
}

$code = 0
switch ($Action) {
  'install' { $code = Install-Autostart }
  'remove' { $code = Remove-Autostart }
  'status' { $code = Get-AutostartStatus }
}
exit $code
