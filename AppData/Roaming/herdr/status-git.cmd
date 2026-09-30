@echo off
rem Herdr tab-bar component: git branch + dirty marker for the active pane cwd.
setlocal enabledelayedexpansion
if not defined HERDR_ACTIVE_PANE_CWD exit /b 0
cd /d "%HERDR_ACTIVE_PANE_CWD%" 2>nul || exit /b 0
git rev-parse --is-inside-work-tree >nul 2>nul || exit /b 0
for /f "delims=" %%b in ('git branch --show-current 2^>nul') do set BR=%%b
if not defined BR set BR=detached
git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (echo  !BR!*) else (echo  !BR!)
