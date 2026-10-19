@echo off
setlocal
cd /d "%~dp0"
title Phone Mockup Studio
if not exist serve.py (
    echo Missing serve.py. Extract the entire ZIP into a new folder first.
    pause
    exit /b 1
)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    py -3 serve.py --open
    goto done
)
python -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>&1
if not errorlevel 1 (
    python serve.py --open
    goto done
)
echo Python 3 is not installed or is not on PATH.
echo Install Python 3 from https://www.python.org/downloads/
echo Enable "Add Python to PATH", then run this file again.
:done
pause
