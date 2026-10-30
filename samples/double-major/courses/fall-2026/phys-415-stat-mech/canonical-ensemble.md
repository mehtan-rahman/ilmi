---
title: canonical ensemble & partition functions
lectures: 2026-09-21 to 2026-10-16
---

## lecture 8 — the Boltzmann factor (Mon 9/21)

Setup: a small system S in thermal contact with a huge reservoir R at temperature $T$. Together isolated, total energy $U_0$ fixed. S can be in any of its microstates $s$ with energy $E_s$. Question: what's $P(s)$?

The trick is to stop counting S and count R. Fix S in one specific state $s$. Then the number of microstates of the combined system is just the number of states of the reservoir with energy $U_0 - E_s$: $\Omega_R(U_0 - E_s)$. By the fundamental assumption applied to the *combined* isolated system,

$$
\frac{P(s_2)}{P(s_1)} = \frac{\Omega_R(U_0 - E_{s_2})}{\Omega_R(U_0 - E_{s_1})} = e^{[S_R(U_0 - E_{s_2}) - S_R(U_0 - E_{s_1})]/k}
$$

Now expand the reservoir entropy, not the multiplicity (she was emphatic: $\Omega_R$ changes by enormous factors, $S_R$ changes smoothly, Taylor-expand the smooth thing). $E_s \ll U_0$:

$$
S_R(U_0 - E_s) \approx S_R(U_0) - E_s \left(\frac{\partial S_R}{\partial U}\right) = S_R(U_0) - \frac{E_s}{T}
$$

The second-order term is $\tfrac12 E_s^2\,\partial^2 S_R/\partial U^2 = -\tfrac12 E_s^2/(T^2 C_R)$, which vanishes as the reservoir's heat capacity $C_R \to \infty$. That's what "reservoir" means. Also used $dV_R = 0$, $dN_R = 0$ — only energy exchanged. So

$$
\frac{P(s_2)}{P(s_1)} = \frac{e^{-E_{s_2}/kT}}{e^{-E_{s_1}/kT}}
$$

and $P(s) \propto e^{-E_s/kT}$, the **Boltzmann factor**. Normalize:

$$
P(s) = \frac{e^{-\beta E_s}}{Z}, \qquad Z = \sum_s e^{-\beta E_s}, \qquad \beta \equiv \frac{1}{kT}
$$

in deriving the Boltzmann factor, why Taylor-expand the reservoir's entropy $S_R(U_0 - E_s)$ rather than its multiplicity $\Omega_R$?
?
$\Omega_R$ changes by huge factors when $E_s$ changes, so a linear expansion of it is useless; $S_R = k\ln\Omega_R$ varies smoothly, its first derivative is $1/T$, and the second-order term is suppressed by the reservoir's huge heat capacity ^sm-why-expand-S
<!-- sr due=2026-10-30 st=review s=9.3 d=5.4 r=4 l=0 ivl=9 last=2026-10-21T08:15:00Z g=3 -->

probability of microstate $s$ of a system in contact with a reservoir at $T$ :: $P(s) = e^{-E_s/kT}/Z$ ^sm-boltzmann-P
<!-- sr due=2026-11-14 st=review s=24.5 d=2.8 r=5 l=0 ivl=24 last=2026-10-21T08:14:00Z g=3 -->

Important: this is the probability of a *microstate*, not of an energy. If a level has degeneracy $g(E)$, $P(E) = g(E)\,e^{-\beta E}/Z$. Hydrogen example she did: ratio of $n=2$ to $n=1$ populations in the solar photosphere ($T \approx 5800$ K): $g_2/g_1 = 8/2 = 4$, $\Delta E = 10.2$ eV, $kT \approx 0.50$ eV, so ratio $\approx 4 e^{-20.4} \approx 5.5 \times 10^{-9}$. (Counting spin, $g_n = 2n^2$.)

in the canonical ensemble, the probability of finding the system at energy $E$ (not in one microstate) :: $P(E) = g(E)\,e^{-\beta E}/Z$, with $g(E)$ the degeneracy ^sm-degeneracy
<!-- sr due=2026-10-29 st=review s=5.3 d=6.1 r=4 l=1 ivl=5 last=2026-10-24T09:40:00Z g=3 -->

