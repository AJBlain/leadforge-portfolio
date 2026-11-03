// LeadForge Windows launcher. Uses only Go's standard library.
// Serves the existing local UI without changing browser storage origin.
package main

import (
 "encoding/json"
 "fmt"
 "net/http"
 "net"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "syscall"
 "time"
 "unsafe"
)
const localURL = "http://127.0.0.1:8765/"
func dialog(title, message string) {
 user32 := syscall.NewLazyDLL("user32.dll")
 proc := user32.NewProc("MessageBoxW")
 t,_:=syscall.UTF16PtrFromString(title)
 m,_:=syscall.UTF16PtrFromString(message)
 proc.Call(0, uintptr(unsafe.Pointer(m)),uintptr(unsafe.Pointer(t)),0x10)
}
func version() (string,bool) {
 client:=&http.Client{Timeout:850*time.Millisecond}
 res,err:=client.Get(localURL+"api/health");if err!=nil{return "",false};defer res.Body.Close()
 if res.StatusCode!=200{return "",false}
 var data struct{OK bool `json:"ok"`; Version string `json:"version"`}
 if err:=json.NewDecoder(res.Body).Decode(&data);err!=nil{return "",false}
 return data.Version,data.OK
}
func runHidden(name string,args ...string) error {
 cmd:=exec.Command(name,args...)
 cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 return cmd.Start()
}
func launchExisting(root string) error {
 script:=filepath.Join(root,"launch_chrome.ps1")
 return runHidden("powershell.exe","-NoProfile","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File",script,"-Url",localURL)
}
func main(){
 exe,err:=os.Executable();if err!=nil{dialog("LeadForge",err.Error());return}
 root:=filepath.Dir(exe)
 if v,ok:=version();ok {
  if !strings.HasPrefix(v,"1.0") {dialog("LeadForge",fmt.Sprintf("Port 8765 is already being used by an older application (version %s). Close its PowerShell window and launch LeadForge again.",v));return}
  if err:=launchExisting(root);err!=nil{dialog("LeadForge",err.Error())}
  return
 }
 // Do not start a second server if a different process owns the port.
 d,err:=netDial();if err==nil{d.Close();dialog("LeadForge","Another service is already listening on port 8765. Close it and try again.");return}
 home:=os.Getenv("LOCALAPPDATA");if home==""{home=os.TempDir()}
 logDir:=filepath.Join(home,"LeadForge","logs")
 _=os.MkdirAll(logDir,0700)
 logPath:=filepath.Join(logDir,"server.log")
 log,err:=os.OpenFile(logPath,os.O_CREATE|os.O_APPEND|os.O_WRONLY,0600)
 if err!=nil{dialog("LeadForge","Cannot create application log: "+err.Error());return}
 defer log.Close()
 ps:=exec.Command("powershell.exe","-NoProfile","-ExecutionPolicy","Bypass","-File",filepath.Join(root,"server.ps1"))
 ps.Dir=root
 ps.Stdout=log
 ps.Stderr=log
 ps.SysProcAttr=&syscall.SysProcAttr{HideWindow:true,CreationFlags:0x00000200} // CREATE_NEW_PROCESS_GROUP
 if err=ps.Start();err!=nil{dialog("LeadForge","Could not start local server: "+err.Error());return}
 _=ps.Process.Release()
 for i:=0;i<60;i++{
  time.Sleep(250*time.Millisecond)
  if v,ok:=version();ok && strings.HasPrefix(v,"1.0"){return} // server launches browser itself
 }
 dialog("LeadForge","The local service did not start. Review the log at:\n"+logPath+"\n\nYou can also run START_APP.bat for interactive diagnostics.")
}
func netDial()(net.Conn,error){return net.DialTimeout("tcp","127.0.0.1:8765",300*time.Millisecond)}
