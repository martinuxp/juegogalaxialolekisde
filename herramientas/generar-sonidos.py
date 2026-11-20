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


# ---------------------------------------------------------------- jugador
def ruido_filtrado(n, bajo, alto, semilla):
    """Ruido que solo tiene frecuencias entre 'bajo' y 'alto' Hz.
    Lo filtramos con la transformada de Fourier (FFT): pasamos el ruido a
    frecuencias, borramos las que no queremos y volvemos al tiempo.
    Bonus: el resultado es PERIÓDICO (el final empalma con el principio),
    perfecto para loops sin costura."""
    r = np.random.default_rng(semilla).standard_normal(n)
    F = np.fft.rfft(r)
    f = np.fft.rfftfreq(n, 1 / SR)
    F[(f < bajo) | (f > alto)] = 0
    return np.fft.irfft(F, n)


def salto():
    """'Fuip' de caricatura: triángulo que sube 260 → 720 Hz en 0,2 s."""
    t = tiempo(0.22)
    k = t / t[-1]
    f = 260 * (720 / 260) ** (k ** 0.6)
    env = np.minimum(1, t / 0.006) * (1 - k) ** 2
    return env * (oscilar(f, 'triangulo') + 0.25 * oscilar(f * 2))


def paso(semilla):
    """Pisada en pasto: un 'tum' grave cortito + un 'shh' de hojas."""
    t = tiempo(0.12)
    golpe = oscilar(110 + 60 * np.exp(-t / 0.01)) * np.exp(-t / 0.025)
    hojas = ruido_filtrado(len(t), 1500, 6000, semilla) * np.exp(-t / 0.03) * 6
    return (golpe + hojas) * np.minimum(1, t / 0.002)


def puno():
    """Puño al aire ('fsss'): ruido cuya banda de frecuencias sube y baja rápido."""
    t = tiempo(0.24)
    k = t / t[-1]
    capas = [ruido_filtrado(len(t), c * 0.6, c * 1.4, 30 + i) for i, c in enumerate((700, 1400, 2800))]
    # cada capa suena más fuerte en un momento distinto: parece que el tono se mueve
    x = sum(c * np.exp(-((k - (0.25 + 0.15 * i)) / 0.18) ** 2) for i, c in enumerate(capas))
    return x * np.minimum(1, t / 0.01) * (1 - k)


def tocar_suelo():
    """Aterrizaje normal: 'pum' suave (seno que cae 150 → 55 Hz) + polvito."""
    t = tiempo(0.25)
    pum = oscilar(55 + 95 * np.exp(-t / 0.03)) * np.exp(-t / 0.08)
    polvo = ruido_filtrado(len(t), 300, 2500, 41) * np.exp(-t / 0.05) * 3
    return (pum + polvo) * np.minimum(1, t / 0.002)


def chapuzon():
    """Caer al mar: golpe de ruido + burbujas (silbidos cortos que suben)."""
    t = tiempo(0.9)
    golpe = ruido_filtrado(len(t), 200, 5000, 52) * np.exp(-t / 0.12) * 4
    burbujas = np.zeros_like(t)
    r = np.random.default_rng(53)
    for _ in range(14):
        t0, f0 = 0.05 + r.random() * 0.6, 500 + r.random() * 900
        m = t >= t0
        tt = t[m] - t0
        burbujas[m] += np.sin(2 * np.pi * f0 * (tt + 18 * tt * tt)) * np.exp(-tt / 0.03) * (0.4 + r.random() * 0.6)
    return golpe + burbujas


# ---------------------------------------------------------------- espacio
def campana(t, t0, f, caida=0.9):
    """Nota de 'campanita': seno + armónicos inarmónicos (×2,76 ×5,4) que se apagan."""
    m = t >= t0
    tt = t[m] - t0
    y = np.zeros_like(t)
    y[m] = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / 0.15)
            + 0.12 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt / 0.06)) * np.exp(-tt / caida) * np.minimum(1, tt / 0.004)
    return y


def despegue_rugido():
    """La cinemática del despegue (3,7 s): rugido de cohete que se va alejando.
    · ruido grave cuyo 'brillo' (frecuencia de corte) baja a medida que se aleja
    · tono que primero sube (acelera) y al final cae (efecto Doppler: algo que se aleja suena más grave)"""
    t = tiempo(3.7)
    k = t / t[-1]
    n = len(t)
    grave = ruido_filtrado(n, 30, 400, 61)
    medio = ruido_filtrado(n, 400, 2500, 62)
    brillo = np.exp(-k / 0.35)                         # lo agudo se pierde con la distancia
    rugido = grave * (1 - 0.6 * k) + medio * brillo * 0.8
    f = 90 + 260 * np.sin(np.pi * np.minimum(1, k / 0.8)) ** 0.7     # sube y cae (Doppler)
    tono = (oscilar(f) + 0.4 * oscilar(f * 1.5)) * 0.25
    env = np.minimum(1, t / 0.04) * (1 - k) ** 1.2
    return env * (rugido * 3 + tono)


