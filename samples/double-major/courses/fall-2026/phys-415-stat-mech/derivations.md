---
type: deck
title: derivations
default-card: qa
---

Derivation drills. Front = what to derive, back = the chain of steps. Grade "good" only if I can write every step on paper without looking, not if I recognize it. Takes 3–5 min each; don't do more than four a day.

derive the Boltzmann factor from a system in contact with a reservoir
?
(1) combined system isolated, all joint microstates equally likely; with S fixed in state $s$, the number of joint states is $\Omega_R(U_0 - E_s)$
(2) so $P(s) \propto \Omega_R(U_0 - E_s) = e^{S_R(U_0 - E_s)/k}$
(3) expand $S_R$ (not $\Omega_R$) to first order:
$$
S_R(U_0 - E_s) \approx S_R(U_0) - \frac{E_s}{T}
$$
(4) second-order term $\propto 1/C_R \to 0$ for a reservoir
(5) $P(s) \propto e^{-E_s/kT}$; normalize with $Z = \sum_s e^{-E_s/kT}$ ^sm-dv-boltzmann
<!-- sr due=2026-11-08 st=review s=12.6 d=5.7 r=3 l=0 ivl=13 last=2026-10-26T19:02:00Z g=3 -->

derive the Sackur–Tetrode entropy from the multiplicity of an ideal gas
?
(1) one atom: states = $V \cdot V_p / h^3$; $N$ atoms: momenta on a $3N$-sphere of radius $\sqrt{2mU}$, divide by $N!$:
$$
\Omega \approx \frac{1}{N!}\frac{V^N}{h^{3N}}\frac{\pi^{3N/2}}{(3N/2)!}(2mU)^{3N/2}
$$
(2) $\ln$, Stirling on $N!$ and $(3N/2)!$
(3) collect: $N\ln(V/N)$, $\tfrac{3N}{2}\ln\frac{4\pi mU}{3Nh^2}$, constants $N + \tfrac{3N}{2} = \tfrac{5N}{2}$
(4)
$$
S = Nk\left[\ln\left(\frac{V}{N}\left(\frac{4\pi mU}{3Nh^2}\right)^{3/2}\right) + \frac52\right]
$$
(5) check extensivity; check $\partial S/\partial U = \tfrac32 Nk/U$ gives $U = \tfrac32 NkT$ ^sm-dv-sackur
<!-- sr due=2026-10-29 st=review s=6.1 d=7.3 r=4 l=1 ivl=6 last=2026-10-23T20:10:00Z g=2 -->

derive $F = -kT\ln Z$
?
(1) Gibbs entropy $S = -k\sum_s P_s\ln P_s$ (reduces to $k\ln\Omega$ for uniform $P_s$)
(2) canonical: $\ln P_s = -\beta E_s - \ln Z$
(3) $S = k\beta\sum_s P_s E_s + k\ln Z\sum_s P_s = U/T + k\ln Z$
(4) $TS = U + kT\ln Z$, so $F = U - TS = -kT\ln Z$ ^sm-dv-F
<!-- sr due=2026-11-12 st=review s=17.2 d=4.1 r=3 l=0 ivl=17 last=2026-10-26T19:05:00Z g=4 -->

