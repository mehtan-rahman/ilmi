---
type: source
title: "ch. 4: ideal quantum gases"
frozen: true
imported: 2026-10-22
read: due=2026-10-31 ivl=3 reps=1 pos=6
author: H. Lindqvist
---

# Chapter 4 — Ideal Quantum Gases

In Chapters 2 and 3 we treated gases of identical particles by counting states as if the particles were distinguishable and then dividing by $N!$. We warned more than once that this procedure is accurate only when the particles are unlikely to share a single-particle state. In this chapter we drop the approximation. The result is two new distributions, one for each kind of particle nature provides, and a set of phenomena with no classical counterpart: the degeneracy pressure of electrons, the blackbody spectrum, and Bose–Einstein condensation.

## 4.1 When the classical treatment fails

The factor $1/N!$ in the partition function $Z = Z_1^N/N!$ corrects for the permutations of particles among *distinct* single-particle states. If two or more particles occupy the same state, there are fewer distinct permutations, and the correction overcompensates. The approximation is therefore good when the number of accessible single-particle states greatly exceeds the number of particles.

The single-particle partition function $Z_1 = V/\lambda^3$ is, roughly, the number of states accessible at temperature $T$. The classical treatment is valid when $Z_1 \gg N$, that is, when

$$
\frac{V}{N} \gg \lambda^3 = \left(\frac{h}{\sqrt{2\pi mkT}}\right)^3.
$$

It is convenient to define the *quantum concentration* $n_Q = 1/\lambda^3$. A gas whose density $n = N/V$ is small compared with $n_Q$ behaves classically; one whose density is comparable to or larger than $n_Q$ does not. Physically, $\lambda$ is the length over which an atom's wavefunction is spread at temperature $T$; the classical description fails when the wavefunctions of neighbouring particles overlap.

For air at room temperature the ratio $n/n_Q$ is of order $10^{-7}$, and the classical treatment is superb. For the conduction electrons in a metal, which are both light and dense, $n/n_Q$ is of order $10^4$, and the classical treatment is not merely inaccurate but qualitatively wrong. Between these extremes lie liquid helium, white dwarf stars, and laboratory gases of ultracold atoms.
<!-- extract quantum-concentration -->

the quantum concentration, and the condition for an ideal gas to be classical :: $n_Q = 1/\lambda^3 = (2\pi mkT/h^2)^{3/2}$; classical when $n \ll n_Q$ ^lq4-nQ
<!-- sr due=2026-11-02 st=review s=3.6 d=5.5 r=2 l=0 ivl=4 last=2026-10-29T20:40:00Z g=3 -->

## 4.2 The Gibbs factor and the grand partition function

To treat identical particles correctly we change our point of view. Rather than regarding each particle as a system, we regard each single-particle state — each *orbital* — as a system, which may contain any allowed number of particles. Since the number of particles in an orbital is not fixed, we need the statistical mechanics of a system that exchanges particles as well as energy with a reservoir.

The argument of §3.1 generalizes directly. If the system, in state $s$, has energy $E_s$ and contains $N_s$ particles, the reservoir's entropy is reduced by $E_s/T - \mu N_s/T$, where $\mu$ is the reservoir's chemical potential. Hence

$$
P(s) = \frac{1}{\mathcal{Z}}e^{-\beta(E_s - \mu N_s)}, \qquad \mathcal{Z} = \sum_s e^{-\beta(E_s - \mu N_s)}.
$$

The exponential is the *Gibbs factor*, and $\mathcal{Z}$ is the *grand partition function*. The sum runs over all states of the system with any number of particles. The average number of particles is

$$
\langle N\rangle = kT\frac{\partial\ln\mathcal{Z}}{\partial\mu},
$$

and the grand potential $\Phi = U - TS - \mu N = -kT\ln\mathcal{Z}$ plays the role that $F$ played in Chapter 3.

**Worked example 4.1.** *Oxygen binding to a single site.* A binding site on a protein can be empty, with energy $0$, or occupied by one O₂ molecule, with energy $-\epsilon_0$. In contact with dissolved oxygen of chemical potential $\mu$, $\mathcal{Z} = 1 + e^{\beta(\epsilon_0 + \mu)}$, and the probability that the site is occupied is

$$
\bar n = \frac{1}{e^{-\beta(\epsilon_0 + \mu)} + 1}.
$$

Since $\mu$ increases with the concentration of oxygen, so does the occupancy, approaching one at high concentration. Real hemoglobin, with four interacting sites, binds more cooperatively than this model predicts.

