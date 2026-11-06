# Cloud-Paper Token-Lebenszyklus (Prototyp)

Die Cloud-Paper-API **stellt keine Tokens aus**. Tokens dürfen ausschließlich von einem zukünftigen vertrauenswürdigen serverseitigen Identity-Gateway ausgestellt werden, niemals von der öffentlichen Web-App. Für den Prototyp ist ein HMAC-SHA256-signiertes Token mit Format `v1.<base64url(JSON claims)>.<hex hmac>` vorgesehen. Claims: `sub` (stabile, nicht frei wählbare Benutzerkennung), `aud=cryptopilot-cloud-paper-preview`, `exp` (maximal 60 Minuten in der Zukunft), `jti` (einmalige zufällige Tokenkennung). Das Signatur-Secret `PAPER_SIGNING_KEY` muss ausschließlich serverseitig verwaltet werden.

Die Wallet wird nach **erfolgreicher** Signaturprüfung aus `sub` bestimmt. `POST /v1/paper/revoke` widerruft nur das aktuelle Token und speichert dessen `jti` dauerhaft in der Wallet. Nach Widerruf werden auch Statusabfragen verweigert. Das ist **kein globaler Sitzungswiderruf**; andere noch gültige Tokens desselben Benutzers bleiben aktiv. Eine produktive Lösung braucht einen zentralen Session-Revocation-Service, Key-Rotation, sichere Token-Ausstellung und Abuse-Schutz.

Der Node-Integrationstest nutzt eine Speicher-Simulation und **keine** Cloudflare-Laufzeit. Echte Durable-Object-Transaktions-, Neustart- und Ausfalltests in `workerd`/Miniflare sind Pflicht vor jeder Bereitstellung.

**Keine Deployment-Freigabe. Echtgeld bleibt gesperrt.**
