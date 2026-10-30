---
type: deck
title: derivation drills
default-card: qa
purpose: physics GRE, spring 2027
---

Cross-course "derive it from scratch" cards. Rule: the back is an outline, not the full derivation. Grade good only if I could write the whole thing on paper in under three minutes without looking. If I need the outline to start, it's again.

GRE is April 2027. Target: every card here mature by March. New ones get added from whatever course I'm in; the old 301 ones mostly live in the course notes, these are the ones that cross courses.

## mechanics

small oscillations about a minimum $x_0$ of $U(x)$: derive the frequency
?
expand $U(x) \approx U(x_0) + \tfrac12U''(x_0)(x-x_0)^2$, linear term vanishes at a minimum
$$m\ddot\xi = -U''(x_0)\,\xi \quad\Longrightarrow\quad \omega = \sqrt{U''(x_0)/m}$$
for a generalized coordinate replace $m$ by the coefficient of $\tfrac12\dot q^2$ in $T$ ^dr-smallosc
<!-- sr due=2026-12-13 st=review s=147 d=3.1 r=9 l=0 ivl=147 last=2026-07-19T08:21:00Z g=3 -->

escape velocity from the surface of a planet of mass $M$, radius $R$
?
energy at infinity $\ge 0$: $\tfrac12mv^2 - GMm/R = 0$
$$v_{\text{esc}} = \sqrt{2GM/R} = \sqrt{2gR}$$
Earth: $\sqrt{2\cdot9.8\cdot6.4\times10^6} \approx 11.2$ km/s; $\sqrt2$ times circular orbital speed ^dr-escape
<!-- sr due=2027-01-03 st=review s=192 d=2.3 r=10 l=0 ivl=192 last=2026-06-25T07:40:00Z g=4 -->

moment of inertia of a uniform rod (mass $M$, length $L$) about one end, and about its center
?
$$I_{\text{end}} = \int_0^L \frac{M}{L}x^2\,dx = \tfrac13ML^2$$
center: same integral from $-L/2$ to $L/2$ gives $\tfrac{1}{12}ML^2$
check with parallel axis: $\tfrac{1}{12}ML^2 + M(L/2)^2 = \tfrac13ML^2$ ✓ ^dr-rod
<!-- sr due=2026-12-15 st=review s=166 d=2.7 r=9 l=0 ivl=166 last=2026-07-02T13:12:00Z g=4 -->

prove the parallel-axis theorem
?
$I = \sum m_i|\mathbf{r}'_i + \mathbf{d}|_\perp^2$ with $\mathbf{r}'_i$ measured from the CM
cross term $2\mathbf{d}\cdot\sum m_i\mathbf{r}'_i = 0$ by definition of the CM
$$I = I_{\text{cm}} + Md^2$$ ^dr-parallel
<!-- sr due=2026-12-05 st=review s=121 d=4 r=8 l=0 ivl=121 last=2026-08-06T09:02:00Z g=3 -->

rocket equation: derive $\Delta v$ for exhaust speed $u$ relative to the rocket
?
momentum in a time $dt$: $Mv = (M + dM)(v + dv) + (-dM)(v - u)$ with $dM < 0$
to first order $M\,dv = -u\,dM$
$$\Delta v = u\ln\frac{M_0}{M_f}$$ ^dr-rocket
<!-- sr due=2026-11-28 st=review s=89 d=5.2 r=8 l=1 ivl=89 last=2026-08-31T07:58:00Z g=3 -->

virial theorem for a bound orbit in a power-law potential $V \propto r^n$
?
$G = \sum\mathbf{p}\cdot\mathbf{r}$, $\dot G = 2T + \sum\mathbf{F}\cdot\mathbf{r}$; time-average over bounded motion: $\langle\dot G\rangle = 0$
$\mathbf{F}\cdot\mathbf{r} = -r\,V'(r) = -nV$
$$2\langle T\rangle = n\langle V\rangle$$
gravity $n = -1$: $\langle T\rangle = -\tfrac12\langle V\rangle$, $E = -\langle T\rangle$ ^dr-virial
<!-- sr due=2026-11-01 st=review s=26 d=7.3 r=11 l=3 ivl=26 last=2026-10-06T19:30:00Z g=3 -->

