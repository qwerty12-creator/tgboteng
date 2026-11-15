<#
  Управление ботом YOUR ENGLISH JOURNEY (Windows).

  Действия: start | stop | restart | status | shortcuts
  Запускать через start-bot.cmd / stop-bot.cmd / status-bot.cmd
  или: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 start
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status', 'shortcuts')]
  [string]$Action = 'status',
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root 'run'
$logDir = Join-Path $root 'logs'
$pidFile = Join-Path $runDir 'bot.pid'
$outLog = Join-Path $logDir 'bot.out.log'
$errLog = Join-Path $logDir 'bot.err.log'
$entry = 'src/index.js'
$maxLogBytes = 5MB
$stopFlag = Join-Path $runDir 'stop.flag'
$taskName = 'LINGO Telegram Bot'

function Say([string]$text) { Write-Host $text }

function Ensure-Dirs {
  if (-not (Test-Path $runDir)) { New-Item -ItemType Directory -Path $runDir | Out-Null }
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
}

function Test-Token {
  $envFile = Join-Path $root '.env'
  if (-not (Test-Path $envFile)) { return $false }
  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*BOT_TOKEN\s*=\s*\S' }
  return [bool]$line
}

function Get-BotProcess {
  # WMI на этой машине не работает (Win32_Process пуст, CommandLine не прочитать),
  # поэтому единственный достоверный источник — run\bot.pid, который пишет сам бот.
  if (Test-Path $pidFile) {
    $text = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($text -match '^\d+$') {
      $proc = Get-Process -Id ([int]$text) -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq 'node') { return $proc }
    }
  }
  return $null
}

function Wait-BotProcess([int]$tries = 60) {
  for ($i = 0; $i -lt $tries; $i++) {
    Start-Sleep -Milliseconds 500
    $proc = Get-BotProcess
    if ($proc) { return $proc }
  }
  return $null
}

function Get-AutostartLine {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($task) { return ('Автозапуск: настроен (задача "' + $taskName + '", ' + $task.State + ')') }
  return 'Автозапуск: не настроен (setup-autostart.cmd)'
}

function Rotate-Logs {
  foreach ($file in @($outLog, $errLog)) {
    if (Test-Path $file) {
      if ((Get-Item $file).Length -gt $maxLogBytes) {
        $old = [System.IO.Path]::ChangeExtension($file, '.old.log')
        Move-Item -LiteralPath $file -Destination $old -Force
      }
    }
  }
}

function Start-Bot {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Say 'Node.js не найден в PATH. Установи Node.js 22+ и повтори.'
    return 1
  }
  if (-not (Test-Token)) {
    Say 'В .env нет BOT_TOKEN. Открой .env и вставь токен от @BotFather.'
    return 1
  }
  $existing = Get-BotProcess
  if ($existing) {
    Set-Content -LiteralPath $pidFile -Value $existing.Id -Encoding ascii
    Say ('Бот уже запущен, PID ' + $existing.Id + '. Для перезапуска: stop, затем start.')
    return 0
  }
  Ensure-Dirs
  # Ручная остановка оставила флаг для обёртки автозапуска — запуск снимает его.
  Remove-Item -LiteralPath $stopFlag -Force -ErrorAction SilentlyContinue

  # Если автозапуск установлен, бота поднимает планировщик вместе с обёрткой:
  # иначе после stop/start перезапуск при падении пропал бы до следующего входа в Windows.
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Start-ScheduledTask -TaskName $taskName
    $proc = Wait-BotProcess
    if (-not $proc) {
      Say 'Задача автозапуска есть, но бот не поднялся за 30 секунд.'
      if (Test-Path $errLog) { Get-Content -Encoding UTF8 $errLog -Tail 15 | ForEach-Object { Say ('  ' + $_) } }
      return 1
    }
    Set-Content -LiteralPath $pidFile -Value $proc.Id -Encoding ascii
    Say ('Бот запущен через задачу "' + $taskName + '" без окна. PID ' + $proc.Id)
    if (Test-Path $outLog) { Get-Content -Encoding UTF8 $outLog -Tail 3 | ForEach-Object { Say ('  ' + $_) } }
    Say ('Логи: ' + $outLog)
    return 0
  }
  Rotate-Logs
  # Старый PID мог остаться от прошлого запуска — убираем, чтобы не принять чужой процесс за бота.
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  # Запуск без окна: cmd с CREATE_NO_WINDOW, вывод пишется в файлы имён через переменные окружения
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = '/c node ' + $entry + ' >> "%LINGO_OUT%" 2>> "%LINGO_ERR%"'
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables['LINGO_OUT'] = $outLog
  $psi.EnvironmentVariables['LINGO_ERR'] = $errLog
  $launcher = [System.Diagnostics.Process]::Start($psi)
  # PID берём из run\bot.pid: его пишет сам бот, WMI для этого не нужен.
  $proc = Wait-BotProcess
  if (-not $proc) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Say 'Бот не поднялся за 30 секунд.'
    if (Test-Path $errLog) { Get-Content -Encoding UTF8 $errLog -Tail 15 | ForEach-Object { Say ('  ' + $_) } }
    return 1
  }
  Set-Content -LiteralPath $pidFile -Value $proc.Id -Encoding ascii
  Say ('Бот запущен без окна. PID ' + $proc.Id)
  if (Test-Path $outLog) { Get-Content -Encoding UTF8 $outLog -Tail 3 | ForEach-Object { Say ('  ' + $_) } }
  Say ('Логи: ' + $outLog)
  return 0
}

