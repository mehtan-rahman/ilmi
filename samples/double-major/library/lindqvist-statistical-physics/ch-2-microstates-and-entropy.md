---
type: source
title: "ch. 2: microstates and entropy"
frozen: true
imported: 2026-09-05
read: due=2026-12-06 ivl=41 reps=5 pos=58
author: H. Lindqvist
---

# Chapter 2 — Microstates and Entropy

Thermodynamics, as developed in Chapter 1, takes temperature, entropy, and the second law as given. It tells us how these quantities are related but is silent on why they exist. In this chapter we begin the project that occupies the rest of the book: deriving the laws of thermodynamics from the mechanics of many particles and a single statistical assumption. The central idea is simple to state. A macroscopic system can be arranged in an astronomically large number of microscopic ways, and almost all of those ways look the same from the outside. Entropy is a measure of that number, and the second law is a consequence of its size.

## 2.1 Macrostates and microstates

Consider a system whose microscopic configuration we can, in principle, specify completely. For a collection of $N$ coins, a complete specification lists the face of each coin. For a gas, it lists the position and momentum of each molecule, or, in quantum mechanics, the occupied state of each. Such a specification is a *microstate*. A *macrostate* specifies only the quantities accessible to a macroscopic measurement: the total number of heads, the total energy, the volume.

The number of microstates corresponding to a given macrostate is its *multiplicity*, denoted $\Omega$. For $N$ coins with $n$ heads,

$$
\Omega(N, n) = \binom{N}{n} = \frac{N!}{n!\,(N-n)!}.
$$

The total number of microstates is $2^N$, and the probability of finding exactly $n$ heads after a fair toss is $\Omega(N,n)/2^N$.

The coin example contains an implicit assumption: that every microstate is equally probable. For coins this follows from the symmetry of each toss. For a physical system we elevate it to a postulate.

> **Fundamental assumption.** In an isolated system in thermal equilibrium, all accessible microstates are equally probable.

The word *accessible* matters. A microstate is accessible if it is consistent with the conserved quantities and constraints that define the system — its energy, volume, number of particles, and any walls or partitions. The assumption cannot be proved from mechanics in general, though it can be motivated by the observation that the microscopic dynamics, left to run long enough, show no preference for one accessible state over another. Its real justification is that its consequences agree with experiment.

## 2.2 Two models: the paramagnet and the Einstein solid

Two models will carry most of the weight in the chapters that follow. Both are simple enough that $\Omega$ can be computed exactly.

**The two-state paramagnet.** Consider $N$ magnetic dipoles, each of moment $\mu$, fixed in place in an external field $B$. Each dipole can point parallel to the field, with energy $-\mu B$, or antiparallel, with energy $+\mu B$. If $N_\uparrow$ dipoles are parallel and $N_\downarrow = N - N_\uparrow$ antiparallel, the total energy is $U = \mu B(N_\downarrow - N_\uparrow)$. The multiplicity is the number of ways to choose which dipoles are parallel:

$$
\Omega(N_\uparrow) = \binom{N}{N_\uparrow}.
$$

This is formally identical to the coin problem. The physics enters through the identification of $N_\uparrow$ with the energy.

**The Einstein solid.** A crystalline solid may be modelled, crudely, as a collection of atoms each bound to its lattice site by a harmonic restoring force. In three dimensions each atom contributes three independent oscillators. We take all oscillators to have the same frequency $\omega$, so that each has energy levels separated by $\hbar\omega$. Measuring energy from the ground state, a solid of $N$ oscillators with total energy $U = q\hbar\omega$ has $q$ units of energy to distribute among $N$ oscillators. Since the oscillators are distinguishable (by their location) but the energy units are not, the multiplicity is the number of ways to arrange $q$ identical units and $N-1$ partitions in a line:

$$
\Omega(N, q) = \binom{q + N - 1}{q}.
$$

For $N = 3$ and $q = 3$ this gives $\Omega = 10$, which the reader should verify by listing the states directly.

