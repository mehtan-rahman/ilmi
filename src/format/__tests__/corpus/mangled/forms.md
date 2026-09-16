std::vector is prose because the separator has no spaces around it
and a::b on the next line is the same

front :: back ^inline-qa
<!-- sr due=2026-01-01 st=new -->

left ::: right ^inline-bidir

a question that wraps
onto a second line
?
an answer that also
wraps ^multi-qa
<!-- sr due=2026-01-01 st=review s=3 d=4 r=1 l=0 -->

Begriff
??
concept ^multi-bidir

a card whose second line
	is tab-indented, lazy, and stays in the card :: with an answer   
^own-line-id
<!-- sr due=2026-01-01 -->

:: empty front makes prose

empty back makes prose too ::

?
a lone question mark on the first line is prose

a paragraph with an ^id-in-the-middle of a line and one at the end ^prose-id

## a heading keeps its ^literal

a q :: a ^first ^second
<!-- sr due=2026-01-01 -->

a {{c1::cloze}} that also has :: a separator is a cloze ^cloze-wins

{{c1::}} numbered with an empty answer is still a blank ^empty-answer
