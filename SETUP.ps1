# Aritas GL Matching - Setup and Build Instructions

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Aritas GL Matching Application" -ForegroundColor Cyan
Write-Host "   Setup and Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$appDir = "c:\Users\ameur\Desktop\Aritas Advisors\GL Matching\gl-matching-app"

# Check if Node.js is installed
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Navigate to app directory
Write-Host ""
Write-Host "Navigating to app directory..." -ForegroundColor Yellow
Set-Location $appDir

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build the application
Write-Host ""
Write-Host "Building TypeScript files..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Show next steps
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Run in development mode:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Build portable .exe:" -ForegroundColor White
Write-Host "   npm run build:exe" -ForegroundColor Cyan
Write-Host "   (Output will be in dist/ folder)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Add your icon:" -ForegroundColor White
Write-Host "   Place your icon.ico file in assets/ folder" -ForegroundColor Gray
Write-Host ""
