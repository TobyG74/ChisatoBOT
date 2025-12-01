# ChisatoBOT Installer for Windows
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ChisatoBOT Installer for Windows    " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Git
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host " Git is installed" -ForegroundColor Green
} else {
    Write-Host " Git is not installed!" -ForegroundColor Red
    exit 1
}

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host " Node.js is installed" -ForegroundColor Green
} else {
    Write-Host " Node.js is not installed!" -ForegroundColor Red
    exit 1
}

# Check NPM
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host " NPM is installed" -ForegroundColor Green
} else {
    Write-Host " NPM is not installed!" -ForegroundColor Red
    exit 1
}

# Check FFmpeg
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host " FFmpeg is installed" -ForegroundColor Green
} else {
    Write-Host " FFmpeg is not installed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/7] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host " Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "[3/7] Setting up environment file..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host " .env file created" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[4/7] Setting up Prisma..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host " Prisma client generated" -ForegroundColor Green

Write-Host ""
Write-Host "[5/7] Pushing database schema..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host " Database schema pushed" -ForegroundColor Green

Write-Host ""
Write-Host "[6/7] Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host " Project built" -ForegroundColor Green

Write-Host ""
Write-Host "[7/7] Checking config.json..." -ForegroundColor Yellow
if (Test-Path "config.json") {
    Write-Host " config.json exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Installation Complete!              " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run with: npm start" -ForegroundColor Cyan
Write-Host ""
