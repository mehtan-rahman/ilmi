# A PDF's pages as a native view on iOS: the plan (phase 1)

Status: approved (B). Phases 1 and 2 are built behind the settings' `book pages: native` (`PdfSurface.swift`, `PdfText.swift`); 3 and 4 to come. The prototype (`src-tauri/ink/ios/Sources/Reader.swift`, `ink_reader`, dev builds only;
`pdfink` `"part": "reader"`) is measuring code. It is not the reader, and nothing a user has uses it.

## Why

The device's zoom log (iPad Air 5, M1) shows the app's tiles drawing in 6 ms each and every zoom sharp 34 to 95 ms
after its layout. Yet the user finds it "not really what i'd like ... goodnotes is just completely seamless". The
time left is the web view's zoom model:

1. a CSS transform during the gesture;
2. a relayout at its end;
3. new pixels swapped in.

A `UIScrollView` zooming tiled layers at the display's rate cannot be matched from inside a web view. On iOS the
pages, their zoom and scroll, and the ink go native. The web view keeps the chrome: tabs, the bar, panes, menus and
sheets. The Mac keeps pdf.js.

There is a precedent in the repo: a notebook's pages on an iPad are already a native `UIScrollView` laid over the
web view (`Surface.swift`, `NoteSurface`, milestone 87). It speaks with the page through `ink_surface` (a spec sent
when it changes) and `ink_surface_do` (go, zoom, settle, picture). It reports its place and zoom, and has holes
where the page lays something over it. The PDF reader follows the same contract.

## What was measured

Setup:
- Air 11 simulator, iOS 27.2, on this Mac's M5.
- 60 Hz frames from a `CADisplayLink` on the native side.
- `vector.pdf` (600 pages of outlines, 52 MB) and `scan.pdf` (300 scanned pages, 417 MB).
- Zoom by the bar's way (animated to 200%, 50%, fit), two fingers (rig: spread 160 to 400 pt, closed 420 to 130 pt
  over 0.9 s), a scroll of three pages, a fling, and a scroll at 250%.

The two candidates:
- **A**: PDFKit's `PDFView`, continuous, with a `PKCanvasView` over each page by `PDFPageOverlayViewProvider`.
- **B**: a `UIScrollView` zooming a column of page views, each a `CATiledLayer` (7 levels, bias 4, no fade, 512 px
  tiles) drawing CGPDF on the layer's threads, a picture of the page at the fitted size made ahead under it, and a
  canvas over it.

How each was measured:
- **Frames late**: interval over 1.5 frames. Measured on the passes with no screenshots.
- **Coarse (B only, exact)**: the share of the view whose finest tile drawn is under the level the zoom settles at.
- **Edge sharpness (both)**: every 4th frame, a 160 pt square at the middle of the view is captured with
  `drawHierarchy`. Each capture's share of steep pixel steps is compared with how it ends: a look counts as
  "blurry" if it is 15% under the end. These passes have more late frames because capturing costs time.