damped harmonic oscillator $m\ddot x + b\dot x + kx = 0$: the three regimes
?
try $e^{st}$: $s = -\gamma \pm\sqrt{\gamma^2 - \omega_0^2}$, with $\gamma = b/2m$, $\omega_0^2 = k/m$
underdamped $\gamma<\omega_0$: $e^{-\gamma t}\cos(\omega_1t + \phi)$, $\omega_1 = \sqrt{\omega_0^2 - \gamma^2}$
critical $\gamma = \omega_0$: $(A + Bt)e^{-\gamma t}$, fastest return without overshoot
overdamped: two real decaying exponentials; $Q = \omega_0/2\gamma$ ^dr-damped
<!-- sr due=2026-11-22 st=review s=74 d=5.6 r=9 l=1 ivl=74 last=2026-09-09T08:15:00Z g=3 -->

the quality factor of a lightly damped oscillator is $Q = {{c1::\omega_0/2\gamma}}$, roughly $2\pi$ times energy stored over {{c2::energy lost per cycle}} ^dr-Q
<!-- sr c1 due=2026-10-31 st=review s=58 d=5.9 r=8 l=1 ivl=58 last=2026-09-03T08:10:00Z g=3 -->
<!-- sr c2 due=2026-11-18 st=review s=33 d=6.8 r=7 l=2 ivl=33 last=2026-10-16T17:40:00Z g=2 -->

Kapitza pendulum: when is the inverted position stable?
?
pivot $y_p = a\cos\gamma t$, effective gravity $g + \ddot y_p$ (from the Lagrangian, drop a total derivative)
fast drive: average the fast motion, effective potential gains $\frac{m a^2\gamma^2}{4}\sin^2\theta$
$$U_{\text{eff}} = -mg\ell\cos\theta + \frac{ma^2\gamma^2}{4}\sin^2\theta$$
at $\theta = \pi$: $U'' > 0$ iff $a^2\gamma^2 > 2g\ell$ ^dr-kapitza
<!-- sr due=2026-12-05 st=review s=41 d=6.4 r=7 l=1 ivl=41 last=2026-10-25T08:44:00Z g=3 -->

Euler–Lagrange from Hamilton's principle (the drill version)
?
$\delta S = \int(\partial_qL\,\delta q + \partial_{\dot q}L\,\delta\dot q)\,dt$
by parts, boundary term zero, $\delta q$ arbitrary
$$\frac{d}{dt}\frac{\partial L}{\partial\dot q} = \frac{\partial L}{\partial q}$$ ^dr-el
<!-- sr due=2027-02-10 st=review s=214 d=1.9 r=12 l=0 ivl=214 last=2026-07-11T07:22:00Z g=4 -->

## electromagnetism

field of an infinite line charge $\lambda$ from Gauss's law
?
cylinder radius $r$, length $\ell$: flux only through the side
$$E\cdot2\pi r\ell = \frac{\lambda\ell}{\epsilon_0}\quad\Longrightarrow\quad E = \frac{\lambda}{2\pi\epsilon_0r}$$
radially outward; potential $\propto\ln r$, no zero at infinity ^dr-linecharge
<!-- sr due=2026-12-27 st=review s=181 d=2.2 r=9 l=0 ivl=181 last=2026-06-29T08:05:00Z g=4 -->

field of a long straight wire carrying $I$, from Ampère's law
?
circle radius $r$ around the wire, $\mathbf{B}$ tangential and constant on it by symmetry
$$\oint\mathbf{B}\cdot d\boldsymbol\ell = B\cdot2\pi r = \mu_0I\quad\Longrightarrow\quad B = \frac{\mu_0I}{2\pi r}$$
direction: right-hand rule ^dr-wire
<!-- sr due=2026-12-30 st=review s=176 d=2.4 r=9 l=0 ivl=176 last=2026-07-07T08:35:00Z g=4 -->

wave equation for $\mathbf{E}$ in vacuum from Maxwell's equations
?
curl of Faraday: $\nabla\times(\nabla\times\mathbf{E}) = -\partial_t(\nabla\times\mathbf{B}) = -\mu_0\epsilon_0\,\partial_t^2\mathbf{E}$
$\nabla\times(\nabla\times\mathbf{E}) = \nabla(\nabla\cdot\mathbf{E}) - \nabla^2\mathbf{E} = -\nabla^2\mathbf{E}$ in vacuum
$$\nabla^2\mathbf{E} = \mu_0\epsilon_0\frac{\partial^2\mathbf{E}}{\partial t^2},\qquad c = \frac{1}{\sqrt{\mu_0\epsilon_0}}$$ ^dr-waveeq
<!-- sr due=2027-02-11 st=review s=113 d=3.7 r=8 l=0 ivl=113 last=2026-10-21T19:20:00Z g=3 -->

