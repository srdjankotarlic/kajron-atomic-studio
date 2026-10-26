"""Exercise the shared native encoder with actual files and both platform engines."""
from pathlib import Path
import argparse
import json
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'desktop'))
from ui import prepare_ui

def verify(output, engine, wine=False):
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    prepare_ui(output / 'ui')
    source = (output / 'ui/app.js').read_text()
    a = source.index('function buildCommand(')
    b = source.index('// Native messages', a)
    command_source = source[a:b]
    g = dict(width=640, height=360, barHeight=100, barY=212, contentWidth=540, labelWidth=100, period=512, frames=100)
    base = Image.new('RGBA', (640, 360))
    ImageDraw.Draw(base).rounded_rectangle((0, 212, 639, 311), radius=12, fill=(24,32,32,200))
    base.save(output / 'base.png')
    foreground = Image.new('RGBA', (640, 360))
    ImageDraw.Draw(foreground).rounded_rectangle((0,212,100,311), radius=12, fill=(203,247,125,255))
    foreground.save(output / 'foreground.png')
    mask = Image.new('RGBA', (640,360))
    ImageDraw.Draw(mask).rounded_rectangle((0,212,639,311), radius=12, fill='white')
    mask.save(output / 'mask.png')
    track = Image.new('RGBA', (1184,100))
    try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',28)
    except OSError: font = ImageFont.load_default()
    drawing = ImageDraw.Draw(track)
    for x in range(30,1184,512): drawing.text((x,32),'OBS ČĆŽŠĐ · Atomic Studio',font=font,fill='white')
    track.save(output / 'track.png')
    reports = []
    for fmt, quality, text_only in [('mp4','compact',False),('webm','compact',False),('mov','compact',False),('mov','high',False),('webm','compact',True),('mov','compact',True)]:
        s = dict(format=fmt,quality=quality,scope='frame',motion='left',fps=25,transparent=fmt!='mp4',textOnly=text_only)
        geometry = {**g, 'labelWidth':0,'contentWidth':640} if text_only else g
        if text_only:
            Image.new('RGBA',(640,360)).save(output/'base.png')
            Image.new('RGBA',(640,360)).save(output/'foreground.png')
        script = "const {desktopCodecOptions}=require(" + json.dumps(str(ROOT/'desktop/encoding.js')) + ");const navigator={hardwareConcurrency:4};\n" + command_source + '\nprocess.stdout.write(JSON.stringify(buildCommand('+json.dumps(s)+','+json.dumps(geometry)+')));'
        args = json.loads(subprocess.check_output(['node','-e',script],text=True))
        name = f'{"only-letters" if text_only else quality}.{fmt}'
        args[-1] = name
        if wine:
            invocation = ['/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine','--bottle','KajronStudio-QA','--no-gui','--workdir',str(output),'--cx-app',str(engine),'--']
        else: invocation = [str(engine)]
        result = subprocess.run([*invocation,'-v','error',*args],cwd=output,capture_output=True,text=True,timeout=120)
        assert result.returncode == 0,(fmt,quality,result.stderr)
        file = output/name
        metadata = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,pix_fmt,width,height:stream_tags=alpha_mode:format=duration,size','-of','json',str(file)],text=True))
        stream = metadata['streams'][0]
        assert stream['width']==640 and stream['height']==360
        assert abs(float(metadata['format']['duration'])-4)<0.01
        decoder=['-c:v','libvpx-vp9'] if fmt=='webm' else []
        data = subprocess.check_output(['ffmpeg','-v','error',*decoder,'-i',str(file),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-'])
        alpha_outside=data[3]
        alpha_bar=data[(250*640+600)*4+3]
        if text_only:
            alphas=data[3::4]
            assert alpha_outside==0 and max(alphas)>220
            assert all(value==0 for value in alphas[212*640:225*640]),'Background or accent line remains visible'
            assert sum(value>0 for value in alphas)<640*100*.3,'Opaque bar remains visible'
        elif fmt!='mp4': assert alpha_outside==0 and 185<=alpha_bar<=215,(fmt,alpha_outside,alpha_bar)
        else: assert alpha_outside==255 and alpha_bar==255
        reports.append(dict(format=fmt,quality=quality,text_only=text_only,codec=stream['codec_name'],bytes=file.stat().st_size,alpha_outside=alpha_outside,alpha_bar=alpha_bar,pass_check=True))
    compact=next(r['bytes'] for r in reports if r['format']=='mov' and r['quality']=='compact')
    high=next(r['bytes'] for r in reports if r['format']=='mov' and r['quality']=='high')
    assert compact < high * .7, (compact,high)
    (output/'report.json').write_text(json.dumps(reports,indent=2))
    print(json.dumps({'windows_engine_under_wine':wine,'mov_size_reduction_percent':round((1-compact/high)*100,1),'results':reports},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--engine',required=True)
    parser.add_argument('--wine',action='store_true')
    args=parser.parse_args()
    verify(args.output,args.engine,args.wine)
