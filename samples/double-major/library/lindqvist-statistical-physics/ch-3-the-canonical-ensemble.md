---
type: source
title: "ch. 3: the canonical ensemble"
pdf: ../lindqvist-statistical-physics.pdf
pages: 23-28
imported: 2026-09-24
read: due=2026-10-30 ivl=5 reps=4 pos=26 y=0.738
author: H. Lindqvist
---

## why the Boltzmann factor — count the reservoir
<!-- read made=2026-09-26 due=2026-10-30 ivl=9 reps=3 boxes=23:0.129:0.403:0.762:0.375 -->

To first order, $S_R(U_0 - E_s) \approx S_R(U_0) - E_s/T$, and the first term is the same for every $s$. Therefore $P(s) \propto e^{-E_s/kT}$.

My gloss: the thing that's surprising is that the small system's own multiplicity doesn't appear at all. That's because we fixed S in *one microstate* — its multiplicity is 1 by construction. All the counting is on the reservoir side. When I asked "but what about the system's entropy" in lecture, Okonkwo said that comes back when you sum over states with the same energy: $P(E) = g(E)e^{-\beta E}/Z$, the $g(E)$ is the system's multiplicity at that energy. So: the system's $\Omega$ enters as a degeneracy factor, the reservoir's $\Omega$ as the exponential.

Also — the small system can be *one atom*. There's no large-$N$ assumption on S. The large-$N$ is all in R. This is different from the microcanonical unit where everything relied on S being huge.

in the derivation of the Boltzmann factor, where does the small system's own multiplicity appear?
?
nowhere for a single microstate (fix S in one state: multiplicity 1); it comes back as the degeneracy $g(E)$ when you ask for the probability of an energy, $P(E) = g(E)e^{-\beta E}/Z$ ^lq-ex-boltz-system-omega
<!-- sr due=2026-11-04 st=review s=8.9 d=5 r=3 l=0 ivl=9 last=2026-10-26T19:12:00Z g=3 -->

does the Boltzmann distribution require the system itself to be large?
?
no — the system can be a single atom; the large-$N$ assumption is entirely on the reservoir, whose entropy is Taylor-expanded ^lq-ex-boltz-small
<!-- sr due=2026-10-30 st=review s=4.3 d=6 r=2 l=0 ivl=4 last=2026-10-26T19:13:00Z g=3 -->

## expand S_R, not Ω_R
<!-- read made=2026-10-21 due=2026-10-29 ivl=4 reps=2 boxes=23:0.129:0.579:0.759:0.039 -->

Making this concrete for myself (night before the midterm, 10/20). Take the reservoir to be a high-$T$ Einstein solid with $N_R$ oscillators, $\Omega_R \approx (eq_R/N_R)^{N_R}$, i.e. $\Omega_R \propto U_R^{N_R}$. Remove one quantum $\epsilon$ from $U_R$:

$$
\frac{\Omega_R(U_R - \epsilon)}{\Omega_R(U_R)} = \left(1 - \frac{\epsilon}{U_R}\right)^{N_R} \approx e^{-N_R\epsilon/U_R} = e^{-\epsilon/kT}
$$

using $U_R = N_R kT$. The linear expansion of $\Omega_R$ would give $1 - N_R\epsilon/U_R = 1 - \epsilon/kT$, which goes negative once $\epsilon > kT$. Nonsense. The log is linear to excellent accuracy: $\ln\Omega_R = N_R\ln U_R + \ldots$, and $N_R\ln(U_R - \epsilon) = N_R\ln U_R - N_R\epsilon/U_R - N_R\epsilon^2/2U_R^2 - \ldots$; the quadratic term is $(\epsilon/kT)^2/2N_R$, which vanishes as $N_R\to\infty$. So the exponential isn't an approximation that happens to work: it's the $N_R\to\infty$ limit of $(1 - x/N_R)^{N_R}$.

for a reservoir with $\Omega_R \propto U_R^{N_R}$, why does removing energy $\epsilon$ give exactly a Boltzmann factor as $N_R \to \infty$?
?
$\Omega_R(U_R - \epsilon)/\Omega_R(U_R) = (1 - \epsilon/U_R)^{N_R}$ with $U_R = N_R kT$, i.e. $(1 - x/N_R)^{N_R} \to e^{-x}$ with $x = \epsilon/kT$ ^lq-ex-expand-limit
<!-- sr due=2026-10-29 st=review s=3.4 d=6.5 r=2 l=0 ivl=3 last=2026-10-26T19:15:00Z g=2 -->

## 3.3 · average values (3.9)
<!-- read made=2026-09-27 boxes=24:0.112:0.759:0.762:0.159 -->

relative energy fluctuation of a macroscopic system in contact with a reservoir scales as :: $N^{-1/2}$, since $\sigma_E^2 = kT^2C_V \propto N$ and $\langle E\rangle \propto N$ ^lq3-fluct-scaling
<!-- sr due=2026-11-11 st=review s=14.7 d=4.2 r=3 l=0 ivl=15 last=2026-10-27T08:31:00Z g=3 -->