## lecture 9 — $Z$ does everything (Wed 9/23)

Average energy. $\langle E \rangle = \sum_s E_s e^{-\beta E_s}/Z$. Notice $\partial Z/\partial\beta = -\sum_s E_s e^{-\beta E_s}$, so

$$
\langle E\rangle = -\frac{1}{Z}\frac{\partial Z}{\partial \beta} = -\frac{\partial \ln Z}{\partial \beta}
$$

$$
\langle E \rangle = {{c1::-\frac{\partial \ln Z}{\partial \beta}}}
$$ ^sm-avgE
<!-- sr due=2026-11-07 st=review s=17.4 d=3.9 r=4 l=0 ivl=17 last=2026-10-21T08:16:00Z g=3 -->

Second derivative gives the variance:

$$
\frac{\partial^2 \ln Z}{\partial\beta^2} = \langle E^2\rangle - \langle E\rangle^2 = \sigma_E^2
$$

and since $\partial\langle E\rangle/\partial\beta = -kT^2\,\partial\langle E\rangle/\partial T = -kT^2 C_V$,

$$
\sigma_E^2 = kT^2 C_V
$$

Fluctuations are tied to a response function. For an ideal gas $C_V = \tfrac32 Nk$, so $\sigma_E/\langle E\rangle = \sqrt{2/3N}$. Same $1/\sqrt{N}$ as lecture 4. This is why canonical and microcanonical agree for macroscopic systems: the canonical energy distribution is a spike.

energy fluctuations in the canonical ensemble, in terms of the heat capacity :: $\sigma_E^2 = kT^2 C_V$ ^sm-sigmaE
<!-- sr due=2026-10-30 st=review s=7.6 d=6.6 r=4 l=1 ivl=8 last=2026-10-22T19:45:00Z g=2 -->

#TODO: check sign — I wrote $\partial\langle E\rangle/\partial\beta = +kT^2C_V$ in the notebook and it has to be minus since $E$ goes down when $\beta$ goes up. Fixed above. The variance is $+\partial^2\ln Z/\partial\beta^2 = -\partial\langle E\rangle/\partial\beta$, positive. OK.

## lecture 10 — free energy (Fri 9/25)

Claim: $F = U - TS = -kT \ln Z$.

Her derivation (Gibbs entropy route). Define $S = -k\sum_s P_s \ln P_s$. In the microcanonical case $P_s = 1/\Omega$ for all accessible states and this gives $k\ln\Omega$, so it's consistent. In the canonical case $\ln P_s = -\beta E_s - \ln Z$, so

$$
S = -k\sum_s P_s(-\beta E_s - \ln Z) = k\beta U + k\ln Z
$$

Multiply by $T$: $TS = U + kT\ln Z$, i.e.

$$
F \equiv U - TS = -kT\ln Z
$$

The book does it differently (shows $\partial(-kT\ln Z)/\partial T$ satisfies the same differential equation as $F$ and fixes the constant at $T = 0$). Both fine; mine is shorter.

$$
F = {{c1::-kT \ln Z}}
$$ ^sm-F-lnZ
<!-- sr due=2026-11-10 st=review s=19.8 d=3.4 r=4 l=0 ivl=20 last=2026-10-21T08:17:00Z g=3 -->

Then everything from $F$, using $dF = -S\,dT - P\,dV + \mu\,dN$:

$$
S = -\left(\frac{\partial F}{\partial T}\right)_{V,N}, \qquad P = -\left(\frac{\partial F}{\partial V}\right)_{T,N}, \qquad \mu = \left(\frac{\partial F}{\partial N}\right)_{T,V}
$$

pressure from the Helmholtz free energy :: $P = -\left(\partial F/\partial V\right)_{T,N}$ ^sm-P-from-F
<!-- sr due=2026-11-04 st=review s=13.2 d=3.7 r=3 l=0 ivl=13 last=2026-10-22T19:44:00Z g=3 -->

Why $F$ is the right potential at fixed $T$: system + reservoir, total entropy change for the system changing by $dU$, $dS$ at fixed $T$, $V$: $dS_{\text{tot}} = dS - dU/T = -dF/T$. Maximizing total entropy = minimizing $F$. "Free energy is entropy maximization of the universe, bookkept from the system's side."

## office hours (Tue 9/29) — is the Gibbs entropy the "same" entropy?

