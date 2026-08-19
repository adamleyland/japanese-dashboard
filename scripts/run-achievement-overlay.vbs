Set shell = CreateObject("WScript.Shell")
command = """" & Replace(WScript.ScriptFullName, "run-achievement-overlay.vbs", "run-achievement-overlay.cmd") & """"
shell.Run command, 0, False
