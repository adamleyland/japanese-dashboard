Set shell = CreateObject("WScript.Shell")
command = """" & Replace(WScript.ScriptFullName, "run-steam-local-sync.vbs", "run-steam-local-sync.cmd") & """"
shell.Run command, 0, False