## 4.3 Fermi–Dirac and Bose–Einstein distributions

Consider a single orbital of energy $\epsilon$. If $n$ particles occupy it, its energy is $n\epsilon$. The allowed values of $n$ depend on the nature of the particles.

**Fermions** — particles of half-integer spin, including electrons, protons, neutrons, and ³He atoms — obey the Pauli exclusion principle, and $n$ is either 0 or 1. Then $\mathcal{Z} = 1 + e^{-\beta(\epsilon - \mu)}$, and the average occupancy is

$$
\bar n_{FD} = \frac{1}{e^{(\epsilon - \mu)/kT} + 1}.
$$

This is the *Fermi–Dirac distribution*.

**Bosons** — particles of integer spin, including photons, ⁴He atoms, and many other atoms — may occupy an orbital in any number. The grand partition function is a geometric series,

$$
\mathcal{Z} = \sum_{n=0}^{\infty}e^{-n\beta(\epsilon - \mu)} = \frac{1}{1 - e^{-\beta(\epsilon - \mu)}},
$$

which converges only if $\mu < \epsilon$. The average occupancy is the *Bose–Einstein distribution*,

$$
\bar n_{BE} = \frac{1}{e^{(\epsilon - \mu)/kT} - 1}.
$$

When $\epsilon - \mu \gg kT$, both distributions reduce to $\bar n \approx e^{-(\epsilon - \mu)/kT}$, the Boltzmann distribution, and the occupancy of every orbital is small. This is precisely the regime in which the $1/N!$ treatment is valid. The quantum distributions thus contain the classical one as a limit, and justify it.

## 4.4 The degenerate Fermi gas

At zero temperature the Fermi–Dirac distribution is a step: every orbital with $\epsilon < \mu$ is occupied, every one above is empty. The value of $\mu$ at $T = 0$ is the *Fermi energy* $E_F$. A gas in this condition, with its lowest orbitals filled solidly, is said to be *degenerate*.

For $N$ electrons in a volume $V$, the orbitals are labelled by momentum, and the number with momentum less than $p_F$ is $(V/h^3)(4\pi p_F^3/3)$. Each orbital accommodates two electrons, of opposite spin. Setting the total equal to $N$ gives

$$
E_F = \frac{p_F^2}{2m} = \frac{\hbar^2}{2m}\left(\frac{3\pi^2N}{V}\right)^{2/3}.
$$

It is useful to describe the orbitals by a *density of states* $g(\epsilon)$, the number of orbitals (counting spin) per unit energy. For free electrons in three dimensions,

$$
g(\epsilon) = \frac{V}{2\pi^2}\left(\frac{2m}{\hbar^2}\right)^{3/2}\sqrt{\epsilon} = \frac{3N}{2E_F^{3/2}}\sqrt{\epsilon}.
$$

The total energy at $T = 0$ is $U_0 = \int_0^{E_F}\epsilon\,g(\epsilon)\,d\epsilon = \frac35 NE_F$, and the pressure is $P = \frac23 U_0/V = \frac25 nE_F$. This *degeneracy pressure* persists at zero temperature and is a direct consequence of the exclusion principle.

For copper, with one conduction electron per atom, $E_F \approx 7.0$ eV, corresponding to a *Fermi temperature* $T_F = E_F/k \approx 8\times10^4$ K. At any temperature at which copper is solid, $T \ll T_F$, and the electron gas is very nearly in its ground state.

**Worked example 4.2.** *The Fermi energy of copper.* Copper has density 8960 kg/m³ and atomic mass 63.5 u, so the number of atoms per unit volume is $n = 8960/(63.5\times1.66\times10^{-27}) \approx 8.5\times10^{28}$ m⁻³. With one conduction electron per atom,

$$
E_F = \frac{\hbar^2}{2m_e}(3\pi^2n)^{2/3} = \frac{(1.055\times10^{-34})^2}{2(9.11\times10^{-31})}(2.51\times10^{30})^{2/3} \approx 1.13\times10^{-18}\ \text{J} \approx 7.0\ \text{eV}.
$$

The Fermi momentum corresponds to a speed $v_F = p_F/m \approx 1.6\times10^6$ m/s, about half a percent of the speed of light, so the nonrelativistic treatment is adequate. The degeneracy pressure, $\frac25 nE_F$, is about $3.8\times10^{10}$ Pa, nearly four hundred thousand atmospheres. It is balanced by the electrostatic attraction between the electrons and the positive ions; the electrons do not escape the metal because the ions hold them in.

