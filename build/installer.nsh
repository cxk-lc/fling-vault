; 卸载清理脚本（由 electron-builder 的 nsis.include 引入）
;
; 目标：卸载后不留下任何目录/文件
;   1. 先结束仍在托盘/后台运行的实例，否则 exe 被占用，安装目录删不掉；
;   2. 删除用户数据目录（设置、库记录、已下载的修改器、日志）；
;   3. 安装目录交给一个延迟启动的批处理：
;      卸载程序运行时自身就在 $INSTDIR 里，直接 RMDir 会留下空目录，
;      因此等它退出后再删，并带重试，避免文件句柄未释放。

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $0
  Sleep 700

  ; deleteAppDataOnUninstall 已覆盖 %APPDATA%，这里再补一次，兼容改过数据目录的机器
  RMDir /r "$APPDATA\${PRODUCT_NAME}"
  RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"

  ; 写一个自删除的清理脚本到 %TEMP%，分离启动后立即返回，不阻塞卸载流程
  StrCpy $0 "$TEMP\flingvault-cleanup.bat"
  FileOpen $9 "$0" w
  FileWrite $9 "@echo off$\r$\n"
  FileWrite $9 "setlocal$\r$\n"
  FileWrite $9 "cd /d $\"%TEMP%$\"$\r$\n"
  FileWrite $9 "timeout /t 2 /nobreak >nul$\r$\n"
  FileWrite $9 "set n=0$\r$\n"
  FileWrite $9 ":retry$\r$\n"
  FileWrite $9 "rmdir /s /q $\"$INSTDIR$\" 2>nul$\r$\n"
  FileWrite $9 "if not exist $\"$INSTDIR$\" goto done$\r$\n"
  FileWrite $9 "set /a n+=1$\r$\n"
  FileWrite $9 "if %n% geq 12 goto done$\r$\n"
  FileWrite $9 "timeout /t 1 /nobreak >nul$\r$\n"
  FileWrite $9 "goto retry$\r$\n"
  FileWrite $9 ":done$\r$\n"
  FileWrite $9 "del /f /q $\"%~f0$\" 2>nul$\r$\n"
  FileClose $9
  Exec 'cmd.exe /c start "" /min "$0"'
!macroend
