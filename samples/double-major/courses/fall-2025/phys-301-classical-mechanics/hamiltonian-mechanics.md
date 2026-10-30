---
title: hamiltonian mechanics
course: PHYS 301
lectures: 2025-10-13 to 2025-11-14
read: due=2026-10-29 ivl=14 reps=2 pos=90
---

## the plan

Weeks 6–10. M&I ch. 8–9 and Lindgren's handouts H1–H4. Re-reading this in October 2026 because QM II (Okonkwo) is about to do canonical quantization and the interaction picture, and I want the brackets and generating functions back in my hands first. Re-read notes are marked [2026].

## Legendre transform

Start with a convex function $f(x)$, so $f'' > 0$ and $p = f'(x)$ is monotonic and can be inverted to $x(p)$. The Legendre transform is

$$g(p) = px - f(x)\Big|_{x = x(p)}, \qquad\text{equivalently}\qquad g(p) = \sup_x\,\big(px - f(x)\big).$$

Geometric reading: $g(p)$ is minus the intercept of the tangent line to $f$ with slope $p$. A convex function is determined by its tangent lines just as well as by its points, so no information is lost.

Properties worth remembering:

- $g'(p) = x$. Proof: $dg = x\,dp + p\,dx - f'(x)\,dx = x\,dp$.
- It is an involution: transforming $g$ gives $f$ back.
- The variable that was *passive* in $f$ stays passive: if $f = f(x, y)$ and we transform only in $x$, then $\partial g/\partial y = -\partial f/\partial y$.

Example: $f = \tfrac12 mx^2 \Rightarrow p = mx,\ g = p^2/2m$. That's the whole kinetic-energy story in one line.

Thermodynamics is the same move: $U(S,V) \to F(T,V) = U - TS$ trades $S$ for $T = \partial U/\partial S$ (sign convention there is $f - px$, so $F$ is minus a Legendre transform; same thing). [2026] Stat mech last spring did this five more times; this is where I first saw it.

