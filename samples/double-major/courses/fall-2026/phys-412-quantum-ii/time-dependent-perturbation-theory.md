---
title: time-dependent perturbation theory
lectures: 2026-10-28
---

Lecture 21, Oct 28. Typed same evening, rough. Lindgren went fast ("you've seen two-level systems in 312, I'm going straight to the golden rule"). Clean up after Friday's lecture, which continues this (harmonic perturbations, absorption/emission). #TODO: redo the sinc² limit carefully, I hand-waved the delta function.

## setup

$H = H^0 + H'(t)$, $H^0|n\rangle = E_n|n\rangle$, and now $H'$ depends on time. We no longer look for stationary states; we ask: start in $|i\rangle$ at $t = 0$, what's the probability of being in $|f\rangle$ at time $t$?

Expand $|\psi(t)\rangle = \sum_n c_n(t)e^{-iE_nt/\hbar}|n\rangle$ (pulling out the unperturbed phases, i.e. interaction picture). Then the Schrödinger equation gives, exactly,

$$i\hbar\,\dot c_f(t) = \sum_n H'_{fn}(t)\,e^{i\omega_{fn}t}\,c_n(t), \qquad \omega_{fn} = \frac{E_f - E_n}{\hbar}.$$

two-level version (from 312): $\dot c_b = -\frac i\hbar H'_{ba}e^{i\omega_0t}c_a$, $\dot c_a = -\frac i\hbar H'_{ab}e^{-i\omega_0t}c_b$, assuming $H'_{aa} = H'_{bb} = 0$.

## first order

Zeroth order: $c_n = \delta_{ni}$. Plug into the right side:

