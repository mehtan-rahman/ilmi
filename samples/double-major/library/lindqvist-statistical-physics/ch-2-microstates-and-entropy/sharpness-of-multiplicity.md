---
type: extract
title: the multiplicity peak is a Gaussian of width q/2√N
imported: 2026-09-09
read: due=2027-01-12 ivl=66 reps=5 pos=3
---

The peak is a Gaussian of width $\sigma_x = q/2\sqrt{N}$. For a macroscopic solid with $N \sim 10^{20}$, the width is smaller than the peak position $q/2$ by a factor of order $10^{-10}$. A deviation from the most probable division large enough to be measured would require $x$ to be many times $\sigma_x$, and the Gaussian falls off so steeply that such a deviation will never be observed.

My own version, so I can get to it from a blank page: $\ln\Omega_{\text{tot}} = N\ln q_A + N\ln q_B + \text{const}$. Expand around $q/2$: the linear terms cancel (equal and opposite), the quadratic term is $-N x^2/(q/2)^2 \cdot$ … careful: $\ln(q/2 + x) + \ln(q/2 - x) = \ln((q/2)^2 - x^2) \approx 2\ln(q/2) - x^2/(q/2)^2$. Times $N$: exponent $-4Nx^2/q^2 = -N(2x/q)^2$. ✓ matches the book.

Width read off $e^{-x^2/2\sigma^2}$ vs $e^{-x^2/(q^2/4N)}$: that gives $2\sigma^2 = q^2/4N$, so $\sigma = q/(2\sqrt{2N})$, not $q/2\sqrt N$. The book's "width" is the $1/e$ half-width, not the standard deviation. Doesn't matter for the $1/\sqrt N$ point. [noted in margin, Okonkwo uses the $1/e$ convention too]

Gaussian width of the two-solid multiplicity peak, as Lindqvist defines it ($1/e$ half-width) :: $q/(2\sqrt N)$, relative to the peak position $q/2$ it's $1/\sqrt N$ ^lq-ex-sharp-width
<!-- sr due=2026-12-14 st=review s=45.2 d=3.4 r=5 l=0 ivl=45 last=2026-10-30T07:48:00Z g=3 -->
