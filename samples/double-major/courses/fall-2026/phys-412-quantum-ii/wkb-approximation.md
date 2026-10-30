---
title: WKB approximation
lectures: 2026-10-23, 10-26
---

#TODO: still typing this up from the notebook (pp. 61–74). Lecture 2 half done. Connection formulas are on the photo of the board, not in the notebook.

## idea

Lectures 19–20 (Oct 23, the Friday after the midterm, and Oct 26). Lindgren compressed WKB into two lectures "because you'll see it again in every course that has a differential equation in it".

For a constant potential $V < E$ the solution is $e^{\pm ikx}$ with $\hbar k = p = \sqrt{2m(E - V)}$. If $V(x)$ varies slowly compared with the wavelength, the solution should look locally like a plane wave with a slowly varying wavelength and a slowly varying amplitude. WKB makes that precise:

$$\psi(x) \approx \frac{C}{\sqrt{p(x)}}\exp\!\left(\pm\frac{i}{\hbar}\int^x p(x')\,dx'\right), \qquad p(x) = \sqrt{2m\left[E - V(x)\right]}.$$

In the classically forbidden region $E < V$, $p$ is imaginary; write $|p(x)| = \sqrt{2m[V(x) - E]}$ and

$$\psi(x) \approx \frac{C}{\sqrt{|p(x)|}}\exp\!\left(\pm\frac1\hbar\int^x|p(x')|\,dx'\right).$$

## derivation

Write $\psi(x) = A(x)e^{i\phi(x)}$ with $A, \phi$ real. The Schrödinger equation is $\psi'' = -\frac{p^2}{\hbar^2}\psi$. Compute

$$\psi'' = \left[A'' + 2iA'\phi' + iA\phi'' - A(\phi')^2\right]e^{i\phi}.$$

Real part:

$$A'' - A(\phi')^2 = -\frac{p^2}{\hbar^2}A.$$

Imaginary part:

$$2A'\phi' + A\phi'' = 0 \quad\Longleftrightarrow\quad \left(A^2\phi'\right)' = 0 \quad\Longleftrightarrow\quad A = \frac{C}{\sqrt{\phi'}}.$$

That one is exact. The approximation: $A''/A$ is negligible compared with $(\phi')^2$ and $p^2/\hbar^2$ (slowly varying amplitude). Then the real part gives $\phi' = \pm p/\hbar$, so

$$\phi = \pm\frac1\hbar\int p\,dx, \qquad A = \frac{C}{\sqrt p}.$$

WKB derivation: with $\psi = Ae^{i\phi}$, what do the imaginary and real parts of the Schrödinger equation give?
?
imaginary: $(A^2\phi')' = 0$ exactly, so $A = C/\sqrt{\phi'}$
real: $A'' - A\phi'^2 = -\frac{p^2}{\hbar^2}A$; drop $A''$ (slow amplitude), so $\phi' = \pm p/\hbar$, hence
$$\psi \approx \frac{C}{\sqrt{p}}e^{\pm\frac i\hbar\int p\,dx}$$ ^qm4-deriv
<!-- sr st=new -->

The $1/\sqrt p$ amplitude has a classical meaning: $|\psi|^2 \propto 1/p \propto 1/v$, the probability of finding a classical particle in $dx$ is proportional to the time it spends there. Also, $A^2\phi' = $ const is conservation of probability current, $j \propto |A|^2\phi'$.

Lindgren also did it the "systematic" way: $\psi = e^{iS(x)/\hbar}$, expand $S = S_0 + \hbar S_1 + \hbar^2S_2 + \cdots$. Order $\hbar^0$: $(S_0')^2 = p^2$ (Hamilton–Jacobi). Order $\hbar^1$: $2S_0'S_1' = iS_0''$, so $S_1 = \frac i2\ln p$, giving the $p^{-1/2}$ prefactor. So WKB is an expansion in $\hbar$, the semiclassical limit. [the $\hbar^2$ term is the first correction; skip]

## validity

The dropped term is $A''/A$ vs $p^2/\hbar^2$. Equivalent statements (Lindgren wrote all three):

- the wavelength changes little over one wavelength: $\left|\frac{d\lambda}{dx}\right| \ll 1$ with $\lambda = 2\pi\hbar/p$ (the reduced $\bar\lambda = \hbar/p$ version, $|d\bar\lambda/dx| \ll 1$, is what you actually check)
- $\left|\frac{\hbar\,p'}{p^2}\right| \ll 1$
- $\left|\frac{m\hbar\,V'}{p^3}\right| \ll 1$, i.e. the potential changes by much less than the kinetic energy over a wavelength

WKB is valid where {{c1::$\left|\hbar\,p'/p^2\right| \ll 1$}}, i.e. the local wavelength changes little over one wavelength ^qm4-valid

All three fail at a classical turning point, where $E = V(x)$ and $p \to 0$: the WKB wavefunction $\propto 1/\sqrt p$ diverges there. The true wavefunction doesn't. Near a turning point you need a different approximation, and then you have to "connect" the WKB solutions on either side. That's the connection-formula business.

## application 1: quantization with hard walls

Infinite walls at $x = 0$ and $x = a$, arbitrary $V(x)$ inside with $E > V$ throughout. No turning points, the walls force $\psi = 0$. Take the real combination

$$\psi(x) \approx \frac{C}{\sqrt{p(x)}}\sin\phi(x), \qquad \phi(x) = \frac1\hbar\int_0^xp(x')\,dx'.$$

$\psi(0) = 0$ automatically; $\psi(a) = 0$ needs $\phi(a) = n\pi$:

$$\int_0^a p(x)\,dx = n\pi\hbar, \qquad n = 1, 2, 3, \ldots$$

Check: $V = 0$ gives $pa = n\pi\hbar$, $E_n = \frac{n^2\pi^2\hbar^2}{2ma^2}$. Exact (as it should be: $p$ constant means $p' = 0$, WKB is exact).

Example from lecture: well with a sloped floor, $V = V_0x/a$ inside. $\int_0^a\sqrt{2m(E - V_0x/a)}\,dx = \frac{2a}{3V_0}\sqrt{2m}\left[E^{3/2} - (E - V_0)^{3/2}\right]$ for $E > V_0$. Set equal to $n\pi\hbar$ and solve numerically. #TODO: PS7 #2 is this with numbers.

## application 2: two soft turning points

[finish connection formulas from photo of board]

What I have from the notebook before the photo: near a turning point $x_2$ (right side, $V$ increasing), linearize $V(x) \approx E + V'(x_2)(x - x_2)$. The Schrödinger equation becomes Airy's equation in the scaled variable $z = \alpha(x - x_2)$, $\alpha = \left(\frac{2mV'}{\hbar^2}\right)^{1/3}$:

$$\frac{d^2\psi}{dz^2} = z\psi.$$

Solutions $\text{Ai}(z)$, $\text{Bi}(z)$. Only $\text{Ai}$ decays for $z \to +\infty$. Its asymptotic forms:

$$\text{Ai}(z) \sim \frac{1}{2\sqrt\pi\,z^{1/4}}e^{-\frac23z^{3/2}} \quad (z\gg0), \qquad \text{Ai}(z) \sim \frac{1}{\sqrt\pi\,(-z)^{1/4}}\sin\!\left(\frac23(-z)^{3/2} + \frac\pi4\right) \quad (z \ll 0).$$

Match these to the WKB forms on either side (in the overlap region where $|z|$ is large but the linear approximation for $V$ still holds). #TODO: the $\frac23z^{3/2}$ is exactly $\frac1\hbar\int|p|\,dx$ in the linear region; show this. Result, for a turning point on the right with forbidden region to the right:

$$\frac{2D}{\sqrt{p}}\sin\!\left(\frac1\hbar\int_x^{x_2}p\,dx' + \frac\pi4\right) \;\longleftrightarrow\; \frac{D}{\sqrt{|p|}}\exp\!\left(-\frac1\hbar\int_{x_2}^x|p|\,dx'\right).$$

#TODO: check the factor of 2 and which side the $D$ goes on. I think it's right (it matches $\frac{1}{\sqrt\pi}$ vs $\frac{1}{2\sqrt\pi}$ in the Airy asymptotics).

Why the patching works at all (my own understanding, check with Lindgren): we need a region where both approximations hold at once. The linear approximation to $V$ holds for $|x - x_2| \ll L$, where $L$ is the length over which $V'$ changes appreciably. The WKB form holds once $|z| \gg 1$, i.e. $|x - x_2| \gg \alpha^{-1} = \left(\frac{\hbar^2}{2mV'}\right)^{1/3}$. So we need $\alpha^{-1} \ll L$, which is the statement that the turning-point region (roughly one local wavelength wide) is narrow compared with the scale on which the potential bends. As $\hbar \to 0$, $\alpha^{-1} \propto \hbar^{2/3} \to 0$, so the overlap region always exists in the semiclassical limit. For a potential that's linear everywhere (gravity) the Airy function is exact and the overlap is infinite.

the connection formulas can be derived because there is an overlap region where {{c1::both the linearized-potential (Airy) solution and the WKB solution are valid}}, which exists when $\left(\hbar^2/2mV'\right)^{1/3}$ is small compared with the scale on which $V'$ changes ^qm4-overlap

Then do the same at the left turning point $x_1$, and require the two oscillatory forms in the middle to agree. [rest on photo] The result Lindgren boxed:

$$\int_{x_1}^{x_2}p(x)\,dx = \left(n - \frac12\right)\pi\hbar, \qquad n = 1, 2, \ldots$$

Each soft (linear) turning point contributes a phase loss of $\pi/4$, so a soft wall "costs" a quarter wavelength relative to... no, $\frac{\pi}{4}$ of phase, i.e. an eighth of a wavelength. Two soft walls: $\frac12\pi\hbar$ subtracted. One hard wall and one soft: $(n - \frac14)\pi\hbar$. Two hard: $n\pi\hbar$.

WKB quantization with two soft turning points: $\int_{x_1}^{x_2}p\,dx = {{c1::\left(n - \frac12\right)\pi\hbar}}$; with one hard wall and one soft turning point, {{c2::$\left(n - \frac14\right)\pi\hbar$}} ^qm4-quant

Check, harmonic oscillator: $p = \sqrt{2m(E - \frac12m\omega^2x^2)}$, turning points $\pm\sqrt{2E/m\omega^2}$, $\int p\,dx = \frac{\pi E}{\omega}$ (area of an ellipse in phase space, divided by 2: the full orbit $\oint p\,dx = 2\pi E/\omega$). So $E = \left(n - \frac12\right)\hbar\omega$, $n = 1, 2, \ldots$, i.e. $\left(n + \frac12\right)\hbar\omega$ counting from zero. Exact, which is a coincidence of the oscillator (Lindgren: "a lucky accident, don't trust it").

Bohr–Sommerfeld: the old quantum theory had $\oint p\,dx = nh$; WKB says $\oint p\,dx = \left(n + \frac12\right)h$ for smooth wells, the $\frac12$ being the Maslov index correction (two turning points × $\frac14$). [Lindgren mentioned "Maslov" once and moved on]

## application 3: tunneling

Barrier between $x_1$ and $x_2$ with $E < V$ inside. Incident from the left. In the barrier the wavefunction is a combination of growing and decaying exponentials; for a high/wide barrier the decaying one dominates, and the amplitude drops by $e^{-\gamma}$ across it, with

$$\gamma = \frac1\hbar\int_{x_1}^{x_2}|p(x)|\,dx = \frac1\hbar\int_{x_1}^{x_2}\sqrt{2m\left[V(x) - E\right]}\,dx.$$

$$T \approx e^{-2\gamma}.$$

WKB tunneling probability ::: $T \approx e^{-2\gamma}$, $\gamma = \dfrac1\hbar\displaystyle\int_{x_1}^{x_2}\sqrt{2m[V(x) - E]}\,dx$ ^qm4-tunnel
<!-- sr st=new -->

(The prefactor is order 1 and WKB doesn't get it right without the connection formulas, which is why only the exponent is quoted.) Check: rectangular barrier height $V_0$ width $L$, $\gamma = \kappa L$ with $\kappa = \sqrt{2m(V_0 - E)}/\hbar$; the exact $T \approx \frac{16E(V_0-E)}{V_0^2}e^{-2\kappa L}$ for $\kappa L \gg 1$. Same exponent.

### Gamow theory of alpha decay

Alpha particle (charge $2e$) inside a nucleus of radius $r_1$, daughter charge $Ze$. Outside $r_1$ the potential is Coulomb, $V = \frac{2Ze^2}{4\pi\epsilon_0 r}$. The alpha has kinetic energy $E$ at infinity; the outer turning point is $r_2 = \frac{2Ze^2}{4\pi\epsilon_0E}$.

$$\gamma = \frac{\sqrt{2mE}}{\hbar}\int_{r_1}^{r_2}\sqrt{\frac{r_2}{r} - 1}\,dr = \frac{\sqrt{2mE}}{\hbar}\left[r_2\left(\frac\pi2 - \sin^{-1}\sqrt{\frac{r_1}{r_2}}\right) - \sqrt{r_1(r_2 - r_1)}\right].$$

For $r_1 \ll r_2$ (the usual case): $\gamma \approx \frac{\sqrt{2mE}}{\hbar}\left[\frac\pi2r_2 - 2\sqrt{r_1r_2}\right] = K_1\frac{Z}{\sqrt E} - K_2\sqrt{Zr_1}$, with $K_1 = \frac{e^2}{4\pi\epsilon_0}\frac{\pi\sqrt{2m}}{\hbar} = 1.980\text{ MeV}^{1/2}$ and $K_2 = \left(\frac{e^2}{4\pi\epsilon_0}\right)^{1/2}\frac{4\sqrt m}{\hbar} = 1.485\text{ fm}^{-1/2}$. #TODO: recompute $K_1$, $K_2$ myself with $m = m_\alpha$.

Lifetime: the alpha bounces inside with speed $v$, hitting the wall every $2r_1/v$, each time escaping with probability $e^{-2\gamma}$, so $\tau \approx \frac{2r_1}{v}e^{2\gamma}$. Then $\ln\tau \approx \frac{2K_1Z}{\sqrt E} + $ const: Geiger–Nuttall law. A factor of 2 in $E$ changes $\tau$ by tens of orders of magnitude (U-238 vs Po-212: $4.3$ vs $8.8$ MeV, lifetimes $\sim10^{17}$ s vs $\sim10^{-7}$ s).

the Geiger–Nuttall law $\ln\tau \propto 1/\sqrt E$ comes from {{c1::the WKB tunneling exponent $2\gamma \approx 2K_1Z/\sqrt E$}} for the Coulomb barrier ^qm4-gamow

## remarks Lindgren made at the end of lecture 20

WKB counts states: since $\int_{x_1}^{x_2}p\,dx = (n - \frac12)\pi\hbar$, the number of bound states below energy $E$ is about $\frac{1}{2\pi\hbar}\oint p\,dx$, the phase-space area in units of $h$. One state per $h$ of phase space. Same counting as statistical mechanics (cross-check for 415: density of states in the classical limit). [link to stat mech notes when I get there]

The method is worst for the ground state ($n=1$, about one half-wavelength between turning points, so "slowly varying over a wavelength" is barely meaningful) and best for highly excited states. The opposite of variational, which is best for the ground state. Lindgren: "the two methods are complementary; between them you bracket the spectrum."

WKB is most accurate for {{c1::highly excited states}}, the variational method for {{c2::the ground state}} ^qm4-complement

## radial WKB (lecture 20, partly typed)

For a central potential, $u(r) = rR(r)$ obeys a 1D equation with $V_{\text{eff}} = V(r) + \frac{\hbar^2l(l+1)}{2mr^2}$ on $r > 0$, with $u(0) = 0$. Naively, WKB on this with a hard wall at $r = 0$... but the centrifugal barrier makes the inner turning point soft for $l > 0$. Lindgren: apply WKB with two soft turning points, but replace $l(l+1) \to (l + \frac12)^2$ (Langer). Then for hydrogen,

$$\int_{r_1}^{r_2}\sqrt{2m\left[E + \frac{e^2}{4\pi\epsilon_0r} - \frac{\hbar^2(l+\frac12)^2}{2mr^2}\right]}\,dr = \left(n_r + \frac12\right)\pi\hbar$$

gives exactly $E = -\frac{13.6\text{ eV}}{(n_r + l + 1)^2}$, the Bohr formula with $n = n_r + l + 1$. Without Langer you get the wrong answer at small $l$. #TODO: do the integral (it's a standard one, $\int\sqrt{-A + 2B/r - C/r^2}\,dr = \pi\left(\frac{B}{\sqrt A} - \sqrt C\right)$, check). [notebook p. 72 has the integral, I didn't copy the substitution]

for radial WKB, the Langer correction replaces {{c1::$l(l+1)$ by $\left(l+\frac12\right)^2$}}, and then WKB reproduces the hydrogen spectrum exactly ^qm4-langer

## still to type

- lecture 20 second half: WKB for the radial equation, Langer correction $l(l+1) \to (l + \frac12)^2$ [notebook p. 72]
- the "double well" splitting $\Delta E \approx \frac{\hbar\omega}{\pi}e^{-\gamma}$ — I have this on p. 73 but the derivation skips a step
- photo of the board: connection formulas, both directions