function Stop-Bot {
  $proc = Get-BotProcess
  if (-not $proc) {
    if (Test-Path $pidFile) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
    Say 'Бот не запущен.'
    return 0
  }
  # Флаг для обёртки автозапуска: остановка намеренная, поднимать бота обратно не нужно.
  Set-Content -LiteralPath $stopFlag -Value ([DateTime]::Now.ToString('s')) -Encoding ascii
  $botPid = $proc.Id
  try {
    Stop-Process -Id $botPid -Force -ErrorAction Stop
  } catch {
    Say ('Не удалось остановить PID ' + $botPid + ': ' + $_.Exception.Message)
    return 1
  }
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (-not (Get-Process -Id $botPid -ErrorAction SilentlyContinue)) { break }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  # Без автозапуска флаг никому не нужен и только мешал бы следующему старту.
  if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $stopFlag -Force -ErrorAction SilentlyContinue
  }
  Say ('Бот остановлен (PID ' + $botPid + ').')
  return 0
}

function Get-Status {
  $proc = Get-BotProcess
  if (-not $proc) {
    Say 'Статус: остановлен.'
    Say (Get-AutostartLine)
    return 0
  }
  Say ('Статус: работает, PID ' + $proc.Id)
  Say ('Запущен: ' + $proc.StartTime.ToString('dd.MM.yyyy HH:mm:ss'))
  Say ('Память: ' + [math]::Round($proc.WorkingSet64 / 1MB, 1) + ' МБ')
  Say (Get-AutostartLine)
  if (Test-Path $errLog) {
    $errors = @(Get-Content -Encoding UTF8 $errLog -ErrorAction SilentlyContinue)
    Say ('Строк ошибок в логе: ' + $errors.Count)
    if ($errors.Count -gt 0) { $errors | Select-Object -Last 5 | ForEach-Object { Say ('  ' + $_) } }
  }
  if (Test-Path $outLog) {
    Say 'Последние строки лога:'
    Get-Content -Encoding UTF8 $outLog -Tail 5 | ForEach-Object { Say ('  ' + $_) }
  }
  return 0
}



function New-Shortcuts {
  $shell = New-Object -ComObject WScript.Shell
  $items = @(
    @{ Name = 'Запустить бота.lnk'; Target = (Join-Path $root 'start-bot.cmd'); Desc = 'Запуск Telegram-бота YOUR ENGLISH JOURNEY' },
    @{ Name = 'Остановить бота.lnk'; Target = (Join-Path $root 'stop-bot.cmd'); Desc = 'Остановка Telegram-бота YOUR ENGLISH JOURNEY' },
    @{ Name = 'Статус бота.lnk'; Target = (Join-Path $root 'status-bot.cmd'); Desc = 'Статус Telegram-бота YOUR ENGLISH JOURNEY' }
  )
  foreach ($item in $items) {
    $path = Join-Path $root $item.Name
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = $item.Target
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = $item.Desc
    $shortcut.Save()
    Say ('Ярлык создан: ' + $item.Name)
  }
  return 0
}

Ensure-Dirs
$code = 0
switch ($Action) {
  'start' { $code = Start-Bot }
  'stop' { $code = Stop-Bot }
  'restart' { $code = Stop-Bot; Start-Sleep -Seconds 1; $code = Start-Bot }
  'status' { $code = Get-Status }
  'shortcuts' { $code = New-Shortcuts }
}
exit $code
