# CryptoPilot – Intelligent Crypto Trading System

**Einfacher, sicherer Forschungsstart für die jeweils 20 größten Kryptowährungen nach Marktkapitalisierung.** Keine Cloudflare-Infrastruktur, kein Kraken-Konto, keine Zugangsdaten, keine echten Orders.

## Funktionsumfang

- **Dynamische Top 20:** CoinGecko /coins/markets (EUR-Marktkapitalisierung); keine dauerhaft festgelegte Coin-Liste.
- **Kraken ohne Login:** öffentliche EUR-Handelspaare und abgeschlossene Tageskerzen.
- **Einfache Trendstrategie:** SMA20 über SMA50, Signale nur aus abgeschlossenen Kerzen, hypothetische Ausführung zur nächsten Tageseröffnung.
- **Kosten in Simulationen:** 0,4 % Gebühren und 0,1 % Slippage je Handelsseite; 40 % maximale Einzelcoin-Exposition.
- **Keine falsche Abdeckung:** Stablecoins bleiben in der Übersicht, werden aber nicht als spekulativer Trendtrade betrachtet. Unbekannte Coin-IDs oder nicht verfügbare EUR-Handelspaare werden klar ausgewiesen; keine Ersatzcoins von Platz 21+.
- **Wichtig:** Jeder Python-Backtest simuliert für sich 1.000 EUR. Das separate Safari-Dashboard besitzt inzwischen ein browserlokales virtuelles Depot; es ist kein dauerhaft laufendes Cloud-Depot. Keine KI mit nachgewiesenem Prognosevorteil.

## Safari-Dashboard (aktuell: v4.4)

Die öffentliche GitHub-Pages-Website ist unter **https://mueschki.github.io/crypto-pilot/** erreichbar. Das browserbasierte Dashboard zeigt:

**Audit v4.1:** [Funktions-, Sicherheits- und Strategieprüfung](docs/AUDIT_2026-11-04.md). Die mobilen Kernbereiche bleiben sichtbar; Signal-Cockpit, Strategy Lab, Orderjournal und Diagnose können ausgeklappt werden. Gespeicherte Paper-Depots werden auf Plausibilität geprüft und bei Fehlern nicht automatisch überschrieben. Gehaltene Coins bleiben im Kraken-Stream, auch wenn sie aus den Top 20 fallen. Eine lokale Lease soll parallele Paper-Ausführung in mehreren Safari-Tabs vermeiden, bietet aber keine Mehrgeräte-Garantie.

- Top-20-Marktkapitalisierungs-Rangliste (CoinGecko), sofern die öffentliche API verfügbar ist; EUR-Ticker von Kraken per öffentlichem WebSocket, soweit passende Handelspaare vorhanden sind.
- Echte Kraken-1-Minuten-Kerzen für den ausgewählten Coin, Zoom (15/30/60/90 Kerzen), Tippen auf einen Coin in der Marktübersicht und Markierungen virtueller Orders.
- **Signal-Cockpit (v3.8):** rein beobachtende 60-Sekunden-Tick-Auswertung mit Richtung, Spread und Datenqualität. **Nicht** identisch mit der separaten einfachen Paper-Momentumstrategie, kein validiertes Prognosemodell und keine automatischen Empfehlungen.
- Browserlokales simuliertes Depot (1.000 EUR Startwert), CSV-Orderjournal und simulierte Positionsbewertung. Der Nutzer schaltet den **Paper-Autohandel einmal bewusst ein**; diese Absicht bleibt lokal in Safari gespeichert, bis er manuell stoppt, einen Depot-Reset ausführt oder ein Sicherheits-Not-Aus greift. Bei Verbindungsabbrüchen und im Hintergrund ist die Ausführung pausiert und läuft erst nach einem neuen bestätigten Kraken-Tick im sichtbaren Tab wieder an.

**Wichtige Betriebsgrenzen:** Die Safari-Seite muss für neue virtuelle Trades geöffnet bleiben, und iOS kann Hintergrund-Tabs anhalten. Es gibt noch **keinen** zuverlässigen serverseitigen 24/7-Paper-Prozess. Kein realer Kraken-Kontozugriff, keine echten Orders, keine API-Schlüssel. Auch die Signalbewertung beweist keinen Gewinnvorteil.

