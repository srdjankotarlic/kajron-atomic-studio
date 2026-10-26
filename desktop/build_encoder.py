#!/usr/bin/env python3
"""Build a small offline FFmpeg from the exact sources shipped with a release.

Requires make, cmake, nasm, pkg-config, and a C compiler. Cross-building Windows
on macOS also requires llvm-mingw-20261020-ucrt-macos-universal in outputs/cache.
Every command and its environment is recorded in the build log.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'ffmpeg': ('ffmpeg-8.1.2.tar.xz', 'https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz'),
    'x264': ('x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.gz', 'https://codeload.github.com/mirror/x264/tar.gz/b35605ace3ddf7c1a5d67a2eb553f034aef41d55'),
    'vpx': ('libvpx-1.16.0.tar.gz', 'https://codeload.github.com/webmproject/libvpx/tar.gz/refs/tags/v1.16.0'),
    'zlib': ('zlib-1.3.1.tar.gz', 'https://zlib.net/fossils/zlib-1.3.1.tar.gz'),
}

def build(platform):
    sources = ROOT / 'outputs/public-sources'
    sources.mkdir(parents=True, exist_ok=True)
    work = Path(os.environ.get('KAJRON_ENCODER_WORK', '/tmp/kajron-atomic-encoder')) / platform
    work.mkdir(parents=True, exist_ok=True)
    prefix = work / 'prefix'
    prefix.mkdir(exist_ok=True)
    env = dict(os.environ)
    if platform == 'windows':
        tools = ROOT / 'outputs/cache/llvm-mingw-20261020-ucrt-macos-universal/bin'
        env['PATH'] = str(tools) + os.pathsep + env['PATH']
        env.update(CC='x86_64-w64-mingw32-gcc', CXX='x86_64-w64-mingw32-g++', AR='x86_64-w64-mingw32-ar', RANLIB='x86_64-w64-mingw32-ranlib', LD='x86_64-w64-mingw32-gcc', CROSS='x86_64-w64-mingw32-')
    else:
        env.update(CC='clang', CXX='clang++', MACOSX_DEPLOYMENT_TARGET='13.0', CFLAGS='-mmacosx-version-min=13.0', LDFLAGS='-mmacosx-version-min=13.0')
    env['PKG_CONFIG_LIBDIR'] = str(prefix / 'lib/pkgconfig')
    env['PKG_CONFIG_PATH'] = str(prefix / 'lib/pkgconfig')
    manifest = {}
    expected = json.loads((ROOT/'desktop/encoder-sources.json').read_text())
    for name, (filename, url) in SOURCES.items():
        archive = sources / filename
        if not archive.exists():
            print('Downloading', filename, flush=True)
            subprocess.run(['curl', '-L', '--fail', '--retry', '2', '-sS', '-o', str(archive), url], check=True)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if digest != expected[name]['sha256']:
            raise RuntimeError(f'Unexpected checksum for {filename}')
        manifest[name] = dict(file=filename, url=url, sha256=digest)
        dest = work / name
        if not dest.exists():
            dest.mkdir()
            with tarfile.open(archive) as tar:
                # Upstream archives contain exactly one root directory.
                for item in tar.getmembers():
                    parts = Path(item.name).parts[1:]
                    if parts:
                        item.name = str(Path(*parts))
                        tar.extract(item, dest, filter='data')
    (sources / 'SOURCES.json').write_text(json.dumps(manifest, indent=2))
    log = (work / 'BUILD.log').open('a')
    def run(args, cwd):
        print(platform, ' '.join(map(str,args)), flush=True)
        log.write('\n$ ' + ' '.join(map(str,args)) + '\n'); log.flush()
        subprocess.run(list(map(str,args)), cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    jobs = str(min(os.cpu_count() or 4, 8))
    common = [f'--prefix={prefix}', '--enable-static', '--disable-shared']
    if not (prefix/'lib/libx264.a').exists():
        args = ['./configure', f'--prefix={prefix}', '--enable-static', '--disable-cli', '--disable-opencl', '--enable-pic']
        if platform == 'windows': args += ['--host=x86_64-w64-mingw32', '--cross-prefix=x86_64-w64-mingw32-']
        run(args, work/'x264'); run(['make','-j'+jobs],work/'x264'); run(['make','install'],work/'x264')
    if not (prefix/'lib/libvpx.a').exists():
        args = ['./configure', *common, '--disable-examples', '--disable-tools', '--disable-docs', '--disable-unit-tests', '--enable-vp9-highbitdepth', '--enable-pic']
        args += ['--target=x86_64-win64-gcc', '--as=nasm'] if platform == 'windows' else ['--force-target=arm64-darwin24-gcc']
        run(args,work/'vpx'); run(['make','-j'+jobs],work/'vpx'); run(['make','install'],work/'vpx')
    if not (prefix/'lib/libz.a').exists() and not (prefix/'lib/libzlibstatic.a').exists():
        args = ['cmake','-S','.','-B','build',f'-DCMAKE_INSTALL_PREFIX={prefix}','-DCMAKE_BUILD_TYPE=Release','-DBUILD_SHARED_LIBS=OFF']
        if platform == 'windows': args += ['-DCMAKE_SYSTEM_NAME=Windows', '-DCMAKE_C_COMPILER=x86_64-w64-mingw32-gcc', '-DCMAKE_RC_COMPILER=x86_64-w64-mingw32-windres']
        else: args += ['-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0']
        run(args,work/'zlib'); run(['cmake','--build','build','--parallel',jobs],work/'zlib'); run(['cmake','--install','build'],work/'zlib')
        static = next((prefix/'lib').glob('*z*static.a'),None)
        if static: shutil.copy2(static,prefix/'lib/libz.a')
    if platform == 'macos':
        for shared in (prefix/'lib').glob('*.dylib'):
            shared.unlink()
    args = ['./configure', f'--prefix={prefix}', '--disable-shared', '--enable-static', '--disable-autodetect', '--disable-everything', '--disable-network', '--disable-doc', '--disable-debug', '--disable-ffplay', '--disable-ffprobe', '--disable-avdevice', '--enable-ffmpeg', '--enable-gpl', '--enable-libx264', '--enable-libvpx', '--enable-zlib', '--enable-encoder=libx264,libvpx_vp9,png,prores_ks', '--enable-decoder=png', '--enable-demuxer=image2,image2pipe', '--enable-muxer=mp4,mov,webm', '--enable-protocol=file,pipe', '--enable-filter=crop,overlay,format,split,alphaextract,blend,alphamerge,color,scale,buffer,buffersink,null', '--pkg-config=pkg-config', '--pkg-config-flags=--static', f'--extra-cflags=-I{prefix}/include', f'--extra-ldflags=-L{prefix}/lib']
    if platform == 'windows': args += ['--enable-cross-compile','--target-os=mingw32','--arch=x86_64','--cross-prefix=x86_64-w64-mingw32-','--cc=x86_64-w64-mingw32-gcc','--cxx=x86_64-w64-mingw32-g++','--extra-libs=-lwinpthread','--extra-ldflags=-static']
    else: args += ['--cc=clang','--extra-cflags=-mmacosx-version-min=13.0','--extra-ldflags=-mmacosx-version-min=13.0']
    run(args,work/'ffmpeg'); run(['make','-j'+jobs],work/'ffmpeg')
    binary = work/'ffmpeg'/('ffmpeg.exe' if platform=='windows' else 'ffmpeg')
    (work/'bin').mkdir(exist_ok=True)
    shutil.copy2(binary, work/'bin'/binary.name)
    (work/'BUILD-ENV.json').write_text(json.dumps({k:env[k] for k in ['CC','CXX','PKG_CONFIG_PATH','PKG_CONFIG_LIBDIR','MACOSX_DEPLOYMENT_TARGET','CROSS'] if k in env},indent=2))
    print('Finished:',work/'bin'/binary.name,flush=True)

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('platform',choices=['macos','windows'])
    build(parser.parse_args().platform)
