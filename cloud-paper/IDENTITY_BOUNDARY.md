# Cloud-Paper: Identitäts- und Sitzungsgrenze

Die öffentliche Web-App ist **kein** Identity Provider. Der Worker akzeptiert ausschließlich signierte, kurzlebige Tokens eines zukünftigen vertrauenswürdigen serverseitigen Ausstellers. Die Ausstellungsbibliothek ist nicht über HTTP erreichbar und darf nie mit einem geheimen Schlüssel in einen Browser-Build gelangen.

Für jede Anfrage überprüft der Worker die Signatur und anschließend den separaten `PAPER_SESSIONS` Durable Object pro `sub`. Er verweigert bei Speicher-/Verbindungsfehlern den Zugriff (503), bevor das Depot angesprochen wird. Das Session-DO kennt einen Sperrzeitpunkt `revokedBefore` und gesperrte `jti`; ein administrativer Widerrufsendpunkt ist bewusst **nicht** öffentlich erreichbar. Das Test-Harness kann den Sperrzeitpunkt intern setzen. Eine authentifizierte, autorisierte administrative Sperrverwaltung ist **noch nicht implementiert**.

Der bestehende Selbstwiderruf bleibt pro Wallet erhalten. Für eine produktive Lösung sind ein vertrauenswürdiger Login-Dienst (z. B. OIDC), zentrale Token-Ausstellung, Session-Verwaltung mit verifizierten Schreibberechtigungen, Schlüsselrotation, Rate-Limits, CSRF-/XSS-Konzept und ein vollständiger Security Review erforderlich.

**Keine Cloud-Bereitstellung. Echtgeld-Trading gesperrt.**
