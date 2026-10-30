---
title: microcanonical ensemble & entropy
read: due=2026-11-04 ivl=12 reps=2
lectures: 2026-08-31 to 2026-09-18
---

## lecture 1 — macrostates, microstates (Mon 8/31)

First day. She opened with a box of gas and asked how many numbers it takes to describe it. Microscopically, $6N$ (positions and momenta), so $\sim 10^{24}$. Thermodynamically, three: $U$, $V$, $N$. Statistical mechanics is the bridge: it explains why three numbers are enough, and how to compute the thermodynamic ones from the microscopic model.

A **microstate** is a complete specification of the system at the level the model allows (every spin up or down; every oscillator's quantum number; every particle's cell in phase space). A **macrostate** is the specification at the level we measure: total energy, total magnetization, volume, number. Many microstates belong to one macrostate. The number of them is the **multiplicity** $\Omega$.

The fundamental assumption (she wrote it in a box): an isolated system in equilibrium is equally likely to be in any of its accessible microstates. Accessible = consistent with the fixed $U$, $V$, $N$. Not derivable from mechanics in any clean way; ergodic hypothesis is the usual hand-wave, she said not to lean on it.

the fundamental assumption of statistical mechanics: an isolated system in equilibrium is {{c1::equally likely to be in any of its accessible microstates}} ^sm-fund-assump
<!-- sr due=2026-11-21 st=review s=31.2 d=3.1 r=6 l=0 ivl=31 last=2026-10-21T07:48:00Z g=3 -->

Consequence: the probability of a macrostate is just its multiplicity over the total, $P(\text{macro}) = \Omega(\text{macro})/\Omega_{\text{total}}$. Everything in this unit is counting.

Warm-up she did on the board: 4 coins. Macrostate "2 heads" has $\binom{4}{2} = 6$ microstates out of $2^4 = 16$. 100 coins: $\Omega(50) = \binom{100}{50} \approx 1.01 \times 10^{29}$ vs $\Omega(0) = 1$. Point: with even modest $N$ the middle dominates absurdly.

## lecture 2 — two-state paramagnet (Wed 9/2)

$N$ spin-1/2 dipoles in a field $B$, each either up (aligned, energy $-\mu B$) or down (anti-aligned, energy $+\mu B$). Ignore interactions between dipoles. Macrostate fixed by $N_\uparrow$ (equivalently by $U$ or the magnetization).

$$
\Omega(N, N_\uparrow) = \binom{N}{N_\uparrow} = \frac{N!}{N_\uparrow!\,N_\downarrow!}
$$

Energy and magnetization:

$$
U = \mu B (N_\downarrow - N_\uparrow) = \mu B (N - 2N_\uparrow), \qquad M = \mu (N_\uparrow - N_\downarrow) = -U/B
$$

So $U$ runs from $-N\mu B$ (all up) to $+N\mu B$ (all down), and $\Omega$ is 1 at both ends and maximal at $U = 0$. Keep that shape in mind: it's the reason negative temperatures exist (lecture 5).

multiplicity of a two-state paramagnet with $N$ dipoles, $N_\uparrow$ of them up :: $\Omega = \binom{N}{N_\uparrow} = \frac{N!}{N_\uparrow!\,N_\downarrow!}$ ^sm-para-omega
<!-- sr due=2026-11-09 st=review s=24.8 d=2.6 r=5 l=0 ivl=25 last=2026-10-15T08:30:00Z g=3 -->

## lecture 3 — Einstein solid, interacting systems (Fri 9/4)

Einstein solid: $N$ independent quantum harmonic oscillators, all the same frequency $\omega$, energy levels $(n + \tfrac12)\hbar\omega$. Drop the zero-point part (constant shift), so total energy $U = q\,\hbar\omega$ where $q$ is the number of energy units shared among the oscillators. $N$ atoms in 3D = $3N$ oscillators; she uses $N$ = number of oscillators throughout and I'll do the same. #TODO: the book uses $N$ = oscillators too, check ch2 problem 2.4 where it switches.