At a small but nonzero temperature the occupancy $\bar n_{FD}$ departs from the step function only in a band a few $kT$ wide around $\mu$. The distribution has a useful symmetry: the probability that an orbital an energy $x$ above $\mu$ is occupied equals the probability that one an energy $x$ below $\mu$ is empty, $\bar n_{FD}(\mu + x) = 1 - \bar n_{FD}(\mu - x)$. If the density of states were constant near $E_F$, this symmetry would keep $\mu$ fixed at $E_F$ as the temperature rose. Because $g(\epsilon)$ increases with $\epsilon$ in three dimensions, there are more orbitals just above $E_F$ than just below, and $\mu$ must fall slightly to keep the total number of electrons fixed. The Sommerfeld expansion gives

$$
\mu(T) \approx E_F\left[1 - \frac{\pi^2}{12}\left(\frac{kT}{E_F}\right)^2\right].
$$

For copper at room temperature the correction is about one part in $10^5$.

**Worked example 4.3.** *Electrons in a white dwarf.* A white dwarf of one solar mass, $M = 2.0\times10^{30}$ kg, compressed to roughly the radius of the earth, $R = 6.4\times10^6$ m, contains about $M/2m_p \approx 6\times10^{56}$ electrons (one per two nucleons, for a star of helium, carbon, or oxygen). The electron density is $n \approx 5\times10^{35}$ m⁻³, more than six million times that in copper. The nonrelativistic formula then gives $E_F \approx 0.2$ MeV, a substantial fraction of the electron rest energy, $0.511$ MeV, so a fully nonrelativistic treatment is marginal. The temperature of the star's interior, about $10^7$ K, corresponds to $kT \approx 1$ keV, far below $E_F$: the electrons are degenerate, and it is their degeneracy pressure, not thermal pressure, that supports the star against gravity. For more massive stars the electrons become relativistic, the degeneracy pressure grows more slowly with density, and above about 1.4 solar masses no equilibrium is possible.

## 4.5 Heat capacity of the electron gas

At small nonzero temperature the step in the Fermi–Dirac distribution is rounded over an energy range of a few $kT$ around $\mu$. Only electrons within this range can be thermally excited; those deeper in the distribution are prevented from absorbing energy $\sim kT$ because the orbitals they would move into are already occupied. The number of excitable electrons is roughly $g(E_F)\,kT \sim N(kT/E_F)$, each gaining energy $\sim kT$, so $U - U_0 \sim N(kT)^2/E_F$ and $C_V \sim Nk(kT/E_F)$. A careful calculation (the Sommerfeld expansion) gives

$$
C_V = \frac{\pi^2}{2}Nk\frac{kT}{E_F}.
$$

At room temperature this is about 1% of the classical value $\frac32 Nk$, which resolves a longstanding puzzle: conduction electrons, though free to carry current, contribute almost nothing to the heat capacity of a metal. At very low temperature, where the lattice contribution falls as $T^3$, the linear electronic term dominates and is readily measured.

## 4.6 Blackbody radiation

The electromagnetic field in a cavity at temperature $T$ may be regarded as a gas of photons. Photons are bosons, but unlike atoms they can be created and absorbed freely by the walls; their number is not conserved. At equilibrium the free energy is then minimized with respect to $N$, which requires $\mu = 0$. Each mode of frequency $\omega$ has average occupancy $1/(e^{\hbar\omega/kT} - 1)$ — the same expression found for the excitation of a harmonic oscillator in §3.8.

Counting modes as for a particle in a box, with two polarizations and $\epsilon = pc$, gives the energy density per unit photon energy,

$$
u(\epsilon) = \frac{8\pi}{(hc)^3}\frac{\epsilon^3}{e^{\epsilon/kT} - 1},
$$

which is *Planck's spectrum*. It peaks at $\epsilon \approx 2.82\,kT$. The total energy density is

$$
\frac{U}{V} = \frac{8\pi^5(kT)^4}{15(hc)^3},
$$

and the power radiated per unit area by a black surface is $\sigma T^4$, with the Stefan–Boltzmann constant $\sigma = 2\pi^5k^4/15h^3c^2 = 5.67\times10^{-8}$ W m⁻² K⁻⁴. Classical equipartition, assigning $kT$ to every mode, would give an infinite energy density; the Bose–Einstein factor freezes out the high-frequency modes and makes the integral converge.

