package main
import("bytes";"fmt";"html/template";"os";"strings")
func main(){
 source,err:=os.ReadFile("supabase/templates/confirmation.html");if err!=nil{panic(err)}
 tpl,err:=template.New("confirmation").Parse(string(source));if err!=nil{panic(err)}
 for _,entry:=range []string{"vereinsmarkt","","other"}{
  var out bytes.Buffer
  err=tpl.Execute(&out,map[string]any{"Data":map[string]any{"auth_entry":entry},"SiteURL":"https://app.spielzeitapp.at","ConfirmationURL":"https://test.invalid/verify?token=test&type=signup"});if err!=nil{panic(err)}
  rendered:=out.String()
  if strings.Contains(rendered,"E-Mail für den Vereinsmarkt bestätigen")!=(entry=="vereinsmarkt"){panic("Incorrect branding branch")}
  if !strings.Contains(rendered,"https://test.invalid/verify?token=test&amp;type=signup"){panic("Confirmation URL lost")}
  if strings.Contains(rendered,"{{"){panic("Unrendered template")}
 }
 fmt.Println("PASS: Go email template renders market, generic and unknown contexts and preserves verification URL")
}
