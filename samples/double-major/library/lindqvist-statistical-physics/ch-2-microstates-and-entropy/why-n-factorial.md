---
type: extract
title: the N! only works when states are sparsely occupied
imported: 2026-09-12
read: due=2026-10-28 ivl=21 reps=3 pos=1
---

We must also account for the indistinguishability of the particles. Interchanging two identical atoms does not produce a new microstate, so the count must be divided by the $N!$ permutations of the particles among their states. This correction is valid only when the number of available states vastly exceeds $N$, so that two particles are rarely found in the same state; the general case is the subject of Chapter 4.

Why the caveat: $N!$ assumes every permutation of the $N$ particles gives a *different* assignment that we're over-counting. If two particles are in the same state, swapping them doesn't give a different assignment even for distinguishable particles, so we've divided by too much. Two particles, two states: distinguishable count = 4 (both in 1, both in 2, A in 1 and B in 2, A in 2 and B in 1). Bosons: 3 (both in 1, both in 2, one each). $4/2! = 2 \ne 3$. Fermions: 1. $1/N!$ is between them and right for neither, only good when double occupancy is rare.

[Came back to this 10/28 after lecture 17: in the grand canonical language, $1/N!$ is exactly the $\bar n \ll 1$ limit of both FD and BE. See course notes, quantum gases tab. Chapter 4 does it in §4.1 — haven't got there in the book yet.]

two identical particles, two single-particle states: number of two-particle states for bosons, for fermions, and the $N!$ estimate
?
bosons 3, fermions 1, classical $2^2/2! = 2$ — right for neither, because the $N!$ over-divides the doubly-occupied states ^lq-ex-nfact-count
<!-- sr due=2026-10-29 st=review s=5.8 d=6.4 r=3 l=1 ivl=6 last=2026-10-23T08:40:00Z g=3 -->