Asked Okonkwo why $-k\sum P\ln P$ (canonical) should be the same thing as $k\ln\Omega$ (microcanonical), since I'd only seen that they agree for uniform $P$. Her answer, roughly:

For a macroscopic system the canonical distribution over *energies* is a spike of relative width $N^{-1/2}$ around $U$. So essentially all the probability sits on the $\Omega(U)$ states at energy $\approx U$, each with probability $\approx 1/\Omega(U)$. Plug in: $-k\sum P\ln P \approx -k\,\Omega(U)\cdot\frac{1}{\Omega(U)}\ln\frac{1}{\Omega(U)} = k\ln\Omega(U)$. The corrections come from the width of the spike, and they're of order $\ln N$ — a "large number" correction to a "very large"... no, to an $N$-sized quantity. Negligible.

More careful version she wrote out: $Z = \sum_E \Omega(E)e^{-\beta E}$, and the summand is sharply peaked, so $\ln Z \approx \ln\Omega(U) - \beta U + O(\ln N)$. Then $k\ln Z + U/T \approx k\ln\Omega(U) = S_{\text{micro}}$. And $k\ln Z + U/T$ is exactly what the Gibbs formula gave in lecture 10. Same entropy to leading order in $N$; for small systems (one atom) only the Gibbs one makes sense.

why does the canonical entropy $k\ln Z + U/T$ agree with the microcanonical $k\ln\Omega(U)$ for a large system?
?
$Z = \sum_E \Omega(E)e^{-\beta E}$ is dominated by a peak at $E = U$ of relative width $N^{-1/2}$, so $\ln Z \approx \ln\Omega(U) - \beta U$ up to $O(\ln N)$ corrections, negligible next to $S \sim N$ ^sm-gibbs-vs-micro
<!-- sr st=new -->

She also said the information-theory reading ($S$ = missing information about the microstate, Shannon) is legitimate but she won't test it. Jaynes 1957 if I want it. [winter break reading]

Problem set 4 #5 asked for the entropy of the two-level system directly from the Gibbs formula. With $p = e^{-x}/(1 + e^{-x})$ the excited probability, $S/Nk = -p\ln p - (1-p)\ln(1-p)$: the binary entropy. $\to 0$ at $T \to 0$ and $\to \ln 2$ at $T \to \infty$, matching lecture 5's paramagnet at $U = 0$, where $\Omega = \binom{N}{N/2} \approx 2^N$.

## lecture 11 — composite systems, ideal gas again (Mon 9/28)

Two non-interacting subsystems, distinguishable: states are pairs, energies add, the sum factorizes.

$$
Z_{\text{total}} = Z_1 Z_2
$$

$N$ of them:

- distinguishable identical-looking things (atoms on lattice sites in a solid, told apart by position): $Z = Z_1^N$
- partition function of $N$ identical, non-interacting particles in a dilute gas :: $Z = Z_1^N / N!$ ^sm-ZN-identical
  <!-- sr due=2026-11-06 st=review s=15.5 d=3.2 r=4 l=0 ivl=16 last=2026-10-21T08:18:00Z g=3 -->
  - same caveat as microcanonical: only when multiple occupancy is negligible

One atom in a box, translational part. $Z_1 = \sum e^{-\beta p^2/2m}$ over box states, replaced by an integral with the $h^3$ rule:

$$
Z_1 = \frac{V}{h^3}\int d^3p\, e^{-\beta p^2/2m} = \frac{V}{h^3}\left(\frac{2\pi m}{\beta}\right)^{3/2} = \frac{V}{\lambda^3}
$$

with the **thermal (de Broglie) wavelength**

$$
\lambda = \frac{h}{\sqrt{2\pi m k T}}
$$

thermal de Broglie wavelength :: $\lambda = h/\sqrt{2\pi m kT}$ ^sm-lambda
<!-- sr due=2026-10-31 st=review s=10.4 d=5 r=3 l=0 ivl=10 last=2026-10-21T08:19:00Z g=3 -->

Internal states (rotation, vibration) multiply in as $Z_{\text{int}}$: $Z_1 = V Z_{\text{int}}/\lambda^3$.

Then $\ln Z = N\ln(V/\lambda^3) - N\ln N + N$, $F = -NkT[\ln(V/N\lambda^3) + 1]$:

