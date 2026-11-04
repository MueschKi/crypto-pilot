# Evidence-first-Forschungsaufbau nach RohOnChain

Quelle: https://x.com/rohonchain/status/2109650293365305427

Der verlinkte Beitrag beschreibt Daten, Rechenleistung und Trading als drei getrennte
Schichten und stellt QuantGPT als Produkt vor. CryptoPilot übernimmt **die
Forschungsprinzipien**, nicht den Werbeanspruch und nicht die Abhängigkeit von
QuantGPT. QuantGPT-Kosten, Verfügbarkeit oder dessen Krypto-Eignung sind
**nicht** Teil dieser Implementierung.

## Aktueller, tatsächlich implementierter Stand

1. Öffentliche Top-20-Marktkapitalisierung und Kraken-EUR-Paare ohne Anmeldung.
2. Feste SMA20/SMA50-Regel; nur geschlossene Tageskerzen als Signale;
   hypothetische Ausführung zur Eröffnung der nächsten Tageskerze.
3. Gebühren 0,4 % und Slippage 0,1 % pro Seite.
4. `src/research.py`: chronologisch getrennter Trainings- und Holdout-Test,
   zwei unabhängige Startkonten, Kosten-Benchmark (40 % Buy-and-Hold,
   60 % EUR-Reserve), Rendite, Drawdown, Sharpe (ohne risikofreien Zins).
5. GitHub Actions für Tests und öffentliche Analyse; **keine** echten Orders.

## Ergebnisetiketten

- **DATA_VALIDATED_PRELIMINARY:** Regel schlägt ihren Vergleich auf Rendite
  und Sharpe in beiden Zeiträumen; **keine** statistische Bestätigung.
- **TRADE_OFF:** Teilerfolg, kein belastbarer Vorteil.
- **NO_EDGE:** Kein untersuchter Vorteil nach den vier einfachen Prüfkriterien.

### Forschungsgrenzen

- Coin-Liste ist **heute** Top 20. Historische Ranglisten fehlen; die
  Einzelcoin-Rückrechnungen sind somit selektionsverzerrt.
- Kraken liefert über den öffentlichen OHLC-Endpunkt nur begrenzte Historie.
  Für jahrelange Out-of-Sample-Tests braucht es mehr historische Daten.
- Portfolio-Paper-Trading mit einem gemeinsamen 1.000-€-Depot ist **noch nicht
  implementiert**. Die vorhandenen Auswertungen sind einzeln pro Coin.
- Bei Strategietests über viele Parameter sind zusätzliche Zeitfenster und
  Korrekturen gegen Data-Snooping notwendig.
- API-Fehler verhindern Analysen; sie erzeugen keine Ersatzsignale.
- Keine KI-gesteuerte Strategieoptimierung oder automatischen Orders. Echtgeld
  bleibt technisch unimplementiert.

## Nächster Ausbau

Stichtagsgenaue Top-20-Snapshots historisieren, ein einziges virtuelles Depot
mit Journal und Not-Aus implementieren, Walk-Forward-Prüfungen ergänzen und
danach erst ein optionales KI-Modul zur Erstellung **prüfbarer** Hypothesen.