## Prognose-Labor v4.2 (experimentell)

Über den eingeklappten Abschnitt **Prognose-Labor** kann ein historisch verfügbarer Kraken-EUR-Coin gewählt und eine Prognose für die nächsten **6 Stunden (6×1h-Kerzen)** oder **24 Stunden (6×4h-Kerzen)** auf Anfrage erstellt werden.

- Grundlage sind ausschließlich **abgeschlossene**, lückenlos aufeinanderfolgende Kraken-OHLC-Kerzen. Der aktuelle offene Kraken-Intervall wird vor der Berechnung entfernt. Fehlende Historie, zeitliche Lücken und unplausible Kerzen führen zu einer Fehlermeldung, nicht zu erfundenen Daten.
- Das Modell vergleicht die aktuelle Marktphase mit ähnlichen früheren Preisphasen anhand von 12-Kerzen-Trend, 24-Kerzen-Volatilität und Position innerhalb der lokalen Preisspanne. Die bis zu 30 nächsten ähnlichen **vollständig historischen** Fälle liefern eine **empirische Median-Prognose**, historische Schlusskursbandbreite (10.–90. Perzentil der Analogfälle) und Szenarien für zwischenzeitliche Tiefs/Hochs. Das sind **keine garantierten Preisziele** oder statistisch kalibrierten Wahrscheinlichkeiten.
- Ein **rückwirkender, chronologischer Vergleich** testet an früheren Zeitpunkten, ob das Modell den Endkurs genauer schätzte als die naive Prognose „unveränderter Kurs“. Messgrößen: mittlerer absoluter prozentualer Fehler und beobachtete Bandabdeckung. Historische Wiederholungen können korreliert und nicht repräsentativ sein; dies ist **keine unabhängige Prospektivvalidierung**.
- Jede auf Anfrage generierte Prognose wird mit Zeitstempel, Markt, Horizont, Ausgangspreis und den vorab ermittelten Grenzen **lokal in Safari** gespeichert. Wenn später ausreichend tatsächlich abgeschlossene Kraken-Kerzen verfügbar sind, wird die ursprüngliche Schätzung gegen den realen Schlusskurs geprüft. Die Speicherung umfasst höchstens 100 Einträge; ältere Daten können durch die beschränkte Kraken-Historie später nicht mehr zugeordnet werden.
- **Keine automatische Orderfreigabe:** Prognose und Protokollierung sind von der bestehenden Paper-Strategie getrennt. Das Modell optimiert noch keine Kauf-/Verkaufsschwellen; es empfiehlt keine garantierten Tiefs/Hochs. Vor einer Integration in die Paper-Handelslogik sind echte, zeitlich unabhängige Forward-Ergebnisse und eine Bewertung nach Handelskosten erforderlich.
- **Kein Cloud-Journal:** Die Daten verbleiben im lokalen Browser und können durch Löschen der Website-Daten verloren gehen. Ein stabiler Cloud-Prozess ist ein gesondertes Zukunftsprojekt.

## Prognose-Audit v4.4: fällige Prognosen und geschätzte Kauf-/Verkaufszonen

Die historische Prognoseauswertung kann nun unabhängig vom aktuell gewählten Coin **fällige gespeicherte Prognosen** auf 1h- und 4h-Kerzen prüfen. Der Button **„Fällige Prognosen prüfen“** startet die Prüfung gezielt; bei eingeschalteter optionaler Beobachtung läuft sie auch in Intervallen, **nur im sichtbaren Safari-Tab**.