Poynting's theorem: derive the energy-conservation statement
?
$\mathbf{J}\cdot\mathbf{E}$ is the work done on charges; eliminate $\mathbf{J}$ with Ampère–Maxwell
use $\nabla\cdot(\mathbf{E}\times\mathbf{B}) = \mathbf{B}\cdot(\nabla\times\mathbf{E}) - \mathbf{E}\cdot(\nabla\times\mathbf{B})$ and Faraday
$$-\frac{\partial u}{\partial t} = \nabla\cdot\mathbf{S} + \mathbf{J}\cdot\mathbf{E},\qquad u = \frac{\epsilon_0E^2}{2} + \frac{B^2}{2\mu_0},\quad \mathbf{S} = \frac{\mathbf{E}\times\mathbf{B}}{\mu_0}$$ ^dr-poynting
<!-- sr due=2026-11-01 st=review s=37 d=7.1 r=10 l=2 ivl=37 last=2026-09-25T08:01:00Z g=3 -->

energy stored in a capacitor
?
move charge $dq$ across potential $V = q/C$: $dW = (q/C)\,dq$
$$W = \int_0^Q\frac{q}{C}\,dq = \frac{Q^2}{2C} = \tfrac12CV^2$$
same answer from $\int\tfrac12\epsilon_0E^2\,d\tau$ for a parallel plate ^dr-cap
<!-- sr due=2026-12-01 st=review s=158 d=2.5 r=8 l=0 ivl=158 last=2026-06-26T07:44:00Z g=4 -->

cyclotron frequency of a charge in a uniform field $B$
?
$qvB = mv^2/r$ for circular motion perpendicular to $\mathbf{B}$
$$\omega_c = \frac{v}{r} = \frac{qB}{m}$$
independent of speed (nonrelativistic), which is why the cyclotron works ^dr-cyclotron
<!-- sr due=2026-12-27 st=review s=139 d=2.9 r=8 l=0 ivl=139 last=2026-08-10T08:28:00Z g=4 -->

the Larmor formula for the power radiated by a slow accelerating charge is $P = {{c1::\dfrac{q^2a^2}{6\pi\epsilon_0c^3}}}$ ^dr-larmor
<!-- sr due=2026-11-30 st=review s=44 d=6.9 r=9 l=2 ivl=44 last=2026-10-17T09:12:00Z g=3 -->

skin depth of a good conductor
?
in a good conductor the displacement current is negligible: $\nabla^2\mathbf{E} = \mu\sigma\,\partial_t\mathbf{E}$
try $e^{i(kz - \omega t)}$: $k^2 = i\mu\sigma\omega$, so $k = (1+i)/\delta$
$$\delta = \sqrt{\frac{2}{\mu\sigma\omega}}$$
copper at 60 Hz: about 8 mm ^dr-skin
<!-- sr st=new -->

## quantum mechanics

infinite square well of width $L$: energies and normalized states
?
$\psi'' = -k^2\psi$ inside, $\psi(0) = \psi(L) = 0$ ⇒ $\psi_n = \sqrt{2/L}\,\sin(n\pi x/L)$, $k = n\pi/L$
$$E_n = \frac{\hbar^2k^2}{2m} = \frac{n^2\pi^2\hbar^2}{2mL^2},\qquad n = 1,2,\dots$$ ^dr-isw
<!-- sr due=2026-12-28 st=review s=168 d=2.2 r=9 l=0 ivl=168 last=2026-07-13T08:50:00Z g=4 -->

harmonic oscillator spectrum from ladder operators
?
$a = \sqrt{m\omega/2\hbar}\,(x + ip/m\omega)$, $[a,a^\dagger] = 1$, $H = \hbar\omega(a^\dagger a + \tfrac12)$
$[H,a] = -\hbar\omega a$: $a$ lowers $E$ by $\hbar\omega$
norm $\ge0$ forces a bottom state $a\psi_0 = 0$, so $E_0 = \tfrac12\hbar\omega$
$$E_n = \hbar\omega\left(n + \tfrac12\right)$$ ^dr-ladder
<!-- sr due=2026-11-14 st=review s=62 d=5.4 r=8 l=1 ivl=62 last=2026-09-13T08:16:00Z g=3 -->

