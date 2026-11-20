"""
generar-sonidos.py · Sonidos de la nave y de tensión, hechos con matemática
---------------------------------------------------------------------------
No hay grabaciones: cada sonido es una suma de ondas que calculamos
muestra por muestra (44 100 muestras por segundo).

  Una onda seno:   y(t) = A · sin(2π · f · t)
     A = amplitud (volumen), f = frecuencia (tono, en Hz)

  Si f cambia con el tiempo, no basta con sin(2π f(t) t): hay que ir
  SUMANDO la frecuencia (la fase es la integral de la frecuencia):
     fase(t) = 2π · Σ f(t)·dt        →  np.cumsum(f) / SR

Trucos que usamos:
  · vibrato  = la frecuencia sube y baja rápido (el "uuuuu" de los ovnis de caricatura)
  · trémolo  = el volumen sube y baja rápido
  · envolvente = cómo nace y muere el volumen (ataque y caída exponencial e^(-t/τ))
  · ruido    = valores al azar (el "shhh" del viento)

Uso:  python3 herramientas/generar-sonidos.py   → escribe los .wav en sonidos/
Necesita numpy.
"""
import wave
from pathlib import Path
import numpy as np

SR = 44100
SALIDA = Path(__file__).resolve().parent.parent / 'sonidos'
rng = np.random.default_rng(7)          # semilla fija: siempre sale igual


def tiempo(seg):
    return np.arange(int(seg * SR)) / SR


def oscilar(frec, forma='seno'):
    """Onda con frecuencia que cambia en el tiempo (frec es un arreglo)."""
    fase = 2 * np.pi * np.cumsum(frec) / SR
    if forma == 'seno':
        return np.sin(fase)
    if forma == 'triangulo':
        return 2 / np.pi * np.arcsin(np.sin(fase))
    raise ValueError(forma)


def pasa_bajos(x, corte):
    """Filtro simple de un polo: suaviza la señal (le quita lo agudo)."""
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def guardar(nombre, x, pico=0.89):
    x = x / (np.max(np.abs(x)) + 1e-9) * pico        # normalizar: el más fuerte llega a ~-1 dB
    datos = (x * 32767).astype('<i2')
    with wave.open(str(SALIDA / nombre), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(datos.tobytes())
    print(f'{nombre:24s} {len(x) / SR:5.2f} s')


# ---------------------------------------------------------------- nave
def ovni_llegada():
    """Bajada de caricatura: tono que cae de 1400 a 420 Hz con vibrato ancho + soplido."""
    t = tiempo(2.1)
    k = t / t[-1]
    f = 1400 * (420 / 1400) ** k                       # caída exponencial (se oye pareja)
    f = f * (1 + 0.09 * np.sin(2 * np.pi * 7.5 * t))   # vibrato de 7,5 Hz
    tono = oscilar(f) + 0.35 * oscilar(f * 2.005)      # + una octava apenas desafinada (más "metálico")
    soplo = pasa_bajos(rng.standard_normal(len(t)), 900) * 1.3
    env = np.minimum(1, t / 0.15) * (0.55 + 0.45 * np.sin(np.pi * k))   # entra, crece al pasar cerca
    env *= np.minimum(1, (t[-1] - t) / 0.25)
    return env * (tono + soplo * (0.4 + 0.6 * np.sin(np.pi * k)))


def ovni_boing():
    """Resorte al frenar: 'boiiing' = vibrato rápido que se va apagando."""
    t = tiempo(0.9)
    f = 260 * (1 + 0.35 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 16 * t))
    return np.exp(-t / 0.28) * np.minimum(1, t / 0.005) * (oscilar(f, 'triangulo') + 0.3 * oscilar(f * 3))


def ovni_rayo():
    """Rayo tractor: barrido que sube 180 → 900 Hz con trémolo de 28 Hz."""
    t = tiempo(0.75)
    k = t / t[-1]
    f = 180 * 5 ** k
    tremolo = 0.6 + 0.4 * np.sin(2 * np.pi * 28 * t)
    env = np.minimum(1, t / 0.03) * np.minimum(1, (t[-1] - t) / 0.2)
    return env * tremolo * (oscilar(f) + 0.5 * oscilar(f * 1.5) + 0.25 * oscilar(f * 2.01))