$P = -\partial F/\partial V = NkT/V$ ✓. $U = -\partial \ln Z/\partial\beta$; only $\lambda^3 \propto \beta^{3/2}$ depends on $\beta$, so $U = \tfrac32 N/\beta = \tfrac32 NkT$ ✓. $S = (U - F)/T = Nk[\ln(V/N\lambda^3) + \tfrac52]$, which is Sackur–Tetrode again (substitute $kT = 2U/3N$ into $\lambda$). Three lines instead of a whole lecture. She did not say "I told you so" but it was implied.

$\mu = \partial F/\partial N = -kT\ln(V/N\lambda^3)$, same as from the microcanonical side. Classical regime is $V/N \gg \lambda^3$: particles further apart than their wavelength.

## lecture 12 — equipartition (Wed 9/30)

Theorem: in the classical limit, each degree of freedom that enters the energy as a quadratic term $E = c\,q^2$ contributes $\tfrac12 kT$ to $\langle E\rangle$.

Proof. Classical: the sum over states for that coordinate becomes $\int dq\, e^{-\beta c q^2}/\Delta q$ (the $\Delta q$ is the "state spacing", whatever it is):

$$
Z_q = \frac{1}{\Delta q}\int_{-\infty}^{\infty} e^{-\beta c q^2}\, dq = \frac{1}{\Delta q}\sqrt{\frac{\pi}{\beta c}} \;\propto\; \beta^{-1/2}
$$

So $\ln Z_q = -\tfrac12\ln\beta + \text{const}$, and $\langle E_q\rangle = -\partial\ln Z_q/\partial\beta = 1/(2\beta) = \tfrac12 kT$. Independent of $c$, independent of $\Delta q$. Only the power of $\beta$ matters.

why is the equipartition result $\tfrac12 kT$ independent of the coefficient $c$ in $E = cq^2$?
?
$Z_q = \int e^{-\beta c q^2}dq \propto (\beta c)^{-1/2}$; $c$ only enters as a constant factor in $Z$, which drops out of $-\partial \ln Z/\partial\beta$ — only the power $\beta^{-1/2}$ matters ^sm-equip-c
<!-- sr due=2026-11-02 st=review s=11.1 d=4.3 r=3 l=0 ivl=11 last=2026-10-22T19:47:00Z g=3 -->

Counting quadratic terms:

| system | quadratic dof per particle | $C_V$ per particle |
| --- | --- | --- |
| monatomic gas | 3 (translation) | $\tfrac32 k$ |
| diatomic, room $T$ | 3 trans + 2 rot | $\tfrac52 k$ |
| diatomic, high $T$ | + 2 vib (KE + PE) | $\tfrac72 k$ |
| solid (per atom) | 3 KE + 3 PE | $3k$ |

[she drew the $H_2$ $C_V$ staircase: $\tfrac32 \to \tfrac52$ around 100 K as rotation turns on, $\to \tfrac72$ above ~ 3000 K as vibration turns on, though it dissociates before it really gets there]

Failure: equipartition assumes the energy levels are closely spaced compared to $kT$ (so the sum is an integral). When $kT$ is small compared to the level spacing, the degree of freedom is **frozen out** and contributes nothing. This was historically a crisis: classical physics can't explain why diatomic gases have $\tfrac52$ not $\tfrac72$ at room temperature, or why the blackbody UV catastrophe happens.

when does equipartition fail for a degree of freedom?
?
when $kT$ is not large compared to the spacing of its quantum energy levels — then the sum over states is not an integral, and the mode is frozen out, contributing less than $\tfrac12 kT$ per quadratic term (nothing at all as $T \to 0$) ^sm-equip-fail
<!-- sr due=2026-10-28 st=review s=6.9 d=5.8 r=3 l=1 ivl=7 last=2026-10-21T08:21:00Z g=3 -->

heat capacity per molecule of a diatomic ideal gas at room temperature :: $\tfrac52 k$ — translation and rotation active, vibration frozen out ^sm-diatomic-cv
<!-- sr due=2026-11-09 st=review s=18.3 d=3.5 r=3 l=0 ivl=18 last=2026-10-22T19:48:00Z g=4 -->