multiplicity of an Einstein solid, $N$ oscillators sharing $q$ units of energy :: $\binom{q+N-1}{q}$ ^lq2-einstein-omega
<!-- sr due=2026-11-24 st=review s=32.5 d=3.6 r=5 l=0 ivl=32 last=2026-10-23T07:35:00Z g=3 -->

## 2.3 Interacting systems

A single isolated system in equilibrium has nothing to do. The interesting questions arise when two systems are allowed to exchange energy. Let solids A and B, with $N_A$ and $N_B$ oscillators, be placed in weak thermal contact, so that energy passes between them slowly compared with the time it takes each to reach internal equilibrium, but the combined system is isolated. The total energy $q = q_A + q_B$ is fixed; the division between A and B is not.

A macrostate of the combined system is now specified by $q_A$. For each value of $q_A$, the number of microstates is the product

$$
\Omega_{\text{total}}(q_A) = \Omega_A(N_A, q_A)\,\Omega_B(N_B, q - q_A),
$$

because any microstate of A can be combined with any microstate of B. By the fundamental assumption, every microstate of the combined system is equally probable, so the probability of a given $q_A$ is proportional to $\Omega_{\text{total}}(q_A)$.

For small systems the distribution of $q_A$ is broad. For $N_A = N_B = 3$ and $q = 6$, the most probable division, $q_A = 3$, accounts for only about a fifth of the 462 microstates. But as the systems grow, the distribution narrows dramatically. With a few hundred oscillators in each solid, the probability of finding the energy far from its most probable division is already smaller than one part in $10^{10}$.

This narrowing is the essence of irreversibility. If the two solids begin with the energy unevenly divided, the exchange of energy will carry the combined system toward the most probable division, not because any force drives it there, but because there are overwhelmingly more microstates there than anywhere else. The system, wandering at random among its accessible microstates, spends nearly all its time in the overwhelming majority. Once there, it will not return to the initial division in any time we could observe.

We may now state the second law in the language of statistics: *an isolated system evolves toward, and remains in, the macrostate of greatest multiplicity.*

## 2.4 Large numbers and the sharpness of the peak

To quantify the narrowing we need a way to handle factorials of large numbers. *Stirling's approximation*,

$$
N! \approx N^N e^{-N}\sqrt{2\pi N},
$$

is accurate to better than one percent for $N \ge 10$. In logarithmic form, dropping the term that grows only as $\ln N$,

$$
\ln N! \approx N\ln N - N.
$$

Consider an Einstein solid in the high-temperature limit, $q \gg N$. Applying Stirling's approximation to each factorial in $\Omega(N, q)$, and using $\ln(1 + x) \approx x$ for small $x$, one finds

$$
\Omega(N, q) \approx \left(\frac{eq}{N}\right)^N.
$$

Now let two identical solids, each with $N$ oscillators, share $q$ units. The product of their multiplicities is

$$
\Omega_{\text{total}} \approx \left(\frac{e}{N}\right)^{2N}(q_A q_B)^N.
$$

Writing $q_A = q/2 + x$ and $q_B = q/2 - x$, we have $q_A q_B = (q/2)^2 - x^2$, and for $x \ll q$,

$$
\Omega_{\text{total}} \approx \Omega_{\max}\exp\!\left[-N\left(\frac{2x}{q}\right)^2\right].
$$

The peak is a Gaussian of width $\sigma_x = q/2\sqrt{N}$. For a macroscopic solid with $N \sim 10^{20}$, the width is smaller than the peak position $q/2$ by a factor of order $10^{-10}$. A deviation from the most probable division large enough to be measured would require $x$ to be many times $\sigma_x$, and the Gaussian falls off so steeply that such a deviation will never be observed.
<!-- extract sharpness-of-multiplicity -->

relative width of the multiplicity peak for two Einstein solids of $N$ oscillators :: of order $1/\sqrt{N}$ ^lq2-peak-width
<!-- sr due=2026-10-30 st=review s=21.8 d=4.5 r=4 l=0 ivl=22 last=2026-10-08T08:44:00Z g=3 -->

