@echo off
echo Starting PFUMA Project...

:: Base directory = folder this .bat file lives in
set "BASE=%~dp0"

:: --- Show this PC's Wi-Fi IP (put this into app\config.js if it changed) ---
echo.
echo Your PC's IP addresses (the phone/Expo app must point config.js at the Wi-Fi one):
ipconfig | findstr /C:"IPv4"
echo.

:: --- Start the database (XAMPP MySQL / MariaDB) ---
start "PFUMA MySQL" /d "C:\xampp\mysql\bin" mysqld.exe --console

:: Give MySQL a few seconds to come up before the backend connects
echo Waiting for the database to start...
timeout /t 6 /nobreak >nul

:: --- Start Backend (Flask API) ---
start "PFUMA Backend" /d "%BASE%backend" cmd /k py app.py

:: --- Start Frontend (Vite web app) ---
start "PFUMA Frontend" /d "%BASE%" cmd /k npm run dev

:: --- Start Expo App (mobile) ---
start "PFUMA Expo" /d "%BASE%app" cmd /k npx expo start

echo.
echo All services are starting in separate windows.
echo   - Database:  MySQL (XAMPP)
echo   - Backend:   http://localhost:5000
echo   - Frontend:  Vite dev server
echo   - Mobile:    Expo
echo.
pause
