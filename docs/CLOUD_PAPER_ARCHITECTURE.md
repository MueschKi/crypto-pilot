# Cloud-Paper: geplante Architektur (noch nicht bereitgestellt)

## Ist-Zustand
Die Weboberfläche v4.8 führt ausschließlich Browser-Paper-Simulationen aus. Ihr Ledger liegt in localStorage. Es gibt keinen Cloud-Paper-Server, keine synchronisierte Wallet und keine 24/7-Ausführung. Das Python-SQLite-Ledger in `src/sqlite_paper_store.py` ist ein lokaler Forschungsbaustein, kein Cloud-Backend.

## Zielbild
1. Ein Cloudflare Worker stellt eine authentifizierte **Paper-only** API bereit; keine Kraken-Privatschlüssel und keine Echtgeld-Endpunkte.
2. Ein einzelner Durable-Object-Koordinator pro virtuellem Depot serialisiert alle Mutationen und besitzt den einzigen Ausführungs-Loop. Durable Object Storage persistiert Order-ID, Zustand, Risikolimits, Not-Aus und append-only Ereignisse atomar. Kein paralleler Browser-Writer.
3. Jeder simulierte Fill erhält eine eindeutige idempotente Order-ID und einen monotonic sequence-Wert; Replay und Abgleich rekonstruieren den Depotstand. Kein Fill ohne persistierte Transaktion.
4. Authentifizierung, Mandantentrennung, Rate-Limits, Audit-Trail, Datenexport und ausdrückliches Opt-in vor Serveraktivierung. Ein Server-Not-Aus blockiert neue virtuelle Orders, bis eine ausdrückliche Freigabe erfolgt.
5. Validierte Kraken-Marktdaten: Quellenkennung, Zeitstempel, Frischegrenze, Spread und Gebühren. Feed-Ausfall oder unklare Ausführungsreihenfolge = keine neuen Orders.
6. Migration: Browser-Depot **niemals automatisch** in die Cloud übernehmen; zuerst Export, Prüfung, bewusste Bestätigung. Der Cloud-Modus erhält eine separate Identität und klare UI-Anzeige.

## Freigabekriterien
- Isolierte Integrationstests für Wiederholungen, Konkurrenz, Neustart, Speicherfehler, Not-Aus und stale market data.
- Geprüfte Cloudflare-Bereitstellung, authentifizierter Status-Endpunkt, kontrollierter Paper-Testlauf und 24/7-Monitoring.
- UI unterscheidet klar Browser-Paper von Cloud-Paper und zeigt niemals einen unbestätigten Cloud-Status als aktiv.
- Echtgeldhandel bleibt technisch und produktseitig gesperrt. Eine spätere Live-Integration wäre ein gesondertes Projekt mit ausdrücklicher Freigabe.
