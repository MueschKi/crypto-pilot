# PUCK PULSE · Native Android/iOS

Die native App lädt **keine Webseite**. Sie bündelt exakt die Dateien, die Cloudflare als Browser-Spiel ausliefert: `../puck-pulse/index.html`, `manifest.webmanifest` und `icon.svg`. Die Navigation, Touch-Steuerung, Musik, KI und Power-ups laufen lokal in der WebView.

## Entwicklung

Voraussetzungen: Node.js, aktuelles Android Studio (Android) bzw. macOS mit Xcode (iOS). Capacitor 8 ist vorgesehen.

```bash
cd puck-pulse-native
npm install
npm run web:sync
npm run android:add     # einmalig
npm run cap:sync
npm run android:open
```

Für iOS an einem Mac entsprechend `npm run ios:add`, `npm run cap:sync`, `npm run ios:open`.

Nach jeder Änderung der Browser-Oberfläche **`npm run cap:sync`** aufrufen. Der Build kopiert danach dieselben Assets ins installierte App-Paket. Die Bundle-ID lautet vorläufig `de.mueschki.puckpulse`.

## Wichtige Grenzen

Die Capacitor-Konfiguration und der deterministische Web-Asset-Kopiervorgang sind vorbereitet und werden in CI verglichen. **Es wurde hier noch keine signierte APK, AAB oder IPA erzeugt**; dazu müssen die nativen Projekte initialisiert und in Android Studio bzw. Xcode erstellt werden. Für die Store-Version werden eigene hochauflösende Launcher-Icons, Store-Grafiken, Datenschutztexte und Plattformtests benötigt. Die Oberfläche selbst muss nicht neu geschrieben werden.

Der Worker wird separat über `puck-pulse-worker.jsonc` aus dem vorhandenen GitHub-Workflow ausgerollt. Der Rest dieses Repositorys bleibt unberührt.