Counting $q$ indistinguishable units among $N$ distinguishable oscillators = stars and bars: $q$ dots and $N-1$ dividers in a row.

$$
\Omega(N, q) = \binom{q + N - 1}{q} = \frac{(q + N - 1)!}{q!\,(N-1)!}
$$

multiplicity of an Einstein solid with $N$ oscillators and $q$ energy units :: $\Omega = \binom{q+N-1}{q}$ (stars and bars: $q$ dots, $N-1$ bars) ^sm-einstein-omega
<!-- sr due=2026-10-30 st=review s=19.6 d=4.4 r=5 l=1 ivl=19 last=2026-10-11T08:02:00Z g=3 -->

Two solids A and B, weakly coupled so they exchange energy slowly, total $q = q_A + q_B$ fixed. Total multiplicity of a given split is the product $\Omega_A(q_A)\Omega_B(q_B)$, and the macrostate here is the split. She tabulated $N_A = N_B = 3$, $q = 6$ (total multiplicity $\binom{11}{6} = 462$; most probable split $q_A = 3$ with $10 \times 10 = 100$). Then the computer table for $N_A = 300$, $N_B = 200$, $q = 100$: the peak at $q_A = 60$ is already sharp, and the probability of finding, e.g., $q_A < 30$ is negligible.

Spontaneous energy flow from A to B is just the system wandering toward the split with the most microstates. Second law = "systems go to the most probable macrostate," which for $N \sim 10^{23}$ is not "probably," it's "always, for any time you could wait."

the second law, in counting language :: an isolated system moves toward the macrostate of largest multiplicity, because for large $N$ that macrostate overwhelmingly dominates ^sm-second-law
<!-- sr due=2026-11-26 st=review s=36.5 d=2.2 r=6 l=0 ivl=36 last=2026-10-21T07:50:00Z g=4 -->

## lecture 4 — large numbers, Stirling, sharpness (Wed 9/9)

(Mon 9/7 Labor Day.)

Three kinds of numbers: small (6, 23), large ($10^{23}$), very large ($10^{10^{23}}$). Multiplying a very large number by a large number does nothing to it: $10^{10^{23}} \times 10^{23} = 10^{10^{23} + 23}$, and the $23$ is invisible. That is why we can be sloppy with prefactors inside $\Omega$ and why $S = k \ln \Omega$ is insensitive to them.

Stirling:

$$
N! \approx N^N e^{-N} \sqrt{2\pi N}, \qquad \ln N! \approx N \ln N - N
$$

The $\sqrt{2\pi N}$ only matters for small $N$; in logs it's $\tfrac12 \ln(2\pi N)$, negligible next to $N \ln N$.

Stirling's approximation in log form, for large $N$: $\ln N! \approx$ {{c1::$N \ln N - N$}} ^sm-stirling
<!-- sr due=2026-12-03 st=review s=38.9 d=1.9 r=6 l=0 ivl=39 last=2026-10-25T09:12:00Z g=4 -->

High-temperature Einstein solid ($q \gg N$): use Stirling on everything and $\ln(1 + N/q) \approx N/q$.

$$
\ln \Omega \approx (q + N)\ln(q+N) - q \ln q - N \ln N \approx N \ln\frac{q}{N} + N
$$

so $\Omega(N, q) \approx (eq/N)^N$ when $q \gg N$. [Dropped the $-1$ in $N-1$, fine at large $N$.]

Two identical high-$T$ solids sharing $q$ units: $\Omega_{\text{total}} \approx (e/N)^{2N} (q_A q_B)^N$. Write $q_A = q/2 + x$. Then $q_A q_B = (q/2)^2 - x^2$ and

$$
\Omega_{\text{total}} \approx \Omega_{\max}\, e^{-N (2x/q)^2}
$$

a Gaussian in $x$ with width $\sigma_x = q/(2\sqrt{N})$. Relative width $\sim 1/\sqrt{N}$. For $N = 10^{20}$, $q = 10^{21}$ she said: the peak width is $10^{10}$ units out of $10^{21}$; you'd need a measurement good to one part in $10^{10}$ to see the fluctuation. Prof. said this is on the midterm (it was, part (a) of problem 1).

