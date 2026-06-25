@echo off
chcp 65001 >nul
cd /d %~dp0
set /p DEEPSEEK_KEY=????? DeepSeek API Key ???: 
if "%DEEPSEEK_KEY%"=="" (
  echo Key ?????
  pause
  exit /b 1
)
(
  echo LLM_PROVIDER=deepseek
  echo LLM_API_KEY=%DEEPSEEK_KEY%
  echo LLM_BASE_URL=https://api.deepseek.com
  echo LLM_MODEL=deepseek-chat
  echo LLM_TIMEOUT_MS=30000
  echo PORT=3000
) > .env
echo.
echo ??? DeepSeek ??? .env?
echo ?????? start.bat ???
pause
