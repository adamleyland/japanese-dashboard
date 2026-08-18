Set shell = CreateObject("WScript.Shell")
command = """" & Replace(WScript.ScriptFullName, "run-local-achievement-watcher.vbs", "run-local-achievement-watcher.cmd") & """"
shell.Run command, 0, False
