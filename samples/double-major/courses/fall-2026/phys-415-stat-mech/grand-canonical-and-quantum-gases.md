---
title: grand canonical & quantum gases
lectures: 2026-10-23 to now
---

## lecture 16 — the Gibbs factor (Fri 10/23)

[first lecture after the midterm, half the class missing. typed up Mon 10/26, notebook pages 41–44]

Same setup as the Boltzmann factor but now S and R exchange particles as well as energy. Fix S in state $s$ with energy $E_s$ and particle number $N_s$. Count reservoir states:

$$
S_R(U_0 - E_s, N_0 - N_s) \approx S_R(U_0, N_0) - \frac{E_s}{T} + \frac{\mu N_s}{T}
$$

using $\partial S_R/\partial U = 1/T$ and $\partial S_R/\partial N = -\mu/T$ (sign from the microcanonical unit, lecture 6). So

$$
P(s) = \frac{1}{\mathcal{Z}}\, e^{-\beta(E_s - \mu N_s)}, \qquad \mathcal{Z} = \sum_s e^{-\beta(E_s - \mu N_s)}
$$

$e^{-\beta(E-\mu N)}$ is the **Gibbs factor**, $\mathcal{Z}$ the grand partition function. Sum over all states with all particle numbers.

the Gibbs factor, for a system exchanging energy and particles with a reservoir at $T$, $\mu$ :: $e^{-(E_s - \mu N_s)/kT}$ ^sm-gibbs-factor
<!-- sr due=2026-11-02 st=review s=3.1 d=5.3 r=2 l=0 ivl=3 last=2026-10-30T08:20:00Z g=3 -->

Averages: $\langle N\rangle = kT\,\partial\ln\mathcal{Z}/\partial\mu$. Grand potential $\Phi = U - TS - \mu N = -kT\ln\mathcal{Z}$, and for a homogeneous system $\Phi = -PV$. [she stated $\Phi = -PV$ without proof — Euler relation, $U = TS - PV + \mu N$ by extensivity. fine]

Her example: hemoglobin binding O₂, one site, empty or occupied with binding energy $-\epsilon_0$. $\mathcal{Z} = 1 + e^{\beta(\epsilon_0 + \mu)}$. The $\mu$ of O₂ in the lungs comes from the gas: $\mu = -kT\ln(V/N\lambda^3)$ at the partial pressure. Didn't finish the numbers. #TODO from the book (ch4 §4.2? it's in the part I haven't read).

## lecture 17 — one orbital at a time (Mon 10/26)

The key move for quantum gases: don't take the system to be a particle. Take it to be **one single-particle orbital**, and let its occupation $n$ vary. The rest of the gas is the reservoir. Orbital energy $\epsilon$; $n$ particles in it means $E = n\epsilon$, $N = n$.

Fermions, $n \in \{0, 1\}$ (Pauli):

$$
\mathcal{Z} = 1 + e^{-\beta(\epsilon - \mu)}, \qquad \bar n_{FD} = \frac{1}{e^{(\epsilon - \mu)/kT} + 1}
$$

Bosons, $n \in \{0, 1, 2, \dots\}$, geometric series (needs $\epsilon > \mu$ to converge):

$$
\mathcal{Z} = \frac{1}{1 - e^{-\beta(\epsilon - \mu)}}, \qquad \bar n_{BE} = \frac{1}{e^{(\epsilon - \mu)/kT} - 1}
$$

$$
\bar n_{FD} = \frac{1}{e^{(\epsilon - \mu)/kT} {{c1::+ 1}}}, \qquad \bar n_{BE} = \frac{1}{e^{(\epsilon - \mu)/kT} {{c2::- 1}}}
$$ ^sm-FD-BE
<!-- sr c1 due=2026-10-30T09:05:00Z st=learning s=0.4 d=5.6 r=1 l=0 steps=1 ivl=0 last=2026-10-30T08:55:00Z g=3 -->
<!-- sr c2 st=new -->

(Derivation of $\bar n_{BE}$: $\bar n = \sum n\,x^n / \sum x^n$ with $x = e^{-\beta(\epsilon-\mu)}$, $= x/(1-x) = 1/(x^{-1} - 1)$. Or $\bar n = kT\,\partial\ln\mathcal{Z}/\partial\mu$.)

Classical limit: when $\epsilon - \mu \gg kT$, both $\to e^{-(\epsilon-\mu)/kT}$, the Boltzmann distribution with occupancy $\ll 1$. That's the dilute regime from before, where $Z_1^N/N!$ works. Consistent with $\mu$ being large and negative for a classical gas ($\mu = -kT\ln(V/N\lambda^3)$, $V/N\lambda^3 \gg 1$).

why must $\mu$ be below the lowest orbital energy for bosons?
?
the grand sum over occupations $\sum_n e^{-n\beta(\epsilon - \mu)}$ only converges if $\epsilon > \mu$ for every orbital; equivalently $\bar n_{BE}$ would be negative or infinite otherwise ^sm-bose-mu
<!-- sr st=new -->

Check of the whole machinery in the classical limit (did this Tue night, not in lecture). If every orbital has $\bar n \approx e^{-\beta(\epsilon - \mu)} \ll 1$, then

$$
N = \sum_{\text{orbitals}} \bar n = e^{\beta\mu}\sum_{\text{orbitals}} e^{-\beta\epsilon} = e^{\beta\mu} Z_1
$$

