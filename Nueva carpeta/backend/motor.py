# -*- coding: utf-8 -*-
import pandas as pd
import numpy as np
from collections import defaultdict
from itertools import product


def analizar_sorteos(historial, config):
    """
    Motor de análisis predictivo para loterías colombianas.
    Combina: frecuencia ponderada + Bayes + Markov condicionado.
    """
    # Parámetros configurables (con defaults)
    TOP_DIGITOS = config.get('topDigitos', 3)
    DECAY       = config.get('decay',      0.98)
    W_FREQ      = config.get('wFreq',      0.50)
    W_BAYES     = config.get('wBayes',     0.35)
    W_MARKOV    = config.get('wMarkov',    0.15)

    # ── Construir DataFrame ──────────────────────────────────────────────
    df = pd.DataFrame(historial)
    df['Fecha'] = pd.to_datetime(df['fecha'])
    df = df.sort_values('Fecha').reset_index(drop=True)

    # Número siempre en 4 dígitos
    df['Numero'] = df['numero'].astype(int).astype(str).str.zfill(4)

    # Dígito por posición
    for i in range(4):
        df[f'd{i}'] = df['Numero'].str[i].astype(int)

    # Peso temporal: el más reciente tiene peso 1, los anteriores decaen
    n = len(df)
    df['peso'] = DECAY ** np.arange(n - 1, -1, -1)

    ultimo = df.iloc[-1]

    # ── 1. Frecuencia ponderada ──────────────────────────────────────────
    freq = {i: defaultdict(float) for i in range(4)}
    pesos = df['peso'].values

    for i in range(4):
        digitos = df[f'd{i}'].values
        for d in range(10):
            freq[i][d] = pesos[digitos == d].sum()

    # ── 2. Suavizado Bayesiano ───────────────────────────────────────────
    bayes = {}
    for i in range(4):
        total = sum(freq[i].values())
        raw = {d: (freq[i][d] + 1) / (total + 10) for d in range(10)}
        # Normalizar min-max → [0, 1]
        mn, mx = min(raw.values()), max(raw.values())
        bayes[i] = {d: (raw[d] - mn) / (mx - mn) if mx > mn else 0.5
                    for d in range(10)}

    # ── 3. Cadena de Markov condicionada ────────────────────────────────
    markov_prob = {i: defaultdict(float) for i in range(4)}

    for i in range(4):
        digitos = df[f'd{i}'].values
        counts  = defaultdict(int)

        for j in range(len(digitos) - 1):
            counts[(digitos[j], digitos[j + 1])] += 1

        for a in range(10):
            salidas = sum(v for (o, _), v in counts.items() if o == a)
            for d in range(10):
                c = counts.get((a, d), 0)
                markov_prob[i][(a, d)] = (
                    (c + 0.01) / (salidas + 0.1) if salidas > 0 else 0.1
                )

    # ── 4. Score integrado por dígito y posición ────────────────────────
    scores = {}
    for i in range(4):
        max_freq = max(freq[i].values()) or 1
        ultimo_d = int(ultimo[f'd{i}'])
        scores[i] = {}
        for d in range(10):
            scores[i][d] = (
                W_FREQ   * (freq[i][d] / max_freq) +
                W_BAYES  * bayes[i][d] +
                W_MARKOV * markov_prob[i][(ultimo_d, d)]
            )

    # ── 5. Top dígitos por posición ─────────────────────────────────────
    top_digits = {
        i: [d for d, _ in sorted(scores[i].items(), key=lambda x: x[1], reverse=True)[:TOP_DIGITOS]]
        for i in range(4)
    }

    # ── 6. Generar candidatos ────────────────────────────────────────────
    candidatos = []
    for combo in product(top_digits[0], top_digits[1], top_digits[2], top_digits[3]):
        score_raw = sum(scores[i][combo[i]] for i in range(4))

        # Penalizar dígitos consecutivos repetidos si son poco frecuentes
        pen = 0
        for j in range(3):
            if combo[j] == combo[j + 1]:
                patron_freq = (df[f'd{j}'] == df[f'd{j+1}']).mean()
                if patron_freq < 0.1:
                    pen += 0.05

        candidatos.append({
            "numero":  int("".join(map(str, combo))),
            "score":   round(score_raw * (1 - pen), 6),
            "digitos": list(combo)
        })

    candidatos.sort(key=lambda x: x['score'], reverse=True)
    top5 = candidatos[:5]

    # Normalizar scores → [0, 1] para que el frontend los muestre bien
    max_s = top5[0]['score'] if top5 else 1
    min_s = top5[-1]['score'] if len(top5) > 1 else 0

    for rank, c in enumerate(top5):
        # Score normalizado entre 0.5 y 1.0 (evitar barras muy pequeñas)
        if max_s > min_s:
            c['score'] = round(0.5 + 0.5 * (c['score'] - min_s) / (max_s - min_s), 4)
        else:
            c['score'] = round(1.0 - rank * 0.05, 4)

        # Confianza: el primero parte de 85, cada uno baja proporcionalmente
        c['confianza'] = round(85 - rank * 8, 1)
        c['diferencia'] = 0 if rank == 0 else round(
            (top5[0]['score'] - c['score']) / top5[0]['score'] * 100, 1
        )

    # ── 7. Análisis por dígito (para mostrar en UI) ──────────────────────
    analisis_digitos = []
    for i in range(4):
        detalle = [
            {
                "digito":       d,
                "score":        round(s, 4),
                "frecuencia":   round(freq[i][d], 2),
                "probabilidad": round(bayes[i][d], 4)
            }
            for d, s in sorted(scores[i].items(), key=lambda x: x[1], reverse=True)[:5]
        ]
        analisis_digitos.append({
            "posicion":    i,
            "top_digitos": top_digits[i],
            "detalle":     detalle
        })

    # ── 8. Resultado final ───────────────────────────────────────────────
    return {
        "recomendacion_principal": top5[0] if top5 else None,
        "top5": top5,
        "analisis_digitos": analisis_digitos,
        "estadisticas": {
            "total_sorteos":  len(df),
            "fecha_inicio":   df['Fecha'].min().strftime('%Y-%m-%d'),
            "fecha_fin":      df['Fecha'].max().strftime('%Y-%m-%d'),
            "promedio":       int(df['numero'].astype(int).mean()),
            "configuracion":  {
                "decay":   DECAY,
                "wFreq":   W_FREQ,
                "wBayes":  W_BAYES,
                "wMarkov": W_MARKOV
            }
        }
    }