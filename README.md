# CryptoPilot – Intelligent Crypto Trading System

**Einfacher, sicherer Forschungsstart für die jeweils 20 größten Kryptowährungen nach Marktkapitalisierung.** Keine Cloudflare-Infrastruktur, kein Kraken-Konto, keine Zugangsdaten, keine echten Orders.

## Funktionsumfang

- **Dynamische Top 20:** CoinGecko /coins/markets (EUR-Marktkapitalisierung); keine dauerhaft festgelegte Coin-Liste.
- **Kraken ohne Login:** öffentliche EUR-Handelspaare und abgeschlossene Tageskerzen.
- **Einfache Trendstrategie:** SMA20 über SMA50, Signale nur aus abgeschlossenen Kerzen, hypothetische Ausführung zur nächsten Tageseröffnung.
- **Kosten in Simulationen:** 0,4 % Gebühren und 0,1 % Slippage je Handelsseite; 40 % maximale Einzelcoin-Exposition.
- **Keine falsche Abdeckung:** Stablecoins bleiben in der Übersicht, werden aber nicht als spekulativer Trendtrade betrachtet. Unbekannte Coin-IDs oder nicht verfügbare EUR-Handelspaare werden klar ausgewiesen; keine Ersatzcoins von Platz 21+.
- **Wichtig:** Jeder Backtest simuliert für sich 1.000 EUR. **Noch kein gemeinsames virtuelles Portfolio**, kein kontinuierliches Paper-Trading, keine KI mit nachgewiesenem Prognosevorteil.

## Bedienung am iPhone – ohne Terminal

1. Repository öffnen: https://github.com/MueschKi/crypto-pilot
2. **Actions → Offline-Tests → Run workflow**: synthetische Tests und Demolauf.
3. **Actions → CryptoPilot Top-20-Marktbericht → Run workflow**: öffentliche aktuelle Top-20-Daten abrufen.
4. Die Ergebnisse unter dem jeweiligen Lauf als Artifact `crypto-pilot-market-report` herunterladen (JSON-Datei, 7 Tage verfügbar). Der Job zeigt zusätzlich eine kurze Coin-Übersicht.

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
2. Gemeinsames virtuelles Depot über 1.000 EUR inklusive Verlustlimits, Orderjournal und nachvollziehbarer Transaktionskosten.
3. Strategien reproduzierbar gegen Buy-and-Hold mit Walk-Forward-Prüfungen vergleichen; KI nur bei messbarem Mehrwert.
4. Echte Orders ausschließlich nach neuer ausdrücklicher Freigabe und mit Not-Aus/Orderabgleich. **Standardmäßig gesperrt.**

## Altes Projekt und Datenschutz

Das alte Repository `MueschKi/krypto-master-network` wird erst **nach** Prüfung der Übergabe vom Besitzer archiviert, nicht gelöscht. Bestehende Cloudflare-D1-Daten oder Codespaces bleiben unangetastet, bis ihre Berechtigungen und Aufbewahrung separat geprüft wurden.

**Repository-Sichtbarkeit:** Dieses GitHub-Repository wird momentan als **PUBLIC** angezeigt. Für die gewünschte private Nutzung unter Settings → General → Danger Zone → Change repository visibility auf PRIVATE umstellen. Hier liegen ausschließlich öffentliche Forschungsprogramme ohne Kontodaten.
