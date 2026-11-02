---
type: source
title: "ch. 4: ideal quantum gases"
pdf: ../lindqvist-statistical-physics.pdf
pages: 29-34
imported: 2026-10-22
read: due=2026-10-31 ivl=3 reps=1 pos=29 y=0.713
author: H. Lindqvist
---

## quantum concentration — when wavefunctions overlap
<!-- read made=2026-10-29 due=2026-10-31 ivl=2 reps=1 boxes=29:0.129:0.553:0.762:0.160 -->

the quantum concentration, and the condition for an ideal gas to be classical :: $n_Q = 1/\lambda^3 = (2\pi mkT/h^2)^{3/2}$; classical when $n \ll n_Q$ ^lq4-nQ
<!-- sr due=2026-11-02 st=review s=3.6 d=5.5 r=2 l=0 ivl=4 last=2026-10-29T20:40:00Z g=3 -->

Checked the electron number myself (Thu night): $\lambda_e$ at 300 K $= h/\sqrt{2\pi m_e kT} \approx 4.3$ nm, cube $\approx 8\times10^{-26}$ m³, times $n_{\text{Cu}} = 8.5\times10^{28}$ gives $\approx 7\times10^3$. OK, "order $10^4$." Wrote $10^3$ in the course notes first, fixed it.

Same thing three ways — they're all one condition: $n\lambda^3 \ll 1$ (book), $V/N\lambda^3 \gg 1$ (what's inside the log in $\mu$ and in Sackur–Tetrode), $\bar n \ll 1$ for every orbital (lecture 17). And the Sackur–Tetrode $S$ goes negative when $V/N\lambda^3 < e^{-5/2}$, which is the formula telling you it's being used outside its regime. That's problem 2.6, which I did wrong in September.

why does the Sackur–Tetrode entropy going negative at low $T$ not violate the third law?
?
it happens only when $n\lambda^3$ is no longer small, i.e. outside the classical regime the formula assumes; the real (quantum) gas has $S \to 0$ ^lq-ex-st-negative
<!-- sr st=new -->