so $\mu = -kT\ln(Z_1/N) = -kT\ln(V/N\lambda^3)$. Exactly the canonical result with $Z_1^N/N!$. So the $N!$ is what you get from the quantum distributions when occupancy is small — answers my question from the first week, roughly. [ask in OH whether this is the "real" justification or just consistency]

The condition for the classical limit, then, is $e^{\beta\mu} \ll 1$, i.e. $n\lambda^3 \ll 1$. The **quantum concentration** $n_Q = 1/\lambda^3$: classical when $n \ll n_Q$, quantum when $n \gtrsim n_Q$. Helium gas at room $T$: $n/n_Q \sim 3\times10^{-6}$. Conduction electrons in copper: $n/n_Q \sim 10^{4}$ (small mass → big $\lambda$, and very dense). Liquid ⁴He near 2 K: a few, and that's where superfluidity is.

the criterion for an ideal gas to behave classically, in terms of the thermal wavelength :: $n\lambda^3 \ll 1$ — the particle spacing is much larger than $\lambda$, so orbital occupancies are $\ll 1$ ^sm-classical-criterion
<!-- sr st=new -->

Fermi–Dirac at $T = 0$: step function. $\bar n = 1$ for $\epsilon < \mu$, $0$ for $\epsilon > \mu$. At $T > 0$ the step rounds off over a width of a few $kT$ around $\mu$, and $\bar n(\mu) = \tfrac12$ always.

value of the Fermi–Dirac occupancy at $\epsilon = \mu$, at any temperature :: $\tfrac12$ ^sm-FD-half
<!-- sr st=new -->

## lecture 18 — degenerate Fermi gas (Wed 10/28)

[typing this the same night, she went fast]

Electrons in a metal: $N$ free electrons in a box $V$, spin ½ so each spatial orbital holds 2. At $T = 0$ they fill every orbital up to the **Fermi energy** $E_F \equiv \mu(T = 0)$. Count with the $h^3$ rule (periodic BCs, Ravi's section): number of orbitals with $|p| < p_F$, times 2 for spin, equals $N$:

$$
N = 2\cdot\frac{V}{h^3}\cdot\frac{4\pi}{3}p_F^3 \quad\Rightarrow\quad p_F = \hbar\,(3\pi^2 n)^{1/3}, \quad n = N/V
$$

(using $h = 2\pi\hbar$: $\frac{8\pi}{3h^3} = \frac{8\pi}{3\cdot 8\pi^3\hbar^3} = \frac{1}{3\pi^2\hbar^3}$ ✓)

$$
E_F = \frac{p_F^2}{2m} = \frac{\hbar^2}{2m}(3\pi^2 n)^{2/3}
$$

$$
E_F = \frac{\hbar^2}{2m}\left({{c1::3\pi^2 N/V}}\right)^{2/3}
$$ ^sm-EF
<!-- sr st=new -->

Total energy: density of states in energy, $g(\epsilon) \propto \sqrt\epsilon$. Normalizing so that $\int_0^{E_F} g\,d\epsilon = N$ gives $g(\epsilon) = \frac{3N}{2E_F^{3/2}}\sqrt\epsilon$. Then

$$
U_0 = \int_0^{E_F}\epsilon\, g(\epsilon)\,d\epsilon = \frac{3N}{2E_F^{3/2}}\cdot\frac{2}{5}E_F^{5/2} = \frac{3}{5}NE_F
$$

average energy per electron in a $T = 0$ Fermi gas :: $\tfrac35 E_F$ ^sm-U0-fermi
<!-- sr st=new -->

Degeneracy pressure: $U_0 \propto N\,E_F \propto V^{-2/3}$ at fixed $N$, so $P = -\partial U_0/\partial V = \frac{2}{3}U_0/V = \frac{2}{5}nE_F$. Nonzero at $T = 0$ — it's what holds up white dwarfs (with electrons) and neutron stars (with neutrons, roughly). [she said the relativistic version is the Chandrasekhar limit, not in this course]

Copper numbers: one conduction electron per atom, $n \approx 8.5\times10^{28}\ \text{m}^{-3}$, gives $E_F \approx 7.0$ eV, $T_F = E_F/k \approx 8.2\times10^4$ K. Room temperature is $T/T_F \approx 0.004$, so the electron gas in a metal is extremely degenerate — the $T = 0$ picture is nearly exact.

Fermi temperature of copper, roughly, and what it implies :: $T_F \approx 8\times10^4$ K, so at room temperature $T/T_F \sim 0.004$ and the conduction electrons are almost fully degenerate ^sm-TF-copper
<!-- sr st=new -->

Teaser for Monday: only electrons within $\sim kT$ of $E_F$ can be excited (the ones deeper have nowhere to go — the orbitals above them are full), so $C_V^{\text{el}} \sim Nk\,(kT/E_F)$, way below the classical $\tfrac32 Nk$. Solves the old puzzle of why electrons don't contribute $\tfrac32 k$ each to the heat capacity of metals. Exact coefficient $\pi^2/2$ (Sommerfeld) — derivation next lecture.

## still to write up

- the Bose gas: $\mu \to 0^-$ as $T$ drops, condensation, $T_c$ — she said Fri 10/30 (today) and next week
- photons: $\mu = 0$ because number isn't conserved; Planck spectrum. Ties back to the oscillator $\bar n$ from lecture 14
- read Lindqvist ch4 past §4.2 before Monday. currently at the start of the FD section
- problem set 8 due Fri 11/6: #2 is the hemoglobin thing, #4 is Fermi energy of ³He (liquid, treat as ideal, she knows it's not)