the Legendre transform of $f(x)$ is $g(p) = {{c1::px - f(x)}}$ with $x$ eliminated through {{c2::$p = f'(x)$}} ^cm-legendre
<!-- sr c1 due=2027-01-10 st=review s=176 d=3 r=10 l=0 ivl=176 last=2026-07-18T08:27:00Z g=3 -->
<!-- sr c2 due=2026-12-29 st=review s=166 d=3.2 r=10 l=0 ivl=166 last=2026-07-16T21:03:00Z g=4 -->

why must $f$ be convex for the Legendre transform to work? :: so $p = f'(x)$ is monotonic and can be inverted for $x(p)$; otherwise one slope belongs to several points ^cm-convex
<!-- sr due=2026-11-12 st=review s=94 d=5.1 r=9 l=1 ivl=94 last=2026-08-10T13:16:00Z g=3 -->

## the Hamiltonian

Given $L(q,\dot q,t)$, define the canonical momenta $p_j = \partial L/\partial\dot q_j$ and Legendre-transform away the velocities:

$$H(q,p,t) = \sum_j p_j\dot q_j - L(q,\dot q,t)\Big|_{\dot q = \dot q(q,p,t)}.$$

The convexity condition is that the Hessian $\partial^2 L/\partial\dot q_i\partial\dot q_j$ be invertible (positive definite for $T$ quadratic). When it isn't, you get constraints in phase space: Dirac's constrained dynamics, gauge theories. Lindgren: "not this course, but remember that it can fail."

### Hamilton's equations

Take the differential of both sides. Left:

$$dH = \sum_j\left(\frac{\partial H}{\partial q_j}dq_j + \frac{\partial H}{\partial p_j}dp_j\right) + \frac{\partial H}{\partial t}dt.$$

Right:

$$d\Big(\sum p\dot q - L\Big) = \sum_j\left(\dot q_j\,dp_j + p_j\,d\dot q_j - \frac{\partial L}{\partial q_j}dq_j - \frac{\partial L}{\partial\dot q_j}d\dot q_j\right) - \frac{\partial L}{\partial t}dt.$$

The $d\dot q$ terms cancel by the definition of $p$ (that's the point of the Legendre transform). Then use E–L, $\partial L/\partial q_j = \dot p_j$, and match coefficients:

$$\dot q_j = \frac{\partial H}{\partial p_j},\qquad \dot p_j = -\frac{\partial H}{\partial q_j},\qquad \frac{\partial H}{\partial t} = -\frac{\partial L}{\partial t}.$$

$2n$ first-order equations instead of $n$ second-order ones. Same content, but now $q$ and $p$ are on an equal footing.

Along a solution, $\dfrac{dH}{dt} = \sum_j\left(\dfrac{\partial H}{\partial q_j}\dot q_j + \dfrac{\partial H}{\partial p_j}\dot p_j\right) + \dfrac{\partial H}{\partial t} = \dfrac{\partial H}{\partial t}$: the sum cancels pairwise. So $H$ is conserved iff it has no explicit time dependence.

**When is $H$ the energy?** When the transformation to generalized coordinates is time-independent (so $T$ is homogeneous quadratic in $\dot q$) and $V$ doesn't depend on velocity. Then Euler's theorem on homogeneous functions gives $\sum\dot q\,\partial T/\partial\dot q = 2T$, so $H = 2T - (T - V) = T + V$. Two separate questions: is $H$ conserved ($\partial_t H = 0$?) and is $H = E$ (scleronomic?). The rotating hoop is the standard case where $H$ is conserved and is not $E$:

$$H_{\text{hoop}} = \frac{p_\theta^2}{2mR^2} - \tfrac12 mR^2\omega^2\sin^2\theta - mgR\cos\theta.$$

derive Hamilton's equations from $H = \sum p\dot q - L$
?
$dH = \sum(\dot q\,dp + p\,d\dot q - \partial_q L\,dq - \partial_{\dot q}L\,d\dot q) - \partial_t L\,dt$
the $d\dot q$ terms cancel because $p = \partial L/\partial\dot q$; use E–L: $\partial_q L = \dot p$
so $dH = \sum(\dot q\,dp - \dot p\,dq) - \partial_t L\,dt$; compare with $dH = \sum(\partial_q H\,dq + \partial_p H\,dp) + \partial_t H\,dt$
$\dot q = \partial H/\partial p$, $\dot p = -\partial H/\partial q$, $\partial_t H = -\partial_t L$ ^cm-hameqs
<!-- sr due=2027-01-25 st=review s=201 d=3.6 r=12 l=0 ivl=201 last=2026-07-08T07:41:00Z g=4 -->

when does the Hamiltonian equal the total energy $T+V$?
?
when the coordinates are related to Cartesian ones without explicit time dependence (so $T$ is homogeneous quadratic in $\dot q$) and $V$ is velocity-independent
then Euler's theorem gives $\sum\dot q\,\partial T/\partial\dot q = 2T$ and $H = T + V$
conservation is a separate question: $dH/dt = \partial H/\partial t$ ^cm-h-energy
<!-- sr due=2026-10-29 st=review s=84 d=6 r=13 l=2 ivl=84 last=2026-08-06T09:48:00Z g=3 -->

### examples

**Harmonic oscillator.** $L = \tfrac12 m\dot x^2 - \tfrac12 m\omega^2x^2$, $p = m\dot x$, $H = p^2/2m + \tfrac12 m\omega^2x^2$. Equations: $\dot x = p/m$, $\dot p = -m\omega^2 x$. Phase portrait: ellipses $H = E$, semi-axes $\sqrt{2E/m\omega^2}$ and $\sqrt{2mE}$, enclosed area $\pi\sqrt{2E/m\omega^2}\sqrt{2mE} = 2\pi E/\omega$.

**Central force, polar coordinates.** $L = \tfrac12 m(\dot r^2 + r^2\dot\theta^2) - V(r)$. $p_r = m\dot r$, $p_\theta = mr^2\dot\theta$.

$$H = \frac{p_r^2}{2m} + \frac{p_\theta^2}{2mr^2} + V(r).$$

$\theta$ is cyclic, $\dot p_\theta = 0$. The $r$ equation $\dot p_r = p_\theta^2/(mr^3) - V'(r)$ is the effective-potential problem (see the orbits note).

**Charged particle.** From $L = \tfrac12 mv^2 - q\phi + q\mathbf{v}\cdot\mathbf{A}$: $\mathbf{p} = m\mathbf{v} + q\mathbf{A}$ (canonical momentum, not gauge invariant), and

$$H = \frac{(\mathbf{p} - q\mathbf{A})^2}{2m} + q\phi.$$

Minimal coupling. Numerically $H$ is still $\tfrac12 mv^2 + q\phi$ (magnetic forces do no work), but as a function of the canonical variables it's not $p^2/2m + q\phi$. [2026] This is literally the Hamiltonian Okonkwo wrote down on Monday for the Landau levels. Good thing I'm re-reading.

the Hamiltonian of a charge $q$ in potentials $(\phi,\mathbf{A})$ is $H = {{c1::\dfrac{(\mathbf{p}-q\mathbf{A})^2}{2m} + q\phi}}$ ^cm-minimal
<!-- sr due=2027-02-12 st=review s=112 d=4.8 r=11 l=1 ivl=112 last=2026-10-23T18:34:00Z g=3 -->

### modified Hamilton's principle

$\delta\int_{t_1}^{t_2}\left(\sum p_j\dot q_j - H(q,p,t)\right)dt = 0$ with $q$ and $p$ varied *independently* and $\delta q = 0$ at the ends. Varying $p$: $\dot q = \partial H/\partial p$. Varying $q$ (integrate $p\,\delta\dot q$ by parts): $\dot p = -\partial H/\partial q$. This is the version canonical transformations are built on: two integrands that differ by a total derivative give the same equations.

## Poisson brackets

For functions $f(q,p,t)$, $g(q,p,t)$:

$$\{f,g\} = \sum_j\left(\frac{\partial f}{\partial q_j}\frac{\partial g}{\partial p_j} - \frac{\partial f}{\partial p_j}\frac{\partial g}{\partial q_j}\right).$$

(Sign convention: M&I and Lindgren have $q$ first. Some books have the opposite. Check before trusting any formula from outside the course.)

Time evolution of any phase-space function along a trajectory:

$$\frac{df}{dt} = \sum_j\left(\frac{\partial f}{\partial q_j}\dot q_j + \frac{\partial f}{\partial p_j}\dot p_j\right) + \frac{\partial f}{\partial t} = \{f, H\} + \frac{\partial f}{\partial t}.$$

So a quantity with no explicit $t$ is conserved iff it Poisson-commutes with $H$. Hamilton's equations themselves are $\dot q_j = \{q_j,H\}$, $\dot p_j = \{p_j,H\}$.

**Fundamental brackets.** $\{q_i,q_j\} = 0$, $\{p_i,p_j\} = 0$, $\{q_i,p_j\} = \delta_{ij}$.

**Algebra.** Antisymmetric, bilinear, Leibniz $\{fg,h\} = f\{g,h\} + \{f,h\}g$, and the Jacobi identity

$$\{f,\{g,h\}\} + \{g,\{h,f\}\} + \{h,\{f,g\}\} = 0.$$

(So phase-space functions form a Lie algebra under the bracket.)

**Poisson's theorem.** If $f$ and $g$ are conserved (no explicit $t$), so is $\{f,g\}$. Proof: Jacobi with $h = H$. Usually gives nothing new, occasionally gives a new integral.

**Angular momentum.** $L_z = xp_y - yp_x$. Then $\{x, L_z\} = \partial L_z/\partial p_x = -y$, $\{y, L_z\} = x$, $\{z, L_z\} = 0$; in general $\{x_i, L_j\} = \epsilon_{ijk}x_k$, and the same for $p$. And

$$\{L_i, L_j\} = \epsilon_{ijk}L_k.$$

Consequence via Poisson's theorem: if $L_x$ and $L_y$ are conserved, so is $L_z$. And $\{L^2, L_i\} = 0$. Same algebra as $[\hat L_i,\hat L_j] = i\hbar\epsilon_{ijk}\hat L_k$, and that's no accident: Dirac's rule $\{f,g\} \to \frac{1}{i\hbar}[\hat f,\hat g]$. [2026] Okonkwo said this rule fails in general (Groenewold–van Hove: no consistent quantization of all polynomials), works for the ones we care about.

time evolution of a phase-space function $f(q,p,t)$ in Poisson-bracket form :: $\dfrac{df}{dt} = \{f,H\} + \dfrac{\partial f}{\partial t}$ ^cm-pb-evol
<!-- sr due=2027-01-08 st=review s=168 d=3.3 r=11 l=0 ivl=168 last=2026-07-24T08:02:00Z g=3 -->

$\{L_i, L_j\} = {{c1::\epsilon_{ijk}L_k}}$ ^cm-pb-L
<!-- sr due=2026-12-25 st=review s=128 d=4.4 r=10 l=1 ivl=128 last=2026-08-19T09:20:00Z g=3 -->

with the convention $\{f,g\} = \sum(\partial_q f\,\partial_p g - \partial_p f\,\partial_q g)$, what is $\{x, L_z\}$? :: $-y$ (in general $\{x_i, L_j\} = \epsilon_{ijk}x_k$) ^cm-pb-xL
<!-- sr due=2026-10-27 st=review s=21 d=8.1 r=13 l=4 ivl=21 last=2026-10-06T19:55:00Z g=3 -->

state Poisson's theorem and say how it's proved :: if $f$ and $g$ are constants of the motion (no explicit $t$), so is $\{f,g\}$; Jacobi identity with $H$ as the third function ^cm-poisson-thm
<!-- sr due=2026-11-10 st=review s=143 d=3.9 r=9 l=0 ivl=143 last=2026-06-20T07:36:00Z g=3 -->

## canonical transformations

A change of phase-space variables $(q,p) \to (Q(q,p,t), P(q,p,t))$ is **canonical** if the equations in the new variables are again Hamilton's, with some new $K(Q,P,t)$. Point transformations $Q = Q(q,t)$ are a special case, but now $q$ and $p$ can be mixed: position and momentum stop being separate kinds of thing.

Condition, from the modified Hamilton's principle: both integrands must give the same extremals, which they do if they differ by a total derivative:

$$\sum p\dot q - H = \sum P\dot Q - K + \frac{dF}{dt}.$$

$F$ is the **generating function**. It must depend on one old and one new variable (half and half), so there are four basic types.

**Type 1**, $F_1(q,Q,t)$: expand $dF_1/dt$ and match coefficients of $\dot q$ and $\dot Q$:

$$p = \frac{\partial F_1}{\partial q},\qquad P = -\frac{\partial F_1}{\partial Q},\qquad K = H + \frac{\partial F_1}{\partial t}.$$

**Type 2**, $F_2(q,P,t) = F_1 + QP$ (a Legendre transform of $F_1$ in $Q$):

$$p = \frac{\partial F_2}{\partial q},\qquad Q = \frac{\partial F_2}{\partial P},\qquad K = H + \frac{\partial F_2}{\partial t}.$$

**Type 3**, $F_3(p,Q,t)$: $q = -\partial F_3/\partial p$, $P = -\partial F_3/\partial Q$.

**Type 4**, $F_4(p,P,t)$: $q = -\partial F_4/\partial p$, $Q = \partial F_4/\partial P$.

In every case $K = H + \partial F/\partial t$. My mnemonic: the derivative with respect to an *old* variable gives the old partner with a $+$ if it's $q$ (i.e. $p = +\partial_q F$) and a $-$ if it's $p$; new variables the opposite. Lindgren's mnemonic was "derive it from the total-derivative condition every time; it takes 30 seconds." He's right, the mnemonic failed me on the final.

**Standard examples.**

- $F_2 = \sum q_iP_i$: identity. $p = P$, $Q = q$.
- $F_2 = \sum f_i(q,t)P_i$: point transformation $Q_i = f_i(q,t)$, with $p_j = \sum_i P_i\,\partial f_i/\partial q_j$ (momenta transform with the transposed Jacobian).
- $F_1 = qQ$: $p = Q$, $P = -q$. Exchanges coordinates and momenta (up to a sign). This is the cleanest demonstration that "coordinate" and "momentum" are labels, not essences.

**Test for canonicity** without a generating function: $\{Q,P\}_{q,p} = 1$ (one dof), or in general the fundamental brackets are preserved. Equivalently the Jacobian $M = \partial(Q,P)/\partial(q,p)$ is symplectic, $M^TJM = J$.

### the oscillator, solved by a canonical transformation

Want new variables in which $H$ is cyclic. Try

$$F_1(q,Q) = \tfrac12 m\omega q^2\cot Q.$$

Then $p = \partial F_1/\partial q = m\omega q\cot Q$ and $P = -\partial F_1/\partial Q = \dfrac{m\omega q^2}{2\sin^2 Q}$. Solve:

$$q = \sqrt{\frac{2P}{m\omega}}\sin Q,\qquad p = \sqrt{2m\omega P}\cos Q.$$

Substitute into $H = p^2/2m + \tfrac12 m\omega^2q^2$:

$$K = \omega P\cos^2 Q + \omega P\sin^2 Q = \omega P.$$

$Q$ is cyclic, so $P$ is constant ($P = E/\omega$), and $\dot Q = \partial K/\partial P = \omega$, so $Q = \omega t + \phi_0$. Back-substitute and you have the solution without ever solving a differential equation. $P$ here is the action variable $J = \frac{1}{2\pi}\oint p\,dq$ (area of the ellipse $2\pi E/\omega$, divided by $2\pi$) and $Q$ the angle. [2026] Action-angle variables are where the old quantum theory came from: Bohr–Sommerfeld $J = n\hbar$ gives $E = n\hbar\omega$, off by the zero-point $\tfrac12\hbar\omega$.

the generating-function relations for a type-2 function $F_2(q,P,t)$
?
$p = \partial F_2/\partial q$
$Q = \partial F_2/\partial P$
$K = H + \partial F_2/\partial t$
from $\sum p\dot q - H = -\sum Q\dot P - K + \tfrac{d}{dt}F_2$ (i.e. $F_2 = F_1 + QP$) ^cm-f2
<!-- sr due=2026-10-30 st=review s=69 d=6.6 r=14 l=3 ivl=69 last=2026-08-22T08:41:00Z g=3 -->

the generating function $F_1 = qQ$ produces {{c1::$p = Q$, $P = -q$: coordinates and momenta exchanged}} ^cm-exchange
<!-- sr due=2026-11-11 st=review s=134 d=4 r=9 l=0 ivl=134 last=2026-06-30T13:40:00Z g=3 -->

which type-1 generating function makes the harmonic oscillator Hamiltonian cyclic, and what is the new Hamiltonian?
?
$F_1 = \tfrac12 m\omega q^2\cot Q$
gives $q = \sqrt{2P/m\omega}\,\sin Q$, $p = \sqrt{2m\omega P}\,\cos Q$
$K = \omega P$, so $P = E/\omega$ is constant and $Q = \omega t + \phi_0$ ^cm-sho-ct
<!-- sr due=2026-12-27 st=review s=97 d=5.4 r=11 l=1 ivl=97 last=2026-09-21T16:22:00Z g=3 -->

a transformation $(q,p)\to(Q,P)$ with one degree of freedom is canonical iff {{c1::$\{Q,P\}_{q,p} = 1$}} ^cm-canon-test
<!-- sr due=2026-10-31 st=review s=152 d=3.5 r=10 l=0 ivl=152 last=2026-06-01T08:10:00Z g=3 -->

### infinitesimal canonical transformations

Take $F_2 = \sum q_iP_i + \epsilon\,G(q,P)$, close to the identity. To first order in $\epsilon$:

$$\delta q_i = Q_i - q_i = \epsilon\frac{\partial G}{\partial p_i},\qquad \delta p_i = P_i - p_i = -\epsilon\frac{\partial G}{\partial q_i},$$

so for any function $\delta f = \epsilon\{f, G\}$. $G$ is the **generator**. Examples: $G = p$ generates translations in $q$; $G = L_z$ generates rotations about $z$; $G = H$ with $\epsilon = dt$ generates the motion itself. Time evolution is a canonical transformation, continuously unfolding.

Noether, Hamiltonian version: the change of $H$ under the flow of $G$ is $\delta H = \epsilon\{H, G\} = -\epsilon\,\dot G$ (for $G$ with no explicit $t$). So **$H$ is invariant under the transformation generated by $G$ if and only if $G$ is conserved.** Symmetry and conservation are literally the same bracket, read in two directions. This is the cleanest statement of Noether I know. [2026] And in QM it's $[\hat H,\hat G] = 0$. Same sentence.

an infinitesimal canonical transformation generated by $G$ changes any phase-space function by {{c1::$\delta f = \epsilon\{f, G\}$}} ^cm-generator
<!-- sr due=2027-01-09 st=review s=79 d=5.7 r=10 l=1 ivl=79 last=2026-10-22T20:45:00Z g=3 -->

why is "$H$ invariant under the flow of $G$" the same statement as "$G$ is conserved"? :: $\delta H = \epsilon\{H,G\} = -\epsilon\{G,H\} = -\epsilon\,\dot G$ for $G$ with no explicit $t$, so one vanishes iff the other does ^cm-noether-pb
<!-- sr due=2026-12-15 st=review s=56 d=6.2 r=8 l=1 ivl=56 last=2026-10-20T07:55:00Z g=3 -->

## phase space and Liouville's theorem

Phase space: the $2n$-dimensional space of $(q,p)$. Hamilton's equations define a vector field on it, $\mathbf{v} = (\dot q, \dot p) = (\partial H/\partial p, -\partial H/\partial q)$, and through each point passes exactly one trajectory (first-order ODE, uniqueness), so trajectories never cross. Contrast configuration space, where paths cross all the time.

**Liouville's theorem.** The flow preserves phase-space volume. Proof: the divergence of the phase velocity is

$$\nabla\cdot\mathbf{v} = \sum_j\left(\frac{\partial\dot q_j}{\partial q_j} + \frac{\partial\dot p_j}{\partial p_j}\right) = \sum_j\left(\frac{\partial^2 H}{\partial q_j\,\partial p_j} - \frac{\partial^2 H}{\partial p_j\,\partial q_j}\right) = 0.$$

An incompressible flow preserves volume. Alternatively: time evolution is a canonical transformation and canonical transformations have unit Jacobian determinant ($\det M = 1$ from $M^TJM = J$).

For an ensemble described by a density $\rho(q,p,t)$: conservation of ensemble members gives $\partial_t\rho + \nabla\cdot(\rho\mathbf{v}) = 0$, and with $\nabla\cdot\mathbf{v} = 0$,

$$\frac{d\rho}{dt} = \frac{\partial\rho}{\partial t} + \{\rho, H\} = 0.$$

The density is constant along trajectories: the phase fluid is incompressible. Equilibrium ensembles need $\{\rho,H\} = 0$, so $\rho = \rho(H)$ (or of other conserved quantities). That's the microcanonical and canonical ensembles, $\rho \propto \delta(H - E)$ and $\rho \propto e^{-H/kT}$. [2026] Stat mech spring 2026 started exactly here, and I'd forgotten it was proved in 301.

**Example (free particles).** Ensemble of free particles in 1D, initial square $x\in[0,a]$, $p\in[0,b]$. After time $t$, $x \to x + pt/m$, $p \to p$: the square shears into a parallelogram, same base, same height, same area $ab$. Spreading in $x$ is paid for by correlation between $x$ and $p$, not by loss of area.

**Example (damped oscillator).** Not Hamiltonian in the usual variables; phase area shrinks like $e^{-\gamma t}$ and everything collapses to the origin (an attractor). Liouville rules out attractors in Hamiltonian systems.

Consequences Lindgren listed:

1. No attractors, no limit cycles in Hamiltonian flow.
2. Poincaré recurrence: a bounded Hamiltonian system returns arbitrarily close to its initial state (volume preservation in a finite region).
3. You can't compress a beam in phase space with conservative fields (beam emittance; why stochastic cooling won a Nobel).

prove Liouville's theorem from Hamilton's equations
?
the phase-space velocity is $\mathbf{v} = (\partial H/\partial p,\ -\partial H/\partial q)$
$$\nabla\cdot\mathbf{v} = \sum_j\left(\frac{\partial^2 H}{\partial q_j\partial p_j} - \frac{\partial^2 H}{\partial p_j\partial q_j}\right) = 0$$
divergence-free flow preserves volume; for a density, continuity plus $\nabla\cdot\mathbf{v} = 0$ gives $d\rho/dt = \partial_t\rho + \{\rho,H\} = 0$ ^cm-liouville
<!-- sr due=2027-01-19 st=review s=109 d=4.9 r=12 l=1 ivl=109 last=2026-10-02T08:18:00Z g=3 -->

a stationary ensemble must satisfy {{c1::$\{\rho, H\} = 0$}}, so $\rho$ is a function of the conserved quantities, e.g. {{c2::$\rho(H)$}} ^cm-stationary
<!-- sr c1 due=2026-12-09 st=review s=87 d=5.2 r=9 l=1 ivl=87 last=2026-09-13T09:35:00Z g=3 -->
<!-- sr c2 due=2026-11-29 st=review s=72 d=5.5 r=9 l=1 ivl=72 last=2026-09-18T19:12:00Z g=3 sus=1 -->

why can't a Hamiltonian system have an attractor? :: Liouville: the flow preserves phase-space volume, so a region can't shrink onto a point or a cycle ^cm-attractor
<!-- sr due=2026-12-02 st=review s=161 d=2.8 r=8 l=0 ivl=161 last=2026-06-24T13:02:00Z g=4 -->

[2026] Stopped re-reading here on 10/15. Rest to finish next pass: the Hamilton–Jacobi bit below was the last lecture before Thanksgiving and I barely typed it up.

## Hamilton–Jacobi (sketch, lec. 2025-11-14)

Look for a type-2 transformation to $K = 0$; then all new variables are constant. Condition: $H(q, \partial S/\partial q, t) + \partial S/\partial t = 0$ for $S = F_2(q, P, t)$. $S$ is Hamilton's principal function, and $dS/dt = L$ along a path: it's the action as a function of the endpoint. For time-independent $H$: $S = W(q,P) - Et$, $H(q,\partial W/\partial q) = E$. Separation of variables works for the Kepler problem in spherical coordinates. [2026] Okonkwo: WKB is $\psi \sim e^{iS/\hbar}$ with this $S$. Need to redo this properly; the handout H4 is in the binder.
