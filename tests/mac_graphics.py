"""Native WKWebView/Swift/encoder integration with unattended file-picker answers.
Run the generated QA .app, then reopen it once to verify restart persistence.
Never modifies an installed user app or its profile.
"""
import argparse, base64, json, plistlib, shutil, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--app',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
app=output/'Kajron Graphics Check.app'
shutil.copytree(args.app,app)
fixtures=output/'fixtures';fixtures.mkdir()
(fixtures/'client.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="100"><defs><linearGradient id="g"><stop stop-color="#1347aa"/><stop offset="1" stop-color="#246dd9"/></linearGradient></defs><rect width="640" height="100" fill="url('#g')"/></svg>''')
logo=Image.new('RGBA',(80,80));ImageDraw.Draw(logo).rectangle((5,5,74,74),fill='red');logo.save(fixtures/'logo.png')
photo=Image.new('RGB',(80,80),'#24a281');photo.save(fixtures/'photo.jpg');photo.save(fixtures/'photo.webp')
(fixtures/'broken.png').write_text('not an image')
s=(ROOT/'desktop/KajronStudio.swift').read_text().replace('Kajron Atomic Studio/Fonts','Kajron Graphics Native Check/Fonts').replace('Kajron Atomic Studio/Graphics','Kajron Graphics Native Check/Graphics').replace('window.title = "Kajron Atomic Studio"','window.title = "Kajron Graphics Check"')
# Replace only the picker responses. Native IPC, import/store/project/export bodies remain real.
def picker(method,next_method,replace):
 global s
 start=s.index(method);end=s.index(next_method,start);part=s[start:end]
 part=part.replace('panel.beginSheetModal(for: window) { response in','let qaPanel: (NSApplication.ModalResponse) -> Void = { response in')
 for old,new in replace:part=part.replace(old,new)
 pos=part.rfind('        }\n    }');assert pos>=0
 part=part[:pos]+part[pos:].replace('        }\n    }','        }\n        qaPanel(.OK)\n    }',1)
 s=s[:start]+part+s[end:]
url=lambda p:'URL(fileURLWithPath: '+json.dumps(str(p),ensure_ascii=False)+')'
picker('    func importGraphics(', '    func fontFolder(', [('panel.urls','['+','.join(url(p) for p in sorted(fixtures.iterdir()))+']')])
picker('    func importFonts(', '    @objc func openProject()', [('panel.urls', '['+url(Path('/System/Library/Fonts/Supplemental/Arial.ttf'))+']')])
project=output/'project-with-artwork.json'
for method,next_method in [('    @objc func openProject()', '    func saveProjectFile('),('    func saveProjectFile(', '    func beginExport(')]:
 picker(method,next_method,[('guard response == .OK, let url = panel.url else { return }','guard response == .OK else { return }; let url = '+url(project))])
picker('    func beginExport(', '    func readProgress(', [('guard response == .OK, var target = panel.url else { self.send(["type": "cancelled"]); return }','guard response == .OK else { return }; var target = '+url(output)+'.appendingPathComponent(name)')])
script=r'''
const checks=[];
function check(ok,label){if(!ok)throw new Error(label);checks.push(label);}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<400;n++){if(fn())return;await delay(50);}throw new Error(label);}
await Promise.all([fontsReady,graphicsReady]);await fontInstallQueue;
native({action:'importFonts'});await until(()=>/^AtomicFont_/.test(state.font),'native custom font import');await fontInstallQueue;
check(document.querySelectorAll('[data-preset]').length===15,'15 designs');
for(const item of STUDIO_DESIGNS){applyDesign(item.id);check(geometry.contentWidth>0&&geometry.contentHeight>0,'render '+item.id);}
state=sanitize({...state,text:'Mac client ČĆŽŠĐ',bold:true,resolution:'custom',customWidth:640,customHeight:360,barHeight:100,margin:0,position:'bottom',fontSize:32,motion:'static',format:'mov',quality:'compact',transparent:true,staticDuration:5,graphics:[]});updateUI(true);
native({action:'importGraphics',kind:'background'});
await until(()=>state.graphics.length===4,'PNG/JPG/WebP/SVG import');await graphicsQueue;
check(state.graphics.length===4,'all four image formats imported; broken PNG skipped');
state=sanitize({...state,graphics:state.graphics.slice(0,2),textX:22,textY:15,textWidth:70,textHeight:70,scope:'frame'});
state.graphics[1]={...state.graphics[1],anchor:'frame',x:80,y:5,width:15,height:15};playing=false;updateUI(true);paintPreview(0);
check(ctx.getImageData(550,40,1,1).data[0]===255,'frame artwork visible outside ticker');
await readyTextFont(state);updateUI();paintPreview(0);
const expected=preview.toDataURL('image/png').split(',')[1];
$('save-project').click();await until(()=>$('toast').textContent.includes('project-with-artwork.json'),'native project save');
state=sanitize({...state,text:'temporary',graphics:[]});updateUI(true);$('import-project').click();
await until(()=>state.text==='Mac client ČĆŽŠĐ'&&state.graphics.length===2,'project reload with embedded images');
check(state.graphics.length===2,'native embedded project save/open');
$('design-name').value='Mac Client Design';$('save-design').click();check(savedDesigns.length>0,'saved user design');
$('export').click();await until(()=>!exporting,'graphics MOV export');check(!$('export-result').hidden,'native MOV with artwork exported');
$('text-only-primary').click();updateUI(true);paintPreview(0);
check(state.textOnly&&state.graphics.length===2,'text-only retains but hides artwork');
check(ctx.getImageData(550,40,1,1).data[3]===0,'text-only background is transparent');
const onlyExpected=preview.toDataURL('image/png').split(',')[1];
// Capture a second movie under a distinct name through the same native export body.
const ss={...state},gg=calc(ss),layers0=await renderLayers(ss,gg),layers={};
for(const key of ['base','track','fg','mask'])layers[key]=await encodeBase64(layers0[key]);
exporting=true;native({action:'export',layers,args:buildCommand(ss,gg),format:'mov',frames:gg.frames,name:'text-only.mov'});
await until(()=>!exporting,'text-only MOV export');
check(!$('export-result').hidden,'native text-only MOV exported');
$('text-only-primary').click();state=sanitize({...state,text:'Mac persistence ČĆŽŠĐ'});persist();updateUI(true);updateGraphicTools(true);
return {pass:true,checks,expected,onlyExpected,graphics:state.graphics.length};
'''
restart="""await Promise.all([fontsReady,graphicsReady]);await ensureGraphicImages(state.graphics);return {pass:state.text==='Mac persistence ČĆŽŠĐ'&&state.graphics.length===2&&savedDesigns.some(a=>a.name==='Mac Client Design'),text:state.text,graphics:state.graphics.length,savedDesigns:savedDesigns.length};"""
encode=lambda value:base64.b64encode(value.encode()).decode()
report=output/'report.json';restore=output/'restart.json'
method='''    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let isRestart = fm.fileExists(atPath: REPORT)
        let encoded = isRestart ? RESTART : INITIAL
        let script = String(data: Data(base64Encoded: encoded)!, encoding: .utf8)!
        web.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            let value: [String: Any]
            switch result {
            case .success(let object): value = object as? [String: Any] ?? ["pass":false,"error":"Missing JavaScript report"]
            case .failure(let error): value = ["pass":false,"error":String(describing:error)]
            }
            let destination = URL(fileURLWithPath: isRestart ? RESTOREPATH : REPORT)
            if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted]) { try? data.write(to: destination, options: .atomic) }
        }
    }
'''
method=method.replace('RESTOREPATH',json.dumps(str(restore))).replace('REPORT',json.dumps(str(report))).replace('RESTART',json.dumps(encode(restart))).replace('INITIAL',json.dumps(encode(script)))
s=s.replace('    func setupMenu() {',method+'\n    func setupMenu() {')
source=output/'Validation.swift';source.write_text(s)
subprocess.run(['swiftc','-O','-swift-version','5','-target','arm64-apple-macos13.0','-framework','AppKit','-framework','WebKit',str(source),'-o',str(app/'Contents/MacOS/KajronAtomicStudio')],check=True)
p=app/'Contents/Info.plist';info=plistlib.loads(p.read_bytes());info['CFBundleIdentifier']='rs.kajron.atomic.graphicsnativecheck';info['CFBundleName']='Kajron Graphics Check';p.write_bytes(plistlib.dumps(info))
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
print(app)
