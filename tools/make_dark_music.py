"""Synthesises the Faceless Ronin's dark soundtrack into assets/audio/mus_dark_*.wav.

Usage: python tools/make_dark_music.py        (needs numpy)

Three seamless loops, built only from synthesis (no samples, nothing copied from anywhere):
  mus_dark_title    the opening: a sub drone, a funeral toll that never quite resolves, a veiled choir, a slow pulse
  mus_dark_belfry   the Silent Belfry and the Cathedral approach: lower, slower, a lament line under the tolling
  mus_dark_ending   the ending: a lone bell tolling a falling phrase over a pad that finally opens

Each loop is rendered a few seconds long and the reverb tail is folded back onto the start, so it repeats without a seam.
The calm tracks (mosslit, spindle) are untouched: the Ronin's journey keeps them for the quiet stretches (see ALIAS in
src/audio/audio.js and Audio.theme).
"""
import wave
from pathlib import Path

import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'audio'
TAU = np.pi * 2


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def fft_filter(x, shape):
    """Multiplies the spectrum of x by shape(freqs) (a zero-phase filter)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)

    return np.fft.irfft(np.fft.rfft(x) * shape(f), n)


def lowpass(x, fc):
    return fft_filter(x, lambda f: 1 / (1 + (f / fc) ** 4))


def place(buf, snd, at, gain=1.0):
    """Adds snd into buf at time `at` (seconds), clipped at the end of the buffer."""
    i = int(at * SR)

    if i >= len(buf):
        return

    n = min(len(snd), len(buf) - i)
    buf[i : i + n] += snd[:n] * gain


# ---------------------------------------------------------------- instruments
BELL = [  # ratio, amplitude, decay seconds: a cast bell is inharmonic, with a strong hum and a minor third
    (0.5, 0.65, 11.0),
    (1.0, 1.0, 9.0),
    (1.183, 0.55, 6.5),
    (1.506, 0.45, 5.5),
    (2.0, 0.5, 5.0),
    (2.514, 0.3, 3.4),
    (2.662, 0.26, 3.0),
    (3.011, 0.2, 2.4),
    (4.166, 0.12, 1.5),
    (5.433, 0.07, 1.0),
]


def bell(f0, sec=12.0, rng=None):
    t = t_axis(sec)
    y = np.zeros_like(t)

    for r, a, d in BELL:
        for det in (0.0, 0.55):  # a second, slightly flat copy makes the slow beating of a real bell
            y += a * 0.6 * np.sin(TAU * (f0 * r + det * r ** 0.5) * t + (rng.random() * TAU if rng is not None else 0)) * np.exp(-t / d)

    k = int(0.05 * SR)
    strike = (rng.random(k) * 2 - 1) if rng is not None else np.zeros(k)
    y[:k] += lowpass(np.pad(strike, (0, len(y) - k)), 2500)[:k] * np.linspace(1, 0, k) ** 2 * 0.5
    y[:60] *= np.linspace(0, 1, 60)

    return y / np.abs(y).max()


def swell(f0, sec, rng):
    """A bell played backwards: it grows out of nothing and ends on the strike."""
    b = bell(f0, sec, rng)[::-1]
    b = b * np.linspace(0, 1, len(b)) ** 2

    return b / np.abs(b).max()


def pad(freqs, sec, rng, vowel=(650, 1080, 2400)):
    """A veiled choir: detuned, vibrato-ed saw stacks pushed through vowel formants."""
    t = t_axis(sec)
    y = np.zeros_like(t)

    for f in freqs:
        for det in (-0.004, 0.0, 0.005):
            fr = f * (1 + det)
            ph = rng.random() * TAU
            vib = 1 + 0.004 * np.sin(TAU * (4.6 + rng.random()) * t + ph)

            for h in range(1, 14):
                y += np.sin(TAU * fr * h * np.cumsum(vib) / SR + ph * h) / h

    def shape(f):
        g = sum(np.exp(-((f - c) / (c * 0.22)) ** 2) * w for c, w in zip(vowel, (1.0, 0.6, 0.25)))

        return g + 0.04

    y = fft_filter(y, shape)
    att, rel = min(sec * 0.4, 4.0), min(sec * 0.4, 5.0)
    e = np.minimum(1, t / att) * np.minimum(1, (sec - t) / rel)

    return y / np.abs(y).max() * e


def drone(base, sec, rng, dissonance=1.0):
    t = t_axis(sec)
    y = np.sin(TAU * base * t) + 0.7 * np.sin(TAU * base * 1.004 * t)
    saw = sum(np.sin(TAU * base * 2 * h * t + h) / h for h in range(1, 10))
    y += 0.5 * lowpass(saw, 240)
    # a semitone above the root, breathing in and out: the thing under the floor that will not settle
    y += dissonance * 0.22 * np.sin(TAU * base * 2 * 1.0595 * t) * (0.5 + 0.5 * np.sin(TAU * 0.045 * t))
    y *= 0.7 + 0.3 * np.sin(TAU * 0.031 * t + rng.random() * TAU)

    return y / np.abs(y).max()


def wind(sec, rng):
    n = rng.standard_normal(int(sec * SR))
    y = fft_filter(n, lambda f: np.exp(-((f - 420) / 260) ** 2))
    t = t_axis(sec)
    y *= 0.5 + 0.5 * np.sin(TAU * 0.07 * t + 1.3) * np.sin(TAU * 0.023 * t)

    return y / np.abs(y).max()


def thud(f=52, sec=0.7):
    t = t_axis(sec)

    return np.sin(TAU * f * t * np.exp(-t * 2.2)) * np.exp(-t * 6)


def string(f, sec, rng):
    """A bowed low line for the lament: a dark saw with slow vibrato and a long attack."""
    t = t_axis(sec)
    vib = 1 + 0.006 * np.sin(TAU * 4.8 * t) * np.minimum(1, t / 1.5)
    ph = np.cumsum(vib) * f / SR * TAU
    y = sum(np.sin(ph * h) / h for h in range(1, 16))
    y = lowpass(y, 1100)
    e = np.minimum(1, t / 1.6) * np.minimum(1, (sec - t) / 2.4)

    return y / np.abs(y).max() * e


def reverb(x, rng, sec=4.2, wet=0.5):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t / 1.15)
    ir = lowpass(ir, 3200)
    ir[: int(0.03 * SR)] *= np.linspace(0, 1, int(0.03 * SR))
    ir /= np.sqrt((ir**2).sum())
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + n]
    y = y[: len(x)] if wet is None else y

    return x * (1 - wet) + y[: len(x)] * wet


def fold(x, loop):
    """Folds everything past `loop` seconds back over the start so the loop is seamless."""
    n = int(loop * SR)
    out = x[:n].copy()
    rest = x[n:]
    out[: len(rest)] += rest[: n]

    return out


def save(name, x):
    x = x - x.mean()
    x = x / np.abs(x).max() * 0.88
    k = int(0.03 * SR)  # a 30 ms dip at the loop point: the drone is not periodic, so this is what keeps the seam silent
    x[:k] *= np.linspace(0, 1, k)
    x[-k:] *= np.linspace(1, 0, k)
    pcm = (x * 32767).astype('<i2')
    path = OUT / (name + '.wav')

    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    # seam check: how far the last sample jumps against the usual sample-to-sample step
    jump = abs(float(pcm[0]) - float(pcm[-1])) / 32767
    step = float(np.abs(np.diff(pcm.astype(float))).mean()) / 32767
    rms = float(np.sqrt((x**2).mean()))
    print(f'{name}: {len(x) / SR:.1f}s  {path.stat().st_size / 1e6:.2f} MB  rms {rms:.3f}  seam jump {jump:.5f} (avg step {step:.5f})')


# ---------------------------------------------------------------- the tracks
def render(loop, tail=7.0):
    n = int((loop + tail) * SR)

    return np.zeros(n)


def title():
    rng = np.random.default_rng(11)
    L = 56
    mix = render(L)
    total = L + 7

    place(mix, drone(36.71, total, rng), 0, 0.55)  # D1
    place(mix, wind(total, rng), 0, 0.10)

    # the toll: deep D, then, half a bar later, an answer a minor third up that is always a little too quiet
    for i, at in enumerate((2.0, 9.0, 16.0, 23.0, 30.0, 37.0, 44.0, 51.0)):
        if i in (3, 6):
            place(mix, swell(73.42, 5.0, rng), at - 5.0, 0.45)

        place(mix, bell(73.42, 13, rng), at, 0.9)
        place(mix, bell(174.61, 9, rng), at + 3.6, 0.22)

    # the choir moves between two chords, one note of each clashing with the root
    chords = [(146.83, 174.61, 220.0, 311.13), (116.54, 146.83, 174.61, 207.65)]

    for k, at in enumerate((0, 14, 28, 42)):
        place(mix, pad(chords[k % 2], 18, rng), at - 2 if at else 0, 0.20)

    # a slow pulse comes in halfway: two thuds, a rest, two thuds
    for beat in np.arange(20.0, L, 2.6):
        place(mix, thud(), beat, 0.5)
        place(mix, thud(46), beat + 0.34, 0.3)

    save('mus_dark_title', fold(reverb(mix, rng), L))


def belfry():
    rng = np.random.default_rng(23)
    L = 64
    mix = render(L)
    total = L + 7

    place(mix, drone(27.5, total, rng, 1.3), 0, 0.6)  # A0
    place(mix, wind(total, rng), 0, 0.14)

    for i, at in enumerate((3.0, 12.0, 21.0, 30.0, 39.0, 48.0, 57.0)):
        place(mix, bell(55.0 if i % 2 == 0 else 49.0, 14, rng), at, 0.95)

        if i in (2, 5):
            place(mix, swell(55.0, 6.0, rng), at - 6.0, 0.4)

    # the lament: a falling line, each note held until the next breathes in
    line = [(146.83, 0), (130.81, 8), (116.54, 16), (110.0, 24), (98.0, 32), (110.0, 40), (116.54, 48), (110.0, 56)]

    for f, at in line:
        place(mix, string(f, 10, rng), at, 0.26)

    place(mix, pad((110.0, 130.81, 164.81), 22, rng, (500, 900, 2200)), 4, 0.14)
    place(mix, pad((98.0, 116.54, 146.83), 22, rng, (500, 900, 2200)), 36, 0.14)

    save('mus_dark_belfry', fold(reverb(mix, rng, 4.6, 0.55), L))


def ending():
    rng = np.random.default_rng(37)
    L = 48
    mix = render(L)
    total = L + 7

    place(mix, drone(36.71, total, rng, 0.3), 0, 0.35)
    place(mix, wind(total, rng), 0, 0.07)

    # a bell tolling a falling phrase (D F E D, then A G F D): one stroke for each of the dead
    phrase = [(293.66, 2.0), (349.23, 8.0), (329.63, 14.0), (293.66, 20.0), (220.0, 27.0), (196.0, 33.0), (174.61, 39.0), (146.83, 44.0)]

    for f, at in phrase:
        place(mix, bell(f / 2, 11, rng), at, 0.75)

    # the pad opens at last from the clashing chord into a plain one
    place(mix, pad((146.83, 174.61, 220.0, 233.08), 20, rng), 0, 0.17)
    place(mix, pad((146.83, 220.0, 293.66, 369.99), 26, rng, (700, 1200, 2600)), 22, 0.19)

    save('mus_dark_ending', fold(reverb(mix, rng, 4.8, 0.6), L))


if __name__ == '__main__':
    title()
    belfry()
    ending()