Also the Maxwell speed distribution falls out here (lecture 12 second half): $P(v)\,dv \propto v^2 e^{-mv^2/2kT}dv$, normalized

$$
D(v) = 4\pi\left(\frac{m}{2\pi kT}\right)^{3/2} v^2 e^{-mv^2/2kT}
$$

$v_{\text{mp}} = \sqrt{2kT/m}$, $\bar v = \sqrt{8kT/\pi m}$, $v_{\text{rms}} = \sqrt{3kT/m}$. In that order, smallest to largest. N₂ at 300 K: $v_{\text{rms}} \approx 517$ m/s.

the three characteristic speeds of the Maxwell distribution, in increasing order :: $v_{\text{mp}} = \sqrt{2kT/m} < \bar v = \sqrt{8kT/\pi m} < v_{\text{rms}} = \sqrt{3kT/m}$ ^sm-maxwell-speeds
<!-- sr due=2026-10-27 st=review s=3.2 d=7.9 r=5 l=2 ivl=3 last=2026-10-24T09:42:00Z g=2 -->

## lecture 13 — two-level system, Schottky anomaly (Fri 10/2, Mon 10/5)

Simplest possible system: two states, energies $0$ and $\epsilon$, nondegenerate.

$$
Z_1 = 1 + e^{-\beta\epsilon}
$$

$$
\langle E\rangle = -\frac{\partial\ln Z_1}{\partial\beta} = \frac{\epsilon\, e^{-\beta\epsilon}}{1 + e^{-\beta\epsilon}} = \frac{\epsilon}{e^{\beta\epsilon} + 1}
$$

Limits: $T\to0$, $\langle E\rangle \to 0$ (everything in ground state). $T\to\infty$, $\langle E\rangle \to \epsilon/2$ (both states equally populated — never more than half up, at positive $T$; consistent with the negative-$T$ story).

Heat capacity for $N$ of them, with $x = \beta\epsilon = \epsilon/kT$:

$$
C = N\frac{\partial\langle E\rangle}{\partial T} = Nk\,\frac{x^2 e^{x}}{(e^{x}+1)^2}
$$

Check: $\partial\langle E\rangle/\partial T = \epsilon \cdot e^{x}(e^x + 1)^{-2}\cdot(\epsilon/kT^2) = k x^2 e^x/(e^x+1)^2$ ✓.

Both limits go to zero: low $T$, $C \approx Nk\,x^2 e^{-x}$, exponentially small (gap); high $T$, $C \approx Nk\,x^2/4 \to 0$, because the system saturates — it can't absorb more energy once the two levels are equally populated. In between there's a peak, the **Schottky anomaly**: max at $x \approx 2.40$, i.e. $kT \approx 0.42\,\epsilon$, with $C_{\max} \approx 0.44\,Nk$.

$$
C_{\text{two-level}} = Nk\,{{c1::\frac{x^2 e^{x}}{(e^{x}+1)^2}}}, \qquad x = \epsilon/kT
$$ ^sm-schottky-C
<!-- sr due=2026-10-30 st=review s=4.6 d=6.9 r=3 l=1 ivl=5 last=2026-10-25T18:20:00Z g=2 -->

why does the heat capacity of a two-level system go to zero at high temperature, unlike a gas?
?
the energy saturates at $N\epsilon/2$ once both levels are equally populated — there's nowhere higher to put energy, so $d\langle E\rangle/dT \to 0$; a gas or oscillator has an unbounded ladder of levels ^sm-schottky-highT
<!-- sr due=2026-11-03 st=review s=9.4 d=4.6 r=3 l=0 ivl=9 last=2026-10-25T18:21:00Z g=3 -->

where is the Schottky peak, and how high?
?
at $kT \approx 0.42\,\epsilon$ (i.e. $\epsilon/kT \approx 2.4$), with $C_{\max} \approx 0.44\,Nk$ ^sm-schottky-peak
<!-- sr due=2026-10-30 st=review s=3.8 d=7.4 r=3 l=1 ivl=4 last=2026-10-26T07:58:00Z g=3 -->