$$c_f^{(1)}(t) = -\frac i\hbar\int_0^tH'_{fi}(t')\,e^{i\omega_{fi}t'}\,dt' \qquad (f\neq i).$$

first-order transition amplitude in time-dependent PT ::: $c_f^{(1)}(t) = -\dfrac{i}{\hbar}\displaystyle\int_0^t H'_{fi}(t')\,e^{i\omega_{fi}t'}\,dt'$ ^qm5-amp
<!-- sr due=2026-10-30T08:15:00Z st=learning s=0.4 d=6.3 r=1 l=0 steps=1 ivl=0 last=2026-10-30T08:05:00Z g=1 -->

So the amplitude is the Fourier component of the perturbation at the transition frequency. Valid while $|c_f^{(1)}| \ll 1$.

## constant perturbation switched on at $t = 0$

$H'(t) = V$ for $t \ge 0$ (time-independent operator, switched on suddenly). Then

$$c_f^{(1)} = -\frac i\hbar V_{fi}\frac{e^{i\omega_{fi}t} - 1}{i\omega_{fi}} = -\frac{i}{\hbar}V_{fi}\,e^{i\omega_{fi}t/2}\,\frac{2\sin(\omega_{fi}t/2)}{\omega_{fi}}$$

$$P_{i\to f}(t) = \frac{4|V_{fi}|^2}{\hbar^2}\,\frac{\sin^2(\omega_{fi}t/2)}{\omega_{fi}^2}.$$

for a constant perturbation switched on at $t=0$, $P_{i\to f}(t) = {{c1::\frac{4|V_{fi}|^2}{\hbar^2}\frac{\sin^2(\omega_{fi}t/2)}{\omega_{fi}^2}}}$ ^qm5-sinc

As a function of $\omega_{fi}$ at fixed $t$: a peak at $\omega_{fi} = 0$ of height $|V_{fi}|^2t^2/\hbar^2$ and width $\sim 2\pi/t$ (first zeros at $\omega_{fi} = \pm 2\pi/t$). So the peak gets taller as $t^2$ and narrower as $1/t$; the area grows as $t$. Energy is "conserved" only to within $\Delta E \sim 2\pi\hbar/t$. Lindgren called this the energy–time uncertainty relation "in the only form I'll accept".

the central peak of $\sin^2(\omega t/2)/\omega^2$ has height $\propto$ {{c1::$t^2$}} and width $\propto$ {{c2::$1/t$}}, so its area grows like $t$ ^qm5-peak

## the long-time limit

$$\lim_{t\to\infty}\frac{\sin^2(\omega t/2)}{\omega^2} = \frac{\pi t}{2}\,\delta(\omega).$$

Sketch: $\int_{-\infty}^\infty\frac{\sin^2(\omega t/2)}{\omega^2}\,d\omega = \frac{t}{2}\int\frac{\sin^2u}{u^2}\,du = \frac{\pi t}{2}$ (with $u = \omega t/2$, $\int\frac{\sin^2u}{u^2}du = \pi$), and the function concentrates at $\omega = 0$ as $t$ grows. #TODO: this is "a nascent delta function times $t$", fine, but the limit is only meaningful under an integral over final states. That's the next step.

So

$$P_{i\to f}(t) \to \frac{4|V_{fi}|^2}{\hbar^2}\cdot\frac{\pi t}{2}\,\delta(\omega_{fi}) = \frac{2\pi}{\hbar}|V_{fi}|^2\,\delta(E_f - E_i)\,t$$

using $\delta(\omega_{fi}) = \hbar\,\delta(E_f - E_i)$. Probability linear in $t$: a constant rate.

## Fermi's golden rule

A delta function in a probability is meaningless for a single discrete final state; it means: the final states form a continuum with density $\rho(E_f)$ (states per unit energy), and we sum over them. Then

$$\Gamma_{i\to f} = \frac{dP}{dt} = \frac{2\pi}{\hbar}\,|V_{fi}|^2\,\rho(E_f)\Big|_{E_f = E_i}.$$

Fermi's golden rule ::: $\Gamma_{i\to f} = \dfrac{2\pi}{\hbar}|V_{fi}|^2\rho(E_f)$, evaluated at $E_f = E_i$ ^qm5-golden

Conditions (Lindgren listed these and said they'd be on the final):

- $t$ long compared with $1/\Delta\omega$, where $\Delta\omega$ is the frequency range over which $|V_{fi}|^2\rho$ is roughly constant (so the sinc² is effectively a delta function under the integral)
- $t$ short enough that $P \ll 1$ (first-order PT still valid, initial state not depleted)
- these are compatible when the rate $\Gamma$ is small compared with $\Delta\omega$; in practice the window is huge. Beyond first order, the initial state decays exponentially, $|c_i|^2 = e^{-\Gamma t}$ (Wigner–Weisskopf), which is the real justification for using a rate

why does the golden rule require a continuum of final states?
?
the long-time limit of $\sin^2(\omega t/2)/\omega^2$ is $\frac{\pi t}{2}\delta(\omega)$; for a single discrete state the probability just oscillates (and the "rate" is meaningless), but summed over a continuum with smooth $|V_{fi}|^2\rho(E)$ the delta function integrates to a finite rate linear in $t$ ^qm5-cont

## example Lindgren did in the last ten minutes: a Gaussian pulse on the oscillator

Charged oscillator, ground state at $t = -\infty$, hit by a uniform field pulse $H'(t) = -qE_0x\,e^{-t^2/\tau^2}$. Only $|1\rangle$ is reachable at first order ($x$ connects $0 \to 1$ only), with $\langle 1|x|0\rangle = \sqrt{\hbar/2m\omega}$:

$$c_1^{(1)} = \frac{i}{\hbar}qE_0\sqrt{\frac{\hbar}{2m\omega}}\int_{-\infty}^{\infty}e^{-t^2/\tau^2}e^{i\omega t}\,dt = \frac{i}{\hbar}qE_0\sqrt{\frac{\hbar}{2m\omega}}\,\sqrt\pi\,\tau\,e^{-\omega^2\tau^2/4}$$

$$P_{0\to1} = \frac{\pi q^2E_0^2\tau^2}{2m\hbar\omega}\,e^{-\omega^2\tau^2/2}.$$

Two limits, which he said is the point of the example:

- sudden, $\omega\tau \ll 1$: the exponential is 1, $P \propto \tau^2$; a short kick transfers momentum $\Delta p = \int qE\,dt = \sqrt\pi\,qE_0\tau$ and $P = \frac{(\Delta p)^2}{2m\hbar\omega}$, which is (kick energy)/(quantum) — classical-looking
- adiabatic, $\omega\tau \gg 1$: $P \sim e^{-\omega^2\tau^2/2}$, exponentially small. A slow perturbation doesn't cause transitions; the state follows the instantaneous ground state (adiabatic theorem, later)

a slowly switched perturbation ($\omega\tau \gg 1$) causes transitions with probability {{c1::exponentially small in $\omega\tau$}}, because the amplitude is {{c2::the Fourier component of $H'(t)$ at the transition frequency}} ^qm5-adiabatic

Remark to self: for a strictly constant perturbation switched on suddenly (the case above), the sinc² is exactly this "sudden" behavior; the golden rule is what's left after long times when a continuum soaks up the oscillation. Same formula, three regimes.

## harmonic perturbation (started, continues Friday)

$H'(t) = Ve^{-i\omega t} + V^\dagger e^{i\omega t}$. Same calculation with $\omega_{fi} \to \omega_{fi} \mp \omega$. For long times only the resonant term survives:

$$\Gamma_{i\to f} = \frac{2\pi}{\hbar}|V_{fi}|^2\,\delta(E_f - E_i - \hbar\omega) + \frac{2\pi}{\hbar}|V^\dagger_{fi}|^2\,\delta(E_f - E_i + \hbar\omega)$$

first term absorption, second stimulated emission. (Each with a $\rho$ after summing.) #TODO: factor of 4 — Lindgren wrote $H' = V\cos\omega t$ at first, which is $\frac V2(e^{i\omega t} + e^{-i\omega t})$, so his golden rule has $\frac{|V_{fi}|^2}{4}$; then he switched to the $Ve^{-i\omega t} + V^\dagger e^{i\omega t}$ convention halfway down the board. Ask which one the final uses.

Rotating-wave version for a two-level atom near resonance (from the textbook, for comparison): $P_{a\to b}(t) = \frac{|V_{ba}|^2}{\hbar^2}\frac{\sin^2[(\omega_0 - \omega)t/2]}{(\omega_0 - \omega)^2}$ with $H' = V\cos\omega t$. Consistent with the factor-of-4 issue above: $\frac{4}{4}$. ok.

[ask in OH: why do we drop the "counter-rotating" term even at first order? He said "it's off-resonant by $2\omega$". Fine, but for a broadband source?]
