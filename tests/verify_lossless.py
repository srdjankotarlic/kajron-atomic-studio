"""Pixel-exact MOV PNG check for fine colored detail, with and without alpha."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'desktop'))
from ui import prepare_ui

def verify(engine, output):
    output = output.resolve()
    prepare_ui(output / 'ui')
    source = (output / 'ui/app.js').read_text()
    start = source.index('function buildCommand(')
    command = source[start:source.index('// Native messages', start)]
    track = Image.new('RGBA', (640, 100))
    for x in range(640):
        for y in range(100):
            track.putpixel((x, y), (255, 0, 0, 255) if x % 2 else (0, 255, 255, 255))
    track.save(output / 'track.png')
    for name in ['base', 'foreground']:
        Image.new('RGBA', (640, 100)).save(output / (name + '.png'))
    Image.new('RGBA', (640, 100), 'white').save(output / 'mask.png')
    geometry = dict(width=640, height=360, barHeight=100, barY=212, contentWidth=640, labelWidth=0, period=640, frames=1)
    results = []
    for quality in ['compact', 'balanced']:
        for transparent in [True, False]:
            settings = dict(format='mov', quality=quality, scope='strip', motion='static', fps=25, transparent=transparent, textOnly=transparent)
            code = 'const {desktopCodecOptions}=require(' + json.dumps(str(ROOT/'desktop/encoding.js')) + '); const navigator={hardwareConcurrency:4};' + command + ';process.stdout.write(JSON.stringify(buildCommand(' + json.dumps(settings) + ',' + json.dumps(geometry) + ')));'
            args = json.loads(subprocess.check_output(['node', '-e', code], text=True))
            name = f'{quality}-{transparent}.mov'
            args[-1] = name
            subprocess.run([str(engine), '-v', 'error', *args], cwd=output, check=True)
            actual = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(output/name), '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', '-'])
            assert actual == track.tobytes(), f'MOV PNG lost color detail: {quality}, alpha={transparent}'
            results.append(dict(quality=quality, transparent=transparent, pixels=64000, exact=True))
    (output/'report.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--engine', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    verify(args.engine, args.output)
