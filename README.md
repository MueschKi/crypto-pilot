# CryptoPilot – Intelligent Crypto Trading System

**Einfacher, sicherer Forschungsstart für die jeweils 20 größten Kryptowährungen nach Marktkapitalisierung.** Keine Cloudflare-Infrastruktur, kein Kraken-Konto, keine Zugangsdaten, keine echten Orders.

## Funktionsumfang

- **Dynamische Top 20:** CoinGecko /coins/markets (EUR-Marktkapitalisierung); keine dauerhaft festgelegte Coin-Liste.
- **Kraken ohne Login:** öffentliche EUR-Handelspaare und abgeschlossene Tageskerzen.
- **Einfache Trendstrategie:** SMA20 über SMA50, Signale nur aus abgeschlossenen Kerzen, hypothetische Ausführung zur nächsten Tageseröffnung.
- **Kosten in Simulationen:** 0,4 % Gebühren und 0,1 % Slippage je Handelsseite; 40 % maximale Einzelcoin-Exposition.
- **Keine falsche Abdeckung:** Stablecoins bleiben in der Übersicht, werden aber nicht als spekulativer Trendtrade betrachtet. Unbekannte Coin-IDs oder nicht verfügbare EUR-Handelspaare werden klar ausgewiesen; keine Ersatzcoins von Platz 21+.
- **Wichtig:** Jeder Python-Backtest simuliert für sich 1.000 EUR. Das separate Safari-Dashboard besitzt inzwischen ein browserlokales virtuelles Depot; es ist kein dauerhaft laufendes Cloud-Depot. Keine KI mit nachgewiesenem Prognosevorteil.

## Safari-Dashboard (aktuell: v3.8)

Die öffentliche GitHub-Pages-Website ist unter **https://mueschki.github.io/crypto-pilot/** erreichbar. Das browserbasierte Dashboard zeigt:

- Top-20-Marktkapitalisierungs-Rangliste (CoinGecko), sofern die öffentliche API verfügbar ist; EUR-Ticker von Kraken per öffentlichem WebSocket, soweit passende Handelspaare vorhanden sind.
- Echte Kraken-1-Minuten-Kerzen für den ausgewählten Coin, Zoom (15/30/60/90 Kerzen), Tippen auf einen Coin in der Marktübersicht und Markierungen virtueller Orders.
- **Signal-Cockpit (v3.8):** rein beobachtende 60-Sekunden-Tick-Auswertung mit Richtung, Spread und Datenqualität. **Nicht** identisch mit der separaten einfachen Paper-Momentumstrategie, kein validiertes Prognosemodell und keine automatischen Empfehlungen.
- Browserlokales simuliertes Depot (1.000 EUR Startwert), CSV-Orderjournal und simulierte Positionsbewertung. Paper-Autohandel wird bei jedem Seitenstart ausdrücklich neu eingeschaltet und bei relevanten Verbindungsabbrüchen beendet.

**Wichtige Betriebsgrenzen:** Die Safari-Seite muss für neue virtuelle Trades geöffnet bleiben, und iOS kann Hintergrund-Tabs anhalten. Es gibt noch **keinen** zuverlässigen serverseitigen 24/7-Paper-Prozess. Kein realer Kraken-Kontozugriff, keine echten Orders, keine API-Schlüssel. Auch die Signalbewertung beweist keinen Gewinnvorteil.

## Bedienung am iPhone – ohne Terminal

1. Repository öffnen: https://github.com/MueschKi/crypto-pilot
2. **Actions → Offline-Tests → Run workflow**: synthetische Tests und Demolauf.
3. **Automatisch täglich**: CryptoPilot führt den Top-20-Marktbericht gegen 06:17 UTC über GitHub Actions aus (bei GitHub sind Verzögerungen möglich). Du kannst **Actions → CryptoPilot Top-20-Marktbericht → Run workflow** zusätzlich jederzeit manuell starten.
4. Die Ergebnisse im jeweiligen Actions-Lauf direkt unter **Summary** ansehen oder als Artifact `crypto-pilot-market-report` herunterladen (JSON-Datei, 7 Tage verfügbar).

GitHub Actions kann bei öffentlichen API-Anbietern auf Rate-Limits treffen. Fehlende Daten werden als solche berichtet, nicht als Kauf- oder Verkaufsempfehlung interpretiert.

## Lokal testen

```bash
python -m unittest discover -s tests -v
python src/bot.py demo
python src/bot.py market
```

Benötigt Python 3.11+, keine Python-Drittanbieterpakete.

## Einordnung der Ergebnisse

Die heutige Top-20-Auswahl verursacht bei historischen Rückrechnungen einen **Selection-/Survivorship-Bias**. Für valide Top-20-Portfoliotests müssen wir stichtagsgerechte historische Ranglisten speichern und aufeinanderfolgende Zeitfenster getrennt prüfen. Kein Backtest garantiert künftige Erträge.

## Nächste Schritte

1. Öffentliche Datenqualität und Kraken-Mapping verifizieren, tägliche Ranglisten historisieren.
2. Browserlokales Paper-Depot durch einen explizit separat freizugebenden, testbaren Cloud-Paper-Dienst ersetzen – mit persistentem Journal, Verlustlimits und konsistentem Status.
3. Strategien reproduzierbar gegen Buy-and-Hold mit Walk-Forward-Prüfungen vergleichen; KI nur bei messbarem Mehrwert.
4. Echte Orders ausschließlich nach neuer ausdrücklicher Freigabe und mit Not-Aus/Orderabgleich. **Standardmäßig gesperrt.**

## Altes Projekt und Datenschutz

Das alte Repository `MueschKi/krypto-master-network` wird erst **nach** Prüfung der Übergabe vom Besitzer archiviert, nicht gelöscht. Bestehende Cloudflare-D1-Daten oder Codespaces bleiben unangetastet, bis ihre Berechtigungen und Aufbewahrung separat geprüft wurden.

**Repository-Sichtbarkeit:** Dieses GitHub-Repository wird momentan als **PUBLIC** angezeigt. Für die gewünschte private Nutzung unter Settings → General → Danger Zone → Change repository visibility auf PRIVATE umstellen. Hier liegen ausschließlich öffentliche Forschungsprogramme ohne Kontodaten.
