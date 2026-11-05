# CryptoPilot – Produktreife-Fahrplan

**Ziel:** Eine nachvollziehbare, auf dem iPhone bedienbare, dauerhaft laufende **Cloud-Paper-Trading-Plattform** ohne Echtgeld-Kontozugriff. Automatische Kauf-/Verkaufsentscheidungen müssen vollständig reproduzierbar sein; künftige Gewinne sind nicht garantiert und gehören nicht zu den Abnahmekriterien.

## Aktueller Stand (v4.5)

- GitHub Pages: Marktübersicht, Live-Kraken-EUR-Ticker, Minute-Kerzenchart, browserlokales virtuelles Depot und Orderjournal.
- Auf Wunsch: historische Strategy-Lab-Vergleiche, empirisches Prognose-Labor mit unsicheren Bandbreiten, Forward-Prognosejournal und nachträgliche Ergebnisprüfung.
- Neu: feste, **nicht handelnde Schattenstrategie** gegen Kaufen-und-Halten im identischen Testabschnitt unter denselben Gebühren und Slippage.
- **Wichtig:** Der aktive browserlokale Paper-Bot ist nicht identisch mit der Prognose-Schattenstrategie. Bei geschlossenem/angehaltenem Safari handelt er nicht.

## Verbindliche Reihenfolge

1. **Prüfbare Forschungsbasis:** reale, persistierte abgeschlossene OHLC- und später Tickdaten mit Quellenzeitstempel, Lückenmarkierung, Datenversion und reproduzierbarer Offline-Testmöglichkeit. Keine synthetischen Preise in produktiven Erfolgskurven.
2. **Vergleichbare Strategien:** identische Zeiträume, identische Kapital-/Positionslimits, Gebühren und Slippage, keine Testdaten-Optimierung, Buy-and-Hold und unveränderte v4.0-Baseline. Bewertung von Nettoertrag, Drawdown, Durchführbarkeit und Fehlerfällen; Schattenstrategie darf nicht ungeprüft live handeln.
3. **Cloud-Paper-Engine:** persistente Datenbank für Portfolio, Order-IDs, Buchungsjournal und Risiko-Status; idempotente Orderverarbeitung, kontrollierte Jobs mit einem Lease/Lock, Feed-Freshness und robuste Wiederaufnahme nach Neustart. **Cloudflare-/Provider-Konfiguration und sichere Zugriffsrechte müssen vor Aktivierung geprüft werden.** Bis dahin bleibt die Browser-Paper-Engine getrennt.
4. **Sichere Bedienung:** Dashboard zeigt eindeutigen Zustand von Cloud-Paper vs. Browser-Paper, Einsatzlimits, Not-Aus und letzte bestätigte Daten. Mobil optimiert; erweiterte Diagnose eingeklappt. Niemals geheime Tokens oder nicht notwendige personenbezogene Daten in GitHub Pages.
5. **Abnahme:** CI-Tests, Fehler-/Neustart-/Ratenlimit-/Datenlücken-Tests, praktischer End-to-End-Paper-Lauf im Cloud-Betrieb mit dokumentierter Dauer und Journalabgleich, veröffentlichte iPhone-Oberfläche, keine offenen kritischen Sicherheitsfehler.

## Nicht akzeptabel

- Keine echten Kraken-Orders oder privaten API-Anfragen ohne gesonderte ausdrückliche Erlaubnis.
- Kein Zahlenversprechen und keine rückblickend als „Vorhersage“ deklarierten Einstiegs-/Hochkurse.
- Kein stillschweigender Wechsel von Browser-Kapital/Portfolio auf Cloud.
- Keine Aussage „fertiges Produkt“, solange ein 24/7-Paper-Lauf und die oben genannten Abnahmekriterien fehlen.

**Entwicklungsberichterstattung:** Kurz, mit tatsächlich geprüfter Version, Tests und nächstem offenen Meilenstein. Keine Behauptungen über Arbeit, die nicht ausgeführt wurde.
