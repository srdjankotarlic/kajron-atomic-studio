# Kajron Atomic Studio

**Lokalna desktop aplikacija za video-kajrone, pokretne vesti i natpise za OBS.**

[English](../README.md) · **Srpski** · **[Preuzmi program](https://github.com/srdjankotarlic/kajron-atomic-studio/releases/latest)**

Unesi tekst, podesi font, boje, dimenzije i brzinu, pa izvezi pravi **WebM, MOV ili
MP4 video**. Ubaci ga u OBS kao **Media Source** i uključi **Loop**. Program radi
lokalno, bez interneta, naloga, pretplate i vodenog žiga.

U jednom paketu su **engleski i srpski interfejs**. Na vrhu prozora izaberi
**English / Srpski**. Izbor ostaje sačuvan; promena jezika ne menja tekst kajrona.

## Preuzimanje i instalacija

Otvori **[Releases — poslednja verzija](https://github.com/srdjankotarlic/kajron-atomic-studio/releases/latest)**.
Zeleno GitHub dugme **Code** preuzima izvorni kod, a ne instalacioni program.

| Računar | Fajl | Instalacija |
| --- | --- | --- |
| Windows 10/11, 64-bit Intel/AMD | `Kajron-Atomic-Studio-Setup-1.5.0.exe` | Pokreni instalater. Pravi prečice na Desktopu i u Start meniju. Ne traži administratorska prava. |
| Windows bez instalacije | `Kajron-Atomic-Studio-Windows-Portable-1.5.0.zip` | Raspakuj **ceo** folder i pokreni `Kajron Atomic Studio.exe`. Prenosi sve njegove fajlove zajedno. |
| Mac sa Apple Silicon procesorom, macOS 13+ | `Kajron-Atomic-Studio-macOS-1.5.0.zip` | Raspakuj aplikaciju i premesti je u Applications. Ovaj paket nije za Intel Mac. |

Video-pogon je uključen. Korisniku nisu potrebni FFmpeg, Node, Python niti druge
alatke za izgradnju. Windows instalater nema izdavački digitalni potpis. Mac ima
ad-hoc potpis i nije notarizovan, pa sistemske bezbednosne provere mogu da spreče
pokretanje preuzetog paketa.

Uz izdanje je `SHA256SUMS.txt` za proveru preuzetih fajlova. Arhiva
**Encoder-Sources** sadrži izvorni kod video-pogona; nije potrebna za korišćenje.

## Napravi kajron

1. U panelu **Tekst** unesi sadržaj. Novi redovi se spajaju znakom **•**.
2. Podesi **Izgled** i **Kretanje**, ili izaberi gotov stil.
3. Za potpuno prozirnu pozadinu uključi **Samo slova — potpuno prozirna pozadina**.
4. Za manje fajlove izaberi **Manji fajl** i **Samo traka kajrona**.
5. Klikni **Sačuvaj WebM / MOV / MP4**, izaberi folder i sačekaj završetak. Početna lokacija je Desktop.

**WebM VP9** je preporučen za male prozirne fajlove. **MOV PNG** čuva alpha kanal
bez gubitka kvaliteta. **MOV / Najviši kvalitet** koristi ProRes 4444 i pravi velike
fajlove. **MP4 H.264** ima punu pozadinu i nije dostupan u režimu „Samo slova”.

Možeš da menjaš veličinu i boju slova, podebljanje, velika slova, boju i neprozirnost
trake, oznaku na početku, visinu kajrona, zaobljenje uglova, položaj, odmak, smer i
brzinu kretanja. Izvoz podržava 25/30/50/60 FPS, standardne rezolucije do 4K i
prilagođene dimenzije, kao traku ili ceo kadar.

Veličina fajla zavisi od trajanja, rezolucije i broja frejmova. Kompresija ne seče
tekst. Ako veoma dugačak tekst sa velikim slovima pređe širinu slike od 32760 px,
smanji slova ili skrati tekst prema obaveštenju u aplikaciji.

## Dodavanje fontova

Klikni **Tekst → Dodaj fontove…** i izaberi TTF, OTF, WOFF ili WOFF2. Font se
pojavi u listi kao **Tvoj font** i ostaje dostupan posle zatvaranja programa.
Čuva se u biblioteci aplikacije; nije potrebna instalacija u operativni sistem.

Podržano je 32 fonta, do 10 MB po fontu i 40 MB ukupno. Na drugom računaru dodaj
isti originalni font pre otvaranja projekta. Ako nedostaje, aplikacija privremeno
bira Arial i prikaže obaveštenje. Gotovom videu font nije potreban na OBS računaru.

Sačuvaj/učitaj projekat preko **Ctrl+S / Ctrl+O** na Windowsu ili **⌘S / ⌘O** na
Mac-u. JSON projekti rade na oba sistema i podržani su stariji Kajron Studio
projekti. Projektni fajl ne sadrži sam font.

## Ubacivanje u OBS

1. **Sources → + → Media Source**.
2. Uključi **Local File** i izaberi video.
3. Uključi **Loop**, a po želji i **Restart playback when source becomes active**.
4. Postavi izvor iznad kamera i ostalih izvora. Pomeri kajron na dno scene.
5. Za isti kajron u više scena koristi **Add Existing**.

Dobijaš video-fajl; za prikaz u OBS-u nisu potrebni Browser Source ni web stranica.

## Izvorni kod i podrška

Kod aplikacije je pod **MIT licencom**. Video-pogon i runtime imaju svoje licence.
[Licence biblioteka](../THIRD_PARTY_NOTICES.md) · [Izgradnja](BUILD.md) ·
[Provere i ograničenja](VALIDATION.md).

Za problem otvori [GitHub issue](https://github.com/srdjankotarlic/kajron-atomic-studio/issues)
i navedi sistem, verziju programa, format i postupak kojim se problem ponavlja.
Koristi probni tekst umesto privatnih projekata.
