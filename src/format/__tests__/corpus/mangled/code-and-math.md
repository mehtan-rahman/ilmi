```md
{{c1::not a card}} inside a fence
<!-- sr due=2026-01-01 -->
```

~~~
a tilde fence with a {{blank}} and ` backticks ` inside
~~~

pay $5 and $10 for a {{c1::coffee}} ^money

the inner braces belong to tex: {{c1::$x^{a^{b}}$}} and so do these $\{\{x\}\}$ ^tex-inside

display math with a {{ brace pair inside: $$\binom{n}{{k}}$$ and a real {{c2::blank}} after it ^display

$$
f(x) = \sum_{i} {{c1::x_i}}
$$

nested {{c1::{{x}}}} braces, then {{c2::a} }} with a split closer, then an unterminated {{c3::open ^nested

{{}} and {{ }} are empty and literal, so this is prose

```js
unterminated fence swallows to the end of the file

even across blank lines