generalized uncertainty principle (Robertson)
?
for $\hat f = \hat A - \langle A\rangle$, $\hat g = \hat B - \langle B\rangle$: Cauchy–Schwarz $\sigma_A^2\sigma_B^2 \ge |\langle f|g\rangle|^2$
$|z|^2 \ge (\operatorname{Im}z)^2$ and $\operatorname{Im}\langle f|g\rangle = \frac{1}{2i}\langle[\hat A,\hat B]\rangle$
$$\sigma_A\sigma_B \ge \frac12\left|\langle[\hat A,\hat B]\rangle\right|$$
$x,p$: $\sigma_x\sigma_p\ge\hbar/2$ ^dr-robertson
<!-- sr due=2026-10-29 st=review s=29 d=7.6 r=10 l=3 ivl=29 last=2026-09-30T08:37:00Z g=3 -->

time derivative of an expectation value (generalized Ehrenfest)
?
$\frac{d}{dt}\langle\psi|\hat Q|\psi\rangle$ with $i\hbar\,\partial_t\psi = H\psi$ and $H$ Hermitian
$$\frac{d\langle Q\rangle}{dt} = \frac{i}{\hbar}\langle[\hat H,\hat Q]\rangle + \left\langle\frac{\partial\hat Q}{\partial t}\right\rangle$$
$Q = p$: $d\langle p\rangle/dt = -\langle V'(x)\rangle$; compare $df/dt = \{f,H\} + \partial_tf$ ^dr-ehrenfest
<!-- sr due=2026-12-09 st=review s=47 d=6.2 r=9 l=1 ivl=47 last=2026-10-23T19:05:00Z g=3 -->

probability current and the continuity equation
?
$\partial_t|\psi|^2 = \psi^*\partial_t\psi + \text{c.c.}$; substitute the Schrödinger equation, $V$ real cancels
$$\frac{\partial\rho}{\partial t} + \frac{\partial j}{\partial x} = 0,\qquad j = \frac{\hbar}{2mi}\left(\psi^*\psi' - \psi\psi'^*\right)$$
plane wave $Ae^{ikx}$: $j = |A|^2\hbar k/m$ ^dr-current
<!-- sr due=2026-10-30 st=review s=8.2 d=8.4 r=8 l=3 ivl=8 last=2026-10-22T08:40:00Z g=3 -->

tunneling through a wide barrier: estimate the transmission
?
inside, $\psi \sim e^{-\kappa x}$ with $\kappa = \sqrt{2m(V_0 - E)}/\hbar$
amplitude falls by $e^{-\kappa a}$ across width $a$, probability by its square
$$T \approx e^{-2\kappa a}$$
WKB version: $T\approx\exp\left(-2\int\kappa(x)\,dx\right)$ ^dr-tunnel
<!-- sr due=2026-11-02 st=review s=35 d=6.5 r=7 l=1 ivl=35 last=2026-09-28T08:12:00Z g=3 -->

Bohr-model energies of hydrogen (the 2-minute GRE version)
?
$mvr = n\hbar$ and $mv^2/r = ke^2/r^2$ ⇒ $r_n = n^2a_0$, $a_0 = \hbar^2/mke^2$
$E = \tfrac12mv^2 - ke^2/r = -ke^2/2r$
$$E_n = -\frac{mk^2e^4}{2\hbar^2n^2} = -\frac{13.6\text{ eV}}{n^2}$$ ^dr-bohr
<!-- sr due=2026-12-10 st=review s=137 d=2.8 r=8 l=0 ivl=137 last=2026-07-26T08:00:00Z g=4 -->

first-order energy shift in nondegenerate perturbation theory
?
$H = H_0 + \lambda H'$, expand $E_n$ and $|n\rangle$ in $\lambda$
take $\langle n^0|$ of the first-order equation; $\langle n^0|H_0 - E_n^0|n^1\rangle = 0$
$$E_n^1 = \langle n^0|H'|n^0\rangle,\qquad E_n^2 = \sum_{m\ne n}\frac{|\langle m^0|H'|n^0\rangle|^2}{E_n^0 - E_m^0}$$
second order of the ground state is always negative ^dr-pt1
<!-- sr due=2026-11-01 st=review s=11 d=6 r=4 l=0 ivl=11 last=2026-10-21T19:15:00Z g=3 -->

