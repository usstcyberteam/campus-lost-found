<#
.SYNOPSIS
  校园寻物局一键安装（Windows）：安装前后端依赖、生成本地配置、建库并导入校园地图，可选安装完直接启动。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Demo -Start
#>
param(
  # 额外生成 60 条演示帖子（AI 地点推荐与热力图需要历史数据）
  [switch]$Demo,
  # 同时安装 pytest、ruff 等开发依赖
  [switch]$Dev,
  # 安装完成后在两个新窗口里启动后端和前端
  [switch]$Start,
  # 不走华为云开源镜像站，直接连 PyPI / npm 官方源（海外网络用）
  [switch]$NoMirror,
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$PipIndex = 'https://repo.huaweicloud.com/repository/pypi/simple'
$NpmRegistry = 'https://repo.huaweicloud.com/repository/npm/'

function Write-Step([string]$Text) { Write-Host "`n==> $Text" -ForegroundColor Cyan }

function Stop-Install([string]$Text) {
  Write-Host "安装中止：$Text" -ForegroundColor Red
  exit 1
}

# 原生命令失败时 PowerShell 不会抛异常，统一检查退出码
function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { Stop-Install "$File $($Arguments -join ' ') 失败（退出码 $LASTEXITCODE）" }
}

# Windows 上的 python 可能是应用商店占位程序，逐个候选实测版本号
function Find-Python {
  $candidates = @(@('python'), @('py', '-3.13'), @('py', '-3.12'), @('py', '-3.11'), @('py', '-3'))
  foreach ($candidate in $candidates) {
    $exe = $candidate[0]
    $prefix = @($candidate | Select-Object -Skip 1)
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
    try {
      # 参数里不放双引号：PowerShell 5.1 传给原生程序时不会转义
      $version = & $exe @prefix -c 'import platform; print(platform.python_version())' 2>$null
    } catch {
      continue
    }
    if ($LASTEXITCODE -eq 0 -and $version -and ([version]$version -ge [version]'3.11')) {
      return @{ Exe = $exe; Prefix = $prefix; Version = $version }
    }
  }
  return $null
}

Write-Step '检查运行环境'
$python = Find-Python
if (-not $python) { Stop-Install '需要 Python 3.11 及以上：https://www.python.org/downloads/ （安装时勾选 Add to PATH）' }
Write-Host "Python $($python.Version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-Install '需要 Node.js 18 及以上：https://nodejs.org/' }
$nodeVersion = (& node --version).TrimStart('v')
if ([version]$nodeVersion -lt [version]'18.0') { Stop-Install "Node.js 版本过低（$nodeVersion），需要 18 及以上" }
Write-Host "Node.js $nodeVersion"

$pipMirror = @()
$npmMirror = @()
if (-not $NoMirror) {
  $pipMirror = @('-i', $PipIndex)
  $npmMirror = @('--registry', $NpmRegistry)
  Write-Host '依赖下载走华为云开源镜像站（加 -NoMirror 可改回官方源）'
}

Write-Step '安装后端依赖（backend\.venv）'
$venvPython = Join-Path $Backend '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  Invoke-Checked $python.Exe ($python.Prefix + @('-m', 'venv', (Join-Path $Backend '.venv')))
}
$requirements = if ($Dev) { 'requirements-dev.txt' } else { 'requirements.txt' }
Invoke-Checked $venvPython (@('-m', 'pip', 'install', '--disable-pip-version-check', '-r', (Join-Path $Backend $requirements)) + $pipMirror)

Write-Step '生成本地配置（已有的 .env 原样保留，不打印密钥）'
Invoke-Checked $venvPython @((Join-Path $Root 'scripts\configure_local.py'))

Write-Step '建表并导入管理员、图层与校园建筑'
Push-Location $Backend
try {
  Invoke-Checked $venvPython @('-m', 'alembic', 'upgrade', 'head')
  Invoke-Checked $venvPython @('seed.py')
  if ($Demo) {
    Write-Step '生成演示帖子'
    Invoke-Checked $venvPython @('-m', 'scripts.seed_demo')
  }
} finally {
  Pop-Location
}

Write-Step '安装前端依赖（frontend\node_modules）'
Push-Location $Frontend
try {
  Invoke-Checked 'npm' (@('ci', '--no-audit', '--no-fund') + $npmMirror)
} finally {
  Pop-Location
}

$backendCommand = "Set-Location '$Backend'; .\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort"
$frontendCommand = "Set-Location '$Frontend'; `$env:API_PROXY_TARGET='http://127.0.0.1:$BackendPort'; npm run dev -- --port $FrontendPort"

Write-Host "`n安装完成。" -ForegroundColor Green
Write-Host "管理员账号 admin，初始密码见 backend\.env 里的 ADMIN_PASSWORD；学生账号在注册页自行注册。"
Write-Host "AI 助手默认走规则模式；接入大模型请在 backend\.env 填写 MODEL_BASE_URL、MODEL_NAME、MODEL_API_KEY 并设 MODEL_DISABLED=false。"

if ($Start) {
  Write-Step '在新窗口启动后端和前端'
  Start-Process powershell -ArgumentList @('-NoExit', '-Command', $backendCommand)
  Start-Process powershell -ArgumentList @('-NoExit', '-Command', $frontendCommand)
  Write-Host "稍等几秒后打开 http://localhost:$FrontendPort"
} else {
  Write-Host "`n启动方法（各开一个终端）："
  Write-Host "  后端：$backendCommand"
  Write-Host "  前端：$frontendCommand"
  Write-Host "然后打开 http://localhost:$FrontendPort ；也可以重新运行本脚本并加 -Start 自动启动。"
}
