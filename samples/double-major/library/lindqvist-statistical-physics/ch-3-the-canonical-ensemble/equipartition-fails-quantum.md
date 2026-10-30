---
type: extract
title: equipartition fails when levels are spaced wider than kT
imported: 2026-10-03
read: due=2026-11-14 ivl=24 reps=3 pos=2
---

The theorem is purely classical. Its assumption, that the levels are closely spaced, fails for any degree of freedom whose quantum of energy is comparable to or larger than $kT$. Such a degree of freedom is said to be *frozen out*: it remains almost entirely in its ground state and contributes almost nothing to the energy or the heat capacity. The vibrations of most diatomic molecules are frozen at room temperature, which is why their heat capacity is $\frac52 k$ per molecule rather than $\frac72 k$. The failure of equipartition in this and other cases, most famously in the radiation of a black body, was among the first signs that classical mechanics was incomplete.

The quantitative version is the oscillator $\langle E\rangle$ from §3.8. Subtract the zero-point energy and set $y = \hbar\omega/kT$: $\langle E\rangle - \hbar\omega/2 = kT\cdot y/(e^y - 1)$. The factor $y/(e^y-1)$ is the fraction of the equipartition value the mode actually gets. At $y = 0.2$ it's $0.2/0.2214 = 0.90$; at $y = 1$, $0.58$; at $y = 3$, $0.16$; at $y = 10$, $4.5\times10^{-4}$. So "frozen" isn't a switch, it's this curve, and the mode is basically gone by $\hbar\omega \approx 5kT$.

For the blackbody: a cavity has modes at every frequency, and classically each gets $kT$, so the energy at high frequency diverges (the "ultraviolet catastrophe"). With the quantum factor, modes with $\hbar\omega \gg kT$ are frozen and the integral converges. Same physics as the diatomic, infinitely many times. Book does this in ch. 4 §4.6.

fraction of its equipartition energy $kT$ that a quantum oscillator mode actually carries (above zero-point), with $y = \hbar\omega/kT$ :: $y/(e^y - 1)$ — near 1 for $y \ll 1$, exponentially small for $y \gg 1$ ^lq-ex-equip-fraction
<!-- sr due=2026-11-19 st=review s=26.1 d=4.1 r=3 l=0 ivl=26 last=2026-10-24T09:52:00Z g=4 -->
