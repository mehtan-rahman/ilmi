---
type: extract
title: expand S_R, not Ω_R
imported: 2026-10-21
read: due=2026-10-29 ivl=4 reps=2 pos=1
---

It is essential to expand $S_R$ rather than $\Omega_R$: the multiplicity changes by an enormous factor even for a small change in energy, while its logarithm changes smoothly.

Making this concrete for myself (night before the midterm, 10/20). Take the reservoir to be a high-$T$ Einstein solid with $N_R$ oscillators, $\Omega_R \approx (eq_R/N_R)^{N_R}$, i.e. $\Omega_R \propto U_R^{N_R}$. Remove one quantum $\epsilon$ from $U_R$:

$$
\frac{\Omega_R(U_R - \epsilon)}{\Omega_R(U_R)} = \left(1 - \frac{\epsilon}{U_R}\right)^{N_R} \approx e^{-N_R\epsilon/U_R} = e^{-\epsilon/kT}
$$

using $U_R = N_R kT$. The linear expansion of $\Omega_R$ would give $1 - N_R\epsilon/U_R = 1 - \epsilon/kT$, which goes negative once $\epsilon > kT$. Nonsense. The log is linear to excellent accuracy: $\ln\Omega_R = N_R\ln U_R + \ldots$, and $N_R\ln(U_R - \epsilon) = N_R\ln U_R - N_R\epsilon/U_R - N_R\epsilon^2/2U_R^2 - \ldots$; the quadratic term is $(\epsilon/kT)^2/2N_R$, which vanishes as $N_R\to\infty$. So the exponential isn't an approximation that happens to work: it's the $N_R\to\infty$ limit of $(1 - x/N_R)^{N_R}$.

for a reservoir with $\Omega_R \propto U_R^{N_R}$, why does removing energy $\epsilon$ give exactly a Boltzmann factor as $N_R \to \infty$?
?
$\Omega_R(U_R - \epsilon)/\Omega_R(U_R) = (1 - \epsilon/U_R)^{N_R}$ with $U_R = N_R kT$, i.e. $(1 - x/N_R)^{N_R} \to e^{-x}$ with $x = \epsilon/kT$ ^lq-ex-expand-limit
<!-- sr due=2026-10-29 st=review s=3.4 d=6.5 r=2 l=0 ivl=3 last=2026-10-26T19:15:00Z g=2 -->