Fermi's golden rule: transition rate into a continuum
?
first-order amplitude $c_f(t) = \frac{1}{i\hbar}\int_0^t\langle f|V|i\rangle e^{i\omega_{fi}t'}dt'$
$|c_f|^2 \propto \sin^2(\omega_{fi}t/2)/\omega_{fi}^2 \to \frac{\pi t}{2}\,\delta(\omega_{fi})$ for large $t$
$$\Gamma = \frac{2\pi}{\hbar}|\langle f|V|i\rangle|^2\rho(E_f)$$ ^dr-golden
<!-- sr due=2026-10-29T15:35:00Z st=learning s=0.4 d=6.9 r=1 l=0 steps=1 ivl=0 last=2026-10-29T15:25:00Z g=1 -->

the adiabatic theorem in one line
?
a system in the $n$th eigenstate of $H(0)$, with $H(t)$ changed slowly compared with $\hbar/(E_{n\pm1} - E_n)$, ends in the $n$th eigenstate of $H(T)$
picks up a dynamical phase $-\frac1\hbar\int E_n\,dt$ and a geometric (Berry) phase $\gamma_n = i\oint\langle n|\nabla_Rn\rangle\cdot d\mathbf{R}$
classical shadow: the action $J = \oint p\,dq$ is an adiabatic invariant ^dr-adiabatic

Landau levels from the minimal-coupling Hamiltonian
?
Landau gauge $\mathbf{A} = (0, Bx, 0)$: $H = \frac{1}{2m}\left[p_x^2 + (p_y - qBx)^2 + p_z^2\right]$
$p_y = \hbar k_y$ conserved: shifted oscillator in $x$ centered at $x_0 = \hbar k_y/qB$
$$E = \hbar\omega_c\left(n + \tfrac12\right) + \frac{p_z^2}{2m},\qquad \omega_c = \frac{qB}{m}$$
degeneracy per area $qB/h$ ^dr-landau

## statistical mechanics and thermodynamics

two-level system (energies $0$, $\epsilon$) in contact with a bath at $T$: mean energy
?
$Z = 1 + e^{-\beta\epsilon}$
$$\langle E\rangle = -\frac{\partial\ln Z}{\partial\beta} = \frac{\epsilon}{e^{\beta\epsilon} + 1}$$
$\to\epsilon/2$ as $T\to\infty$, never more; heat capacity has the Schottky bump at $kT\sim0.4\epsilon$ ^dr-twolevel
<!-- sr due=2026-12-28 st=review s=71 d=5 r=8 l=1 ivl=71 last=2026-10-18T08:30:00Z g=3 -->

equipartition: why $\tfrac12kT$ per quadratic degree of freedom
?
$H \ni \alpha x^2$; the Boltzmann factor factorizes
$$\langle\alpha x^2\rangle = \frac{\int\alpha x^2e^{-\beta\alpha x^2}dx}{\int e^{-\beta\alpha x^2}dx} = -\frac{\partial}{\partial\beta}\ln\sqrt{\frac{\pi}{\beta\alpha}} = \frac{1}{2\beta}$$
independent of $\alpha$; classical only (fails when $kT\ll\hbar\omega$) ^dr-equip
<!-- sr due=2026-11-01 st=review s=133 d=3 r=8 l=0 ivl=133 last=2026-06-21T08:14:00Z g=4 -->

kinetic-theory pressure of an ideal gas
?
molecule bouncing in a box of length $L$: momentum $2mv_x$ per wall hit, hits every $2L/v_x$
force per molecule $mv_x^2/L$; sum, divide by area, $\langle v_x^2\rangle = \langle v^2\rangle/3$
$$PV = \tfrac13Nm\langle v^2\rangle = \tfrac23N\langle KE\rangle\quad\Rightarrow\quad\langle KE\rangle = \tfrac32kT$$ ^dr-kinetic
<!-- sr due=2026-12-29 st=review s=152 d=2.6 r=8 l=0 ivl=152 last=2026-07-30T08:25:00Z g=4 -->

the Maxwell relation from the Helmholtz free energy
?
$dF = -S\,dT - P\,dV$
mixed partials of $F(T,V)$ are equal
$$\left(\frac{\partial S}{\partial V}\right)_T = \left(\frac{\partial P}{\partial T}\right)_V$$ ^dr-maxwellrel
<!-- sr due=2026-10-30T16:05:00Z st=relearning s=0.7 d=9.1 r=13 l=5 steps=1 ivl=0 last=2026-10-30T15:55:00Z g=1 -->

Carnot efficiency from the second law
?
reversible cycle: $\Delta S_{\text{total}} = 0$, so $Q_h/T_h = Q_c/T_c$
$$\eta = 1 - \frac{Q_c}{Q_h} = 1 - \frac{T_c}{T_h}$$
any irreversibility makes $Q_c/T_c > Q_h/T_h$, so $\eta$ is lower ^dr-carnot
<!-- sr due=2027-01-08 st=review s=188 d=2.1 r=9 l=0 ivl=188 last=2026-07-04T07:52:00Z g=4 -->

entropy change in the free expansion of an ideal gas from $V$ to $2V$
?
irreversible, but $S$ is a state function: use a reversible isothermal path between the same states ($T$ unchanged since $U$ unchanged)
$$\Delta S = \int\frac{dQ}{T} = Nk\ln\frac{V_f}{V_i} = Nk\ln2$$
statistically: each molecule has twice the room, $\Omega\to2^N\Omega$ ^dr-freeexp
<!-- sr due=2026-10-31 st=review s=96 d=4.4 r=8 l=1 ivl=96 last=2026-07-27T19:40:00Z g=3 -->

Fermi energy of a 3D gas of $N$ spin-½ fermions in volume $V$
?
fill a sphere in $k$-space: $2\cdot\frac{V}{(2\pi)^3}\cdot\frac43\pi k_F^3 = N$
$$k_F = (3\pi^2n)^{1/3},\qquad E_F = \frac{\hbar^2}{2m}(3\pi^2n)^{2/3}$$
metals: a few eV, $T_F\sim10^4$–$10^5$ K ^dr-fermi
<!-- sr due=2026-10-31 st=review s=24 d=6.7 r=6 l=1 ivl=24 last=2026-10-07T08:20:00Z g=3 -->

the Stefan–Boltzmann law says blackbody power per area scales as {{c1::$T^4$}}, from $u = \int\hbar\omega\,g(\omega)\,\bar n(\omega)\,d\omega$ with the substitution {{c2::$x = \hbar\omega/kT$}} ^dr-stefan
<!-- sr c1 due=2026-11-12 st=review s=118 d=3.4 r=8 l=0 ivl=118 last=2026-07-17T08:48:00Z g=3 -->
<!-- sr c2 due=2026-10-31 st=review s=46 d=6.1 r=8 l=2 ivl=46 last=2026-09-15T08:06:00Z g=2 -->

Boltzmann entropy {{c1::$S = k\ln\Omega$}}; Gibbs form {{c2::$S = -k\sum_ip_i\ln p_i$}} ^dr-entropy
<!-- sr c1 due=2027-01-26 st=review s=209 d=1.8 r=9 l=0 ivl=209 last=2026-07-01T07:35:00Z g=4 -->
<!-- sr c2 due=2026-11-01 st=review s=12 d=5.8 r=4 l=0 ivl=12 last=2026-10-20T08:22:00Z g=3 -->

## relativity

time dilation from a light clock
?
clock at rest: tick $\Delta t_0 = 2d/c$; moving at $v$, the light travels diagonals
$(c\Delta t/2)^2 = d^2 + (v\Delta t/2)^2$
$$\Delta t = \frac{\Delta t_0}{\sqrt{1 - v^2/c^2}} = \gamma\Delta t_0$$ ^dr-dilation
<!-- sr due=2027-01-03 st=review s=199 d=2 r=10 l=0 ivl=199 last=2026-06-18T08:00:00Z g=4 -->

energy–momentum relation from the four-momentum
?
$p^\mu = (E/c, \mathbf{p}) = m\gamma(c, \mathbf{v})$
invariant: $p^\mu p_\mu = m^2\gamma^2(c^2 - v^2) = m^2c^2$
$$E^2 = p^2c^2 + m^2c^4$$ ^dr-emc
<!-- sr due=2027-01-10 st=review s=172 d=2.3 r=9 l=0 ivl=172 last=2026-07-22T07:48:00Z g=4 -->

Compton shift
?
photon $(E/c,\mathbf{p})$ off electron at rest; conserve four-momentum, square $p_e'^2 = (p_\gamma + p_e - p_\gamma')^2$
$m^2c^2 = m^2c^2 + 2p_\gamma\cdot p_e - 2p_\gamma'\cdot p_e - 2p_\gamma\cdot p_\gamma'$
$$\lambda' - \lambda = \frac{h}{mc}(1 - \cos\theta)$$
$h/m_ec = 2.43$ pm ^dr-compton
<!-- sr due=2026-11-01 st=review s=54 d=6.4 r=9 l=2 ivl=54 last=2026-09-08T08:33:00Z g=3 -->

