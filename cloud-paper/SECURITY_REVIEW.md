# Cloud-Paper Sicherheitsprüfung – nicht zur Bereitstellung freigegeben

Status: **experimenteller Prototyp, nicht bereitgestellt**.

## Wesentliche Sperren
- Das einzelne globale `PAPER_API_TOKEN` ist **keine** sichere benutzerbezogene Authentifizierung. Es darf **niemals** in `docs/`, Browser-JavaScript, einem öffentlichen Repository oder einer Client-Konfiguration hinterlegt werden. Vor Browser-Anbindung ist ein vertrauenswürdiger Auth-Gateway mit Benutzeridentität, serverseitiger Token-Verifikation, Wallet-Ownership und Widerruf erforderlich.
- Die Wallet ist derzeit global auf `single-preview-wallet` festgelegt. **Keine** Mandantentrennung: niemals für mehrere Benutzer freischalten.
- Der Prototyp nimmt virtuelle Fills direkt per API an. Für automatisches Cloud-Paper-Trading fehlen ein serverseitiger Signal-/Order-Prozess, vertrauenswürdige Marktdaten, serverseitige Risikoprüfung und Herkunftsprüfung für Preise.
- Transaktionale Durable-Object-Speicherung ist im Node-Test nur simuliert. Vor Freigabe: echte Cloudflare-Laufzeit-/SQLite-DO-Tests, Neustart-/Alarm-/Race-Tests und Ausfallinjektion.
- Der persistente Not-Aus hat absichtlich keinen Resume-Endpunkt. Ein späteres Resume muss explizit autorisiert und auditiert werden.
- Operative Mindestanforderungen: Secret-Rotation, Rate-Limits, Zugriffsaudit, Monitoring, Backups/Export, Alarme, Deployment-Rollback, Kostenlimits und Datenschutzprüfung.

## Vorhandene Schutzmaßnahmen
- Ohne serverseitig gesetztes Secret werden Anfragen abgewiesen.
- Eingehende API-Aufrufe benötigen Bearer-Token; Worker nutzt eine nicht veröffentlichte DO-Bindung.
- Prototypische Fill-Verarbeitung ist auf virtuelle BTC/ETH/SOL/NEAR beschränkt, nutzt transaktionale Speicherung und lehnt Sequenzkonflikte, ungültige Zahlen, ungedeckte Verkäufe und Limits ab.
- Keine Kraken-Privat-API, kein Echtgeld-Endpunkt und keine produktive Worker-Route.

**Keine Cloud-Bereitstellung ohne separate Sicherheitsfreigabe.**