We shall meet the factor $1/\sqrt{N}$ repeatedly. It governs the size of fluctuations in every macroscopic quantity, and it explains why thermodynamics, a theory of averages, is so precise: the averages are almost never departed from.

## 2.5 Entropy and temperature

Multiplicities of macroscopic systems are inconveniently large. It is natural to work with their logarithms, and we define the *entropy* as

$$
S = k\ln\Omega,
$$

where $k = 1.381\times10^{-23}$ J/K is Boltzmann's constant. The logarithm has a further advantage: since the multiplicity of a composite system is the product of the multiplicities of its parts, the entropy is the sum of their entropies. The second law becomes the statement that the total entropy of an isolated system tends to increase.

Return now to two systems exchanging energy. At equilibrium the total entropy $S_A + S_B$ is a maximum with respect to the division of energy, so

$$
\frac{\partial S_A}{\partial U_A} = \frac{\partial S_B}{\partial U_B}.
$$

The quantity $\partial S/\partial U$ is therefore the same for two systems in thermal equilibrium. This is the defining property of temperature. To fix the relationship we observe that energy flows spontaneously toward the system in which it produces the greater increase of entropy, that is, toward the system with the larger $\partial S/\partial U$. Since heat flows from hot to cold, a larger $\partial S/\partial U$ must correspond to a lower temperature. The simplest choice consistent with this and with the units of Chapter 1 is

$$
\frac{1}{T} = \left(\frac{\partial S}{\partial U}\right)_{N,V}.
$$

the statistical definition of temperature :: $1/T = (\partial S/\partial U)_{N,V}$ ^lq2-def-T
<!-- sr due=2026-11-16 st=review s=28.7 d=2.9 r=5 l=0 ivl=29 last=2026-10-18T08:22:00Z g=3 -->

For the high-temperature Einstein solid, $S = Nk[\ln(U/N\hbar\omega) + 1]$, and differentiation gives $U = NkT$. Each oscillator holds an average energy $kT$, a result we shall recover in Chapter 3 as an instance of the equipartition theorem.

For the paramagnet the result is more interesting. The entropy is largest when $N_\uparrow = N_\downarrow$, that is, at $U = 0$, and falls to zero at both $U = -N\mu B$ and $U = +N\mu B$. For $U < 0$ the slope $\partial S/\partial U$ is positive and the temperature is positive. For $U > 0$ the slope is negative, and so is the temperature. Such negative-temperature states are hotter than any positive temperature, in the sense that energy flows from them to any positive-temperature system. They can occur only in systems whose energy is bounded above.

Applying the same reasoning to systems that exchange volume or particles leads to the statistical definitions of pressure and chemical potential:

$$
P = T\left(\frac{\partial S}{\partial V}\right)_{U,N}, \qquad \mu = -T\left(\frac{\partial S}{\partial N}\right)_{U,V}.
$$

Combining all three gives the thermodynamic identity $dU = T\,dS - P\,dV + \mu\,dN$.

## 2.6 The multiplicity of an ideal gas

For a classical gas the microstate is a point in phase space, and the counting requires a prescription for how many states occupy a given region. Quantum mechanics supplies it: for a particle confined to a box, the allowed states are spaced so that each occupies a phase-space volume $h^3$. The number of states available to one particle of energy $U$ in a volume $V$ is therefore proportional to $V V_p/h^3$, where $V_p$ is the volume of the momentum-space shell of radius $\sqrt{2mU}$.

For $N$ particles the momentum space is $3N$-dimensional, and the allowed momenta lie on the surface of a hypersphere. We must also account for the indistinguishability of the particles. Interchanging two identical atoms does not produce a new microstate, so the count must be divided by the $N!$ permutations of the particles among their states. This correction is valid only when the number of available states vastly exceeds $N$, so that two particles are rarely found in the same state; the general case is the subject of Chapter 4.
<!-- extract why-n-factorial -->

Carrying out the counting and applying Stirling's approximation leads to the *Sackur–Tetrode equation* for the entropy of a monatomic ideal gas,