| | A: PDFView | B: tiled scroll view |
|---|---|---|
| open (vector / scan) | 706 / 1526 ms | 319 / 120 ms |
| bar to 200% / 50% / fit: late frames | 1 / 1 / 1 (longest 151 ms) | 1 / 1 / 0 (longest 84 ms) |
| pinch spread, vector: late frames; blurry looks | 5, **one stall of 1258 ms** at its start; 0 of 55 | 2 (longest 51 ms); 0 of 51 (coarse in 14 frames, last at 1.7 s, i.e. as the fingers end) |
| pinch closed, vector: blurry looks | 9 of 50, last at 927 ms | 9 of 57, last at 821 ms |
| pinch spread, scan: blurry looks | 15 of 50, last at 1442 ms | 13 of 50, last at 1189 ms |
| scroll 3 pages / fling: late frames | 2 / 3 (longest 133 ms) | 3 / 4 (longest 57 ms) |
| scroll at 250%, vector: blurry looks | 7 of 31, last at 628 ms | 1 of 31 by the look; **coarse in 78 frames for 1.28 s** by the tiles |
| scroll at 250%, scan: blurry looks | 1 of 30 | 13 of 31, last at 971 ms; coarse in 72 frames |
| ink: written, moved by the lasso, erased | yes, yes, yes | yes, yes (no on the first run), yes |
| tile draw | (PDFKit's own) | 5–6 ms (vector), 13–18 ms (scan) |

What it says:
- **Both are native-smooth.** Neither drops frames in a pinch, a scroll or a fling the way the web reader's handover
  did. The relayout, the swap and the jump at the end of a pinch do not exist in either.
- **A had one long stall.** PDFKit held the main thread 1.26 s at the start of its first pinch, and sharpened a
  scanned page up to 1.4 s after a pinch.
- **B never stalled** (nothing over 84 ms without screenshots). Its weak spot is CATiledLayer's laziness: it draws only
  tiles already in view. Scrolling at 250% shows the fitted picture under undrawn tiles for about a second (0.4 of
  the pixels at 250%). That is fixable in B: our own tile manager with a margin and prefetch, the same as the web
  reader's bands, or a second picture at twice the fitted size under the tiles when zoomed past 150%.
- **The simulator's limits.** It runs at 60 Hz on a Mac's processor. The iPad's 120 Hz and its own CPU and GPU
  were not seen. CATiledLayer and PDFKit both draw on background threads, so the main-thread stall above is the
  number that should transfer.

## Recommendation: B, with PDFKit's document model for text and links

B, the tiled scroll view, for these reasons:
- **Control of every pixel.** We decide what shows under a tile and when, the dark theme's turn, the tags beside a
  page, the boxes, the read point. PDFView decides those for itself.
- **No main-thread stall**, against A's 1.26 s.
- **One page view for notebooks and books.** The notebook surface is already a `UIScrollView` of pages with our own
  ink engine (live strokes, eraser, lasso, shapes, undo, the sheet model and storage). A PDF page becomes a sheet whose
  paper is the PDF's page.
- **The text and the links still come free.** They come from `PDFDocument` and `PDFPage`, used as a model without
  `PDFView`: `selection(from:to:)`, `selectionForWord(at:)`, `selectionsByLine()`, `bounds(for:)`, `characterIndex`,
  `string`, `annotations` (links), `findString`. A is only ahead in that its selection loupe and handles come
  ready-made.

Two changes to B before porting:
1. **Our own tiles in place of CATiledLayer.** Bands drawn on a pool of threads (the web reader's `pages.rs` way,
   natively), with a margin of half a view, kept per level until the next level covers the view. The aim is to
   remove the 1.28 s of coarse frames when scrolling zoomed in. A second picture at twice the fitted size goes under
   the tiles past 150%.
2. **The ink at the zoom's scale.** The canvases redraw at the zoom's scale when it ends (the prototype sets
   `contentScaleFactor`). The live stroke stays on the one canvas that stands still over the view, as the notebook
   surface does.

## Each feature, and how it moves

A spec from the page (`ink_surface` with `kind: "pdf"`) carries:
- where the view lies and its holes;
- the file's path in the store, the page sizes, the zoom, the place to open at;
- the marks (highlights, boxes, the ruler, the read point, portals, search hits), all in fractions of a page;
- the theme's colours and `tagRoom`.

The surface answers with events on the `onSurface` channel. Commands go by `ink_surface_do`.

| Feature | Native | How |
|---|---|---|
| Text selection and copy | yes | A held finger or a double tap selects through `PDFPage.selectionForWord(at:)` and drags by `selection(from:to:)`. It is drawn as layers from `selectionsByLine()` quads, with handles and loupe. Copy is through `UIEditMenuInteraction`. The page hears `selection { text, page, quads, rect }`, quads in the web reader's `Quad` form. |
| Search and its hits | the drawing | The search stays in JS (pdf.js's text, the same results on the Mac). The hits go to the surface as marks (`hit`, `cur`). `go` brings the current hit into view; the surface may also use `findString` if JS's text is not loaded. |
| Links | yes | From `PDFPage.annotations` (`PDFAnnotationSubtype.link`: a URL or a destination), read as a page comes near. A tap inside a page goes there natively and tells the page (`link { from, to }`) so the trail (back and forward) is kept. A URL is told to the page, which opens it. |
| Cross-book portals | the drawing | They are JS data. Their marks are drawn by the surface; a tap says `mark { key }` and JS opens the book beside, as today. |
| Highlights and boxes | the drawing | Marks drawn as vector layers in the page's coordinates, so they are sharp at any zoom. A box is drawn by a held finger as the notebook surface already does (`box` event). Tags beside the first box are drawn in the gutter (`tagRoom`). |
| Extracts from a selection or a box | the actions stay in JS | The surface says what was selected or boxed. The `passage` and `card` bar (`.pend`) stays web, put at the rect the surface gives, and is a hole in the surface. `makeSection` and `cardOrClip` are unchanged. |
| The read point and section overlays (ruler, done-for-today point, following) | the drawing | Marks of their own kinds. The surface says the page and fraction at the view's foot (`place`), which is what the read point reads today. |
| Page jump and the page counter | yes | `place { page, y, x, zoom }` is said when a scroll or zoom settles, and throttled to a few a second while it moves (for the counter only). `go { page, y, x }` is a jump; the jump's waiting for the page's picture (`whenSeen`) is native. |
| The dark theme's turn | yes | Drawn turned in the tile (after `drawPDFPage`, a white fill with the difference blend, then the 0.92 by a grey under it), so it costs nothing per frame. The fitted pictures likewise. |
| The book-head rows (title, notes, bar) | stay web | The surface lies under them with `pad.top` room. It says its offset while it moves, and the rows follow by a transform only. Pulling them in and out (`pullsStay`) reads that offset. |
| Panes beside and stacked | yes | One surface a pane, by id, as notebooks already do. A pane resized sends a new rect, and the surface lays out again at the same place. |
| Kept zoom and position | the store stays in JS | `bookZooms`, `places` and the trail are JS's, from the surface's `place` events. On opening, the spec's `open` and `zoom`. |
| The PDF's opening and big files | yes | The surface opens the file from the store's path (`page_file`); the 417 MB scan opened in 120 ms in B. pdf.js is no longer needed on iOS for drawing. It may stay in a worker for the text JS's search and the lens's reading use. |
| Ink: written, erased, lasso, shapes, undo | yes | The notebook surface's engine, with a sheet a PDF page (`p.<hash>.<page>`, as today). It has one standing canvas for the live stroke and strokes drawn by us. Storage and sync are unchanged. |
| Overlays from the page (menus, sheets, notices) | holes | `holesOver`, as the notebook surface does. A full-cover sheet veils the surface with its picture (`surfacePicture`). |

**Sync, in short.**
- The page owns the data: marks, highlights, portals, places, the trail, the zoom stored, and every action (extract,
  card, bookmark).
- The surface owns the pixels and the gestures: scroll, zoom, selection, box, ink.
- The page tells the surface what changed, never per frame.
- The surface tells the page the place when a gesture settles, selections and boxes when they end, taps on marks and
  links, and ink as today.
- Commands from the page: `go`, `zoom` (animated), `select` (clear or set), `flash` a mark, `picture`.

## Phases after this one

1. **The surface for PDFs, B with our own tiles:** drawing, zoom, scroll, the fitted pictures, the dark turn, place
   events, `go`, `zoom`, holes, panes. Behind a setting, the web reader kept.
2. **Ink on it:** the notebook surface's engine shared, not copied. The ink agent's files are touched with them.
3. **Marks:** highlights, boxes and their tags, the ruler, the read point, portals, search hits.
4. **Text:** selection, copy, the edit menu's actions, links and the trail.
5. **The checks:** `zoomfeel`'s measures moved native (`CADisplayLink`: frames late, frames coarser than they settle,
   time to sharp), the device's zoom log likewise, then the setting removed on iOS.
