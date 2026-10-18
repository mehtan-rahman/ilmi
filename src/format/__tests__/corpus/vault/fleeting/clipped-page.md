---
type: source
title: "Spaced repetition: a field guide"
frozen: true
imported: 2026-05-28
url: https://example.org/notes/spaced-repetition
author: Jane Doe
published: 2026-05-20
---

A clipping the intake landed from a page, with the marks a page brings: *emphasis*, **strong**, `code`, and a [link back to the page](https://example.org/notes/spaced-repetition#intro). A ratio written a::b in the page stays prose, and a template written { {x} } stays text.[^1]

## How the interval grows

- the first pass is a day
- each pass multiplies by the growth factor
- a lapse starts over

| grade | meaning |
| --- | --- |
| 1 | again |
| 3 | good |

```python
def next_interval(ivl, af):
    return max(1, round(ivl * af))
```

![the forgetting curve](clipped-page/img-01.png)

> Retrieval is the thing that lasts.

## notes

[^1]: The footnote the page carried, kept at the end.
