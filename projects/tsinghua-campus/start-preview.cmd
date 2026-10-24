@echo off
setlocal
title Tsinghua Campus Preview
cd /d "%~dp0"
set "PORT=8786"
echo Starting local preview at http://127.0.0.1:8786/
echo Keep this window open. Close it to stop the preview.
node scripts\serve.mjs
set "SERVER_EXIT=%ERRORLEVEL%"
echo.
echo Preview stopped. Exit code: %SERVER_EXIT%
pause
exit /b %SERVER_EXIT%
