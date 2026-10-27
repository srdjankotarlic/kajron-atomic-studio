"""Independently decode the PNG frame embedded in the native Windows MOV."""
from pathlib import Path
import io
import sys
from PIL import Image

folder = Path(sys.argv[1])
movie = (folder / 'pixel-perfect.mov').read_bytes()
offset = movie.index(b'\x89PNG\r\n\x1a\n')
actual = Image.open(io.BytesIO(movie[offset:])).convert('RGBA')
expected = Image.open(folder / 'pixel-expected.png').convert('RGBA')
assert actual.size == expected.size == (640, 100)
assert actual.tobytes() == expected.tobytes(), 'Windows MOV PNG lost color information'
print('Windows MOV PNG: all 64000 RGBA pixels match exactly.')
