@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js，請安裝 Node.js 後再試，或將網站部署到 GitHub Pages。
  pause
  exit /b 1
)
node server.js
if errorlevel 1 pause