$$
S = Nk\left[\ln\left(\frac{V}{N}\left(\frac{4\pi m U}{3Nh^2}\right)^{3/2}\right) + \frac{5}{2}\right].
$$

From it follow the energy, $U = \frac32 NkT$, and the equation of state, $PV = NkT$, by the definitions of the previous section. The Sackur–Tetrode equation predicts an absolute entropy, including the constant term, and the prediction has been confirmed by calorimetric measurements of the entropy of monatomic gases.

**Worked example 2.1.** *Entropy of mixing.* A box is divided into two halves of volume $V$, each containing $N$ atoms of an ideal gas at the same temperature. The partition is removed. If the gases are different (say helium and argon), each expands into volume $2V$, and the entropy increases by $\Delta S = 2Nk\ln 2$. If the gases are identical, the macrostate after removal is indistinguishable from the one before, and $\Delta S$ must be zero. The Sackur–Tetrode equation gives exactly this: the total entropy depends on $V/N$, which is unchanged. Without the factor $1/N!$, the formula would depend on $\ln V$ rather than $\ln(V/N)$ and would predict an entropy increase of $2Nk\ln 2$ for identical gases as well. This is Gibbs's paradox, and its resolution is the indistinguishability of identical particles.

entropy of mixing two different ideal gases, $N$ atoms each, each expanding from $V$ to $2V$ :: $\Delta S = 2Nk\ln 2$ ^lq2-mixing
<!-- sr due=2026-11-21 st=review s=30.4 d=3.8 r=4 l=0 ivl=30 last=2026-10-22T08:01:00Z g=4 -->

**Worked example 2.2.** *Entropy of a paramagnet at zero field.* At $B = 0$ every arrangement of $N$ dipoles has the same energy, and all $2^N$ are accessible. Thus $S = Nk\ln2$. When a field is applied adiabatically, the entropy is unchanged while the energy levels split; cooling the lattice and then removing the field isothermally and adiabatically in turn is the basis of adiabatic demagnetization, discussed in Chapter 7.

## Summary

The microcanonical approach rests on counting. For any isolated system, we determine the multiplicity $\Omega$ as a function of the conserved quantities, form $S = k\ln\Omega$, and obtain temperature, pressure, and chemical potential by differentiation. The second law appears as the overwhelming dominance of the most probable macrostate. The approach is conceptually clean but computationally demanding: for each new system the counting must be done afresh, under the constraint of exactly fixed energy. In Chapter 3 we relax that constraint and obtain a far more convenient method.

## Problems

1. **2.1** Ten coins are tossed. Find the probability of exactly five heads, and of four, five, or six heads.
2. **2.2** List all microstates of an Einstein solid with $N = 3$ and $q = 4$ and confirm that $\Omega = 15$.
3. **2.3** For two Einstein solids with $N_A = 300$, $N_B = 200$, and $q = 100$, use a computer to find the most probable value of $q_A$ and the probability that $q_A$ lies within 10% of it.
4. **2.4** Use Stirling's approximation to show that the multiplicity of an Einstein solid in the low-temperature limit $q \ll N$ is $\Omega \approx (eN/q)^q$. Interpret the result.
5. **2.5** Compute $S$, $T$, and $U(T)$ for the two-state paramagnet. Sketch $S(U)$ and $T(U)$, and show that the magnetization is $M = N\mu\tanh(\mu B/kT)$.
6. **2.6** Show that the Sackur–Tetrode equation predicts $S \to -\infty$ as $T \to 0$. Why is this not a violation of the third law?
7. **2.7** Evaluate the Sackur–Tetrode entropy of one mole of argon at 300 K and 1 atm, and compare with the tabulated value of 155 J/K.
8. **2.8** A rubber band may be modelled as a chain of $N$ links, each pointing left or right with length $\ell$. Find the entropy as a function of the total length $L$, and show that the tension at fixed $T$ is approximately $kTL/N\ell^2$ for $L \ll N\ell$.
