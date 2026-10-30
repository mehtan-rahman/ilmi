---
type: source
title: why perturbation series diverge
frozen: true
imported: 2026-10-25
url: https://example.net/essays/why-perturbation-series-diverge
author: Teodor Halvorsen
published: 2024-03-11
read: due=2026-10-30 ivl=3 reps=2 pos=9
---

Quantum electrodynamics is the most precisely tested theory in physics. Its prediction for the electron's anomalous magnetic moment agrees with experiment to about one part in a trillion, and every digit of that prediction comes from a power series in the fine-structure constant $\alpha \approx 1/137$. Each term is a set of Feynman diagrams, each order costs years of work, and the terms get smaller fast. It is natural to assume the series converges. It almost certainly does not.

The argument that it does not is due to Freeman Dyson, in a two-page paper from 1952, and it is one of the most elegant pieces of reasoning in theoretical physics, because it uses almost no mathematics. It does not compute a single coefficient. It asks instead what the series would have to mean if it converged, and finds that the meaning is absurd.

## The argument

Suppose some physical quantity $F$ is given by a series $F(e^2) = c_0 + c_1e^2 + c_2e^4 + \dots$ that converges for all $|e^2|$ smaller than some radius $R > 0$. A convergent power series defines an analytic function in a disk around the origin, and a disk contains negative numbers. So $F$ would be perfectly well defined, and smooth, for small *negative* $e^2$.

Now ask what a world with negative $e^2$ looks like. The Coulomb energy between two charges is proportional to $e^2$, so flipping its sign flips the force: like charges attract and opposite charges repel. Electrons attract electrons. Positrons attract positrons. Electrons and positrons push each other apart.

In that world the vacuum is not stable. Create a large number $N$ of electron–positron pairs out of nothing, which costs roughly $2Nmc^2$ in rest energy plus some kinetic energy. Move all the electrons into one region and all the positrons into another, far away. Within each cluster every pair of particles now attracts, so the electrostatic energy of a cluster is negative and grows in magnitude like $N^2$, while the cost of making the particles grows only like $N$. For large enough $N$ the total is negative, and it keeps getting more negative as $N$ grows. There is no lowest-energy state. The "vacuum" of this theory is a false vacuum that can lower its energy without limit by tunneling into a state full of separated, self-bound clusters of charge.

A theory with no ground state is not a slightly different theory; it is a sick one, and nothing computed in it can be a smooth continuation of the healthy theory at positive $e^2$. So $F$ cannot be analytic at $e^2 = 0$, and the series cannot have a positive radius of convergence. Its radius is zero. For every nonzero value of the coupling, however small, the series diverges.

Dyson was careful to call this a physical argument, not a proof, and the details have been debated since. But the conclusion has held up, and the structure of the argument has turned out to be general: whenever flipping the sign of a coupling makes a system unstable, the perturbation series in that coupling diverges.
<!-- extract dyson-argument -->

## A toy you can do on paper

The cleanest place to see this is an integral with no physics in it at all. Consider

$$Z(g) = \frac{1}{\sqrt{2\pi}}\int_{-\infty}^{\infty}e^{-x^2/2 - gx^4}\,dx,$$

a zero-dimensional cousin of an interacting field theory. For $g > 0$ it is a perfectly good number. For $g < 0$ the integrand blows up at large $|x|$ and the integral does not exist: the same instability Dyson found, in miniature. So we should expect trouble at $g = 0$.

Expanding $e^{-gx^4}$ and integrating term by term, using the Gaussian moments $\langle x^{4n}\rangle = (4n-1)!!$, gives

$$Z(g) \sim \sum_{n=0}^{\infty}\frac{(-g)^n}{n!}(4n-1)!! = 1 - 3g + \frac{105}{2}g^2 - \frac{10395}{6}g^3 + \dots$$

The coefficients grow roughly like $n!\,16^n$. However small $g$ is, the factorial eventually wins, and the terms first shrink and then grow without bound. Term-by-term integration was illegitimate: we exchanged a sum and an integral where the sum does not converge uniformly at large $x$.

And yet the first few terms are excellent approximations to $Z(g)$ when $g$ is small. That is the defining property of an **asymptotic series**: for fixed truncation order $N$, the error of the partial sum goes to zero faster than $g^N$ as $g \to 0$. Convergence is a statement about $N \to \infty$ at fixed $g$. Asymptoticity is a statement about $g \to 0$ at fixed $N$. They are different limits, and physics usually only needs the second.

## How far to trust the terms

Euler had the prototype two centuries before quantum theory. The integral

$$E(x) = \int_0^\infty\frac{e^{-t}}{1 + xt}\,dt$$

is a well-defined function for $x > 0$, and expanding $1/(1+xt)$ gives the series $\sum(-1)^nn!\,x^n$, which diverges for every $x \ne 0$. The terms $n!\,x^n$ decrease while $n < 1/x$ and increase after. The best you can do is to stop at the smallest term, $n \approx 1/x$, and the error you are left with is about the size of that term, roughly $e^{-1/x}$.

This is the general lesson. An asymptotic series with factorially growing coefficients has a built-in floor of accuracy of order $e^{-c/g}$. That is not a failure of diligence. It is the series telling you that the function contains pieces, like $e^{-1/g}$, that are invisible to every order of perturbation theory because all their derivatives vanish at $g = 0$. In field theory those pieces have names: instantons, tunneling amplitudes, the decay of false vacua. Dyson's unstable world is exactly one of them seen from the other side.

For QED the floor is not a practical problem. If the coefficients grow like $n!$, the smallest term comes at $n$ around $1/\alpha \approx 137$, and its size is something like $e^{-137}$. We have computed five orders. The divergence is real and irrelevant to every measurement anyone will make. What it changes is what the series *is*: not a definition of the theory, but an expansion of something that has to be defined some other way.

## Summing the unsummable

There are ways to assign a value to a divergent series that agree with the function it came from. The most important is Borel summation: divide the $n$th coefficient by $n!$, which tames the growth, sum the resulting convergent series to get a function $B(t)$, and then undo the division with the integral $\int_0^\infty e^{-t}B(gt)\,dt$. For Euler's series this returns exactly the integral we started from. For the quartic integral above it works too.

It does not always work. If $B(t)$ has singularities on the positive real axis, the final integral is ambiguous, and the ambiguity is again of order $e^{-c/g}$: the same non-perturbative pieces, now showing up as a choice of how to steer around a pole. In QCD these singularities are called renormalons, and they are one reason the relationship between perturbative and non-perturbative physics remains an active subject.

## What to take away

The striking thing about Dyson's argument is that it is about the theory, not the series. It never estimates a coefficient. It notices that the analytic structure of the answer near zero coupling is constrained by physics at negative coupling, which nobody would have thought to look at. Most of what has been learned since about the large-order behavior of perturbation theory, from the anharmonic oscillator (whose coefficients were worked out to high order in the late 1960s and do grow factorially) to the structure of resurgent series, is a refinement of that one move.

The series we use are not wrong. They are asymptotic, which is a precise word for "trust the first terms and not the tail." Knowing which kind of series you are holding is part of knowing what you have computed.

what is an asymptotic (as opposed to convergent) series? :: one whose partial sum to fixed order $N$ has error $o(g^N)$ as $g\to0$; convergence is about $N\to\infty$ at fixed $g$, asymptoticity about $g\to0$ at fixed $N$ ^fl-asymptotic