relative width of the multiplicity peak for two interacting solids of $N$ oscillators each :: $\sim 1/\sqrt{N}$, so for macroscopic $N$ the most probable split is effectively certain ^sm-peak-width
<!-- sr due=2026-10-28 st=review s=13.7 d=5.2 r=5 l=1 ivl=14 last=2026-10-14T19:40:00Z g=3 -->

## lecture 5 — entropy and temperature (Fri 9/11, Mon 9/14)

Define

$$
S \equiv k \ln \Omega
$$

Why the log: (1) multiplicities of independent subsystems multiply, entropies add, so $S$ is extensive; (2) the numbers become manageable — $S/k$ is a large number, not a very large one.

why is entropy defined with a logarithm, $S = k \ln \Omega$, and not as $\Omega$ itself?
?
multiplicities of independent subsystems multiply, so the log makes entropy additive (extensive); and it turns very large numbers into merely large ones ^sm-why-log
<!-- sr due=2026-11-02 st=review s=17.9 d=4.9 r=4 l=0 ivl=18 last=2026-10-15T08:34:00Z g=3 -->

Equilibrium between A and B exchanging energy: total entropy $S_A(U_A) + S_B(U - U_A)$ is maximized, so

$$
\frac{\partial S_A}{\partial U_A} = \frac{\partial S_B}{\partial U_B}
$$

The quantity that becomes equal in thermal equilibrium is what we've been calling temperature, up to how we invert it. Units and the direction of heat flow fix it:

$$
\frac{1}{T} \equiv \left(\frac{\partial S}{\partial U}\right)_{N, V}
$$

Heat flows from the object with the smaller slope $\partial S/\partial U$ to the one with the larger slope: giving up energy costs the first one less entropy than the second one gains. Smaller slope = higher $T$. ✓ with intuition.

$$
\frac{1}{T} = {{c1::\left(\frac{\partial S}{\partial U}\right)_{N,V}}}
$$ ^sm-def-T
<!-- sr due=2026-11-17 st=review s=33.4 d=2.4 r=6 l=0 ivl=33 last=2026-10-15T08:33:00Z g=3 -->

Check on the high-$T$ Einstein solid: $S = Nk[\ln(q/N) + 1]$ with $q = U/\epsilon$, $\epsilon = \hbar\omega$. Then

$$
\frac{1}{T} = \frac{\partial S}{\partial U} = \frac{Nk}{U} \quad \Rightarrow \quad U = NkT
$$

one $kT$ per oscillator, i.e. $\tfrac12 kT$ for each of the two quadratic terms (kinetic + potential). Equipartition falls out. For $N_{\text{atoms}}$ in 3D: $U = 3N_{\text{atoms}}kT$, $C_V = 3N_{\text{atoms}} k$, Dulong–Petit. Only valid at high $T$; low $T$ needs the exact $\Omega$ (or the canonical treatment, which is much easier — next unit).

Paramagnet, exactly. With Stirling,

$$
S/k = N \ln N - N_\uparrow \ln N_\uparrow - N_\downarrow \ln N_\downarrow
$$

$\partial S/\partial N_\uparrow = k \ln(N_\downarrow / N_\uparrow)$ and $dN_\uparrow / dU = -1/(2\mu B)$, so

$$
\frac{1}{T} = \frac{k}{2\mu B} \ln\frac{N_\uparrow}{N_\downarrow}
$$

Solve with $N_\uparrow + N_\downarrow = N$:

$$
U = -N\mu B \tanh\!\left(\frac{\mu B}{kT}\right), \qquad M = N\mu \tanh\!\left(\frac{\mu B}{kT}\right)
$$

High-$T$ limit $\tanh x \approx x$ gives Curie's law $M \approx N\mu^2 B/kT$.