derive $\sigma_E^2 = kT^2 C_V$ in the canonical ensemble
?
(1) $\langle E\rangle = -\partial_\beta\ln Z$
(2) $\partial_\beta^2\ln Z = \frac{Z''}{Z} - \left(\frac{Z'}{Z}\right)^2 = \langle E^2\rangle - \langle E\rangle^2$
(3) and $\partial_\beta^2\ln Z = -\partial_\beta\langle E\rangle$
(4) $\partial_\beta = -kT^2\,\partial_T$, so $-\partial_\beta\langle E\rangle = kT^2\,\partial_T\langle E\rangle = kT^2 C_V$ ^sm-dv-fluct
<!-- sr st=new -->

derive the Schottky heat capacity of $N$ two-level systems (levels $0$, $\epsilon$)
?
(1) $Z_1 = 1 + e^{-\beta\epsilon}$
(2) $\langle E\rangle = \epsilon/(e^{\beta\epsilon} + 1)$ per system
(3) $C = N\,d\langle E\rangle/dT$, with $x = \epsilon/kT$:
$$
C = Nk\frac{x^2e^x}{(e^x + 1)^2}
$$
(4) limits: $x\to\infty$ gives $Nkx^2e^{-x}$; $x\to0$ gives $Nkx^2/4$; peak near $x \approx 2.4$ ^sm-dv-schottky
<!-- sr due=2026-11-06 st=review s=10.5 d=5.5 r=2 l=0 ivl=10 last=2026-10-27T07:51:00Z g=3 -->

derive the heat capacity of an Einstein solid and both limits
?
(1) $Z_1 = \sum_n e^{-\beta\hbar\omega(n+1/2)} = 1/(2\sinh(\beta\hbar\omega/2))$
(2) $\langle E\rangle = \frac{\hbar\omega}{2} + \frac{\hbar\omega}{e^{\beta\hbar\omega} - 1}$
(3) $3N$ oscillators; $y = \Theta_E/T$:
$$
C_V = 3Nk\,\frac{y^2 e^y}{(e^y - 1)^2}
$$
(4) $y\to0$: $3Nk$ (Dulong–Petit); $y\to\infty$: $3Nky^2e^{-y}$ (too fast; real solids $\propto T^3$) ^sm-dv-einstein
<!-- sr st=new -->

derive equipartition for one quadratic degree of freedom
?
(1) $E = cq^2$; classical sum → integral, $Z_q = \frac{1}{\Delta q}\int e^{-\beta cq^2}dq = \frac{1}{\Delta q}\sqrt{\pi/\beta c}$
(2) $\ln Z_q = -\tfrac12\ln\beta + \text{const}$
(3) $\langle E\rangle = -\partial_\beta\ln Z_q = \frac{1}{2\beta} = \tfrac12 kT$ ^sm-dv-equip
<!-- sr due=2026-11-20 st=review s=24.3 d=3.3 r=3 l=0 ivl=24 last=2026-10-27T07:53:00Z g=4 -->

derive the paramagnet's magnetization from the multiplicity (microcanonical)
?
(1) $S/k = N\ln N - N_\uparrow\ln N_\uparrow - N_\downarrow\ln N_\downarrow$
(2) $U = \mu B(N - 2N_\uparrow)$, so $dN_\uparrow/dU = -1/2\mu B$
(3) $1/T = \frac{k}{2\mu B}\ln(N_\uparrow/N_\downarrow)$
(4) $N_\uparrow/N_\downarrow = e^{2\mu B/kT}$, solve with $N_\uparrow + N_\downarrow = N$
(5) $M = N\mu\tanh(\mu B/kT)$ ^sm-dv-para-micro
<!-- sr due=2026-10-12 st=review s=5.2 d=8.4 r=4 l=2 ivl=5 last=2026-10-07T20:30:00Z g=1 sus=1 -->

[suspended the microcanonical paramagnet — the canonical version is three lines and she said she won't ask the long way]

derive the high-temperature entropy of an Einstein solid from the multiplicity
?
(1) $\Omega = \binom{q+N-1}{q}$, $q \gg N$
(2) Stirling; $\ln(1 + N/q) \approx N/q$
(3) $\ln\Omega \approx N\ln(q/N) + N$, so $S = Nk[\ln(q/N) + 1]$
(4) $1/T = \partial S/\partial U$ with $U = q\epsilon$ gives $U = NkT$ ^sm-dv-einstein-micro
<!-- sr due=2026-10-20 st=review s=9.7 d=6.2 r=3 l=1 ivl=10 last=2026-10-10T09:15:00Z g=3 sus=1 -->

derive the Fermi energy of a free electron gas
?
(1) orbitals with $|p| < p_F$: $\frac{V}{h^3}\cdot\frac{4\pi}{3}p_F^3$; times 2 for spin $= N$
(2) $p_F = \hbar(3\pi^2 n)^{1/3}$
(3)
$$
E_F = \frac{\hbar^2}{2m}(3\pi^2 n)^{2/3}
$$
(4) $g(\epsilon) = \frac{3N}{2E_F^{3/2}}\sqrt\epsilon$; $U_0 = \tfrac35 NE_F$; $P = \tfrac25 nE_F$ ^sm-dv-fermi
<!-- sr st=new -->
