---
type: extract
title: quantum concentration — when wavefunctions overlap
imported: 2026-10-29
read: due=2026-10-31 ivl=2 reps=1 pos=1
---

It is convenient to define the *quantum concentration* $n_Q = 1/\lambda^3$. A gas whose density $n = N/V$ is small compared with $n_Q$ behaves classically; one whose density is comparable to or larger than $n_Q$ does not. Physically, $\lambda$ is the length over which an atom's wavefunction is spread at temperature $T$; the classical description fails when the wavefunctions of neighbouring particles overlap.

For air at room temperature the ratio $n/n_Q$ is of order $10^{-7}$, and the classical treatment is superb. For the conduction electrons in a metal, which are both light and dense, $n/n_Q$ is of order $10^4$, and the classical treatment is not merely inaccurate but qualitatively wrong. Between these extremes lie liquid helium, white dwarf stars, and laboratory gases of ultracold atoms.

Checked the electron number myself (Thu night): $\lambda_e$ at 300 K $= h/\sqrt{2\pi m_e kT} \approx 4.3$ nm, cube $\approx 8\times10^{-26}$ m³, times $n_{\text{Cu}} = 8.5\times10^{28}$ gives $\approx 7\times10^3$. OK, "order $10^4$." Wrote $10^3$ in the course notes first, fixed it.

Same thing three ways — they're all one condition: $n\lambda^3 \ll 1$ (book), $V/N\lambda^3 \gg 1$ (what's inside the log in $\mu$ and in Sackur–Tetrode), $\bar n \ll 1$ for every orbital (lecture 17). And the Sackur–Tetrode $S$ goes negative when $V/N\lambda^3 < e^{-5/2}$, which is the formula telling you it's being used outside its regime. That's problem 2.6, which I did wrong in September.

why does the Sackur–Tetrode entropy going negative at low $T$ not violate the third law?
?
it happens only when $n\lambda^3$ is no longer small, i.e. outside the classical regime the formula assumes; the real (quantum) gas has $S \to 0$ ^lq-ex-st-negative
<!-- sr st=new -->