magnetization of an ideal two-state paramagnet at temperature $T$ :: $M = N\mu \tanh(\mu B/kT)$; at high $T$ this is Curie's law $M \approx N\mu^2 B/kT$ ^sm-para-M
<!-- sr due=2026-10-29 st=review s=8.2 d=6.3 r=6 l=2 ivl=8 last=2026-10-21T08:05:00Z g=2 -->

Negative temperature. For $U > 0$ (more down than up), adding energy *decreases* $\Omega$, so $\partial S/\partial U < 0$ and $T < 0$. Not colder than zero: hotter than infinity. Such a system gives energy to anything at positive $T$. Order: $+0 \to +\infty$, then $-\infty \to -0$, coldest to hottest. Needs an energy spectrum bounded above (spins yes, gas no) and isolation from the lattice long enough to measure. Nuclear spins in LiF (Purcell–Pound 1951) is the classic example.

why can a two-state paramagnet have negative temperature but an ideal gas cannot?
?
the paramagnet's energy is bounded above, so past $U = 0$ adding energy lowers $\Omega$ and $\partial S/\partial U < 0$; a gas's $\Omega$ grows with $U$ without limit ^sm-neg-T
<!-- sr due=2026-11-06 st=review s=15.1 d=5.6 r=4 l=0 ivl=15 last=2026-10-22T19:21:00Z g=3 -->

## lecture 6 — pressure and chemical potential (Wed 9/16)

Same argument, other exchanges. Two systems exchanging volume (movable partition) at equal $T$: maximize $S_A + S_B$ over $V_A$, so $\partial S/\partial V$ equalizes. Mechanical equilibrium means equal pressure, and dimensions say $P/T$:

$$
\frac{P}{T} = \left(\frac{\partial S}{\partial V}\right)_{U, N}, \qquad -\frac{\mu}{T} = \left(\frac{\partial S}{\partial N}\right)_{U, V}
$$

Minus sign on $\mu$ so that particles flow from high $\mu$ to low $\mu$ (same logic as heat from high $T$). Put together:

$$
dS = \frac{1}{T} dU + \frac{P}{T} dV - \frac{\mu}{T} dN \quad\Longleftrightarrow\quad dU = T\,dS - P\,dV + \mu\,dN
$$

the thermodynamic identity :: $dU = T\,dS - P\,dV + \mu\,dN$ ^sm-thermo-identity
<!-- sr due=2026-11-12 st=review s=27.2 d=3 r=5 l=0 ivl=27 last=2026-10-16T08:11:00Z g=3 -->

chemical potential from the entropy :: $\mu = -T\left(\partial S/\partial N\right)_{U,V}$ — the minus sign makes particles flow from high $\mu$ to low $\mu$ ^sm-mu-def
<!-- sr due=2026-10-27 st=review s=6.4 d=7.2 r=7 l=3 ivl=6 last=2026-10-21T08:09:00Z g=2 -->

## lecture 7 — ideal gas, Sackur–Tetrode (Fri 9/18)

The big one. Monatomic ideal gas, $N$ atoms of mass $m$ in volume $V$, energy $U$.

One atom first. Number of states ~ (volume of position space × volume of accessible momentum space) / $h^3$. The $h^3$ comes from uncertainty: a phase-space cell of size $\Delta x \Delta p_x \sim h$ per dimension holds one state. She was honest that this is a heuristic until you do particle-in-a-box; for a box of side $L$, the box states $p = hn/2L$ give exactly this count.

$N$ atoms: momentum space is $3N$-dimensional, and the constraint $\sum p_i^2 = 2mU$ is the surface of a $3N$-sphere of radius $\sqrt{2mU}$. Area of a $d$-sphere of radius $r$:

$$
A_d(r) = \frac{2\pi^{d/2}}{\Gamma(d/2)}\, r^{d-1}
$$

Then divide by $N!$ because the atoms are identical — swapping two atoms doesn't give a new microstate.

$$
\Omega(U, V, N) \approx \frac{1}{N!}\frac{V^N}{h^{3N}}\frac{\pi^{3N/2}}{(3N/2)!}(2mU)^{3N/2}
$$

