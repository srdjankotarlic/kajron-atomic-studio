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

# PNG frames in the MOV allow independent checks without a second encoder install.
for movie_name, expected_name in [('graphics.mov', 'graphics-expected.png'), ('graphics-text-only.mov', 'text-only-expected.png'), ('custom-label.mov', 'label-expected.png')]:
    movie = (folder / movie_name).read_bytes()
    offset = movie.index(b'\x89PNG\r\n\x1a\n')
    actual = Image.open(io.BytesIO(movie[offset:])).convert('RGBA')
    expected = Image.open(folder / expected_name).convert('RGBA')
    assert actual.size == expected.size == (640, 360)
    differences = [abs(a-b) for a,b in zip(actual.tobytes(),expected.tobytes())]
    assert max(differences) <= 2, (movie_name, max(differences))
    if movie_name == 'graphics.mov':
        assert actual.getpixel((550,40)) == (255,0,0,255), 'Frame-anchored logo was clipped to the ticker strip'
        assert actual.getpixel((0,0))[3] == 0, 'Empty frame background is not transparent'
    elif movie_name == 'graphics-text-only.mov':
        assert actual.getpixel((550,40))[3] == 0, 'Graphic remains in text-only output'
        assert max(actual.getchannel('A').getdata()) > 0, 'Text-only output is empty'
    print(movie_name + ': preview matches within 2 color levels; artwork and alpha checks passed.')
