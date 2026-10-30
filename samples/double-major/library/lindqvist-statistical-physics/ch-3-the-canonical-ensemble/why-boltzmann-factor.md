---
type: extract
title: why the Boltzmann factor — count the reservoir
imported: 2026-09-26
read: due=2026-10-30 ivl=9 reps=3 pos=4
---

The answer comes from applying the fundamental assumption not to the small system but to the combined one. When the small system is in state $s$, the reservoir has energy $U_0 - E_s$ and may be in any of $\Omega_R(U_0 - E_s)$ microstates. Each of these, combined with state $s$, is a distinct microstate of the isolated whole, and all such microstates are equally probable. Hence the probability of state $s$ is proportional to the number of reservoir states compatible with it:

$$
P(s) \propto \Omega_R(U_0 - E_s) = \exp\left[\frac{S_R(U_0 - E_s)}{k}\right].
$$

Because the reservoir is large, $E_s$ is a tiny fraction of its energy, and we may expand its entropy in a Taylor series. It is essential to expand $S_R$ rather than $\Omega_R$: the multiplicity changes by an enormous factor even for a small change in energy, while its logarithm changes smoothly.
<!-- extract expand-the-entropy -->

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