[She went straight from area to this, using that for large $N$ the shell area × thickness and the volume of the ball give the same $\ln \Omega$ to leading order. Factors like $3N/2U$ and $\Delta p$ are "large numbers" next to a "very large" one. Fine.]

Log it with Stirling, $\ln N! \approx N\ln N - N$ and $\ln(3N/2)! \approx \tfrac{3N}{2}\ln\tfrac{3N}{2} - \tfrac{3N}{2}$:

$$
\ln \Omega = N\ln V - N\ln N + N + \frac{3N}{2}\ln\frac{2\pi m U}{h^2} - \frac{3N}{2}\ln\frac{3N}{2} + \frac{3N}{2}
$$

Group: $N\ln V - N \ln N = N \ln(V/N)$, the two $3N/2$ logs combine into $\tfrac{3N}{2}\ln\frac{4\pi m U}{3 N h^2}$, constants $N + 3N/2 = 5N/2$.

$$
S = Nk\left[\ln\left(\frac{V}{N}\left(\frac{4\pi m U}{3 N h^2}\right)^{3/2}\right) + \frac{5}{2}\right]
$$

That's **Sackur–Tetrode**. Notice it's extensive: double $U$, $V$, $N$ and $V/N$ and $U/N$ don't change, so $S$ doubles. Without the $1/N!$ we'd have $\ln V$ instead of $\ln(V/N)$ and $S$ would not be extensive — that's the Gibbs paradox (mixing two halves of the same gas would "increase" entropy).

$$
S = Nk\left[\ln\left({{c1::\frac{V}{N}}}\left(\frac{4\pi m U}{3 N h^2}\right)^{3/2}\right) + {{c2::\frac{5}{2}}}\right]
$$ ^sm-sackur-tetrode
<!-- sr c1 due=2026-11-03 st=review s=16.6 d=4.8 r=5 l=1 ivl=17 last=2026-10-17T09:03:00Z g=3 -->
<!-- sr c2 due=2026-10-30 st=review s=11.2 d=5.9 r=5 l=1 ivl=11 last=2026-10-19T07:41:00Z g=3 -->

what goes wrong in the ideal-gas entropy if you leave out the $1/N!$?
?
you get $\ln V$ where Sackur–Tetrode has $\ln(V/N)$, so $S$ is not extensive, and removing a partition between two samples of the same gas would seem to raise the entropy (Gibbs paradox) ^sm-gibbs-paradox
<!-- sr due=2026-11-08 st=review s=21.3 d=4 r=4 l=0 ivl=21 last=2026-10-18T08:55:00Z g=3 -->

Recovering thermodynamics from $S$:

$1/T = \partial S/\partial U = \tfrac{3}{2}Nk/U$, so $U = \tfrac32 NkT$. ✓

$P/T = \partial S/\partial V = Nk/V$, so $PV = NkT$. ✓ (The ideal gas law comes out of counting. She was pleased with this.)

$\mu = -T\,\partial S/\partial N$. Careful, $N$ appears three places. Result:

$$
\mu = -kT \ln\left[\frac{V}{N}\left(\frac{4\pi m U}{3Nh^2}\right)^{3/2}\right] = -kT\ln\left[\frac{V}{N}\left(\frac{2\pi m k T}{h^2}\right)^{3/2}\right]
$$