Physically: seen as a bump in the low-$T$ heat capacity of paramagnetic salts and of materials with low-lying split levels (crystal-field splitting of rare-earth ions). Two-level = paramagnet with $\epsilon = 2\mu B$ and energies shifted by $-\mu B$. Redo of lecture 5 in two lines: $Z_1 = 2\cosh(\beta\mu B)$, $\langle E \rangle = -\mu B\tanh(\beta\mu B)$ per dipole. Same answer as microcanonical with ~1/10 the work.

paramagnet, canonical: single-dipole partition function :: $Z_1 = e^{\beta\mu B} + e^{-\beta\mu B} = 2\cosh(\beta\mu B)$ ^sm-para-Z1
<!-- sr due=2026-11-01 st=review s=7.2 d=4.9 r=3 l=0 ivl=7 last=2026-10-25T18:22:00Z g=3 -->

## lecture 14 — Einstein solid, canonical (Wed 10/7, Fri 10/9)

One quantum oscillator, levels $E_n = (n+\tfrac12)\hbar\omega$. Geometric series:

$$
Z_1 = \sum_{n=0}^{\infty} e^{-\beta\hbar\omega(n + 1/2)} = \frac{e^{-\beta\hbar\omega/2}}{1 - e^{-\beta\hbar\omega}} = \frac{1}{2\sinh(\beta\hbar\omega/2)}
$$

$$
\langle E\rangle = -\frac{\partial\ln Z_1}{\partial\beta} = \frac{\hbar\omega}{2} + \frac{\hbar\omega}{e^{\beta\hbar\omega} - 1}
$$

The second term is $\hbar\omega\,\bar n$ with $\bar n = 1/(e^{\beta\hbar\omega} - 1)$ — the Planck/Bose occupation, already, before we've talked about bosons. She flagged this and said "remember this in November."

average energy of one quantum oscillator at temperature $T$ :: $\langle E\rangle = \frac{\hbar\omega}{2} + \frac{\hbar\omega}{e^{\hbar\omega/kT} - 1}$ ^sm-osc-E
<!-- sr due=2026-11-02 st=review s=8.8 d=5.1 r=3 l=0 ivl=9 last=2026-10-24T09:44:00Z g=3 -->

Solid of $N_{\text{atoms}}$ = $3N_{\text{atoms}}$ oscillators. Define the **Einstein temperature** $\Theta_E = \hbar\omega/k$. Then

$$
C_V = 3N_{\text{atoms}}k\left(\frac{\Theta_E}{T}\right)^2 \frac{e^{\Theta_E/T}}{(e^{\Theta_E/T} - 1)^2}
$$

Limits:

High $T$ ($T \gg \Theta_E$): $e^{y} - 1 \approx y$ with $y = \Theta_E/T$, so $C_V \to 3N_{\text{atoms}}k$, Dulong–Petit. ✓ matches equipartition.

Low $T$ ($T \ll \Theta_E$): $C_V \approx 3N_{\text{atoms}}k\,(\Theta_E/T)^2 e^{-\Theta_E/T}$, exponentially small. Real solids go as $T^3$ (Debye), because real solids have low-frequency sound modes that the single-$\omega$ model ignores. Einstein (1907) was the first explanation of why $C_V$ drops at all, and it's qualitatively right and quantitatively wrong at the lowest $T$. Prof. said the low-$T$ limit is "fair game in any form" on the final.

Einstein solid heat capacity at $T \ll \Theta_E$, and why it disagrees with experiment :: $C_V \approx 3Nk(\Theta_E/T)^2 e^{-\Theta_E/T}$, exponentially small; real solids go as $T^3$ because they have low-frequency phonon modes the single-frequency model leaves out ^sm-einstein-lowT
<!-- sr due=2026-10-29 st=review s=4.2 d=7.1 r=4 l=2 ivl=4 last=2026-10-25T18:24:00Z g=2 -->