def espacio_loop():
    """Música AMBIENTE del espacio (16 s, estéreo, loop sin costura).
    Igual que tension_loop: todas las frecuencias hacen un número ENTERO
    de ciclos en 16 s (múltiplos de 1/16 Hz), así el final empalma con el inicio.
    · colchón: acorde de Re con 2ª (Re–La–Mi–Fa#), cada nota en 2 copias apenas
      desafinadas (izquierda/derecha) → 'batimientos' lentos que hacen ondular el sonido
    · campanitas: notas de la escala pentatónica que caen al azar, como estrellas
    · viento cósmico: ruido muy suave filtrado (periódico gracias a la FFT)"""
    dur = 16.0
    t = tiempo(dur)
    n = len(t)
    q = lambda f: round(f * dur) / dur                 # redondear a ciclos enteros en 16 s
    acorde = [73.42, 110.0, 164.81, 220.0, 293.66, 369.99]
    izq, der = np.zeros(n), np.zeros(n)
    for i, f in enumerate(acorde):
        respira = 0.6 + 0.4 * np.sin(2 * np.pi * t / dur * (1 + i % 2) + i)   # 1 o 2 respiros por loop
        a = respira / (1 + i * 0.5)
        izq += a * (np.sin(2 * np.pi * q(f) * t) + 0.3 * np.sin(2 * np.pi * q(f * 2) * t + i))
        der += a * (np.sin(2 * np.pi * q(f + 0.25) * t + 1) + 0.3 * np.sin(2 * np.pi * q(f * 2 + 0.5) * t))
    izq *= 0.16; der *= 0.16

    # campanitas (si una se pasa del final, su cola sigue al principio: módulo dur)
    escala = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]
    r = np.random.default_rng(71)
    t2 = tiempo(dur * 2)
    for j in range(11):
        t0 = j * dur / 11 + r.random() * 0.6
        nota = campana(t2, t0, q(escala[r.integers(len(escala))]), 1.6) * (0.10 + 0.08 * r.random())
        nota = nota[:n] + nota[n:2 * n]                # doblar la cola sobre el inicio
        pan = r.random()
        izq += nota * (1 - pan); der += nota * pan

    viento = ruido_filtrado(n, 150, 900, 72) * 0.5
    viento *= 0.5 + 0.5 * np.sin(2 * np.pi * t / dur)  ** 2
    izq += viento * 0.6; der += np.roll(viento, n // 3) * 0.6   # mismo viento corrido = sensación de espacio
    return np.stack([izq, der])


def carga_tarjeta():
    """Cambio de tarjeta en la pantalla de carga: dos campanitas suaves (Mi → La)."""
    t = tiempo(1.0)
    return campana(t, 0, 659.25, 0.35) + 0.8 * campana(t, 0.09, 880, 0.45)


def carga_lista():
    """Barra llena: arpegio que sube (Re–Fa#–La–Re), como 'listo, puedes seguir'."""
    t = tiempo(1.8)
    return sum(campana(t, i * 0.11, f, 0.7) * (0.7 + 0.1 * i) for i, f in enumerate((587.33, 739.99, 880, 1174.66)))


def nivel_completo():
    """Fanfarria cortita al completar el nivel: Re mayor que sube y queda sonando."""
    t = tiempo(2.6)
    x = sum(campana(t, i * 0.13, f, 0.9) for i, f in enumerate((293.66, 369.99, 440, 587.33)))
    acorde = sum(oscilar(np.full(len(t), f), 'triangulo') for f in (293.66, 369.99, 440, 587.33))
    m = t >= 0.52
    x[m] += 0.25 * acorde[m] * np.exp(-(t[m] - 0.52) / 0.8) * np.minimum(1, (t[m] - 0.52) / 0.02)
    return x


def guardar_estereo(nombre, x, pico=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * pico
    datos = (x.T * 32767).astype('<i2')               # muestras intercaladas: I D I D ...
    with wave.open(str(SALIDA / nombre), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(datos.tobytes())
    print(f'{nombre:24s} {x.shape[1] / SR:5.2f} s (estéreo)')


if __name__ == '__main__':
    guardar('ovni-llegada.wav', ovni_llegada())
    guardar('ovni-boing.wav', ovni_boing())
    guardar('ovni-rayo.wav', ovni_rayo(), 0.7)
    guardar('ovni-huida.wav', ovni_huida())
    guardar('tension-golpe.wav', tension_golpe())
    guardar('tension-loop.wav', tension_loop(), 0.8)
    # jugador
    guardar('salto.wav', salto(), 0.7)
    for i in (1, 2, 3):
        guardar(f'paso{i}.wav', paso(80 + i), 0.6)
    guardar('puno.wav', puno(), 0.7)
    guardar('tocar-suelo.wav', tocar_suelo(), 0.7)
    guardar('chapuzon.wav', chapuzon(), 0.8)
    # espacio (despegue y pantalla de carga)
    guardar('despegue-rugido.wav', despegue_rugido())
    guardar_estereo('espacio-loop.wav', espacio_loop())
    guardar('carga-tarjeta.wav', carga_tarjeta(), 0.5)
    guardar('carga-lista.wav', carga_lista(), 0.7)
    guardar('nivel-completo.wav', nivel_completo(), 0.8)