def ovni_huida():
    """Escape: 'fiuuuuu' que sube a 2200 Hz y se aleja (baja el volumen)."""
    t = tiempo(1.6)
    k = t / t[-1]
    f = 380 * (2200 / 380) ** (k ** 0.7)
    f = f * (1 + 0.06 * np.sin(2 * np.pi * 9 * t))
    env = np.minimum(1, t / 0.05) * (1 - k) ** 1.5
    return env * (oscilar(f) + 0.3 * oscilar(f * 2))


# ---------------------------------------------------------------- tensión
def tension_golpe():
    """Golpe al entrar a la arena: bombo grave que cae de 90 a 38 Hz + ruido."""
    t = tiempo(2.2)
    f = 38 + 52 * np.exp(-t / 0.12)
    bombo = oscilar(f) * np.exp(-t / 0.7)
    ruido = pasa_bajos(rng.standard_normal(len(t)), 400) * np.exp(-t / 0.18) * 4
    cola = oscilar(np.full(len(t), 55.0)) * 0.3 * np.exp(-t / 1.0)
    return (bombo + ruido + cola) * np.minimum(1, t / 0.004)


def tension_loop():
    """
    Loop de 10 s (16 pulsos a 96 por minuto) que se repite sin costura.
    Para que no haya salto al dar la vuelta, TODO es periódico en 10 s:
    las frecuencias hacen un número entero de ciclos en 10 s (55 Hz → 550).
    """
    dur = 10.0
    t = tiempo(dur)
    pulso = 60 / 96                                    # 0,625 s

    # 1) zumbido grave: La (55 Hz) + quinta (82,5 Hz), con armónicos que se abren y cierran
    abre = 0.5 - 0.5 * np.cos(2 * np.pi * t / dur)     # 0 → 1 → 0 en los 10 s
    dron = np.zeros_like(t)
    for n in range(1, 7):
        amp = 1 / n * (1 if n < 3 else abre)
        dron += amp * np.sin(2 * np.pi * 55 * n * t) + 0.6 * amp * np.sin(2 * np.pi * 82.5 * n * t + n)
    dron *= 0.22

    # 2) latido "lub-dub": dos golpes graves por pulso, cada 2 pulsos
    latido = np.zeros_like(t)
    for i in range(16):
        if i % 2:
            continue
        for desfase, fuerza in ((0.0, 1.0), (0.2, 0.6)):
            t0 = i * pulso + desfase
            m = t >= t0
            tt = t[m] - t0
            latido[m] += fuerza * np.sin(2 * np.pi * (45 * tt + 30 * 0.05 * (1 - np.exp(-tt / 0.05)))) * np.exp(-tt / 0.12)

    # 3) cuerdas agudas disonantes (La5 y La#5, a medio tono = choque) con trémolo
    tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * 8 * t)    # 8 Hz → 80 ciclos en 10 s
    agudo = (np.sin(2 * np.pi * 880 * t) + np.sin(2 * np.pi * 932.3 * t + 1)) * tremolo
    agudo *= 0.05 * (0.4 + 0.6 * abre)

    # 4) tic-tac de reloj en cada medio pulso (ruido cortito, muy bajo)
    tic = np.zeros_like(t)
    ruido = rng.standard_normal(int(0.02 * SR))
    for i in range(32):
        a = int(i * pulso / 2 * SR)
        trozo = ruido * np.exp(-np.arange(len(ruido)) / (0.004 * SR)) * (0.5 if i % 2 else 0.8)
        tic[a:a + len(trozo)] += trozo[:len(tic) - a]
    tic = tic - pasa_bajos(tic, 3000)                  # solo lo agudo

    return dron + 0.9 * latido + agudo + 0.08 * tic


if __name__ == '__main__':
    guardar('ovni-llegada.wav', ovni_llegada())
    guardar('ovni-boing.wav', ovni_boing())
    guardar('ovni-rayo.wav', ovni_rayo(), 0.7)
    guardar('ovni-huida.wav', ovni_huida())
    guardar('tension-golpe.wav', tension_golpe())
    guardar('tension-loop.wav', tension_loop(), 0.8)