- Es werden höchstens **vier verschiedene Coin-/Intervallgruppen pro Durchgang** anhand der öffentlichen Kraken-OHLC-Historie abgerufen. Nur echte **abgeschlossene** Kerzen werden bewertet. Datenlücken, fehlende Zuordnung oder inzwischen verfallene Kursintervalle bleiben als **nicht verifizierbar** offen; keine Prognosen werden nachträglich erfunden oder als Treffer gewertet.
- Die ursprünglichen Prognosedaten bleiben beim nachträglichen Hinzufügen realisierter Ergebnisse erhalten. Bestehende v4.2/v4.3-Prognosen sind kompatibel.
- Neue Prognoseeinträge enthalten zusätzlich die ursprünglich erwartete Tief- und Hochzone. Bei fällig gewordenen Prognosen können die **mittleren prozentualen Abstände der Schätzungen von tatsächlichen späteren Tiefs und Hochs** berechnet werden. Frühere Einträge ohne gespeicherte Zonen werden aus diesen zwei Kennzahlen ausgeschlossen.
- Eine **hypothetische Long-Kostenprüfung** zeigt, wie oft Prognosen, deren erwarteter Schlusskursanstieg über den modellierten Rundlaufkosten liegt, später rechnerisch positive Nettoergebnisse gehabt hätten. Grundlage sind **historische Schlusskurse**, keine ausführbaren Ask-/Bid-Fills. Diese Kennzahlen sind **keine Kauf-/Verkaufssignale, keine realen Paper-Trades und kein belastbarer Gewinnnachweis**. Das exakte Tief bzw. Hoch einer Kerze lässt sich rückblickend feststellen, nicht im Voraus zum garantierten Preis handeln.
- Gespeicherte Forecast-Aktivierung und Paper-Trading bleiben voneinander getrennt; die vorhandenen v4.0-Kauf- und Verkaufsregeln bleiben unverändert.

## Prognose-Beobachtung v4.3: Prospektive Messung

Das Prognose-Labor besitzt jetzt eine ausdrücklich aktivierbare Funktion **„Prognosen automatisch beobachten“**. Sie ist zunächst ausgeschaltet. Nach Aktivierung wird das Einverständnis browserlokal gespeichert; die **Ausführung** funktioniert nur während der sichtbaren Safari-Sitzung, nicht bei geschlossenem iPhone-Tab oder als Cloud-Dienst.

- Für den aktuell ausgewählten Coin erstellt der Beobachter aus öffentlichen **abgeschlossenen Kraken-1h-Kerzen** höchstens alle sechs Stunden eine neue 6h-Prognose. Nach sechs abgeschlossenen Folgestunden prüft er – bei nächster Gelegenheit mit vorhandenen Kursen – die ursprünglich gespeicherte Schätzung. Die Ausführung prüft bei sichtbarem Tab höchstens jede Minute, führt Netzabfragen aber höchstens alle 15 Minuten aus und nur, wenn neue Daten benötigt werden.
- Das Prognosejournal enthält maximal 100 Einträge, wird lokal in Safari gespeichert und kann als **CSV** exportiert werden. Browserdaten löschen, Gerätewechsel oder zu weit zurückliegende historische Kerzen können Ergebnisse unvollständig machen. Auch die separate manuelle 24h-Prognose wird im selben Journal protokolliert.
- Die Auswertung enthält **mittleren absoluten prozentualen Prognosefehler**, Fehler einer „unveränderten Kurs“-Baseline, Richtungstrefferquote, beobachtete Abdeckung des historischen Bandes und Anteil an Prognosen mit kleinerem Fehler als die Baseline. Angaben werden getrennt je ausgewähltem Coin und Horizont angezeigt.
- Weniger als **30 abgeschlossene Beobachtungen** werden ausdrücklich als unzureichende Datenlage gekennzeichnet; 30 oder mehr sind noch **kein statistischer Nachweis** eines Handelsvorteils. Messungen über Zeit und Coins sind nicht zwingend unabhängig.
- **Keine Kauf-/Verkaufsautomatik aus dem Prognosemodell**. Der alte Paper-Bot bleibt unverändert. Für belastbare Empfehlungen sind weitere unabhängige Prognosen, stabile Verbesserung gegenüber der Baseline, Verlusttests und Gebühren-/Slippage-Bereinigung nötig. Kein Anspruch, zukünftige Tief- oder Hochpunkte exakt zu erkennen.

## Paper-Strategie v4.0: ausführliche Sicherheitsregeln

Diese **neue heuristische Paper-Strategie ist noch nicht durch historische Tests als profitabler nachgewiesen** und wird nicht automatisch mit realem Geld verbunden. Die bisherigen Limits bleiben: maximal drei Positionen, je höchstens 150 EUR, maximal 60 % Kapitalexposition, Mindestreserve und Not-Aus bei unter 950 EUR virtuellem Depotwert.