relativistic Doppler shift for a source receding along the line of sight
?
crests emitted every $\gamma T_0$ in the lab (dilation); source moves $v\gamma T_0$ farther between crests
$$T = \gamma T_0(1 + \beta)\quad\Rightarrow\quad f = f_0\sqrt{\frac{1 - \beta}{1 + \beta}}$$
approaching: flip the sign of $\beta$ ^dr-doppler
<!-- sr st=new -->

## waves and the rest

driven damped oscillator: steady-state amplitude
?
$\ddot x + 2\gamma\dot x + \omega_0^2x = (F_0/m)\cos\omega t$, try $x = \operatorname{Re}\,Ae^{i\omega t}$
$$|A| = \frac{F_0/m}{\sqrt{(\omega_0^2 - \omega^2)^2 + 4\gamma^2\omega^2}}$$
peak at $\omega = \sqrt{\omega_0^2 - 2\gamma^2}$; FWHM of the power resonance $\approx2\gamma$ ^dr-driven
<!-- sr due=2026-10-31 st=review s=6.1 d=7.8 r=6 l=2 ivl=6 last=2026-10-25T08:11:00Z g=2 -->

speed of a transverse wave on a string of tension $\mathcal{T}$, linear density $\mu$
?
small segment $dx$: net vertical force $\mathcal{T}(y'(x+dx) - y'(x)) = \mathcal{T}y''\,dx$
Newton: $\mu\,dx\,\ddot y = \mathcal{T}y''\,dx$
$$v = \sqrt{\mathcal{T}/\mu}$$ ^dr-string
<!-- sr due=2026-12-23 st=review s=144 d=2.6 r=8 l=0 ivl=144 last=2026-08-01T07:57:00Z g=4 -->