## 3.4 · the Helmholtz free energy (3.10–3.11)
<!-- read made=2026-09-28 boxes=25:0.129:0.119:0.760:0.214 -->

$$
F = {{c1::-kT\ln Z}}
$$ ^lq3-F-lnZ
<!-- sr due=2026-11-03 st=review s=12.9 d=3.6 r=3 l=0 ivl=13 last=2026-10-21T08:24:00Z g=3 -->

## equipartition fails when levels are spaced wider than kT
<!-- read made=2026-10-03 due=2026-11-14 ivl=24 reps=3 boxes=26:0.113:0.316:0.762:0.124 -->

the condition for equipartition to apply to a degree of freedom :: its energy levels must be closely spaced compared with $kT$, so that the sum over states can be replaced by an integral ^lq3-equip-cond
<!-- sr due=2026-10-30 st=review s=6.2 d=5.2 r=3 l=1 ivl=6 last=2026-10-24T09:50:00Z g=3 -->

The quantitative version is the oscillator $\langle E\rangle$ from §3.8. Subtract the zero-point energy and set $y = \hbar\omega/kT$: $\langle E\rangle - \hbar\omega/2 = kT\cdot y/(e^y - 1)$. The factor $y/(e^y-1)$ is the fraction of the equipartition value the mode actually gets. At $y = 0.2$ it's $0.2/0.2214 = 0.90$; at $y = 1$, $0.58$; at $y = 3$, $0.16$; at $y = 10$, $4.5\times10^{-4}$. So "frozen" isn't a switch, it's this curve, and the mode is basically gone by $\hbar\omega \approx 5kT$.

For the blackbody: a cavity has modes at every frequency, and classically each gets $kT$, so the energy at high frequency diverges (the "ultraviolet catastrophe"). With the quantum factor, modes with $\hbar\omega \gg kT$ are frozen and the integral converges. Same physics as the diatomic, infinitely many times. Book does this in ch. 4 §4.6.

fraction of its equipartition energy $kT$ that a quantum oscillator mode actually carries (above zero-point), with $y = \hbar\omega/kT$ :: $y/(e^y - 1)$ — near 1 for $y \ll 1$, exponentially small for $y \gg 1$ ^lq-ex-equip-fraction
<!-- sr due=2026-11-19 st=review s=26.1 d=4.1 r=3 l=0 ivl=26 last=2026-10-24T09:52:00Z g=4 -->

## the Schottky anomaly
<!-- read made=2026-10-06 due=2026-10-30 ivl=5 reps=2 boxes=27:0.129:0.149:0.759:0.124 -->

Where the numbers come from (did this for pset 6, #2). Maximize $f(x) = x^2e^x/(e^x+1)^2$. Setting $f'(x) = 0$ gives

$$
x\tanh(x/2) = 2
$$

(write $f = x^2/(4\cosh^2(x/2))$, so $\ln f = 2\ln x - 2\ln\cosh(x/2) + \text{const}$, derivative $2/x - \tanh(x/2) = 0$.) Solve numerically: $x = 2.4$ gives $2.4\times\tanh 1.2 = 2.4\times0.834 = 2.00$. So $x^* \approx 2.40$, $kT^* = \epsilon/2.40 = 0.417\,\epsilon$. Height: $f(2.4) = 5.76/(4\cosh^2 1.2) = 5.76/(4\times3.278) = 0.439$. ✓ both of the book's numbers.

The $\cosh$ form is much nicer than the one in my course notes. Use it on the final.

How to use it experimentally: if you see a bump in $C(T)$ at $T^*$ and it's two-level-like, $\epsilon \approx 2.4\,kT^*$. Height tells you $N$ (number of impurities/ions). E.g. Problem 3.7: $\epsilon = 1.0$ meV gives $T^* = 1.0\text{ meV}/(2.40\,k) \approx 4.8$ K.

the condition for the Schottky maximum, with $x = \epsilon/kT$ :: $x\tanh(x/2) = 2$, so $x \approx 2.40$ ^lq-ex-schottky-cond
<!-- sr due=2026-10-30 st=review s=4.9 d=6.2 r=2 l=0 ivl=5 last=2026-10-25T18:30:00Z g=3 -->

two-level heat capacity written with a hyperbolic function :: $C = Nk\,\dfrac{x^2}{4\cosh^2(x/2)}$, $x = \epsilon/kT$ ^lq-ex-schottky-cosh
<!-- sr st=new -->

## 3.8 · the Einstein solid revisited
<!-- read made=2026-10-25 boxes=27:0.129:0.616:0.759:0.140 -->

high-temperature limit of the Einstein heat capacity, and its name :: $C_V \to 3Nk$, the Dulong–Petit law ^lq3-dulong-petit
<!-- sr st=new -->
