---
type: source
title: "Halvorsen ch. 9: the WKB approximation"
frozen: true
imported: 2026-10-24
read: due=2026-11-21 ivl=24 reps=3 pos=6 af=3
author: E. Halvorsen
---

# Chapter 9 — The WKB Approximation

The methods of the last three chapters all begin from a problem we can solve exactly and treat the difference as small. The method of this chapter begins somewhere else: from the observation that when a potential changes slowly, a particle moving through it hardly notices the change over the distance of one wavelength. Locally the wavefunction is a plane wave; globally its wavelength and amplitude drift. The approximation that makes this precise carries the initials of Wentzel, Kramers and Brillouin, who applied it to the Schrödinger equation in 1926, although Jeffreys had used it for other equations two years before and Liouville and Green a century before that.

## 9.1 The local wavelength

For a particle of energy $E$ in a constant potential $V < E$, the solutions are $e^{\pm ikx}$ with $\hbar k = p = \sqrt{2m(E - V)}$. When $V$ depends on $x$ we may still define a local momentum $p(x) = \sqrt{2m[E - V(x)]}$ and a local de Broglie wavelength $\lambda(x) = 2\pi\hbar/p(x)$. These are just names until we say when they mean something. They mean something when the potential changes by a small fraction of the kinetic energy over one wavelength.

The condition can be written $|d\lambda/dx| \ll 1$: the wavelength must not change appreciably within a wavelength. It fails wherever $p(x)$ is small, and in particular it fails badly at a classical turning point, where $E = V(x)$, $p = 0$ and the local wavelength is infinite. Most of the work of this chapter is in getting around those points.

## 9.2 The approximate solutions

Write the wavefunction as $\psi(x) = e^{iS(x)/\hbar}$ with $S$ complex, and substitute into the time-independent Schrödinger equation. The result is exact:

$$
\frac{1}{2m}\left(S'\right)^2 - \frac{i\hbar}{2m}S'' = E - V(x).
$$

If $\hbar$ is treated as small, expand $S = S_0 + \hbar S_1 + \hbar^2 S_2 + \cdots$ and collect powers. At order $\hbar^0$, $(S_0')^2 = p^2$, so $S_0 = \pm\int^x p\,dx'$: the classical action. At order $\hbar^1$, $2S_0'S_1' = iS_0''$, so $S_1 = \tfrac{i}{2}\ln p$. Keeping these two terms gives

$$
\psi(x) \approx \frac{C_\pm}{\sqrt{p(x)}}\exp\left(\pm\frac{i}{\hbar}\int^x p(x')\,dx'\right).
$$

The amplitude $1/\sqrt{p}$ has a classical reading. The probability density $|\psi|^2 \propto 1/p \propto 1/v$ is largest where the particle moves slowest, exactly as the fraction of time a classical particle spends in a small interval is inversely proportional to its speed there.

In a classically forbidden region, $E < V(x)$, the momentum is imaginary. With $\kappa(x) = \sqrt{2m[V(x) - E]}/\hbar$ the two solutions are real exponentials, one growing and one decaying, $\psi \approx D_\pm\,\kappa^{-1/2}\exp(\pm\int^x\kappa\,dx')$.

## 9.3 Connection formulas

Near a turning point $x_0$ neither approximate solution holds. If the potential is smooth there, it is nearly linear over a small region, $V(x) \approx E + V'(x_0)(x - x_0)$, and the Schrödinger equation in that region can be solved exactly in terms of Airy functions. Matching the asymptotic forms of the Airy functions to the WKB solutions on either side gives rules for continuing a solution across the turning point. For a turning point with the allowed region on the left, a solution that decays into the forbidden region on the right connects to

$$
\frac{2C}{\sqrt{p(x)}}\cos\left(\frac{1}{\hbar}\int_x^{x_0}p(x')\,dx' - \frac{\pi}{4}\right).
$$

The phase of $\pi/4$ is the whole content of the turning point. It is the reason the quantization condition of the next section is not the one Bohr and Sommerfeld first wrote down.

A warning about direction. The rule above may be used safely from the forbidden side toward the allowed side. Used the other way, it is unreliable: a small error in the phase of the oscillating solution produces an admixture of the growing exponential, which soon dominates. Texts that state the connection formulas with a double-headed arrow are being generous.

## 9.4 Bound states

Consider a potential well with two turning points $a < b$ at energy $E$. Starting from the decaying solution beyond $b$ and connecting it inward, and doing the same from the decaying solution beyond $a$, we obtain two expressions for the wavefunction in the allowed region. They agree only if

$$
\int_a^b p(x)\,dx = \left(n + \tfrac{1}{2}\right)\pi\hbar, \qquad n = 0, 1, 2, \ldots
$$

For the harmonic oscillator the condition gives $E_n = (n + \tfrac12)\hbar\omega$, exactly; this is a coincidence of the quadratic potential, not a general property of the method. For a well with one or two vertical walls the half-integer changes, since a hard wall is not a smooth turning point: with one wall the condition reads $(n + \tfrac34)\pi\hbar$, with two $(n + 1)\pi\hbar$.

The approximation is best for large $n$, where the wavelength is short compared with the scale of the potential. It is often surprisingly good even for the ground state.

## 9.5 Tunnelling

When a particle meets a barrier higher than its energy, the WKB solution inside the barrier is a combination of growing and decaying exponentials. For a barrier that is wide compared with the decay length, only the decaying solution matters, and the transmission probability is

$$
T \approx \exp\left(-\frac{2}{\hbar}\int_{x_1}^{x_2}\sqrt{2m\left[V(x) - E\right]}\,dx\right),
$$

with $x_1$ and $x_2$ the turning points at the edges of the barrier. The prefactor, which the careful calculation supplies, is of order one and is usually dropped.

Gamow used this formula in 1928 to explain the alpha decay of heavy nuclei: an alpha particle inside the nucleus meets the Coulomb barrier of the remaining protons, and the exponential dependence of $T$ on the energy accounts for half-lives ranging over more than twenty orders of magnitude while the energies range over a factor of two.

## Problems

9.1 Estimate the energies of a particle in the potential $V(x) = \alpha|x|$ using the quantization condition, and compare the first three with the exact values from the zeros of the Airy function.

9.2 Use the tunnelling formula to find the lifetime of a particle in the potential $V = -V_0$ for $|x| < a$ and $V = 0$ for $|x| > a$, separated by a parabolic barrier. State the conditions under which the estimate is trustworthy.
