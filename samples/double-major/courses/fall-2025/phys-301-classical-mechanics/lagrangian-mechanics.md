---
title: lagrangian mechanics
course: PHYS 301
lectures: 2025-09-03 to 2025-10-10
---

# Lagrangian mechanics

typed up from the notebook, lec 1–14. M&I ch. 6–7.

## Lec 1–2: generalized coordinates

**Def.** A system of $N$ point particles has $3N$ Cartesian coordinates. Constraints cut that down. If the constraints can be written as $k$ equations $f_a(\mathbf{r}_1,\dots,\mathbf{r}_N,t)=0$ they are *holonomic* and we can eliminate $k$ coordinates, leaving $n = 3N-k$ independent *generalized coordinates* $q_1,\dots,q_n$. The space they live in is configuration space, an $n$-dimensional manifold, not necessarily $\mathbb{R}^n$ (the plane pendulum's configuration space is a circle; the double pendulum's is a torus).

The $q$'s don't have to be lengths. Angles, normal-mode amplitudes, anything that pins down the configuration uniquely and with no redundancy. Each Cartesian position becomes a function $\mathbf{r}_i = \mathbf{r}_i(q_1,\dots,q_n,t)$; the explicit $t$ is there when the constraints move (bead on a rotating hoop, pendulum with an oscillating pivot).

- dof :: 3N − k
- holonomic :: constraint is f(q,t) = 0
- scleronomic :: no explicit t

[the three above were my first cards, a list typed in week 1. the rest of these notes keep a card per paragraph, which is the habit I fell into.]

Kinds of constraint, Lindgren's taxonomy:

- **holonomic**: $f(q,t)=0$. Bead on wire, rigid body (distances fixed), pendulum rod.
- **scleronomic** vs **rheonomic**: no explicit time dependence vs explicit time dependence. A hoop spinning at fixed $\omega$ is rheonomic even though the bead's equation looks innocent.
- **nonholonomic**: anything else. Inequalities ($r \ge a$, a particle outside a sphere) or non-integrable velocity relations (a disk rolling without slipping on a plane: $\dot x = a\dot\phi\cos\theta$, $\dot y = a\dot\phi\sin\theta$, which can't be integrated to a relation among $x,y,\phi,\theta$).

Why the rolling disk is nonholonomic, his argument: you can get from any $(x,y,\theta,\phi)$ to any other by rolling and turning, so there's no surface $f=0$ in configuration space the motion is confined to. But the velocities are constrained at every point. Constraint on velocities without a constraint on positions. Rolling along a straight line (1D) is holonomic: $x = a\phi + \text{const}$.

a rolling disk on a plane is nonholonomic because its velocity constraint {{c1::cannot be integrated into a relation among the coordinates}}: every configuration is reachable ^cm-roll
<!-- sr due=2026-11-07 st=review s=96 d=5.2 r=12 l=1 ivl=96 last=2026-08-03T19:22:00Z g=3 -->

## Lec 3–4: virtual work and d'Alembert

**Virtual displacement** $\delta\mathbf{r}_i$: an infinitesimal change of configuration consistent with the constraints *at a fixed instant* ($\delta t = 0$). Compare the real displacement $d\mathbf{r}_i$ in time $dt$, which also feels the constraints moving. On the rotating hoop the real displacement has a component along the hoop's motion; the virtual one is tangent to the hoop frozen at time $t$.

$$\delta\mathbf{r}_i = \sum_j \frac{\partial \mathbf{r}_i}{\partial q_j}\,\delta q_j \qquad (\text{no } \partial_t \text{ term})$$

Ideal (workless) constraints: the constraint forces do no virtual work, $\sum_i \mathbf{F}^{(c)}_i\cdot\delta\mathbf{r}_i = 0$. True for frictionless surfaces (normal force ⟂ allowed motion), rigid rods, rolling without slipping (contact point instantaneously at rest). Not true for sliding friction, which is why friction has to be put in by hand as a generalized force.

Newton: $\mathbf{F}_i = \dot{\mathbf{p}}_i$ with $\mathbf{F}_i = \mathbf{F}^{(a)}_i + \mathbf{F}^{(c)}_i$ (applied + constraint). Dot with $\delta\mathbf{r}_i$, sum, drop the constraint part:

$$\sum_i \left(\mathbf{F}^{(a)}_i - \dot{\mathbf{p}}_i\right)\cdot\delta\mathbf{r}_i = 0$$

This is **d'Alembert's principle**. The point: the constraint forces are gone, and they're the forces we usually don't know.

Now turn it into generalized coordinates. Define the **generalized force**

$$Q_j = \sum_i \mathbf{F}^{(a)}_i\cdot\frac{\partial\mathbf{r}_i}{\partial q_j}$$

(dimension of force × length / [q]; for an angle it's a torque.)

The inertial term needs two identities. Both are just the chain rule but I kept getting them backwards so writing them out:

1. "cancellation of dots": $\dot{\mathbf{r}}_i = \sum_j \frac{\partial\mathbf{r}_i}{\partial q_j}\dot q_j + \frac{\partial\mathbf{r}_i}{\partial t}$, so $\frac{\partial\dot{\mathbf{r}}_i}{\partial\dot q_j} = \frac{\partial\mathbf{r}_i}{\partial q_j}$.
2. $\frac{d}{dt}\frac{\partial\mathbf{r}_i}{\partial q_j} = \frac{\partial\dot{\mathbf{r}}_i}{\partial q_j}$ (mixed partials commute).

Then

$$\sum_i \dot{\mathbf{p}}_i\cdot\frac{\partial\mathbf{r}_i}{\partial q_j} = \sum_i m_i\left[\frac{d}{dt}\left(\dot{\mathbf{r}}_i\cdot\frac{\partial\dot{\mathbf{r}}_i}{\partial\dot q_j}\right) - \dot{\mathbf{r}}_i\cdot\frac{\partial\dot{\mathbf{r}}_i}{\partial q_j}\right] = \frac{d}{dt}\frac{\partial T}{\partial\dot q_j} - \frac{\partial T}{\partial q_j}$$

with $T = \sum_i \tfrac12 m_i\dot{\mathbf{r}}_i^2$. So d'Alembert becomes

$$\sum_j\left[\frac{d}{dt}\frac{\partial T}{\partial\dot q_j} - \frac{\partial T}{\partial q_j} - Q_j\right]\delta q_j = 0.$$

Holonomic constraints ⇒ the $\delta q_j$ are independent ⇒ each bracket vanishes. If the applied forces come from a potential $V(q,t)$, $Q_j = -\partial V/\partial q_j$, and since $V$ doesn't depend on $\dot q$ we can pull it inside: with $L = T - V$,

$$\frac{d}{dt}\frac{\partial L}{\partial\dot q_j} - \frac{\partial L}{\partial q_j} = 0.$$

Prof. said the derivation from d'Alembert is on the midterm, the variational one is not. (It was. Both were.)

why do the constraint forces drop out of d'Alembert's principle?
?
ideal constraints do no virtual work: $\sum_i \mathbf{F}^{(c)}_i\cdot\delta\mathbf{r}_i = 0$ for displacements consistent with the constraints at fixed $t$
so only the applied forces and the inertial terms survive ^cm-dalem
<!-- sr due=2026-12-05 st=review s=131 d=4.4 r=10 l=0 ivl=131 last=2026-07-27T08:15:00Z g=3 -->

the "cancellation of dots" identity is $\dfrac{\partial\dot{\mathbf{r}}_i}{\partial\dot q_j} = {{c1::\dfrac{\partial\mathbf{r}_i}{\partial q_j}}}$ ^cm-dots
<!-- sr due=2026-12-21 st=review s=118 d=4.9 r=11 l=1 ivl=118 last=2026-08-25T21:10:00Z g=3 -->

**Velocity-dependent potentials.** The derivation goes through if $Q_j = -\partial U/\partial q_j + \frac{d}{dt}\partial U/\partial\dot q_j$ for some $U(q,\dot q,t)$. Lorentz force is the one example that matters: $U = q\phi - q\,\mathbf{v}\cdot\mathbf{A}$, so

$$L = \tfrac12 mv^2 - q\phi + q\,\mathbf{v}\cdot\mathbf{A}.$$

#TODO: check sign — did it on the board as $+q\mathbf{v}\cdot\mathbf{A}$, Marsh & Ilves has it the same, ok. (checked, 2025-09-20)

## Lec 5–6: Hamilton's principle

Second route, which Lindgren clearly prefers. Define the **action** $S[q] = \int_{t_1}^{t_2} L(q,\dot q,t)\,dt$, a functional on paths with fixed endpoints $q(t_1)=q_1$, $q(t_2)=q_2$. Hamilton's principle: the physical path makes $S$ stationary.

Derivation of Euler–Lagrange. Vary $q(t) \to q(t) + \epsilon\,\eta(t)$ with $\eta(t_1)=\eta(t_2)=0$:

$$\delta S = \epsilon\int_{t_1}^{t_2}\left(\frac{\partial L}{\partial q}\eta + \frac{\partial L}{\partial\dot q}\dot\eta\right)dt.$$

Integrate the second term by parts:

$$\int \frac{\partial L}{\partial\dot q}\dot\eta\,dt = \left[\frac{\partial L}{\partial\dot q}\eta\right]_{t_1}^{t_2} - \int\frac{d}{dt}\frac{\partial L}{\partial\dot q}\,\eta\,dt.$$

Boundary term dies because $\eta$ vanishes at the ends. So

$$\delta S = \epsilon\int_{t_1}^{t_2}\left(\frac{\partial L}{\partial q} - \frac{d}{dt}\frac{\partial L}{\partial\dot q}\right)\eta(t)\,dt = 0 \quad\text{for all }\eta.$$

Fundamental lemma of the calculus of variations: if $\int g\eta = 0$ for every smooth $\eta$ vanishing at the endpoints and $g$ is continuous, then $g\equiv 0$. (Proof sketch: if $g(t_0)>0$, pick $\eta$ a bump around $t_0$.) Hence E–L. Several coordinates: vary each independently.

Things he wanted us to get:

1. *Stationary*, not least. For short enough time intervals it's a minimum; past the first conjugate point (kinetic focus) it's a saddle. Harmonic oscillator: paths longer than half a period aren't minima. [ask in OH about conjugate points — asked, he said "Jacobi accessory equation, not on the exam."]
2. The Lagrangian is not unique. $L' = L + \frac{d}{dt}F(q,t)$ gives the same EOM because $\int \dot F\,dt = F(q_2,t_2) - F(q_1,t_1)$ is fixed by the endpoints, so its variation is zero.
3. E–L is coordinate-free in the sense that if you change $q \to Q(q,t)$ the equations in $Q$ are again E–L with $L$ rewritten. Newton's equations don't have that property in curvilinear coordinates (you have to fish out the fictitious forces by hand).

derive the Euler–Lagrange equation from Hamilton's principle (one coordinate)
?
vary $q \to q + \epsilon\eta$, $\eta(t_1)=\eta(t_2)=0$: $\delta S = \epsilon\int(\partial_q L\,\eta + \partial_{\dot q}L\,\dot\eta)\,dt$
integrate the $\dot\eta$ term by parts; boundary term vanishes since $\eta=0$ at ends
$\delta S = \epsilon\int\left(\partial_q L - \tfrac{d}{dt}\partial_{\dot q}L\right)\eta\,dt = 0$ for all $\eta$
fundamental lemma ⇒ $\tfrac{d}{dt}\partial_{\dot q}L - \partial_q L = 0$ ^cm-el
<!-- sr due=2027-01-14 st=review s=184 d=3.9 r=13 l=1 ivl=184 last=2026-07-14T09:31:00Z g=3 -->

why does adding $dF(q,t)/dt$ to $L$ leave the equations of motion unchanged? :: its integral is $F(q_2,t_2)-F(q_1,t_1)$, fixed by the endpoints, so it contributes nothing to $\delta S$ ^cm-gauge
<!-- sr due=2027-01-02 st=review s=74 d=5.8 r=12 l=2 ivl=74 last=2026-10-20T17:45:00Z g=3 -->

## Lec 7–8: constraints and Lagrange multipliers

Sometimes you *want* the constraint force (the tension, the normal force, whether the bead leaves the surface), or the coordinates that kill the constraint are ugly. Then: keep the redundant coordinates and enforce the constraint with a multiplier.

For holonomic $f(q,t)=0$: the $\delta q_j$ are no longer independent, they satisfy $\sum_j \frac{\partial f}{\partial q_j}\delta q_j = 0$. Add $\lambda(t)$ times this to the d'Alembert sum and choose $\lambda$ to kill one bracket; then the rest are independent. Result:

$$\frac{d}{dt}\frac{\partial L}{\partial\dot q_j} - \frac{\partial L}{\partial q_j} = \lambda\frac{\partial f}{\partial q_j}, \qquad j = 1,\dots,n$$

plus $f = 0$ itself: $n+1$ equations for $n$ unknown functions $q_j$ and one $\lambda$. Equivalent shortcut: extremize $\int (L + \lambda f)\,dt$ treating $\lambda$ as another coordinate. Several constraints → one $\lambda_a$ each.

The **generalized constraint force** is $Q^{(c)}_j = \sum_a \lambda_a\,\partial f_a/\partial q_j$.

**Example (simple pendulum, tension).** Polar coordinates $(r,\theta)$, $\theta$ from the downward vertical, constraint $f = r - \ell = 0$.

$$L = \tfrac12 m(\dot r^2 + r^2\dot\theta^2) + mgr\cos\theta$$

$r$-equation: $m\ddot r - mr\dot\theta^2 - mg\cos\theta = \lambda$.
$\theta$-equation: $\frac{d}{dt}(mr^2\dot\theta) + mgr\sin\theta = 0$.

Impose $r=\ell$: $\ddot\theta = -(g/\ell)\sin\theta$, the usual, and

$$\lambda = -m\ell\dot\theta^2 - mg\cos\theta.$$

$\partial f/\partial r = +1$ so $\lambda$ is the outward radial force; it's negative, i.e. the rod pulls inward with tension $T = m\ell\dot\theta^2 + mg\cos\theta$. Sanity: at the bottom ($\theta = 0$) $T = mg + mv^2/\ell$. ✓

the Lagrange-multiplier form of E–L for a constraint $f(q,t)=0$ is $\dfrac{d}{dt}\dfrac{\partial L}{\partial\dot q_j} - \dfrac{\partial L}{\partial q_j} = {{c1::\lambda\dfrac{\partial f}{\partial q_j}}}$ ^cm-lagmult
<!-- sr due=2026-10-30 st=review s=4.1 d=9.4 r=15 l=5 ivl=4 last=2026-10-26T20:02:00Z g=3 -->

[that one is a leech. five lapses. it's always the sign — I write $-\lambda$, or put $\lambda$ on the wrong side. the fix is understanding that the sign of $\lambda$ is a convention and the *force* $\lambda\,\partial f/\partial q$ comes out right either way as long as the constraint term is on the right side with a plus. maybe the card should ask for that instead.]

**Example (particle sliding off a hemisphere).** Particle on top of a frictionless hemisphere radius $a$, starts at rest (nudged). Coordinates $(r,\theta)$, $\theta$ from the top, $f = r - a$. $L = \tfrac12 m(\dot r^2 + r^2\dot\theta^2) - mgr\cos\theta$. Radial: $m\ddot r - mr\dot\theta^2 + mg\cos\theta = \lambda$. On the surface: $\lambda = mg\cos\theta - ma\dot\theta^2$ = normal force (outward, so positive while in contact). Energy: $\tfrac12 ma^2\dot\theta^2 = mga(1-\cos\theta)$, so $a\dot\theta^2 = 2g(1-\cos\theta)$ and

$$\lambda = mg(3\cos\theta - 2).$$

Leaves the surface when $\lambda = 0$: $\cos\theta = 2/3$, $\theta \approx 48.2°$. Classic. Note it doesn't depend on $m$, $a$, or $g$.

a particle released from rest at the top of a frictionless hemisphere leaves the surface where {{c1::$\cos\theta = 2/3$}} (normal force $mg(3\cos\theta-2)$) ^cm-hemi
<!-- sr due=2026-11-24 st=review s=158 d=3.1 r=9 l=0 ivl=158 last=2026-06-19T07:50:00Z g=4 -->

## Lec 8 (cont.): moving supports, and the total-derivative trick

**Bead on a rotating rod.** Straight frictionless rod in a horizontal plane, spun about one end at fixed $\omega$. One coordinate $r$ (distance along the rod). $T = \tfrac12 m(\dot r^2 + r^2\omega^2)$, $V = 0$ (horizontal). E–L: $\ddot r = \omega^2 r$, so $r(t) = A\cosh\omega t + B\sinh\omega t$ and the bead flies off exponentially. If you want the force the rod exerts, keep $\phi$ as a coordinate with $f = \phi - \omega t = 0$: the $\phi$-equation gives $\frac{d}{dt}(mr^2\dot\phi) = \lambda$, so $\lambda = 2mr\dot r\omega$, a torque; the sideways force is $\lambda/r = 2m\omega\dot r$, which is exactly the Coriolis force in the rod's frame. Nice check.

**Pendulum with a vertically driven pivot.** Pivot at height $y_p(t)$ (prescribed). Bob at $x = \ell\sin\theta$, $y = y_p - \ell\cos\theta$.

$$T = \tfrac12 m\left(\ell^2\dot\theta^2 + \dot y_p^2 + 2\ell\dot\theta\sin\theta\,\dot y_p\right),\qquad V = mg(y_p - \ell\cos\theta)$$

The cross term: $m\ell\dot y_p\sin\theta\,\dot\theta = -\frac{d}{dt}\left(m\ell\dot y_p\cos\theta\right) + m\ell\ddot y_p\cos\theta$. Drop the total derivative, drop the pure functions of $t$ ($\tfrac12 m\dot y_p^2$, $mgy_p$):

$$L \simeq \tfrac12 m\ell^2\dot\theta^2 + m\ell\left(g + \ddot y_p\right)\cos\theta.$$

So a moving pivot is just a time-dependent gravity $g \to g + \ddot y_p$ (equivalence principle, in one line). With $y_p = a\cos\gamma t$ this is the Mathieu equation. Lindgren mentioned (not derived) that the *inverted* pendulum is stabilized if $a^2\gamma^2 > 2g\ell$ (Kapitza). [derive this over break? — did it in spring with the averaging method, it's in the drills deck now]

a vertically driven pivot $y_p(t)$ enters the pendulum Lagrangian as {{c1::an effective gravity $g + \ddot y_p$}}, after dropping a total time derivative ^cm-pivot
<!-- sr due=2027-01-08 st=review s=102 d=5.3 r=9 l=1 ivl=102 last=2026-09-28T09:12:00Z g=3 -->

**Why $L = T - V$ at all?** Lindgren's answer, borrowed from Landau: for a free particle, homogeneity of space and time and isotropy of space force $L = L(v^2)$; requiring that a Galilean boost change $L$ only by a total derivative forces $L \propto v^2$. Interactions are then *defined* by adding $-V$. So the form isn't derived from Newton in that approach, Newton is derived from it. I find the d'Alembert route more convincing because it says where the constraint forces went.

## Lec 9: double pendulum (setup only)

Masses $m_1, m_2$, rods $\ell_1, \ell_2$ (massless), angles $\theta_1,\theta_2$ from the downward vertical. Two dof, configuration space a torus. Positions:

$$x_1 = \ell_1\sin\theta_1,\quad y_1 = -\ell_1\cos\theta_1,\qquad x_2 = x_1 + \ell_2\sin\theta_2,\quad y_2 = y_1 - \ell_2\cos\theta_2.$$

Kinetic energy (the cross term is the whole difficulty):

$$T = \tfrac12(m_1+m_2)\ell_1^2\dot\theta_1^2 + \tfrac12 m_2\ell_2^2\dot\theta_2^2 + m_2\ell_1\ell_2\dot\theta_1\dot\theta_2\cos(\theta_1-\theta_2)$$

$$V = -(m_1+m_2)g\ell_1\cos\theta_1 - m_2 g\ell_2\cos\theta_2$$

E–L for $\theta_1$ (divided by $\ell_1$), with $\Delta = \theta_1 - \theta_2$:

$$(m_1+m_2)\ell_1\ddot\theta_1 + m_2\ell_2\ddot\theta_2\cos\Delta + m_2\ell_2\dot\theta_2^2\sin\Delta + (m_1+m_2)g\sin\theta_1 = 0$$

E–L for $\theta_2$ (divided by $m_2\ell_2$):

$$\ell_2\ddot\theta_2 + \ell_1\ddot\theta_1\cos\Delta - \ell_1\dot\theta_1^2\sin\Delta + g\sin\theta_2 = 0$$

(the $\dot\theta_1\dot\theta_2\sin\Delta$ terms cancel in both, between $\frac{d}{dt}\partial_{\dot\theta}L$ and $\partial_\theta L$. Lost 20 minutes on that in PS3.)

Chaotic for large amplitudes (not covered beyond a demo video). Small oscillations, equal masses and lengths: linearize, $\cos\Delta\to1$, drop $\dot\theta^2$ terms.

$$M = m\ell^2\begin{pmatrix}2&1\\1&1\end{pmatrix},\qquad K = mg\ell\begin{pmatrix}2&0\\0&1\end{pmatrix}$$

$\det(K - \omega^2 M) = 0$ with $u = \omega^2\ell/g$: $(2-2u)(1-u) - u^2 = u^2 - 4u + 2 = 0$, so

$$\omega_\pm^2 = (2\pm\sqrt2)\,\frac{g}{\ell}.$$

Mode shapes: slow mode $\theta_2/\theta_1 = +\sqrt2$ (in phase), fast mode $\theta_2/\theta_1 = -\sqrt2$ (out of phase).

the kinetic energy of the double pendulum has the cross term {{c1::$m_2\ell_1\ell_2\dot\theta_1\dot\theta_2\cos(\theta_1-\theta_2)$}} ^cm-dp-T
<!-- sr due=2026-10-28 st=review s=88 d=6.1 r=13 l=2 ivl=88 last=2026-08-01T15:12:00Z g=2 -->

small-oscillation frequencies of the double pendulum with equal masses and lengths :: $\omega^2 = (2\pm\sqrt2)\,g/\ell$; slow mode in phase with $\theta_2/\theta_1 = \sqrt2$, fast mode out of phase with $-\sqrt2$ ^cm-dp-modes
<!-- sr due=2026-11-29 st=review s=63 d=6.7 r=10 l=2 ivl=63 last=2026-09-27T12:30:00Z g=3 -->

## Lec 10–11: bead on a rotating hoop

The one he spent two full lectures on, and the midterm problem.

Bead of mass $m$ on a frictionless circular hoop of radius $R$; the hoop spins about its vertical diameter at fixed angular velocity $\omega$. $\theta$ = angle of the bead from the bottom of the hoop. One dof (the rotation angle $\phi = \omega t$ is not a coordinate, it's imposed: rheonomic constraint).

Bead's speed: along the hoop $R\dot\theta$, around the axis $\rho\omega = R\sin\theta\,\omega$, perpendicular to each other.

$$T = \tfrac12 mR^2\left(\dot\theta^2 + \omega^2\sin^2\theta\right),\qquad V = -mgR\cos\theta$$

$$L = \tfrac12 mR^2\dot\theta^2 + \tfrac12 mR^2\omega^2\sin^2\theta + mgR\cos\theta$$

E–L:

$$mR^2\ddot\theta = mR^2\omega^2\sin\theta\cos\theta - mgR\sin\theta \quad\Longrightarrow\quad \ddot\theta = \sin\theta\left(\omega^2\cos\theta - \frac{g}{R}\right).$$

**Equilibria.** $\sin\theta = 0$: $\theta = 0$ (bottom) and $\theta = \pi$ (top). And $\cos\theta_0 = g/(R\omega^2)$, which exists only if $\omega^2 > g/R$: a symmetric pair $\pm\theta_0$.

**Stability.** Cleanest via the effective potential. The $\tfrac12 mR^2\omega^2\sin^2\theta$ in $L$ acts like a negative potential (centrifugal), so define

$$U_{\text{eff}}(\theta) = -mgR\cos\theta - \tfrac12 mR^2\omega^2\sin^2\theta,\qquad L = \tfrac12 mR^2\dot\theta^2 - U_{\text{eff}}.$$

$U'_{\text{eff}} = mgR\sin\theta - mR^2\omega^2\sin\theta\cos\theta$, and

$$U''_{\text{eff}} = mgR\cos\theta - mR^2\omega^2\cos2\theta.$$

- $\theta = 0$: $U'' = mR(g - R\omega^2)$. Stable iff $\omega^2 < g/R$; small oscillations at $\Omega^2 = g/R - \omega^2$.
- $\theta = \pi$: $U'' = -mgR - mR^2\omega^2 < 0$. Always unstable.
- $\theta_0$: substitute $\cos\theta_0 = g/(R\omega^2)$, $\cos2\theta_0 = 2\cos^2\theta_0 - 1$: $U'' = mR^2\omega^2\cos^2\theta_0 - mR^2\omega^2(2\cos^2\theta_0 - 1) = mR^2\omega^2\sin^2\theta_0 > 0$. Stable whenever it exists, $\Omega^2 = \omega^2\sin^2\theta_0 = \omega^2 - g^2/(R^2\omega^4)$.

So at $\omega_c = \sqrt{g/R}$ the bottom loses stability and two stable off-axis equilibria are born: a supercritical pitchfork bifurcation. Lindgren drew the $\theta_0(\omega)$ diagram and called it "the first phase transition you'll see" (symmetry $\theta\to-\theta$ spontaneously broken). Also: $\Omega \to 0$ on both sides of $\omega_c$, critical slowing down.

**Energy is not conserved** (the motor that keeps $\omega$ fixed does work on the bead through the normal force). But $L$ has no explicit $t$, so the energy function

$$h = \dot\theta\frac{\partial L}{\partial\dot\theta} - L = \tfrac12 mR^2\dot\theta^2 - \tfrac12 mR^2\omega^2\sin^2\theta - mgR\cos\theta$$

is conserved. $h \ne T + V$ because $T$ isn't homogeneous quadratic in $\dot\theta$ (the $\omega^2\sin^2\theta$ piece is degree zero). In the rotating frame $h$ *is* the energy, with the centrifugal potential. Prof. said this distinction ($h$ vs $E$) is on the midterm. It was.

equation of motion for a bead on a hoop (radius $R$) spinning at $\omega$ about its vertical diameter, $\theta$ from the bottom :: $\ddot\theta = \sin\theta\,(\omega^2\cos\theta - g/R)$ ^cm-hoop-eom
<!-- sr due=2027-01-22 st=review s=107 d=5.5 r=12 l=1 ivl=107 last=2026-10-07T10:04:00Z g=3 -->

for the bead on a rotating hoop, the bottom is stable iff {{c1::$\omega^2 < g/R$}}; above that the stable equilibria are at {{c2::$\cos\theta_0 = g/(R\omega^2)$}} ^cm-hoop-stab
<!-- sr c1 due=2026-11-24 st=review s=139 d=4.6 r=11 l=1 ivl=139 last=2026-07-08T08:55:00Z g=3 -->
<!-- sr c2 due=2026-10-31 st=review s=71 d=6.3 r=12 l=2 ivl=71 last=2026-08-21T19:40:00Z g=3 -->

why is $h = \dot\theta\,\partial L/\partial\dot\theta - L$ conserved for the rotating hoop when $E = T+V$ is not?
?
$\partial L/\partial t = 0$, so $dh/dt = -\partial L/\partial t = 0$
but $T$ has a piece $\tfrac12 mR^2\omega^2\sin^2\theta$ of degree zero in $\dot\theta$, so $h = T_2 - T_0 + V \ne T+V$
physically the motor holding $\omega$ fixed does work through the normal force ^cm-hoop-h
<!-- sr due=2026-11-30 st=review s=92 d=5.9 r=11 l=1 ivl=92 last=2026-08-30T07:25:00Z g=3 -->

small-oscillation frequency about the off-axis equilibrium of the rotating hoop :: $\Omega^2 = \omega^2\sin^2\theta_0 = \omega^2 - g^2/(R^2\omega^4)$ ^cm-hoop-omega
<!-- sr due=2026-10-26 st=review s=12 d=7.4 r=9 l=3 ivl=12 last=2026-10-14T18:10:00Z g=3 sus=1 -->

[suspended the one above in October, it's a pure plug-in once you have $U''$ and I keep grading it on whether I remembered the algebra. the stability card covers the idea.]

## Lec 12–14: cyclic coordinates and Noether

**Generalized momentum** $p_j \equiv \partial L/\partial\dot q_j$. Not necessarily $m\dot x$: for an angle it's an angular momentum, in an EM field it's $m\mathbf{v} + q\mathbf{A}$ (canonical, not kinetic).

**Cyclic (ignorable) coordinate**: $q_k$ doesn't appear in $L$ (only $\dot q_k$ does). Then E–L says $\dot p_k = \partial L/\partial q_k = 0$: $p_k$ is conserved.

Example: spherical pendulum, $L = \tfrac12 m\ell^2(\dot\theta^2 + \sin^2\theta\,\dot\phi^2) + mg\ell\cos\theta$. $\phi$ cyclic, so $p_\phi = m\ell^2\sin^2\theta\,\dot\phi$ = $L_z$ conserved. Then you can eliminate $\dot\phi$ and get a 1D problem in $\theta$ (but careful: substitute in the *equations*, or use the Routhian, not the Lagrangian directly — substituting $\dot\phi = p_\phi/(m\ell^2\sin^2\theta)$ into $L$ flips the sign of the centrifugal term. Lindgren made a big deal of this; it's why you use $h$ or the Routhian.)

**Noether's theorem (Lagrangian version).** Suppose the one-parameter family $q_j \to q_j + \epsilon K_j(q)$ leaves $L$ invariant to first order: $\delta L = \epsilon\sum_j\left(\frac{\partial L}{\partial q_j}K_j + \frac{\partial L}{\partial\dot q_j}\dot K_j\right) = 0$. Then

$$Q = \sum_j\frac{\partial L}{\partial\dot q_j}K_j(q)$$

is conserved. Proof: $\dot Q = \sum_j\left(\frac{d}{dt}\frac{\partial L}{\partial\dot q_j}K_j + \frac{\partial L}{\partial\dot q_j}\dot K_j\right) = \sum_j\left(\frac{\partial L}{\partial q_j}K_j + \frac{\partial L}{\partial\dot q_j}\dot K_j\right) = \delta L/\epsilon = 0$, using E–L in the middle step.

Generalization: if $\delta L = \epsilon\,\frac{d}{dt}\Lambda(q,t)$ (invariant up to a total derivative), then $Q = \sum_j p_jK_j - \Lambda$ is conserved. Galilean boosts are the example: $\delta L$ is a total derivative and the conserved quantity is $M\mathbf{R} - \mathbf{P}t$ (center of mass moves uniformly).

Dictionary:

| symmetry | $K$ | conserved $Q$ |
| --- | --- | --- |
| translation along $\hat n$ | $\delta\mathbf{r}_i = \hat n$ | $\hat n\cdot\mathbf{P}$ |
| rotation about $\hat n$ | $\delta\mathbf{r}_i = \hat n\times\mathbf{r}_i$ | $\hat n\cdot\mathbf{L}$ |
| time translation | $\partial L/\partial t = 0$ | $h = \sum p_j\dot q_j - L$ |
| Galilean boost | $\delta\mathbf{r}_i = \mathbf{v}t$ | $M\mathbf{R} - \mathbf{P}t$ |

A cyclic coordinate is just Noether with $K_k = 1$, $K_{j\ne k} = 0$. The art is finding coordinates in which a symmetry becomes cyclic.

**Example: particle in a uniform field + helical symmetry.** (Lindgren's favorite exam trick.) A charged particle in a potential that is invariant under the screw motion $z \to z + c\epsilon$, $\phi \to \phi + \epsilon$ (e.g. a helical wire's field). Neither $p_z$ nor $p_\phi$ alone is conserved, but $K = (0, 1, c)$ in $(\rho,\phi,z)$ gives $Q = p_\phi + c\,p_z$ conserved: $L_z + cP_z$.

state Noether's theorem for a point symmetry $q_j \to q_j + \epsilon K_j(q)$ that leaves $L$ invariant
?
the quantity $Q = \sum_j \dfrac{\partial L}{\partial\dot q_j}K_j(q)$ is conserved
proof: $\dot Q = \sum_j(\partial_{q_j}L\,K_j + p_j\dot K_j) = \delta L/\epsilon = 0$, using E–L for $\dot p_j$
if instead $\delta L = \epsilon\,\dot\Lambda$, conserve $Q - \Lambda$ ^cm-noether
<!-- sr due=2026-10-30 st=review s=67 d=6.4 r=12 l=2 ivl=67 last=2026-08-24T07:58:00Z g=3 -->

for a helically symmetric potential (invariant under $\phi\to\phi+\epsilon$, $z\to z+c\epsilon$) the conserved quantity is {{c1::$p_\phi + c\,p_z$}} ^cm-helix
<!-- sr due=2027-01-18 st=review s=81 d=5 r=9 l=1 ivl=81 last=2026-10-29T14:20:00Z g=3 -->

why can't you substitute a conserved $p_\phi$ back into the Lagrangian to reduce the spherical pendulum? :: it flips the sign of the $p_\phi^2/(2m\ell^2\sin^2\theta)$ term; substitute into the equations of motion, or use the Routhian $R = L - p_\phi\dot\phi$ ^cm-routh
<!-- sr due=2026-10-26 st=review s=59 d=6.9 r=10 l=2 ivl=59 last=2026-08-28T08:05:00Z g=2 -->

the Lagrangian of a charge in an EM field is $L = \tfrac12 mv^2 {{c1::- q\phi + q\,\mathbf{v}\cdot\mathbf{A}}}$ ^cm-emlag
<!-- sr due=2026-11-07 st=review s=125 d=4.7 r=10 l=1 ivl=125 last=2026-07-05T20:50:00Z g=3 -->