- **Einstieg:** Mindestens zwölf echte Kursereignisse über mindestens 20 Sekunden, enger Kraken-Spread (maximal 0,35 %), positive kurzfristige Richtung und mindestens 1,15 % Kursanstieg über das Beobachtungsfenster. Kein Einstieg bei starken kurzfristigen Schwankungen über 3,5 % oder innerhalb von zehn Minuten nach dem letzten Trade dieses Coins.
- **Ausstieg:** Geschätzter Nettoerlös unter −2,5 % gegenüber Einstiegskosten (Verluststopp); Nettoertrag ab +3,5 % (Gewinnziel); nach +2 % erreichten Zwischengewinnen optionaler nachziehender Stop bei −1 % vom beobachteten Kurshoch, frühestens nach 30 Sekunden; negativ stehende Positionen werden nach 45 Minuten bei verfügbaren echten Kursen geschlossen.
- **Simulation:** Unverändert 0,4 % Gebühren plus 0,1 % Slippage je Seite. Sämtliche Orders bleiben **virtuell** und hängen von aktuellen Kraken-Kursen ab; technische Kurslücken können Stop-Niveaus überspringen.
- **Aktivierung:** Die ausdrücklich gewählte Paper-Aktivierung übersteht das Neuladen und erneute Öffnen des Browsers. **Nicht** die tatsächliche Ausführung: Safari muss die Seite sichtbar ausführen, und ein neuer gültiger WebSocket-Tick muss die Handelsbereitschaft bestätigen. Unterbrechungen, fehlende Verbindung und veraltete Preise führen zur Pause, nicht zum heimlichen Trading. Ein Sicherheits-Not-Aus widerruft die Aktivierung.
- **Keine Profitgarantie:** Zusätzliche Filter können Trades und Gewinne verhindern oder Verluste nicht vermeiden. Die Live-Regeln sind **nicht** identisch mit den drei Strategy-Lab-Modellen und dürfen nicht als deren validiertes Ergebnis ausgegeben werden. Die sehr kurze Momentum-Schwelle von 1,15 % über höchstens 90 Sekunden ist **nicht empirisch optimiert oder validiert** und kann zu seltenen oder verspäteten Einstiegen führen.

## Strategy Lab v3.9 (Browser)

Im Safari-Dashboard kannst du im Bereich **Strategy Lab** ein verfügbares Kraken-EUR-Handelspaar und 1-Stunden- oder 4-Stunden-Kerzen auswählen und auf **Strategien vergleichen** tippen. Erst dann werden öffentliche historische Kraken-OHLC-Daten abgerufen. Die letzte, noch nicht abgeschlossene Kraken-Kerze wird ausdrücklich entfernt.

- Verglichen werden **Kaufen & Halten**, **EMA 8/21** und **20-Kerzen-Ausbruch** mit identischen historischen Daten. Alle Strategien starten in jedem Testfenster mit eigenen 1.000 EUR.
- Die Simulation ist long-oder-cash und berücksichtigt bei Ein- und Ausstiegen **0,4 % Gebühr plus 0,1 % Slippage je Seite**. Entscheidungen nutzen ausschließlich vorherige abgeschlossene Kerzen; Handel erfolgt hypothetisch zur nächsten Kerzeneröffnung.
- Ergebnisse: Netto-Rendite, maximaler Rückgang vom bisherigen Portfoliohöchststand, Anzahl Käufe, geschätzte tatsächlich gezahlte Handelskosten und Kurven für den Testabschnitt.
- Die Zeitreihe wird chronologisch geteilt: **erste 60 % Entwicklung, letzte 40 % unabhängiger Testabschnitt**. Zusätzlich laufen drei zeitlich nacheinander liegende Evaluationsfenster mit festen Parametern; sie sind keine echte automatische Parameteroptimierung.
- Fehlende, ungeordnete, doppelte oder lückenhafte Kerzen werden abgelehnt, nicht interpoliert. Es werden mindestens 180 vollständig abgeschlossene Kerzen benötigt.
- **Einschränkung:** Kraken stellt nur begrenzte OHLC-Historie bereit. Ergebnisse von 1h- und 4h-Daten erlauben keine belastbare Aussage über langfristige Gewinne. Keines dieser Modelle wird automatisch für den Paper-Bot aktiviert. Es handelt sich um Forschung, nicht um ein trainiertes KI-Prognosemodell.

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
