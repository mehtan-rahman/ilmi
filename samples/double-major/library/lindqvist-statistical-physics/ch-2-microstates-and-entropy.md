---
type: source
title: "ch. 2: microstates and entropy"
pdf: ../lindqvist-statistical-physics.pdf
pages: 17-22
imported: 2026-09-05
read: due=2026-12-06 ivl=41 reps=5 pos=22 y=0.430
author: H. Lindqvist
---

## 2.2 · two models: the paramagnet and the Einstein solid (2.3)
<!-- read made=2026-09-06 boxes=18:0.113:0.350:0.760:0.271 -->

multiplicity of an Einstein solid, $N$ oscillators sharing $q$ units of energy :: $\binom{q+N-1}{q}$ ^lq2-einstein-omega
<!-- sr due=2026-11-24 st=review s=32.5 d=3.6 r=5 l=0 ivl=32 last=2026-10-23T07:35:00Z g=3 -->

## the multiplicity peak is a Gaussian of width q/2√N
<!-- read made=2026-09-09 due=2027-01-12 ivl=66 reps=5 boxes=19:0.130:0.877:0.761:0.042,20:0.112:0.047:0.759:0.108 -->

relative width of the multiplicity peak for two Einstein solids of $N$ oscillators :: of order $1/\sqrt{N}$ ^lq2-peak-width
<!-- sr due=2026-10-30 st=review s=21.8 d=4.5 r=4 l=0 ivl=22 last=2026-10-08T08:44:00Z g=3 -->

My own version, so I can get to it from a blank page: $\ln\Omega_{\text{tot}} = N\ln q_A + N\ln q_B + \text{const}$. Expand around $q/2$: the linear terms cancel (equal and opposite), the quadratic term is $-N x^2/(q/2)^2 \cdot$ … careful: $\ln(q/2 + x) + \ln(q/2 - x) = \ln((q/2)^2 - x^2) \approx 2\ln(q/2) - x^2/(q/2)^2$. Times $N$: exponent $-4Nx^2/q^2 = -N(2x/q)^2$. ✓ matches the book.

Width read off $e^{-x^2/2\sigma^2}$ vs $e^{-x^2/(q^2/4N)}$: that gives $2\sigma^2 = q^2/4N$, so $\sigma = q/(2\sqrt{2N})$, not $q/2\sqrt N$. The book's "width" is the $1/e$ half-width, not the standard deviation. Doesn't matter for the $1/\sqrt N$ point. [noted in margin, Okonkwo uses the $1/e$ convention too]

Gaussian width of the two-solid multiplicity peak, as Lindqvist defines it ($1/e$ half-width) :: $q/(2\sqrt N)$, relative to the peak position $q/2$ it's $1/\sqrt N$ ^lq-ex-sharp-width
<!-- sr due=2026-12-14 st=review s=45.2 d=3.4 r=5 l=0 ivl=45 last=2026-10-30T07:48:00Z g=3 -->

## 2.5 · entropy and temperature (2.12)
<!-- read made=2026-09-07 boxes=20:0.112:0.513:0.763:0.161 -->

the statistical definition of temperature :: $1/T = (\partial S/\partial U)_{N,V}$ ^lq2-def-T
<!-- sr due=2026-11-16 st=review s=28.7 d=2.9 r=5 l=0 ivl=29 last=2026-10-18T08:22:00Z g=3 -->

## the N! only works when states are sparsely occupied
<!-- read made=2026-09-12 due=2026-10-28 ivl=21 reps=3 boxes=21:0.129:0.357:0.758:0.116 -->

Why the caveat: $N!$ assumes every permutation of the $N$ particles gives a *different* assignment that we're over-counting. If two particles are in the same state, swapping them doesn't give a different assignment even for distinguishable particles, so we've divided by too much. Two particles, two states: distinguishable count = 4 (both in 1, both in 2, A in 1 and B in 2, A in 2 and B in 1). Bosons: 3 (both in 1, both in 2, one each). $4/2! = 2 \ne 3$. Fermions: 1. $1/N!$ is between them and right for neither, only good when double occupancy is rare.

[Came back to this 10/28 after lecture 17: in the grand canonical language, $1/N!$ is exactly the $\bar n \ll 1$ limit of both FD and BE. See course notes, quantum gases tab. Chapter 4 does it in §4.1 — haven't got there in the book yet.]

two identical particles, two single-particle states: number of two-particle states for bosons, for fermions, and the $N!$ estimate
?
bosons 3, fermions 1, classical $2^2/2! = 2$ — right for neither, because the $N!$ over-divides the doubly-occupied states ^lq-ex-nfact-count
<!-- sr due=2026-10-29 st=review s=5.8 d=6.4 r=3 l=1 ivl=6 last=2026-10-23T08:40:00Z g=3 -->

## 2.6 · the multiplicity of an ideal gas
<!-- read made=2026-09-08 boxes=21:0.129:0.655:0.763:0.190 -->

entropy of mixing two different ideal gases, $N$ atoms each, each expanding from $V$ to $2V$ :: $\Delta S = 2Nk\ln 2$ ^lq2-mixing
<!-- sr due=2026-11-21 st=review s=30.4 d=3.8 r=4 l=0 ivl=30 last=2026-10-22T08:01:00Z g=4 -->