the second form using $U/N = \tfrac32 kT$. The thing in brackets is $V/(N\lambda^3)$, the volume per particle over the thermal-wavelength cube (she previewed $\lambda$ here, it'll come back in the quantum unit). For a classical gas this is huge, so $\mu$ is large and negative.

Worked number from section: helium at 300 K, 1 atm. $V/N = kT/P \approx 4.1 \times 10^{-26}\ \text{m}^3$. $\lambda = h/\sqrt{2\pi m k T} \approx 5.0 \times 10^{-11}$ m, $\lambda^3 \approx 1.3 \times 10^{-31}\ \text{m}^3$. Ratio $\approx 3.2 \times 10^5$, $\ln \approx 12.7$, so $S/Nk \approx 12.7 + 2.5 = 15.2$, molar entropy $\approx 126$ J/(mol·K), which matches the tables. $\mu \approx -12.7\,kT \approx -0.33$ eV.

Sackur–Tetrode entropy per atom of helium at room temperature and 1 atm, roughly :: $S/Nk \approx 15$ (molar $S \approx 126$ J/mol·K) ^sm-he-entropy
<!-- sr st=new -->

## discussion section (Thu 9/17, Ravi) — the $h^3$ and the box

Ravi's version of where $h^3$ comes from, which is cleaner than lecture. One particle in a cubic box of side $L$, wavefunctions vanishing at the walls: $p_x = h n_x / 2L$ with $n_x = 1, 2, 3, \dots$, same for $y$, $z$. Each triple $(n_x, n_y, n_z)$ of positive integers is one state. The number of states with $|p| \le p_0$ is the number of lattice points in one octant of a sphere of radius $2Lp_0/h$:

$$
N(p_0) \approx \frac{1}{8}\cdot\frac{4\pi}{3}\left(\frac{2Lp_0}{h}\right)^3 = \frac{V}{h^3}\cdot\frac{4\pi}{3}p_0^3
$$

which is exactly (position volume) × (momentum-ball volume) / $h^3$. The octant's $1/8$ is undone by the $2^3$ from the $2L$. So the semiclassical rule is not a convention; the constant is fixed by the quantum count, and it shows up in the additive constant of $S$. Periodic boundary conditions give $p = hn/L$ with $n$ of either sign — same count, all octants, half the spacing. He said to use whichever is convenient, we'll use periodic for the Fermi gas.

semiclassical count of one-particle states in volume $V$ with momentum below $p_0$ :: $\frac{V}{h^3}\cdot\frac{4\pi}{3}p_0^3$ — one state per phase-space volume $h^3$ ^sm-h3-count
<!-- sr due=2026-11-05 st=review s=14.8 d=4.6 r=3 l=0 ivl=15 last=2026-10-21T08:13:00Z g=3 -->

Second thing from section: problem set 2 #3 (the "how many states for two particles in a box" problem). Distinguishable vs identical matters at low occupation: for two particles and many states, identical-boson count ≈ distinguishable count / 2, the $1/N!$ rule. But when two particles can sit in the *same* state, the $1/N!$ undercounts for bosons (the doubly-occupied states aren't double-counted to begin with) and fermions forbid it entirely. So $1/N!$ is correct only when nearly every state is empty or singly occupied — the dilute, classical limit. This is the seed of the whole quantum-gas unit. Ravi: "the $N!$ is a classical approximation to a quantum fact."

when is dividing by $N!$ the correct way to count states of $N$ identical particles?
?
only when the particles are almost never in the same single-particle state (dilute, classical limit); with multiple occupancy it undercounts bosons and fermions forbid it outright ^sm-nfact-validity
<!-- sr due=2026-10-26 st=review s=4.1 d=6.8 r=3 l=1 ivl=4 last=2026-10-22T19:30:00Z g=3 -->

## summary of the unit (for myself)

The whole unit is one move repeated: count $\Omega$, take $S = k\ln\Omega$, differentiate. $\partial S/\partial U$ gives $1/T$, $\partial S/\partial V$ gives $P/T$, $\partial S/\partial N$ gives $-\mu/T$. The hard part is always the counting, and the microcanonical ensemble makes it hard because the energy is fixed exactly — every model is a constrained combinatorics problem. The canonical ensemble (next) trades the fixed $U$ for a fixed $T$ and turns counting into summing exponentials, which factorizes. She said: "you will never do a microcanonical calculation voluntarily again after October." 

Things still shaky: the shell-vs-ball argument; why the $h^3$ isn't just a convention (it is fixed by matching to the quantum count, but the classical limit is insensitive to it except in $S$'s additive constant, and that constant is measurable — vapour pressure, Sackur–Tetrode was originally checked against mercury vapour). Read ch2 §2.6 of Lindqvist for this again.
