from pathlib import Path
import re
import subprocess
import json
ROOT = Path(__file__).resolve().parent.parent

def run(*args):
    return subprocess.check_output([str(a) for a in args], stderr=subprocess.STDOUT, text=True)

def prepare_ui(ui):
    ui.mkdir(parents=True, exist_ok=True)
    html = (ROOT / 'desktop/base/index.html').read_text()
    html = html.replace('<script type="module" src="app.js"></script>', '<script defer src="app.js"></script>')
    html = html.replace('<sup>BETA</sup>', '<sup>DESKTOP</sup>')
    html = html.replace('Kajron Studio', 'Kajron Atomic Studio')
    html = html.replace('<span>kajron<span class="brand-light">studio</span>', '<span>kajron<span class="brand-light">atomic studio</span>')
    html = html.replace('kajronstudio', 'kajron atomic studio')
    html = html.replace('<div class="top-actions">', '<div class="top-actions"><label class="sr-only" for="language">Language / Jezik</label><select id="language" aria-label="Language / Jezik" style="width:110px;padding:8px"><option value="en">English</option><option value="sr">Srpski</option></select>')
    html = html.replace('          <div class="field-head range-heading"><label for="font-size">', '<div style="margin-top:10px"><button class="button subtle" id="add-fonts" style="width:100%">＋ Dodaj fontove…</button><p class="field-help" id="font-library-count">TTF / OTF / WOFF / WOFF2 · Čuvaju se u aplikaciji</p></div>          <div class="field-head range-heading"><label for="font-size">')
    html = html.replace('          <div class="export-options">', '<div style="padding:16px 0 6px"><label class="check-label" style="font-size:12px;color:#d9efc1"><input type="checkbox" id="text-only"> Samo slova — potpuno prozirna pozadina</label><p class="format-note">Uklanja traku, oznaku i liniju akcenta. Izvoz u WebM ili MOV sa alpha kanalom.</p></div>          <div class="export-options">')
    html = html.replace('WebM · VP8 + Alpha', 'WebM · VP9 + Alpha').replace('MOV · ProRes 4444 + Alpha', 'MOV · Alpha')
    html = html.replace('          <div class="export-bottom">', '<div class="compression-control"><label class="field-label" for="quality">KVALITET I VELIČINA FAJLA</label><select id="quality"><option value="compact">Manji fajl · preporučeno za OBS</option><option value="balanced">Uravnoteženo</option><option value="high">Najviši kvalitet · veliki fajlovi</option></select><p class="format-note">Za najmanje fajlove koristi WebM ili MP4 i „Samo traka kajrona”. Ceo tekst ostaje u videu.</p></div>          <div class="export-bottom">')
    html = html.replace('Podesi izlaz. Preuzmi video. Ubaci u OBS.', 'Sačuvaj video-fajl na Desktop i ubaci ga u OBS.')
    html = html.replace('          <div class="export-bottom">', '<div class="desktop-formats"><span>BRZI IZVOZ NA RAČUNAR</span><div><button class="button subtle" id="export-mp4">↓ Sačuvaj MP4</button><button class="button subtle" id="export-mov">↓ Sačuvaj MOV</button><button class="button subtle" id="export-webm">↓ Sačuvaj WebM</button></div><p>Izaberi format. Otvoriće se prozor za snimanje videa; početna lokacija je Desktop.</p></div>          <div class="export-bottom">')
    designs = json.loads((ROOT / 'desktop/designs.json').read_text())
    cards = ''.join('<button class="preset" data-preset="' + d['id'] + '" aria-pressed="false"><canvas aria-hidden="true"></canvas><span class="preset-name">' + d['name'] + '<i>✓</i></span></button>' for d in designs)
    design_toolbar = '<div class="design-actions"><button id="text-only-primary" class="button text-only-primary" aria-pressed="false">Samo tekst · bez grafike</button><label class="sr-only" for="saved-designs">Moji izgledi</label><select id="saved-designs"></select><button id="delete-design" class="button subtle">Ukloni izgled</button></div>'
    save_toolbar = '<div class="graphics-actions"><label class="sr-only" for="design-name">Naziv izgleda</label><input id="design-name" type="text" maxlength="80" placeholder="Naziv mog izgleda…" style="flex:1;min-width:120px"><button id="save-design" class="button subtle">Sačuvaj moj izgled</button></div>'
    html = re.sub(r'<section class="presets-section">.*?</section>', '<section class="presets-section"><div class="section-header"><h2>Izgledi kajrona</h2><span>15 IZGLEDA</span></div>' + design_toolbar + '<div class="presets">' + cards + '</div>' + save_toolbar + '</section>' + (ROOT / 'desktop/design-tools.html').read_text(), html, count=1)
    html = html.replace('<div class="inline-options"><label class="check-label"><input type="checkbox" id="accent-line"', '<label class="field-label" for="bar-style">OBLIK TRAKE</label><select id="bar-style"><option value="solid">Puna boja</option><option value="gradient">Preliv</option><option value="outline">Okvir</option><option value="double">Dvostruka linija</option><option value="diagonal">Dijagonala</option></select><label class="field-label" for="label-shape" style="margin-top:14px">OBLIK OZNAKE</label><select id="label-shape"><option value="rectangle">Pravougaonik</option><option value="pill">Kapsula</option><option value="flag">Zastavica</option><option value="dot">Tačka uživo</option><option value="outline">Okvir</option></select><label class="check-label" style="margin:14px 0"><input id="label-uppercase" type="checkbox" checked> Velika slova oznake</label><div class="inline-options"><label class="check-label"><input type="checkbox" id="accent-line"')
    html = html.replace('Sve ostaje na tvom uređaju', 'Lokalno · Bez interneta')
    html = html.replace('Automatski sačuvano u pregledaču', 'Automatski sačuvano na ovom računaru')
    html = html.replace('Obrada je lokalna. Drži ovu karticu otvorenom dok se video ne preuzme.', 'Video se snima na ovaj računar. Možeš da nastaviš da uređuješ sledeći kajron dok izvoz traje.')
    html = html.replace('Bez naloga. Bez vodenog žiga. Samo tvoj kajron.', 'Desktop aplikacija. Bez interneta. Video spreman za OBS.')
    html = html.replace('</section>\n        <div class="obs-tip">', '</section>\n        <div class="obs-tip">')
    html = html.replace('<div class="export-result" id="export-result"', '<p id="saved-path" class="format-note" style="overflow-wrap:anywhere;user-select:text" hidden></p><div class="export-result" id="export-result"')
    (ui / 'index.html').write_text(html)
    css = re.sub(r"^@import[^\n]+\n", '', (ROOT / 'desktop/base/style.css').read_text())
    css = css.replace("'DM Sans',sans-serif", "-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif")
    css = css.replace("Manrope,'DM Sans',sans-serif", "-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif")
    css += '\n.desktop-formats{border-top:1px solid #30382b;padding:18px 0}.desktop-formats>span{font-size:9px;letter-spacing:1px;color:#a9b99c}.desktop-formats>div{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.desktop-formats p{color:#93a386;font-size:10px;line-height:1.7;margin:10px 0 0}\n'
    css += '\n' + (ROOT / 'desktop/design-tools.css').read_text()
    (ui / 'style.css').write_text(css)
    js = (ROOT / 'desktop/base/renderer.js').read_text().replace("import { FFmpeg } from './assets/ffmpeg-index.js';\n", '')
    js = '\n'.join(line for line in js.split('\n') if not line.startswith("$('fullscreen').addEventListener"))
    js += (ROOT / 'desktop/native-export.js').read_text()
    i18n = (ROOT / 'desktop/i18n.js').read_text().replace('TRANSLATIONS_JSON', (ROOT / 'desktop/translations.json').read_text())
    js = i18n + '\n' + (ROOT / 'desktop/encoding.js').read_text() + '\n' + (ROOT / 'desktop/fonts.js').read_text() + '\nconst STUDIO_DESIGNS = ' + json.dumps(designs, ensure_ascii=False) + ';\n' + (ROOT / 'desktop/graphics.js').read_text() + '\n' + js
    js = js.replace("fps: 30, scope: 'strip', format:", "quality: 'compact', fps: 30, scope: 'strip', format:")
    js = js.replace("quality: 'compact', fps:", "textOnly: false, quality: 'compact', fps:")
    js = js.replace("scope: 'scope', format: 'format'", "quality: 'quality', scope: 'scope', format: 'format'")
    js = js.replace("quality: 'quality', scope:", "textOnly: 'text-only', quality: 'quality', scope:")
    js = js.replace("if (clean.format === 'mp4') clean.transparent = false;", "if (clean.textOnly) { clean.transparent = true; if (clean.format === 'mp4') clean.format = 'webm'; } else if (clean.format === 'mp4') clean.transparent = false;")
    js = js.replace('const labelWidth = s.labelEnabled &&', 'const labelWidth = !s.textOnly && s.labelEnabled &&')
    js = js.replace('function paintBase(c, s, g, strip = false, opaque = false) {', 'function paintBase(c, s, g, strip = false, opaque = false) {\n  if (s.textOnly) return;')
    js = js.replace('s.radius);', '(s.textOnly ? 0 : s.radius));')
    js = js.replace("$('label').disabled = !state.labelEnabled;", "$('label').disabled = state.textOnly || !state.labelEnabled;\n  for (const id of ['label-enabled','label-uppercase','label-shape','bar-style','bar-color','accent-color','label-color','opacity','radius','accent-line']) $(id).disabled = state.textOnly;\n  $('format').querySelector('option[value=mp4]').disabled = state.textOnly;\n  if (state.textOnly) $('format').value = state.format;")
    js = js.replace("$('transparent').disabled = state.format === 'mp4';", "$('transparent').disabled = state.textOnly || state.format === 'mp4';")
    js = js.replace("const enums = {", "const enums = { quality: ['compact', 'balanced', 'high'],")
    js = js.replace("$('format-note').textContent = descriptions[state.format];", "$('format-note').textContent = desktopFormatDescription(state);")
    codec_start = js.index('  let codec;')
    codec_end = js.index("  return ['-y'", codec_start)
    js = js[:codec_start] + '  const codec = desktopCodecOptions(s, g);\n' + js[codec_end:]
    js = js.replace("'-an', '-threads', '1'", "'-an', '-threads', String(Math.min(navigator.hardwareConcurrency || 4, 8))")
    js = js.replace('Pregledač ne dozvoljava čuvanje.', 'Automatsko čuvanje nije dostupno.')
    js = js.replace('Pregledač ne može da napravi sliku ove veličine.', 'Dimenzije slike su prevelike. Smanji rezoluciju.')
    js = js.replace('paintBase(ctx, state, geometry);', 'paintBase(ctx, state, geometry, false, !state.transparent);')
    js = js.replace("text: 'Dobrodošli u prenos uživo!\\nSve najnovije informacije na jednom mestu.\\nOstanite uz nas.'", "text: window.KajronI18n.language === 'en' ? 'Welcome to the live broadcast!\\nAll the latest updates in one place.\\nStay tuned.' : 'Dobrodošli u prenos uživo!\\nSve najnovije informacije na jednom mestu.\\nOstanite uz nas.'")
    js = js.replace("label: 'UŽIVO'", "label: window.KajronI18n.language === 'en' ? 'LIVE' : 'UŽIVO'")
    js = js.replace("label: 'VESTI'", "label: window.KajronI18n.language === 'en' ? 'NEWS' : 'VESTI'")
    js += '\nwindow.KajronI18n.connect(native);\n'
    (ui / 'app.js').write_text(js)
    run('node', '--check', ui / 'app.js')