**Worked example 4.4.** *The cosmic background radiation.* The universe is filled with blackbody radiation at $T = 2.73$ K, a remnant of the epoch when matter and radiation were last in equilibrium. Its spectrum peaks at a photon energy $2.82\,kT \approx 6.6\times10^{-4}$ eV, in the microwave range, and its energy density is $U/V = 4\sigma T^4/c \approx 4.2\times10^{-14}$ J/m³. The number density of photons, obtained by integrating $\bar n_{BE}$ over modes rather than weighting by energy, is about $4\times10^8$ per cubic metre — far greater than the number density of baryons. The measured spectrum agrees with the Planck form to better than one part in $10^4$, the most precise blackbody known.

## 4.7 Bose–Einstein condensation

For a gas of bosons whose number is conserved, $\mu$ is determined by the requirement that the occupancies sum to $N$. As the temperature is lowered at fixed density, $\mu$ rises toward the energy of the lowest orbital, which we take as zero. Replacing the sum over orbitals with an integral over the density of states, one finds that even at $\mu = 0$ the excited orbitals can hold at most

$$
N_{\text{exc}} = 2.612\,\frac{V}{\lambda^3}
$$

particles. Below the temperature $T_c$ at which this equals $N$,

$$
kT_c = \frac{2\pi\hbar^2}{m}\left(\frac{N}{2.612\,V}\right)^{2/3},
$$

the excess particles have nowhere to go but the ground orbital, which acquires a macroscopic occupancy $N_0 = N[1 - (T/T_c)^{3/2}]$. This is *Bose–Einstein condensation*. The numerical factor is $\zeta(3/2) \approx 2.612$, and the condition $n\lambda^3 = 2.612$ shows that condensation occurs precisely when the density reaches the quantum concentration, as §4.1 led us to expect.

The phenomenon is unusual among phase transitions in that it occurs without any interaction between the particles; it is a consequence of statistics alone. Its signature is the sudden appearance, below $T_c$, of a macroscopic number of particles in a single quantum state. In the laboratory gases of 1995 this was made visible directly: when the trap holding the atoms was switched off, the condensed atoms, having almost no momentum, expanded slowly, and an image of the cloud showed a sharp central peak rising out of the broad thermal distribution.

For liquid ⁴He, treated as an ideal gas, the formula gives $T_c \approx 3.1$ K, close to the observed superfluid transition at 2.17 K; the difference reflects the strong interactions in the liquid. Condensation in a nearly ideal gas was first achieved in 1995, in rubidium vapour cooled below about $10^{-7}$ K.

## 4.8 Summary

Identical particles are correctly described by treating each orbital as a system in contact with a reservoir of temperature $T$ and chemical potential $\mu$. Fermions occupy orbitals according to the Fermi–Dirac distribution, bosons according to the Bose–Einstein distribution, and both reduce to the Boltzmann distribution when occupancies are small. A degenerate Fermi gas has a large zero-point energy and pressure and a heat capacity linear in $T$. Photons, with $\mu = 0$, give the Planck spectrum. Bosons with conserved number condense into their ground orbital below a critical temperature at which their density equals the quantum concentration.

## Problems

1. **4.1** Compute $n/n_Q$ for (a) nitrogen at room temperature and pressure, (b) liquid ⁴He at 2 K (density 145 kg/m³), (c) conduction electrons in sodium.
2. **4.2** Show that for both Fermi–Dirac and Bose–Einstein statistics $\langle N\rangle = kT\,\partial\ln\mathcal{Z}/\partial\mu$ gives the distributions of §4.3.
3. **4.3** Show that $\bar n_{FD}(\mu + x) = 1 - \bar n_{FD}(\mu - x)$, and interpret.
4. **4.4** Compute the Fermi energy, Fermi temperature, and degeneracy pressure of the conduction electrons in aluminium (three per atom, density 2700 kg/m³).
5. **4.5** A white dwarf has the mass of the sun and the radius of the earth. Estimate the Fermi energy of its electrons and decide whether a nonrelativistic treatment is justified.
6. **4.6** Derive the Planck spectrum from the occupancy of cavity modes, and show that its maximum lies at $\epsilon \approx 2.82\,kT$.
7. **4.7** Show that the entropy of blackbody radiation is $S = \frac43 U/T$, and hence that a photon gas expanding adiabatically obeys $VT^3 = \text{const}$.
8. **4.8** Estimate $T_c$ for a gas of $10^4$ rubidium-87 atoms at a density of $10^{19}$ m⁻³.