two-body problem: why the reduced mass $\mu = m_1m_2/(m_1+m_2)$
?
$m_1\ddot{\mathbf{r}}_1 = \mathbf{F}$, $m_2\ddot{\mathbf{r}}_2 = -\mathbf{F}$; subtract after dividing by the masses
$$\ddot{\mathbf{r}} = \left(\frac{1}{m_1} + \frac{1}{m_2}\right)\mathbf{F}\quad\Longrightarrow\quad\mu\ddot{\mathbf{r}} = \mathbf{F}$$
hydrogen: $\mu = m_e(1 - m_e/m_p + \dots)$ shifts $R_\infty$ to $R_H$ ^dr-reduced
<!-- sr due=2026-12-12 st=review s=126 d=3.1 r=8 l=0 ivl=126 last=2026-08-08T08:40:00Z g=3 -->

Hamilton's equations from the Legendre transform (drill version)
?
$dH = d(p\dot q - L) = \dot q\,dp - \partial_qL\,dq - \partial_tL\,dt$ ($d\dot q$ cancels)
E–L: $\partial_qL = \dot p$
$$\dot q = \frac{\partial H}{\partial p},\qquad\dot p = -\frac{\partial H}{\partial q}$$ ^dr-hamilton
<!-- sr due=2026-10-31 st=review s=12 d=5.1 r=4 l=0 ivl=12 last=2026-10-19T08:41:00Z g=3 -->

Wien's displacement law $\lambda_{\max}T = b$: where does it come from?
?
maximize Planck's $u(\lambda) \propto \lambda^{-5}/(e^{hc/\lambda kT} - 1)$; set $x = hc/\lambda kT$
$\frac{d}{dx}\left[x^5/(e^x - 1)\right] = 0 \Rightarrow 5(1 - e^{-x}) = x$, $x\approx4.965$
$$\lambda_{\max}T = \frac{hc}{4.965\,k}\approx2.9\times10^{-3}\text{ m·K}$$ ^dr-wien
