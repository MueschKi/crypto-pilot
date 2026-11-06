# GitHub Pages – Veröffentlichungsprüfung

Die Website wird aus `main/docs` bereitgestellt; die Startdatei ist
`docs/index.html`. GitHub Pages muss in den Repository-Einstellungen unter
**Settings → Pages → Build and deployment → Deploy from a branch**
mit **main** und **/docs** konfiguriert sein.

Der Workflow `Published Pages smoke check` ruft nach Änderungen an
`docs/**` oder manuell die öffentliche URL
https://mueschki.github.io/crypto-pilot/ ab und prüft HTTP-Erfolg und
die erwartete CryptoPilot-HTML-Kennung. Ein grüner Offline-Test allein
belegt **keine** erfolgreiche Online-Veröffentlichung.

Bei fehlgeschlagenem Smoke-Check: GitHub Pages Source/Domain prüfen,
Pages-Deployment-Status kontrollieren und die Aktion nach Behebung
manuell neu starten. Der Check prüft nur HTTP/HTML, **nicht** WebSocket,
Kraken/CoinGecko, Safari-Bedienung oder einen Cloud-Paper-Dauerlauf.

Keine Echtgeldausführung, keine Kraken-Kontozugangsdaten.
