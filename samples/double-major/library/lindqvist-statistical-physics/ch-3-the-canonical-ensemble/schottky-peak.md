---
type: extract
title: the Schottky anomaly
imported: 2026-10-06
read: due=2026-10-30 ivl=5 reps=2 pos=1
---

It vanishes at both low and high temperature, and has a broad maximum, of height about $0.44\,Nk$, near $kT = 0.42\,\epsilon$. The vanishing at low temperature is a consequence of the energy gap, and is shared by every system with a gap above its ground state. The vanishing at high temperature is peculiar to systems with a bounded spectrum: once the two levels are equally populated, raising the temperature cannot raise the energy. The maximum, observed in the low-temperature heat capacity of many paramagnetic salts and of materials with low-lying split electronic levels, is known as the *Schottky anomaly*.

Where the numbers come from (did this for pset 6, #2). Maximize $f(x) = x^2e^x/(e^x+1)^2$. Setting $f'(x) = 0$ gives

$$
x\tanh(x/2) = 2
$$

(write $f = x^2/(4\cosh^2(x/2))$, so $\ln f = 2\ln x - 2\ln\cosh(x/2) + \text{const}$, derivative $2/x - \tanh(x/2) = 0$.) Solve numerically: $x = 2.4$ gives $2.4\times\tanh 1.2 = 2.4\times0.834 = 2.00$. So $x^* \approx 2.40$, $kT^* = \epsilon/2.40 = 0.417\,\epsilon$. Height: $f(2.4) = 5.76/(4\cosh^2 1.2) = 5.76/(4\times3.278) = 0.439$. ✓ both of the book's numbers.

The $\cosh$ form is much nicer than the one in my course notes. Use it on the final.

How to use it experimentally: if you see a bump in $C(T)$ at $T^*$ and it's two-level-like, $\epsilon \approx 2.4\,kT^*$. Height tells you $N$ (number of impurities/ions). E.g. Problem 3.7: $\epsilon = 1.0$ meV gives $T^* = 1.0\text{ meV}/(2.40\,k) \approx 4.8$ K.

the condition for the Schottky maximum, with $x = \epsilon/kT$ :: $x\tanh(x/2) = 2$, so $x \approx 2.40$ ^lq-ex-schottky-cond
<!-- sr due=2026-10-30 st=review s=4.9 d=6.2 r=2 l=0 ivl=5 last=2026-10-25T18:30:00Z g=3 -->

two-level heat capacity written with a hyperbolic function :: $C = Nk\,\dfrac{x^2}{4\cosh^2(x/2)}$, $x = \epsilon/kT$ ^lq-ex-schottky-cosh
<!-- sr st=new -->
