import AppKit
import WebKit
import UniformTypeIdentifiers
import CryptoKit

final class Studio: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var process: Process?
    var jobFolder: URL?
    var completedURL: URL?
    var cancelRequested = false
    var totalFrames = 1
    var progressBuffer = ""
    var progressPipe: Pipe?
    var errorHandle: FileHandle?
    var language = UserDefaults.standard.string(forKey: "KajronLanguage") ?? (Locale.preferredLanguages.first?.hasPrefix("sr") == true ? "sr" : "en")
    lazy var translations: [String: String] = {
        guard let url = Bundle.main.url(forResource: "translations", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:]
    }()
    func L(_ text: String) -> String { language == "en" ? (translations[text] ?? text) : text }
    let fm = FileManager.default

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "desktop")
        configuration.websiteDataStore = .default()
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1340, height: 950), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Kajron Atomic Studio"
        window.minSize = NSSize(width: 960, height: 700)
        window.backgroundColor = NSColor(calibratedRed: 0.067, green: 0.075, blue: 0.082, alpha: 1)
        window.contentView = web
        window.delegate = self
        window.setFrameAutosaveName("KajronStudioWindow")
        window.center()
        setupMenu()
        let root = Bundle.main.resourceURL!.appendingPathComponent("ui", isDirectory: true)
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func setupMenu() {
        let main = NSMenu()
        let application = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: self.L("O aplikaciji Kajron Atomic Studio"), action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: self.L("Zatvori Kajron Atomic Studio"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        application.submenu = appMenu
        main.addItem(application)
        let file = NSMenuItem(title: self.L("Datoteka"), action: nil, keyEquivalent: "")
        let fileMenu = NSMenu(title: self.L("Datoteka"))
        fileMenu.addItem(withTitle: self.L("Sačuvaj projekat…"), action: #selector(saveProject), keyEquivalent: "s")
        fileMenu.addItem(withTitle: self.L("Otvori projekat…"), action: #selector(openProject), keyEquivalent: "o")
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: self.L("Izvezi video…"), action: #selector(exportVideo), keyEquivalent: "e")
        fileMenu.addItem(withTitle: self.L("Prikaži poslednji video u Finder-u"), action: #selector(revealVideo), keyEquivalent: "")
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: self.L("Zatvori prozor"), action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.submenu = fileMenu
        main.addItem(file)
        let edit = NSMenuItem(title: self.L("Uređivanje"), action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: self.L("Uređivanje"))
        for (name, action, key) in [(self.L("Poništi"), Selector(("undo:")), "z"), (self.L("Iseci"), #selector(NSText.cut(_:)), "x"), (self.L("Kopiraj"), #selector(NSText.copy(_:)), "c"), (self.L("Nalepi"), #selector(NSText.paste(_:)), "v"), (self.L("Izaberi sve"), #selector(NSText.selectAll(_:)), "a")] {
            editMenu.addItem(withTitle: self.L(name), action: action, keyEquivalent: key)
        }
        edit.submenu = editMenu
        main.addItem(edit)
        let help = NSMenuItem(title: self.L("Pomoć"), action: nil, keyEquivalent: "")
        let helpMenu = NSMenu(title: self.L("Pomoć"))
        helpMenu.addItem(withTitle: self.L("Kako ubaciti kajron u OBS"), action: #selector(guide), keyEquivalent: "")
        help.submenu = helpMenu
        main.addItem(help)
        NSApp.mainMenu = main
    }

    @objc func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Kajron Atomic Studio", .applicationVersion: (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.5"), .credits: NSAttributedString(string: self.L("Lokalni generator video-kajrona za OBS.\nWebM / MOV sa alpha kanalom · MP4 H.264\nObrada radi na ovom Mac-u, bez interneta."))])
    }
    @objc func saveProject() { web.evaluateJavaScript("document.getElementById('save-project').click()", completionHandler: nil) }
    @objc func exportVideo() { web.evaluateJavaScript("document.getElementById('export').click()", completionHandler: nil) }
    @objc func guide() { web.evaluateJavaScript("document.getElementById('guide-open').click()", completionHandler: nil) }
    @objc func revealVideo() { if let url = completedURL { NSWorkspace.shared.activateFileViewerSelecting([url]) } }

    func send(_ event: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.desktopEvent(\(json))", completionHandler: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "setLanguage":
            language = body["language"] as? String == "sr" ? "sr" : "en"
            UserDefaults.standard.set(language, forKey: "KajronLanguage")
            setupMenu()
        case "export": beginExport(body)
        case "cancel":
            cancelRequested = true
            process?.terminate()
        case "reveal": revealVideo()
        case "saveProject": saveProjectFile(body)
        case "loadProject": openProject()
        case "loadGraphics": send(["type": "graphicsLoaded", "assets": readGraphics()])
        case "importGraphics": importGraphics(body)
        case "storeGraphics":
            do { send(["type": "graphicsStored", "requestId": body["requestId"] as? String ?? "", "assets": try storeGraphics(body["assets"])]) }
            catch { send(["type": "graphicsStored", "requestId": body["requestId"] as? String ?? "", "error": self.L(error.localizedDescription)]) }
        case "loadFonts": send(["type": "fontsLoaded", "fonts": readFonts()])
        case "importFonts": importFonts()
        case "fullscreen": window.toggleFullScreen(nil)
        default: break
        }
    }


    func graphicsFolder() -> URL {
        fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("Kajron Atomic Studio/Graphics", isDirectory: true)
    }
    func readGraphics() -> [[String: String]] {
        let folder = graphicsFolder()
        let files = ((try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []).filter { $0.pathExtension == "json" }.prefix(64)
        var total = 0
        return files.compactMap { url in
            guard let metadata = try? Data(contentsOf: url),
                  let item = try? JSONSerialization.jsonObject(with: metadata) as? [String: String],
                  let id = item["id"], id.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
                  url.deletingPathExtension().lastPathComponent == id, let name = item["name"] else { return nil }
            let file = folder.appendingPathComponent(id + ".png")
            guard let attrs = try? fm.attributesOfItem(atPath: file.path), (attrs[.size] as? Int ?? 0) <= 8_000_000,
                  let data = try? Data(contentsOf: file), data.starts(with: [137,80,78,71,13,10,26,10]) else { return nil }
            total += data.count
            guard total <= 64_000_000 else { return nil }
            return ["id": id, "name": String(name.prefix(160)), "data": data.base64EncodedString()]
        }
    }
    func storeGraphics(_ value: Any?) throws -> [[String: String]] {
        guard let assets = value as? [[String: String]], assets.count <= 12 else { throw StudioError("Najviše 12 slika po projektu.") }
        let library = readGraphics()
        var known = Set(library.compactMap { $0["id"] })
        var total = library.reduce(0) { $0 + (Data(base64Encoded: $1["data"] ?? "")?.count ?? 0) }
        var prepared: [(String,String,Data)] = []
        for asset in assets {
            guard let encoded = asset["data"], encoded.count <= 11_000_000,
                  let bytes = Data(base64Encoded: encoded), bytes.count <= 8_000_000,
                  bytes.starts(with: [137,80,78,71,13,10,26,10]) else { throw StudioError("Slika nije ispravna.") }
            let id = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            if let supplied = asset["id"], supplied != id { throw StudioError("Slika nije ispravna.") }
            if !known.contains(id) {
                total += bytes.count
                known.insert(id)
                guard known.count <= 64, total <= 64_000_000 else { throw StudioError("Biblioteka grafika je puna (64 slike / 64 MB).") }
            }
            prepared.append((id, String((asset["name"] ?? "Graphic").prefix(160)), bytes))
        }
        let folder = graphicsFolder()
        try fm.createDirectory(at: folder, withIntermediateDirectories: true)
        for (id, name, bytes) in prepared {
            try bytes.write(to: folder.appendingPathComponent(id + ".png"), options: .atomic)
            try JSONSerialization.data(withJSONObject: ["id":id,"name":name]).write(to: folder.appendingPathComponent(id + ".json"), options: .atomic)
        }
        return prepared.map { ["id":$0.0,"name":$0.1,"data":$0.2.base64EncodedString()] }
    }
    func importGraphics(_ body: [String: Any]) {
        let panel = NSOpenPanel()
        panel.title = self.L("Dodaj grafike i slike")
        panel.allowedContentTypes = ["png","jpg","jpeg","webp","svg"].compactMap { UTType(filenameExtension:$0) }
        panel.allowsMultipleSelection = true
        panel.beginSheetModal(for: window) { response in
            guard response == .OK else { return }
            var images: [[String: String]] = []
            var warnings: [String] = []
            let types = ["png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","webp":"image/webp","svg":"image/svg+xml"]
            for url in panel.urls.prefix(12) {
                do {
                    guard let mime = types[url.pathExtension.lowercased()] else { throw StudioError(self.L("Izaberi PNG, JPG, WebP ili SVG.")) }
                    let attrs = try self.fm.attributesOfItem(atPath: url.path)
                    guard (attrs[.size] as? Int ?? 0) <= 20_000_000 else { throw StudioError(self.L("Ulazna slika je prevelika (najviše 20 MB).")) }
                    let data = try Data(contentsOf:url)
                    images.append(["name":url.lastPathComponent,"mime":mime,"data":data.base64EncodedString()])
                } catch { warnings.append(url.lastPathComponent + ": " + error.localizedDescription) }
            }
            if panel.urls.count > 12 { warnings.append(self.L("Najviše 12 slika po projektu.")) }
            self.send(["type":"graphicsImported","images":images,"kind":body["kind"] as? String == "background" ? "background" : "image","warning":warnings.prefix(3).joined(separator:" · ")])
        }
    }

    func fontFolder() -> URL {
        fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("Kajron Atomic Studio/Fonts", isDirectory: true)
    }
    func readFonts() -> [[String: String]] {
        let folder = fontFolder()
        let files = ((try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []).filter { $0.pathExtension == "json" }.prefix(32)
        return files.compactMap { url in
            guard let metadata = try? Data(contentsOf: url),
                  let item = try? JSONSerialization.jsonObject(with: metadata) as? [String: String],
                  let filename = item["file"], filename.range(of: "^[a-f0-9]{64}\\.(ttf|otf|woff|woff2)$", options: .regularExpression) != nil,
                  let family = item["family"], let label = item["label"],
                  let data = try? Data(contentsOf: folder.appendingPathComponent(filename)), data.count <= 10_000_000 else { return nil }
            return ["family": family, "label": label, "data": data.base64EncodedString()]
        }
    }
    func validFontHeader(_ data: Data) -> Bool {
        let headers = [Data([0, 1, 0, 0]), Data("OTTO".utf8), Data("true".utf8), Data("wOFF".utf8), Data("wOF2".utf8)]
        return data.count >= 12 && headers.contains(Data(data.prefix(4)))
    }
    func importFonts() {
        let panel = NSOpenPanel()
        panel.title = self.L("Dodaj fontove u Kajron Atomic Studio")
        panel.allowedContentTypes = ["ttf", "otf", "woff", "woff2"].compactMap { UTType(filenameExtension: $0) }
        panel.allowsMultipleSelection = true
        panel.beginSheetModal(for: window) { response in
            guard response == .OK else { return }
            do {
                let folder = self.fontFolder()
                try self.fm.createDirectory(at: folder, withIntermediateDirectories: true)
                var selected: String?
                var total = self.readFonts().reduce(0) { $0 + (Data(base64Encoded: $1["data"] ?? "")?.count ?? 0) }
                var warnings: [String] = []
                for url in panel.urls {
                    do {
                    let ext = url.pathExtension.lowercased()
                    guard ["ttf", "otf", "woff", "woff2"].contains(ext) else { throw StudioError(self.L("Izaberi TTF, OTF, WOFF ili WOFF2 font.")) }
                    let attrs = try self.fm.attributesOfItem(atPath: url.path)
                    guard (attrs[.size] as? Int ?? 0) <= 10_000_000 else { throw StudioError(self.L("Font je prevelik. Najveća veličina pojedinačnog fonta je 10 MB.")) }
                    let data = try Data(contentsOf: url)
                    guard self.validFontHeader(data) else { throw StudioError(self.L("Izaberi ispravan font.")) }
                    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                    var filename = hash + "." + ext
                    let metadata = folder.appendingPathComponent(hash + ".json")
                    if let previousData = try? Data(contentsOf: metadata),
                       let previous = try? JSONSerialization.jsonObject(with: previousData) as? [String: String],
                       let previousFile = previous["file"], previousFile.hasPrefix(hash + "."),
                       previousFile.range(of: "^[a-f0-9]{64}\\.(ttf|otf|woff|woff2)$", options: .regularExpression) != nil {
                        filename = previousFile
                    }
                    if !self.fm.fileExists(atPath: folder.appendingPathComponent(filename).path) {
                        guard self.readFonts().count < 32, total + data.count <= 40_000_000 else { throw StudioError(self.L("Biblioteka fontova je puna (32 fonta / 40 MB).")) }
                        try data.write(to: folder.appendingPathComponent(filename), options: .atomic)
                        total += data.count
                    }
                    let family = "AtomicFont_" + hash
                    let item = ["family": family, "label": url.deletingPathExtension().lastPathComponent, "file": filename]
                    try JSONSerialization.data(withJSONObject: item).write(to: folder.appendingPathComponent(hash + ".json"), options: .atomic)
                    selected = family
                    } catch { warnings.append(url.lastPathComponent + ": " + error.localizedDescription) }
                }
                self.send(["type": "fontsLoaded", "fonts": self.readFonts(), "selectedFamily": selected ?? "", "warning": warnings.prefix(3).joined(separator: " · ")])
            } catch { self.send(["type": "notice", "message": "Font nije dodat: \(error.localizedDescription)"]) }
        }
    }

    @objc func openProject() {
        let panel = NSOpenPanel()
        panel.title = self.L("Otvori Kajron Atomic Studio projekat")
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let attrs = try self.fm.attributesOfItem(atPath: url.path)
                guard (attrs[.size] as? Int ?? 0) <= 64_000_000 else { throw StudioError(self.L("Projekat je prevelik.")) }
                let data = try Data(contentsOf: url)
                let object = try JSONSerialization.jsonObject(with: data)
                self.send(["type": "projectLoaded", "project": object])
            } catch { self.send(["type": "notice", "message": self.L("Projekat nije učitan. Izaberi ispravan Kajron Atomic Studio JSON fajl.")]) }
        }
    }
    func saveProjectFile(_ body: [String: Any]) {
        guard let contents = body["contents"] as? String, contents.utf8.count <= 64_000_000 else { return }
        let panel = NSSavePanel()
        panel.title = self.L("Sačuvaj projekat")
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "kajron-projekat.json"
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try Data(contents.utf8).write(to: url, options: .atomic)
                self.send(["type": "notice", "message": "Projekat je sačuvan: \(url.lastPathComponent)"])
            } catch { self.send(["type": "notice", "message": "Projekat nije sačuvan: \(error.localizedDescription)"]) }
        }
    }

    func beginExport(_ body: [String: Any]) {
        guard process == nil, jobFolder == nil else { send(["type": "failed", "message": self.L("Sačekaj da se tekući izvoz završi.")]); return }
        guard let ext = body["format"] as? String, ["webm", "mov", "mp4"].contains(ext),
              let name = body["name"] as? String,
              let args = body["args"] as? [String], args.count < 150,
              let layers = body["layers"] as? [String: String],
              ["base", "track", "fg", "mask"].allSatisfy({ layers[$0] != nil }) else {
            send(["type": "failed", "message": self.L("Podaci za izvoz nisu ispravni.")]); return
        }
        totalFrames = max(1, body["frames"] as? Int ?? 1)
        let panel = NSSavePanel()
        panel.title = self.L("Izvezi kajron kao video")
        panel.message = self.L("Sačuvaj video, pa ga u OBS-u dodaj kao Media Source i uključi Loop.")
        panel.allowedContentTypes = [ext == "mp4" ? .mpeg4Movie : ext == "mov" ? .quickTimeMovie : (UTType(filenameExtension: "webm") ?? .movie)]
        panel.allowsOtherFileTypes = false
        panel.isExtensionHidden = false
        panel.canSelectHiddenExtension = false
        panel.directoryURL = fm.urls(for: .desktopDirectory, in: .userDomainMask).first
        panel.nameFieldStringValue = name
        panel.canCreateDirectories = true
        cancelRequested = false
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, var target = panel.url else { self.send(["type": "cancelled"]); return }
            if target.pathExtension.lowercased() != ext { target = target.appendingPathExtension(ext) }
            do {
                let folder = self.fm.temporaryDirectory.appendingPathComponent("kajron-\(UUID().uuidString)", isDirectory: true)
                try self.fm.createDirectory(at: folder, withIntermediateDirectories: true)
                self.jobFolder = folder
                let names = ["base": "base.png", "track": "track.png", "fg": "foreground.png", "mask": "mask.png"]
                for (key, filename) in names {
                    guard let data = Data(base64Encoded: layers[key]!), data.count < 100_000_000 else { throw StudioError(self.L("Slika kajrona nije ispravna.")) }
                    try data.write(to: folder.appendingPathComponent(filename))
                }
                var nativeArgs = args
                guard nativeArgs.last == "kajron.\(ext)" else { throw StudioError(self.L("Format izlaza nije ispravan.")) }
                nativeArgs[nativeArgs.count - 1] = "output.\(ext)"
                nativeArgs.insert(contentsOf: ["-f", ext], at: nativeArgs.count - 1)
                nativeArgs.insert(contentsOf: ["-nostdin", "-hide_banner", "-progress", "pipe:1", "-nostats"], at: 0)
                let engine = Bundle.main.resourceURL!.appendingPathComponent("bin/ffmpeg")
                let task = Process()
                task.executableURL = engine
                task.arguments = nativeArgs
                task.currentDirectoryURL = folder
                let pipe = Pipe()
                self.progressPipe = pipe
                task.standardOutput = pipe
                let log = folder.appendingPathComponent("encoder.log")
                self.fm.createFile(atPath: log.path, contents: nil)
                self.errorHandle = try FileHandle(forWritingTo: log)
                task.standardError = self.errorHandle
                self.progressBuffer = ""
                pipe.fileHandleForReading.readabilityHandler = { handle in
                    let data = handle.availableData
                    guard !data.isEmpty, let chunk = String(data: data, encoding: .utf8) else { return }
                    DispatchQueue.main.async { self.readProgress(chunk) }
                }
                task.terminationHandler = { task in
                    DispatchQueue.main.async { self.finishExport(status: task.terminationStatus, target: target, ext: ext) }
                }
                self.process = task
                try task.run()
                self.send(["type": "progress", "value": 5, "message": self.L("Pravljenje lokalnog video-fajla…")])
            } catch {
                self.cleanJob()
                self.send(["type": "failed", "message": "Izvoz nije pokrenut: \(error.localizedDescription)"])
            }
        }
    }

    func readProgress(_ chunk: String) {
        progressBuffer += chunk
        let lines = progressBuffer.components(separatedBy: "\n")
        progressBuffer = lines.last ?? ""
        for line in lines.dropLast() where line.hasPrefix("frame=") {
            if let frame = Int(line.dropFirst(6).trimmingCharacters(in: .whitespacesAndNewlines)) {
                send(["type": "progress", "value": min(99, 5 + Double(frame) / Double(totalFrames) * 94), "message": "Pravljenje videa · \(frame) / \(totalFrames) frejmova"])
            }
        }
    }
    func finishExport(status: Int32, target: URL, ext: String) {
        guard let folder = jobFolder else { return }
        defer { cleanJob() }
        if cancelRequested { send(["type": "cancelled"]); return }
        guard status == 0 else {
            let log = (try? String(contentsOf: folder.appendingPathComponent("encoder.log"), encoding: .utf8)) ?? ""
            let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("Kajron Atomic Studio", isDirectory: true)
            try? fm.createDirectory(at: support, withIntermediateDirectories: true)
            try? log.write(to: support.appendingPathComponent("last-export.log"), atomically: true, encoding: .utf8)
            send(["type": "failed", "message": self.L("Izvoz nije završen. Probaj manju rezoluciju ili samo traku. Detalji su u Application Support/Kajron Atomic Studio/last-export.log.")])
            return
        }
        let output = folder.appendingPathComponent("output.\(ext)")
        let partial = target.deletingLastPathComponent().appendingPathComponent(".kajron-\(UUID().uuidString).\(ext)")
        defer { try? fm.removeItem(at: partial) }
        do {
            let size = (try fm.attributesOfItem(atPath: output.path)[.size] as? Int) ?? 0
            guard size > 0 else { throw StudioError(self.L("Video-fajl je prazan.")) }
            try fm.copyItem(at: output, to: partial)
            if fm.fileExists(atPath: target.path) { _ = try fm.replaceItemAt(target, withItemAt: partial) }
            else { try fm.moveItem(at: partial, to: target) }
            completedURL = target
            send(["type": "complete", "path": target.path, "name": target.lastPathComponent, "bytes": size, "format": ext])
        } catch { send(["type": "failed", "message": "Video nije sačuvan: \(error.localizedDescription)"]) }
    }
    func cleanJob() {
        progressPipe?.fileHandleForReading.readabilityHandler = nil
        try? errorHandle?.close()
        errorHandle = nil
        progressPipe = nil
        process = nil
        if let folder = jobFolder { try? fm.removeItem(at: folder) }
        jobFolder = nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if process != nil {
            let alert = NSAlert()
            alert.messageText = self.L("Izvoz videa je u toku.")
            alert.informativeText = self.L("Zatvaranje aplikacije će otkazati tekući izvoz.")
            alert.addButton(withTitle: self.L("Nastavi izvoz"))
            alert.addButton(withTitle: self.L("Otkaži izvoz i zatvori"))
            if alert.runModal() == .alertFirstButtonReturn { return .terminateCancel }
            cancelRequested = true
            process?.terminate()
            process?.waitUntilExit()
            cleanJob()
        }
        return .terminateNow
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

struct StudioError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

let app = NSApplication.shared
let studio = Studio()
app.setActivationPolicy(.regular)
app.delegate = studio
app.run()
