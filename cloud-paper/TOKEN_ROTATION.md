# Token-Ausstellung und Schlüsselrotation – Sicherheitsentwurf

**Kein öffentlicher Token-Aussteller. Keine Cloud-Bereitstellung freigegeben.**

Das API-Gateway akzeptiert ausschließlich `v2.<kid>.<base64url(claims)>.<hex-hmac>` mit HMAC-SHA256. Der serverseitige Worker-Secret `PAPER_VERIFY_KEYS_JSON` enthält eine JSON-Map aus Key-IDs und mindestens 32 Zeichen langen geheimen Signaturschlüsseln, z. B. `{"key_2026_11":"<nur im Secret-Store>"}`. Niemals im Repository oder Browser speichern. Tokens enthalten `sub`, `iat`, `exp`, `jti` und festes `aud`; maximale Lebensdauer 60 Minuten, Ausstellung höchstens 30 Sekunden in der Zukunft.

## Vertrauenswürdige Ausstellung (noch nicht implementiert)
Ein eigenständiger, geschützter Identity-Service authentifiziert die Person, bestimmt eine nicht frei wählbare stabile `sub`, erzeugt eine kryptografisch zufällige `jti`, setzt kurze Laufzeit und signiert mit dem aktuellen Schlüssel. Die öffentliche Web-App darf weder Schlüssel noch eigene `sub` bestimmen. Der Worker stellt selbst keine Tokens aus.

## Rotation
1. Neuen Schlüssel ausschließlich im Secret-Store anlegen; alte Key-ID für die Restlaufzeit bestehender Tokens vorübergehend akzeptieren.
2. Token-Aussteller auf neue `kid` umstellen; alte Tokens höchstens bis zu ihrem `exp` akzeptieren.
3. Alten Schlüssel nach maximaler Token-Laufzeit aus der Verifikationsliste entfernen. Bei Kompromittierung sofort entfernen und sämtliche betroffenen Sitzungen zentral sperren.
4. Negative Tests: unbekannte `kid`, falsche Signatur, abgelaufenes Token, falsches `aud`, zu lange Gültigkeit, fehlendes `iat`, widerrufene `jti`.

## Verbleibende Sperren
Keine Authentifizierungs-/Token-Ausstellungsinfrastruktur, keine zentrale Session-Sperrliste, keine verifizierte Secret-Rotation in Produktion, kein Rate-Limit, kein vollständiger Sicherheitsreview. Cloud-Paper bleibt offline. Echtgeld ist technisch nicht angebunden.
