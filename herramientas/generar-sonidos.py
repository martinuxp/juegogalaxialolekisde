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


# ---------------------------------------------------------------- Ícaro: llegada y cueva
def eco(x, retardo, fuerza, veces=4):
    """Eco: la misma señal, más tarde y más bajita, varias veces (como en una cueva)."""
    y = x.copy()
    d = int(retardo * SR)
    for k in range(1, veces + 1):
        if d * k >= len(x):
            break
        y[d * k:] += x[:len(x) - d * k] * fuerza ** k
    return y


def llegada_icaro():
    """Música de la cinemática de llegada (7 s), calza con la imagen:
    0 – 3,2 s  acercándote: colchón grave (Re) que crece + brillo agudo con trémolo (el calor del sol)
    3,2 s      ¡CHOQUE! silencio de golpe (el choque lo pone choque.wav)
    3,3 – 7 s  caída: glissando que BAJA (de La a Re, una quinta) mientras te hundes en la grieta"""
    t = tiempo(7.0)
    n = len(t)
    crece = np.clip(t / 3.2, 0, 1) ** 2
    antes = t < 3.2
    colchon = sum(np.sin(2 * np.pi * f * t + i) / (1 + i * 0.6) for i, f in enumerate((73.42, 110.0, 146.83, 220.0)))
    brillo = (np.sin(2 * np.pi * 1174.66 * t) + 0.7 * np.sin(2 * np.pi * 1318.5 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
    parte1 = (colchon * 0.3 + brillo * 0.05 * crece) * (0.25 + 0.75 * crece) * antes
    parte1 *= np.minimum(1, (3.2 - t).clip(0) / 0.03 + 0)      # corte seco justo en el choque
    tt = np.clip(t - 3.3, 0, None)
    k = np.clip(tt / 3.4, 0, 1)
    f = 220 * (146.83 / 220) ** k                              # baja una quinta mientras caes
    caer = (oscilar(f) + 0.5 * oscilar(f * 1.5) + 0.3 * oscilar(f / 2)) * (t > 3.3)
    caer *= np.minimum(1, tt / 0.4) * (1 - k) ** 1.5 * 0.35
    viento = ruido_filtrado(n, 200, 1200, 101) * (t > 3.3) * np.sin(np.pi * k) * 0.6
    return parte1 + caer + viento


def choque():
    """El choque con la piedra del cinturón: bombo muy grave + crujido de roca + piedritas que saltan."""
    t = tiempo(1.6)
    bombo = oscilar(30 + 70 * np.exp(-t / 0.06)) * np.exp(-t / 0.35)
    crujido = ruido_filtrado(len(t), 400, 7000, 111) * np.exp(-t / 0.09) * 5
    piedras = np.zeros_like(t)
    r = np.random.default_rng(112)
    for _ in range(22):
        t0, f0 = 0.04 + r.random() * 0.9, 900 + r.random() * 2500
        m = t >= t0
        tt = t[m] - t0
        piedras[m] += np.sin(2 * np.pi * f0 * tt) * np.exp(-tt / 0.012) * (0.3 + 0.7 * r.random()) * np.exp(-t0 / 0.6)
    return (bombo * 1.4 + crujido + piedras) * np.minimum(1, t / 0.002)


def caida_grieta():
    """Caer por la grieta (3 s): viento cuyo 'tono' baja y que suena cada vez más fuerte."""
    t = tiempo(3.0)
    k = t / t[-1]
    n = len(t)
    capas = [ruido_filtrado(n, c * 0.7, c * 1.3, 120 + i) for i, c in enumerate((300, 600, 1200, 2400))]
    # el brillo baja: primero suenan las capas agudas y después las graves (barrido hacia abajo)
    x = sum(c * np.exp(-((k - (0.75 - 0.22 * i)) / 0.3) ** 2) for i, c in enumerate(capas))
    return x * (0.3 + 0.7 * k) * np.minimum(1, (t[-1] - t) / 0.3)


def golpe_cueva():
    """Caer en la arena de la cueva: golpe sordo + arena que se escurre + eco de la cueva."""
    t = tiempo(2.4)
    pum = oscilar(40 + 60 * np.exp(-t / 0.04)) * np.exp(-t / 0.2)
    arena = ruido_filtrado(len(t), 1500, 7000, 131) * np.exp(-t / 0.5) * (t > 0.05) * 1.2
    x = (pum * 1.5 + ruido_filtrado(len(t), 80, 600, 132) * np.exp(-t / 0.08) * 3 + arena)
    return eco(x * np.minimum(1, t / 0.003), 0.23, 0.35)


def cueva_loop():
    """AMBIENTE de la cueva (16 s, estéreo, loop sin costura).
    · zumbido muy grave (Re 36,7 Hz + La 55 Hz) con batimientos lentos
    · viento que aúlla: ruido filtrado cuya banda sube y baja despacio
    · gotas que caen a lo lejos (un 'plic' agudo con eco)
    Todo hace ciclos enteros en 16 s (múltiplos de 1/16 Hz), así empalma."""
    dur = 16.0
    t = tiempo(dur)
    n = len(t)
    q = lambda f: round(f * dur) / dur
    izq = 0.2 * (np.sin(2 * np.pi * q(36.75) * t) + 0.7 * np.sin(2 * np.pi * q(55.0) * t) + 0.3 * np.sin(2 * np.pi * q(110.25) * t))
    der = 0.2 * (np.sin(2 * np.pi * q(37.0) * t + 1) + 0.7 * np.sin(2 * np.pi * q(55.25) * t) + 0.3 * np.sin(2 * np.pi * q(110.0) * t + 2))
    aullido = ruido_filtrado(n, 250, 700, 141) * (0.5 + 0.5 * np.sin(2 * np.pi * t / dur * 2) ** 2)
    silbido = ruido_filtrado(n, 900, 1600, 142) * (0.5 + 0.5 * np.sin(2 * np.pi * t / dur * 3 + 1)) ** 3
    izq += 0.35 * aullido + 0.12 * silbido
    der += 0.35 * np.roll(aullido, n // 4) + 0.12 * np.roll(silbido, n // 3)
    r = np.random.default_rng(143)
    t2 = tiempo(dur * 2)
    for j in range(7):
        t0 = j * dur / 7 + r.random() * 1.5
        f0 = q(1400 + r.random() * 1500)
        m = t2 >= t0
        tt = t2[m] - t0
        g = np.zeros_like(t2)
        g[m] = np.sin(2 * np.pi * f0 * (tt + 6 * tt * tt)) * np.exp(-tt / 0.025)
        g = eco(g, 0.31, 0.45, 5) * (0.1 + 0.08 * r.random())
        g = g[:n] + g[n:2 * n]
        pan = r.random()
        izq += g * (1 - pan); der += g * pan
    return np.stack([izq, der])


def misteriosa_loop():
    """TEMA de la personaje misteriosa (16 s, estéreo, loop). Lento (60 por minuto),
    en Re menor: un colchón suave y una cajita de música que toca una melodía
    corta con eco. Elegante, un poco burlón, un poco peligroso."""
    dur = 16.0
    t = tiempo(dur)
    n = len(t)
    q = lambda f: round(f * dur) / dur
    pad_i, pad_d = np.zeros(n), np.zeros(n)
    # Re menor → Si bemol mayor (cambia a la mitad, con fundido suave)
    mitad = 0.5 - 0.5 * np.cos(2 * np.pi * t / dur)            # 0 → 1 → 0
    for f, peso in ((146.83, 1), (174.61, 0.8), (220.0, 0.7)):
        pad_i += peso * (1 - mitad) * np.sin(2 * np.pi * q(f) * t)
        pad_d += peso * (1 - mitad) * np.sin(2 * np.pi * q(f + 0.25) * t + 1)
    for f, peso in ((116.54, 1), (146.83, 0.8), (174.61, 0.7)):
        pad_i += peso * mitad * np.sin(2 * np.pi * q(f) * t + 2)
        pad_d += peso * mitad * np.sin(2 * np.pi * q(f + 0.25) * t)
    pad_i *= 0.09; pad_d *= 0.09
    # melodía (segundo, nota): La Fa Mi Re ... Do# (la nota "rara" que la hace misteriosa)
    mel = [(0, 880.0), (1, 698.46), (1.5, 659.25), (2, 587.33), (4, 880.0), (5, 932.33), (5.5, 880.0), (6, 554.37),
           (8, 698.46), (9, 587.33), (9.5, 523.25), (10, 466.16), (12, 587.33), (13, 554.37), (13.5, 659.25), (14, 587.33)]
    t2 = tiempo(dur * 2)
    caja = np.zeros(len(t2))
    for t0, f in mel:
        caja += campana(t2, t0, q(f), 0.9) * 0.22
    caja = eco(caja, 0.375, 0.4, 4)
    caja = caja[:n] + caja[n:2 * n]
    return np.stack([pad_i + caja, pad_d + np.roll(caja, int(0.012 * SR))])


def ojos_rojos():
    """Se encienden los ojos: un 'vuuum' grave que sube + un brillo agudo que tiembla."""
    t = tiempo(1.4)
    k = t / t[-1]
    f = 50 * (120 / 50) ** np.minimum(1, k / 0.4)
    vum = oscilar(f) * np.minimum(1, t / 0.3) * np.exp(-np.clip(t - 0.4, 0, None) / 0.4)
    brillo = (np.sin(2 * np.pi * 1760 * t) + np.sin(2 * np.pi * 1864.66 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t))
    brillo *= np.minimum(1, t / 0.2) * np.exp(-t / 0.5) * 0.15
    return eco(vum + brillo, 0.25, 0.3)


def voz_misteriosa(f0, semilla):
    """Una 'sílaba' de su voz: tono grave con un poquito de vibrato + soplo.
    Suena una cada 3 letras mientras se escribe el texto (dialogo.js)."""
    t = tiempo(0.11)
    k = t / t[-1]
    f = f0 * (1 + 0.04 * np.sin(2 * np.pi * 30 * t)) * (1 - 0.08 * k)
    tono = oscilar(f) + 0.45 * oscilar(f * 2) + 0.2 * oscilar(f * 3)
    soplo = ruido_filtrado(len(t), 600, 2500, semilla) * 0.6
    env = np.sin(np.pi * k) ** 1.5
    return (tono + soplo) * env


def botas():
    """Tomas las botas: soplido que sube + arpegio de campanitas (Re–La–Re–Fa#)."""
    t = tiempo(1.6)
    k = t / t[-1]
    sube = ruido_filtrado(len(t), 600, 3000, 151) * np.sin(np.pi * np.minimum(1, k / 0.5)) * 0.5
    x = sum(campana(t, 0.08 + i * 0.09, f, 0.6) for i, f in enumerate((587.33, 880, 1174.66, 1479.98)))
    return sube + x



# ---------------------------------------------------------------- botas de salto
def super_carga():
    """Agacharse con las botas (0,45 s): un zumbido que SUBE de tono, como algo que se carga."""
    t = tiempo(0.45)
    k = t / t[-1]
    f = 180 * (520 / 180) ** k
    return (oscilar(f, 'triangulo') + 0.3 * oscilar(f * 2)) * np.minimum(1, t / 0.03) * (0.3 + 0.7 * k) * 0.6


def super_listo():
    """¡Listo! Un 'ting' brillante: dos campanitas agudas casi juntas (Mi y Si)."""
    t = tiempo(0.9)
    return campana(t, 0, 1318.5, 0.35) + 0.8 * campana(t, 0.035, 1975.5, 0.3)


def super_salto():
    """El súper salto: un 'fuiiip' más grande que el salto normal + soplido que sube."""
    t = tiempo(0.5)
    k = t / t[-1]
    f = 200 * (1100 / 200) ** (k ** 0.5)
    tono = (oscilar(f, 'triangulo') + 0.35 * oscilar(f * 1.5)) * (1 - k) ** 1.5
    soplo = ruido_filtrado(len(t), 800, 5000, 171) * np.sin(np.pi * k) * 0.8
    return (tono + soplo) * np.minimum(1, t / 0.005)


# ---------------------------------------------------------------- cueva: peligros del laberinto
def estalactita_cruje():
    """La piedra se suelta: crujidos (clics de ruido al azar) cada vez más seguidos."""
    t = tiempo(0.45)
    x = np.zeros_like(t)
    r = np.random.default_rng(301)
    for i in range(18):
        t0 = 0.4 * (i / 18) ** 0.7 + r.random() * 0.02
        m = t >= t0
        tt = t[m] - t0
        x[m] += ruido_filtrado(m.sum(), 1500, 7000, 302 + i) * np.exp(-tt / 0.006) * (0.5 + 0.5 * i / 18)
    return x + 0.25 * oscilar(np.full_like(t, 70)) * (t / t[-1])


def estalactita_cae():
    """Silbido que baja (la piedra cortando el aire)."""
    t = tiempo(0.5)
    k = t / t[-1]
    return ruido_filtrado(len(t), 900, 3000, 311) * (0.3 + k) * np.minimum(1, (t[-1] - t) / 0.05) * 2


def estalactita_rompe():
    """Golpe de piedra que se hace pedazos: 'pum' grave + piedritas que rebotan."""
    t = tiempo(0.9)
    pum = oscilar(45 + 120 * np.exp(-t / 0.02)) * np.exp(-t / 0.12)
    trozos = np.zeros_like(t)
    r = np.random.default_rng(321)
    for i in range(16):
        t0 = 0.02 + r.random() * 0.6
        m = t >= t0
        tt = t[m] - t0
        trozos[m] += np.sin(2 * np.pi * (900 + r.random() * 2500) * tt) * np.exp(-tt / 0.012) * (0.2 + r.random() * 0.4)
    return pum * 1.2 + ruido_filtrado(len(t), 200, 4000, 322) * np.exp(-t / 0.08) * 3 + trozos


def fragil_cruje():
    """El suelo cruje antes de caer: un 'crrrr' grave de roca que se raja."""
    t = tiempo(0.9)
    k = t / t[-1]
    raspa = ruido_filtrado(len(t), 120, 900, 331) * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t) ** 2) * 4
    return raspa * np.minimum(1, t / 0.05) * (0.4 + 0.6 * k)


def fragil_cae():
    """Las baldosas se van: derrumbe (ruido grave que se apaga) + golpe."""
    t = tiempo(1.2)
    derrumbe = ruido_filtrado(len(t), 60, 1200, 341) * np.exp(-t / 0.35) * 5
    golpe = oscilar(40 + 80 * np.exp(-t / 0.03)) * np.exp(-t / 0.2)
    return derrumbe + golpe


def corazon():
    """Tomar un corazón: arpegio corto hacia arriba (do-mi-sol-do)."""
    t = tiempo(0.7)
    return sum(campana(t, i * 0.07, f, 0.35) for i, f in enumerate((523, 659, 784, 1046)))


def rescate():
    """Te sacan del fondo: 'fuuup' que sube con brillo."""
    t = tiempo(0.6)
    k = t / t[-1]
    f = 300 * (1200 / 300) ** k
    return (oscilar(f, 'triangulo') + 0.4 * oscilar(f * 1.5)) * np.sin(np.pi * k)


# ---------------------------------------------------------------- superficie de Ícaro
def desierto_loop():
    """Viento del desierto (12 s, loop sin costura): ruido grave cuyo volumen
    sube y baja lento (ráfagas) + un silbido agudo que va y viene.
    Las ráfagas usan senos con un número ENTERO de vueltas en 12 s, así empalma."""
    seg = 12.0
    t = tiempo(seg)
    n = len(t)
    def rafagas(semilla):
        r = np.random.default_rng(semilla)
        return sum(np.sin(2 * np.pi * k / seg * t + r.random() * 6) / k for k in (1, 2, 3, 5))
    canales = []
    for lado in (0, 1):
        base = ruido_filtrado(n, 60, 500, 401 + lado) * 6
        silbido = ruido_filtrado(n, 900, 1600, 403 + lado) * 2.5
        g1 = 0.55 + 0.35 * rafagas(410 + lado)
        g2 = np.clip(rafagas(420 + lado), 0, None)
        canales.append(base * g1 + silbido * g2 * 0.5)
    return np.array(canales)


def quemadura():
    """¡La arena quema! chisporroteo (ruido agudo a saltos) + un 'fsss' de vapor."""
    t = tiempo(0.8)
    r = np.random.default_rng(431)
    chispas = ruido_filtrado(len(t), 3000, 9000, 432) * (r.random(len(t)) < 0.08) * 6
    vapor = ruido_filtrado(len(t), 1500, 6000, 433) * np.exp(-t / 0.3) * 3
    return (chispas * np.exp(-t / 0.25) + vapor) * np.minimum(1, t / 0.005)


def salir_grieta():
    """Sales disparad@ de la grieta: rugido de tierra + 'fuuush' que sube."""
    t = tiempo(1.4)
    k = t / t[-1]
    tierra = ruido_filtrado(len(t), 40, 400, 441) * np.exp(-t / 0.5) * 6
    sube = ruido_filtrado(len(t), 700, 3000, 442) * np.sin(np.pi * np.minimum(1, k * 1.6)) * 2
    return tierra + sube


def meowl_chilla():
    """El grito de Meowl: mitad maullido, mitad ulular. Un 'miau' (tono que sube y baja,
    con la 'boca' que se abre: filtro) seguido de dos 'uuh' de búho."""
    t = tiempo(1.5)
    x = np.zeros_like(t)
    m = t < 0.65
    tt = t[m]
    k = tt / 0.65
    f = 520 + 380 * np.sin(np.pi * k ** 0.8)
    miau = oscilar(f) + 0.5 * oscilar(f * 2) + 0.3 * oscilar(f * 3)
    x[m] += miau * np.sin(np.pi * k) ** 0.7
    for t0 in (0.8, 1.15):
        m = (t >= t0) & (t < t0 + 0.3)
        tt = t[m] - t0
        f = 330 - 60 * tt / 0.3
        x[m] += (oscilar(f) + 0.2 * oscilar(f * 2)) * np.sin(np.pi * tt / 0.3) * 0.9
    return x


def meowl_carga():
    """El destello antes de lanzarse: un brillo agudo que sube rápido (medio segundo)."""
    t = tiempo(0.5)
    k = t / t[-1]
    f = 900 * (2600 / 900) ** k
    return (oscilar(f) + 0.4 * oscilar(f * 1.5)) * (0.2 + 0.8 * k) * (1 + 0.5 * np.sin(2 * np.pi * 28 * t))


def meowl_picada():
    """La picada: silbido que se pone más agudo y fuerte (acelera exponencialmente)."""
    t = tiempo(0.9)
    k = t / t[-1]
    capa = ruido_filtrado(len(t), 600, 4000, 451) * np.exp(3 * k) / np.exp(3) * 3
    tono = oscilar(400 * np.exp(1.6 * k)) * k ** 2
    return (capa + 0.5 * tono) * np.minimum(1, (t[-1] - t) / 0.03)


def meowl_clava():
    """Se clava en la arena: golpe grave + arena que salta."""
    t = tiempo(0.8)
    golpe = oscilar(38 + 140 * np.exp(-t / 0.025)) * np.exp(-t / 0.18) * 1.4
    arena = ruido_filtrado(len(t), 300, 3500, 461) * np.exp(-t / 0.15) * 4
    return golpe + arena


def meowl_arrastre():
    """Se arrastra por la arena hacia ti: raspado que acelera."""
    t = tiempo(0.9)
    k = t / t[-1]
    raspa = ruido_filtrado(len(t), 250, 2500, 471) * (0.6 + 0.4 * np.sin(2 * np.pi * (12 + 30 * k) * t)) * 4
    return raspa * np.minimum(1, t / 0.03) * np.minimum(1, (t[-1] - t) / 0.08)


def meowl_mareado():
    """Pajaritos del mareo: 'pío-pío' agudos que suben y bajan."""
    t = tiempo(1.2)
    x = np.zeros_like(t)
    for i, t0 in enumerate((0.0, 0.25, 0.5, 0.75)):
        m = (t >= t0) & (t < t0 + 0.16)
        tt = t[m] - t0
        f = 2200 + 500 * np.sin(2 * np.pi * tt / 0.16) * (1 if i % 2 else -1)
        x[m] += oscilar(f) * np.sin(np.pi * tt / 0.16)
    return x


def meowl_golpe():
    """¡Le pegaste!: 'bonk' + un graznido corto."""
    t = tiempo(0.6)
    bonk = oscilar(180 + 400 * np.exp(-t / 0.02)) * np.exp(-t / 0.08)
    m = t > 0.08
    tt = t[m] - 0.08
    graz = np.zeros_like(t)
    f = 700 - 300 * tt / 0.5
    graz[m] = (oscilar(f, 'triangulo') + 0.6 * ruido_filtrado(m.sum(), 800, 3000, 481)) * np.exp(-tt / 0.15)
    return bonk * 1.2 + graz


def meowl_vuela():
    """Aleteo: soplidos de ruido que se repiten rápido."""
    t = tiempo(1.3)
    alas = (np.sin(2 * np.pi * 7 * t) ** 8)
    return ruido_filtrado(len(t), 200, 1800, 491) * alas * np.sin(np.pi * t / t[-1]) * 4


def meowlito_sale():
    """Sale de la arena: 'plop' + arenita."""
    t = tiempo(0.4)
    plop = oscilar(200 + 500 * (t / t[-1])) * np.exp(-t / 0.06)
    return plop + ruido_filtrado(len(t), 1000, 5000, 501) * np.exp(-t / 0.08) * 2


def meowlito_carga():
    """El destello del meowlito: dos 'pip' agudos, como una alarma chiquita."""
    t = tiempo(0.5)
    x = np.zeros_like(t)
    for t0 in (0.0, 0.25):
        m = (t >= t0) & (t < t0 + 0.1)
        tt = t[m] - t0
        x[m] += oscilar(np.full(m.sum(), 1760.0)) * np.sin(np.pi * tt / 0.1)
    return x


def meowlito_lanza():
    """Se lanza: chillido corto que sube ('¡iiip!') + soplido."""
    t = tiempo(0.35)
    k = t / t[-1]
    f = 900 * (2000 / 900) ** k
    return (oscilar(f, 'triangulo') * (1 - k) + ruido_filtrado(len(t), 1200, 4000, 511) * (1 - k) * 1.5) * np.minimum(1, t / 0.005)


def meowlito_muere():
    """Meowlito aplastado: 'pfuí' que baja + poof de arena."""
    t = tiempo(0.4)
    k = t / t[-1]
    f = 1500 * (300 / 1500) ** k
    return oscilar(f, 'triangulo') * (1 - k) + ruido_filtrado(len(t), 500, 4000, 521) * np.exp(-t / 0.1) * 2


def confeti():
    """¡Meowl se hace confeti!: estallido de fiesta (pop) + lluvia de brillitos."""
    t = tiempo(2.0)
    pop = ruido_filtrado(len(t), 100, 6000, 531) * np.exp(-t / 0.04) * 6 + oscilar(60 + 200 * np.exp(-t / 0.02)) * np.exp(-t / 0.1)
    brillos = np.zeros_like(t)
    r = np.random.default_rng(532)
    for _ in range(40):
        brillos += campana(t, 0.05 + r.random() * 1.4, 1500 + r.random() * 3000, 0.12) * (0.2 + r.random() * 0.3)
    return pop + brillos


def canon_sube():
    """El cañón sale de la arena: rumor grave que sube + piedras."""
    t = tiempo(2.6)
    k = t / t[-1]
    rumor = ruido_filtrado(len(t), 30, 300, 541) * (0.4 + 0.6 * np.sin(np.pi * k)) * 6
    motor = oscilar(50 + 40 * k) * 0.6 * np.sin(np.pi * k)
    return rumor + motor


def canon_listo():
    """El cañón quedó arriba: dos campanadas."""
    t = tiempo(1.2)
    return campana(t, 0, 660, 0.5) + campana(t, 0.18, 990, 0.6)


def generar_superficie():
    # cueva (peligros del laberinto)
    guardar('estalactita-cruje.wav', estalactita_cruje(), 0.6)
    guardar('estalactita-cae.wav', estalactita_cae(), 0.6)
    guardar('estalactita-rompe.wav', estalactita_rompe(), 0.85)
    guardar('fragil-cruje.wav', fragil_cruje(), 0.6)
    guardar('fragil-cae.wav', fragil_cae(), 0.8)
    guardar('corazon.wav', corazon(), 0.7)
    guardar('rescate.wav', rescate(), 0.6)
    # superficie y Meowl
    guardar_estereo('desierto-loop.wav', desierto_loop(), 0.6)
    guardar('quemadura.wav', quemadura(), 0.75)
    guardar('salir-grieta.wav', salir_grieta(), 0.8)
    guardar('meowl-chilla.wav', meowl_chilla(), 0.8)
    guardar('meowl-carga.wav', meowl_carga(), 0.55)
    guardar('meowl-picada.wav', meowl_picada(), 0.8)
    guardar('meowl-clava.wav', meowl_clava(), 0.9)
    guardar('meowl-arrastre.wav', meowl_arrastre(), 0.7)
    guardar('meowl-mareado.wav', meowl_mareado(), 0.5)
    guardar('meowl-golpe.wav', meowl_golpe(), 0.85)
    guardar('meowl-vuela.wav', meowl_vuela(), 0.6)
    guardar('meowlito-sale.wav', meowlito_sale(), 0.6)
    guardar('meowlito-carga.wav', meowlito_carga(), 0.45)
    guardar('meowlito-lanza.wav', meowlito_lanza(), 0.6)
    guardar('meowlito-muere.wav', meowlito_muere(), 0.6)
    guardar('confeti.wav', confeti(), 0.85)
    guardar('canon-sube.wav', canon_sube(), 0.8)
    guardar('canon-listo.wav', canon_listo(), 0.7)


def guardar_estereo(nombre, x, pico=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * pico
    datos = (x.T * 32767).astype('<i2')               # muestras intercaladas: I D I D ...
    with wave.open(str(SALIDA / nombre), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(datos.tobytes())
    print(f'{nombre:24s} {x.shape[1] / SR:5.2f} s (estéreo)')


def generar_icaro():
    guardar('llegada-icaro.wav', llegada_icaro(), 0.8)
    guardar('choque.wav', choque())
    guardar('caida-grieta.wav', caida_grieta(), 0.7)
    guardar('golpe-cueva.wav', golpe_cueva(), 0.8)
    guardar_estereo('cueva-loop.wav', cueva_loop(), 0.7)
    guardar_estereo('misteriosa-loop.wav', misteriosa_loop(), 0.7)
    guardar('ojos-rojos.wav', ojos_rojos(), 0.75)
    for i, (f0, sem) in enumerate(((190, 161), (172, 162), (214, 163)), 1):
        guardar(f'voz-misteriosa{i}.wav', voz_misteriosa(f0, sem), 0.6)
    guardar('botas.wav', botas(), 0.75)
    guardar('super-carga.wav', super_carga(), 0.5)
    guardar('super-listo.wav', super_listo(), 0.7)
    guardar('super-salto.wav', super_salto(), 0.75)


if __name__ == '__main__':
    import sys
    if 'superficie' in sys.argv:       # python3 herramientas/generar-sonidos.py superficie → peligros de la cueva, superficie y Meowl
        generar_superficie()
        sys.exit()
    if 'icaro' in sys.argv:            # python3 herramientas/generar-sonidos.py icaro → solo los de Ícaro
        generar_icaro()
        sys.exit()
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
    # Ícaro (llegada y cueva)
    generar_icaro()
    generar_superficie()