Diamond: $\Theta_E \approx 1300$ K (Einstein's own fit was ~1320 K), so at room temperature $C_V$ is well below Dulong–Petit. That's the original data Einstein fit. Lead: $\Theta_E$ ~ 70 K, so it's at Dulong–Petit already.

Entropy for completeness: $S = (U - F)/T$ with $F = -kT\ln Z$, per oscillator

$$
S/k = \frac{y}{e^{y} - 1} - \ln(1 - e^{-y}), \qquad y = \hbar\omega/kT
$$

→ 0 as $T \to 0$ (third law ✓), → $\ln(kT/\hbar\omega) + 1$ at high $T$, matching lecture 5's $\ln(q/N) + 1$ with $q/N = kT/\hbar\omega$. Nice consistency check, I did it myself on the bus.

## problem set 5 notes — rotation of a diatomic (worked, because I got it wrong first)

Rigid rotor, levels $E_\ell = \ell(\ell+1)\hbar^2/2I$, degeneracy $2\ell + 1$. Define the rotational temperature $\Theta_r = \hbar^2/2Ik$. For a heteronuclear molecule (CO, HCl):

$$
Z_{\text{rot}} = \sum_{\ell=0}^{\infty}(2\ell+1)\,e^{-\ell(\ell+1)\Theta_r/T}
$$

First attempt I forgot the $2\ell + 1$ (see "things I keep getting wrong" below). With it: for $T \gg \Theta_r$, substitute $u = \ell(\ell+1)$, $du = (2\ell+1)\,d\ell$, and the sum becomes

$$
Z_{\text{rot}} \approx \int_0^\infty e^{-u\Theta_r/T}\,du = \frac{T}{\Theta_r}
$$

So $\ln Z_{\text{rot}} = -\ln\beta + \text{const}$, $\langle E_{\text{rot}}\rangle = kT$, $C_{\text{rot}} = k$: two quadratic degrees of freedom, as equipartition says. For a homonuclear molecule (N₂, O₂) only half the $\ell$ values are allowed by exchange symmetry of the nuclei, so $Z_{\text{rot}} \approx T/2\Theta_r$ — the factor of 2 changes $S$ and $F$ but not $U$ or $C$.

Low $T$ ($T \ll \Theta_r$): keep two terms, $Z_{\text{rot}} \approx 1 + 3e^{-2\Theta_r/T}$, and $C_{\text{rot}} \approx 12k(\Theta_r/T)^2 e^{-2\Theta_r/T}$ — frozen out, same shape as the two-level system at low $T$ (gap $2k\Theta_r$, degeneracy 3).

Numbers: $\Theta_r$ is 2.8 K for CO, 2.9 K for N₂, but 88 K for H₂ (light, small $I$). That's why hydrogen is the one where you can see rotation freeze out in the gas phase. [H₂ also has the ortho/para mess — nuclear spin and rotation are coupled by symmetry, and the measured $C_V$ depends on whether the ortho/para ratio has equilibrated. Not on the exam, she said, but "know it exists."]

high-temperature rotational partition function of a heteronuclear diatomic molecule :: $Z_{\text{rot}} \approx T/\Theta_r$, with $\Theta_r = \hbar^2/2Ik$ (halved for homonuclear) ^sm-Zrot
<!-- sr due=2026-11-05 st=review s=11.6 d=5 r=3 l=0 ivl=12 last=2026-10-24T09:46:00Z g=3 -->

Vibration, same problem part (c): $Z_{\text{vib}}$ is the oscillator from lecture 14, $\Theta_v = \hbar\omega/k$ is about 3400 K for N₂ — so at room $T$ the vibrational $C$ is $k(\Theta_v/T)^2 e^{-\Theta_v/T} \approx k\cdot 128\cdot e^{-11.3} \approx 1.6\times10^{-3}\,k$. Frozen. Confirms $\tfrac52$.

## lecture 15 — review, then the midterm (Mon 10/12 to Fri 10/16)

Review session: she listed what the midterm covers (everything to here). Fri 10/16 was a problem day, no new material. Midterm Wed 10/21. Notes on what I got wrong are in the notebook, not here.

The pattern for any canonical problem, which is worth writing out once:

identify the single-particle (or single-mode) states and energies; write $Z_1$; decide distinguishable ($Z_1^N$) or identical-dilute ($Z_1^N/N!$); take $\ln Z$; differentiate — $U$ from $\beta$, $F$ from $-kT\ln Z$, $P$ and $S$ and $\mu$ from $F$; check limits ($T\to0$, $T\to\infty$, classical limit) against what you already know.

Things I keep getting wrong: (1) forgetting degeneracy factors when the problem gives levels not states; (2) the minus sign in $\langle E\rangle = -\partial_\beta\ln Z$; (3) using $Z_1^N/N!$ for a solid. [Ravi: "if the particles have addresses, no $N!$."]
