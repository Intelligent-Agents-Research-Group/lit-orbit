# Lit Orbit

An orbit view of a literature batch. Your course sits at the centre; every
study is a dot that orbits it. The ring a dot sits on is its evidence tier
(tier 1 innermost), the wedge is a category of your choice (for example the
role the AI played), and the bolder a dot is drawn, the more of your course
settings it shares:

- a study that shares **every** setting is solid and ringed;
- one that misses **one** setting is half-transparent;
- one that misses **more** is not drawn at all.

A batch set up here can also be published as a website of its own, to link to
from a paper - see [Publishing a site](#publishing-a-site).

## Running it

```bash
npm install
npm run dev
```

Other scripts: `npm run build` (type-check + production build into `dist/`),
`npm run preview` (serve the build), `npm run lint`, `npm run format`
(Prettier, 120 columns and single quotes - see `.prettierrc`), `npm test`.

`npm test` runs the tests of `src/lib` and `src/data` in Node, and
`src/App.test.tsx`, which renders the whole app in jsdom: which screen comes
up, and what it makes of what the browser kept and what the address names.
GitHub Actions lints, tests and builds every push and pull request
(`.github/workflows/check.yml`), forks included. A push to `main` is also
built and put up on GitHub Pages (`.github/workflows/pages.yml`), at
<https://intelligent-agents-research-group.github.io/lit-orbit/>.

Publishing a site copies the built app. `npm run preview` and the deployed app
copy the build they serve; `npm run dev` has none, so publishing from it builds
one first, which takes a few seconds.

## The landing page

The app opens on a landing page: what Lit Orbit is, when to reach for it and
when another picture serves better (a grid of gaps, a pooled effect, a figure
in print), a tutorial on how to read an orbit (the centre, the rings, the
wedges, a full match and a near miss, and the four steps a file goes through
to become one), and two ways in:

| Button | What happens |
| --- | --- |
| **View an example** | the batch that ships with the app, already set up, straight on the orbit |
| **Build your own** | three setup pages (below), then the orbit drawn from the user's own CSV / TSV / XLSX / JSON |

The choice is kept, so a reload goes straight back to the orbit. *Change data
source* in the header reopens the landing page, and leaves everything as it
was unless another choice is made.

## Building your own

Between the landing page and the orbit sit three pages, with a step indicator
at the top and *Back* / *Next* at the bottom. Any page can be gone back to at
any time.

1. **Your file.** The course name, which is written in the circle at the
   centre of the orbit (optional - left empty, the centre reads *GenAI and
   CS Ed*, as the example does, whatever filters are set); the file itself,
   with a note on the shape of table that reads best; which line the column
   names are on (and which sheet, for a workbook); and the *file check* - what
   the reader made of the table's shape, with an instruction to hand to an AI
   assistant when it strays (see [Checking the file](#checking-the-file)).
2. **Your columns.** How each column's cells are read - one value or several,
   what to cut off, which numbers to group - beside the first rows of the
   data. Clicking a rule lights its column in the table and lists every value
   the column yields under that rule, with a count for each, so a rule is
   judged by what it leaves rather than in the abstract.
3. **Your orbit.** Which column plays which role (label, wedges, colour, dot
   size, tier column) and how the evidence tiers are decided, next to a
   live orbit that redraws as they change. *Show the orbit* leaves the setup.

Everything on these pages is a guess made from the file until someone who has
seen the file says otherwise, and the order is fixed because every choice on
the later pages is named by a column the first page decides the names of.

It is not a one-way door: the same controls stay in the panel beside the
orbit, and *Edit setup* in the header reopens the first page. The example has
no setup pages - it is already set up.

### Privacy

Files are read inside the browser: there is no server, no upload, no account
and no copy kept anywhere. What the app does keep is local: the batch, how it
is read, the filters and the tier rules go into this browser's
`localStorage` so a reload does not lose the setup. *Clear stored data* on the
landing page removes all of it (the light / dark choice, the panel widths and
the code tab of the file check are kept: they say nothing about the data).

A browser gives a page a few megabytes of that, which a large batch of long
answers can exceed. The app says so when it happens rather than letting the
reload after it come back to a different batch: everything works for the rest
of the session, and the next visit starts on the landing page, asking for the
file again.

Publishing a site is a download too: the ZIP is put together in the browser,
from the files this page was served with, and nothing is sent anywhere. What
happens to it next is the author's choice - and a site on GitHub Pages is
public, every study in it included.

## The built-in batch

*Use our batch* reads `public/example-batch.xlsx` in the browser, through the
same reader a user's own file goes through: 70 studies of generative AI in
university computing courses. They are invented - no row is a real
publication - and written to show what the app does, so the file keeps the
habits real extractions have. Replacing the batch means overwriting that file:
nothing is generated and nothing is rebuilt.

What we know about it is stated in its setup, `src/data/example.ts`, rather
than guessed:

- the **column roles**, because the name-based guesses would label every study
  by its long title;
- the **column rules** (see below), because the file has conventions we know:
  three answers are written `Yes - <how>`, the tools and outcomes of a study are
  listed one per line, a study run at two course levels or in two regions is
  written `Introductory and Intermediate`, and a third of `Women (%)` is
  `Not reported`;
- the **filters** "Your course" starts with, and the **tier rules** (see
  *Evidence tiers*).

A new version of the file that renames a column keeps working: roles pointing
at a column that is gone fall back to "none", and the user picks new ones in
*Column roles*. `src/data/base.test.ts` reads the file under its setup, so an
edit that leaves the two disagreeing fails the tests.

A batch that cannot ship keeps its setup the same way. `src/data/reconciled.ts`
holds the setup of the confidential extraction the app used to open on; the
spreadsheet itself stays on the machine it is used on - `.gitignore` keeps it,
and the `private/` folder, out of the repository - and the module says how to
open the app on it locally.

## Loading data

| What | Formats | Where |
| --- | --- | --- |
| The batch (all studies) | CSV, TSV, XLSX (first sheet), JSON (array of objects) | *Build your own*, or *Batch → Load another file* |

The studies on screen go back out the same way - see [Downloading a set](#downloading-a-set).

Column names are **not fixed**: they are read from the file. After loading,
open *Column roles* to confirm or change which column is used as

| Role | Used for | Guessed from column names like |
| --- | --- | --- |
| Label | titles in lists, tooltips and the card | `label`, `title`, `citation`, `author` |
| Wedges by | splitting the circle into sectors (one value per row) | `role`, `category`, `type`, `design` |
| Colour by | dot colour (up to 8 values) | `direction`, `outcome`, `result` |
| Dot size by | dot radius (columns that are mostly numbers) | `class_size`, `participants`, `n` |
| Tier column | evidence tier read straight from the file (integers 1-5, one per row) | `tier`, `evidence`, `quality` |

*Wedges by* and *Tier column* each place a study somewhere, so both only offer
columns that hold **one value per row**. A column read as a list has no single
wedge or ring to answer with; read it as one value per cell in *Column rules*
and it is offered again.

*Dot size by* offers a column that is **mostly** numbers, not only one that is
entirely numbers: a "Not Reported" among the participant counts does not cost
you the column. The studies that hold one are drawn at the default size, as
studies with an empty cell there already are. A column grouped into bands in
*Column rules* is text rather than a scale, so it stops being offered.

How the cells themselves are read is a separate question, answered in *Column
rules*.

## Checking the file

The reader makes do with whatever table it is given - a column mixing two
separators is split on one of them, a note under the table becomes a study
with one cell - and nothing on screen would say so. So the first setup page
says, before a file is chosen, what shape reads best (`src/config/fileShape.ts`:
one table with one study per row, one question per column answered in a few
words, several answers in a cell separated the same way throughout, numbers as
plain numbers), and once a file is loaded, a **file check** (`src/lib/fileCheck.ts`)
looks it over for the shapes the reader handles badly:

| Finding | What was seen |
| --- | --- |
| No header | no line of column names was found, so the columns are numbered |
| Unnamed, repeated or sentence-long names | a column with no name, two with the same name, or a name over 60 characters (a line of data, read as names) |
| One column | only one column came out of the file, so its separator was not recognised |
| Note rows | rows holding a single cell, in a table at least four columns wide |
| Mixed separators | a column that separates values with both `;` and `,` (say), each used without the other in enough cells to be two habits rather than one inside the other |
| An unsplit separator | a column that holds lists on a character the app never splits on (`+`, `&`, `or`, `•`), or one read whole with more values than a filter may hold that would have few enough split on a separator it uses |
| Many values | a column with more distinct values than a filter may hold (15% of the rows, between 30 and 40 - see [Filters](#filters-your-course)), judged under the column's rule, so a split that shreds a column shows it. Read one value per cell with no separator in it, it is reported when some values still repeat (`MANY_VALUES_MAX_RATIO`: only a column where every cell differs is free text) - one thing spelled several ways, or categories cut finer than needed. With a separator between its values, it is reported whenever splitting on it lowers the count of distinct values yet leaves more than a filter may hold: the separator works, and is not enough |
| A second separator | a column whose values are separated by two characters - `A; B, C`, or `A, B; C, D` in every row. Found inside the pieces of a column the reader splits, or, for a column it reads whole, as two characters that lower the count of distinct values only together (split on either alone, `A, B; C, D` leaves pairs more varied than the cells were, so the reader splits on neither). Always named, however few values are left |
| Numbers in text | a column of `150 students`, `41.7%`, `n = 45` - numbers the app cannot size dots by or group into bands |
| Nested values | a JSON cell that held an object |

Every finding is a guess from the cells, worded as what was seen, and each
column's findings are shown again under its rule on the second page. The
thresholds sit with the others in `src/config/defaults.ts`.

Under the findings, folded open when there are any, sits an **instruction for
an AI assistant** (`src/lib/reshapeInstruction.ts`) with a *Copy* button: what
the file is (its name, sheet, header line and column names - which the code
needs - and no cell beyond the one a finding quotes), the shape above, the
findings as numbered points with the change each asks for, and a request for
the pandas code that writes a copy of the file in that shape next to the
original. Three tabs ask for that code in the form the user will run
(`CODE_TARGETS`), and in each it is something to run top to bottom with
nothing to edit along the way, since the point is a cleaned file rather than a
notebook to step through: a **Python script**, run with one command beside the
file; code for a **Jupyter notebook** beside the file; or code for a **Google
Colab** notebook, which asks for the file and hands the result back. A
notebook is asked for in as few cells as it takes, and one if it can be, which
assistants seldom give, so the line under the box says what comes back - code
in one cell or a few, pasted in the order given - rather than promising one
cell. Every tab also asks for code that needs nothing set or edited beyond the
file name, with the user's answers written into it, and that ends by printing
what changed. The tab chosen is kept in this browser with the light / dark
choice. The app never talks to an AI itself: the text is for the user to
paste, or not, with it in front of them.

Some things only the user can say, so the instruction has the AI ask them -
every question in one message, before it writes any code - rather than asking
them on the page:

- **What to call an unnamed column.** A column the user gives no name keeps
  the one Lit Orbit gave it (`Column 3`).
- **What each separator does**, for a column found using several: separating
  values that stay in one cell, splitting the column into separate columns
  (`tools 1`, `tools 2`, ...), or being part of the text. Lit Orbit only warns
  about such a column and reads it on one separator, so the column may keep
  one at most; any other separator between values is rewritten as the kept
  one. Unanswered, the main separator is kept.

## Column rules

A spreadsheet column does not say how it should be read, so the app guesses
and then shows the guess. *Column rules* lists every column with a
dropdown - on the second setup page, beside the first rows of the data and
every value the chosen column yields, and again in the *Batch* panel
afterwards. A rule is up to three steps:

| Step | What it does | Example cell → values |
| --- | --- | --- |
| Split | one cell holds several values | `Code generation; Debugging` → two values |
| Cut | keep only what comes before a separator | `Yes - we pre-loaded the rubric` → `Yes` |
| Band | group numbers into equal-width or equal-count bands | `41.7` → `32-43` |

Splitting is tried on `;`, `|`, a line break, `、`, `/`, `,` and the word
`and`, in that order. To be *guessed*, a delimiter has to be common in the
column, leave short parts, produce a vocabulary that repeats, and **reduce**
the number of distinct values - a character that leaves more values than the
column started with sits inside them, as the comma does in `2+ Conditions,
Random Assignment`.

To be *offered* it only has to reduce them - or be common in the column: a
delimiter in at least 8% of the column's cells is offered whatever splitting
on it does (`DELIMITER_OFFER_MIN_SHARE`). The bar is lower because the
dropdown is where the user says what the file means: one row in seventy-six
reading `300 (Junior) and 400 (Senior)` is a study that ran at two levels, not
a seventh level - but one row is far too little to guess from, and most prose
is held together by the same word. A common delimiter is offered on the same
reasoning: the reader may judge it part of the text, and the user may know
better.

Only splitting is guessed at all. Cutting and banding throw information away,
so they are offered rather than applied. Banding keeps cells that are not numbers as they
are, so `Not Reported` stays its own answer next to the bands. It is only offered for a
column with more distinct numbers than the palette has colours (`BAND_MIN_DISTINCT`):
with fewer, each number can already be a value of its own, and equal bands would
cut between them at fractions nobody wrote.

Bands are cut one of two ways (`BAND_EDGES`). **Equal width** splits the stretch
between the column's lowest and highest number into equal parts, so a band means
the same stretch of the scale wherever it sits - but one far-off number crowds the
rest together: mean ages of 19 to 23 plus one of 45, in three bands, put nine
studies in `19–27.7`, none in the middle and one in `36.3–45`. **Equal count** cuts
so that each band holds about as many studies (`19–20`, `21–22`, `23–45`), and
labels each band with the lowest and highest number actually in it. Equal numbers
always share a band, so a column where most studies give the same number can come
out with fewer bands than asked for.

## Filters ("Your course")

A column can become a filter when its distinct values number at most 15% of
the batch's rows, kept between 30 and 40 (`FILTER_MAX_CATEGORIES`): any batch
up to 206 rows allows 30, one of 207 allows 31, and the limit rises by one
about every seven rows to stop at 40 from 267 rows. A filter's column has to
be a category too - its values at most 60% as many as its filled cells
(`CATEGORICAL_MAX_RATIO`) - so in a batch of fewer than 50 rows that is what
limits it first. Past that the row of values stops reading as a setting of
one course, and a filter almost nothing satisfies leaves next to nothing on
the orbit.
The file check uses the same limit to say when a column has too many values.

A study's *match* is the number of active filters it satisfies, and it decides
how the dot is drawn (`matchLook` in `src/lib/layout.ts`). With *n* filters set:

| Match | Drawn |
| --- | --- |
| *n* | solid, with an outline |
| *n* - 1 | half-transparent (`--palette-dot-near-miss-alpha`) |
| 0 to *n* - 2 | not drawn, and cannot be hovered or clicked |

A study that shares nothing is never a near miss, so with one filter a study
either meets it or is left off. The outline can be switched off with
`RING_FULL_MATCHES` (`src/config/defaults.ts`); solid against half-transparent
then tells a full match from a near miss on its own. Hovering a dot, or
opening it, draws it solid whatever it matches, and the tooltip gives the
exact count.

The list on the right ranks the whole batch by the same count, then by tier,
and gives each study a *Match* column: a setting is a preference, not a
condition, so a study that misses one drops down the list rather than off it.
The studies the orbit leaves off are listed too, below the rest, which is the
one place they can still be opened from. *only those* narrows the list to the
studies that meet every setting.

A filter never moves a dot. Every study stays on the ring of its tier, give or
take a little jitter that keeps neighbours from overlapping. *Across* the
wedge, the studies of one (wedge, tier) cell are laid out in a fixed order -
by colour first, then by label - so a category reads as a band inside the
wedge instead of being scattered through it, and a dot keeps its slot until
the *colour by* column changes. Ordering that arc by match would cost the
picture its one steady landmark: a dot you had your eye on would slide past
its neighbours the moment you set a filter, and read as a different dot.

Each filter takes **several values at once**, because a course is not always
one thing - two course levels, two languages. Within one filter the values are
alternatives, so a study counts if it shares any of them; the filters
themselves stack up.

### Linking to a view

The address bar follows the view. Set a filter, or open a study, and the page's
address gains a fragment that names it:

```
https://example.github.io/my-orbit/#course=Course%20level:Introductory;Region:Europe&study=12
```

Copy it and whoever opens it sees the same orbit: the same settings on, the
same study open. On a published site that is how a paper can point at one
view of its batch, and how two readers can talk about the same picture.

A link beats what the browser remembers: a page opened on one shows the
link's view, and stores it only once something is changed from it. A setting
the link names on a column the panel did not list joins the panel, because a
setting with values chosen is a setting of the course wherever it came from;
one on a column the batch does not have is ignored. The fragment is rewritten
in place rather than added to the history, so the back button is not asked to
retrace every pill clicked. See `src/lib/urlState.ts`.

## Downloading a set

The right-hand panel writes back out what it is listing: the studies that meet
every setting of *Your course*, or the whole batch when nothing is set, in the
order the panel lists them. *only those* narrows the file exactly as it
narrows the panel, so what you see is what you download.

| Format | Written as |
| --- | --- |
| CSV, TSV | UTF-8 with a byte-order mark, so Excel reads the accents in a title rather than mojibake |
| XLSX | one sheet, `Studies` |
| JSON | an array of objects; numbers stay numbers and a cell holding several values stays a list |

`.txt` and `.xls` are read but not written: the first is a delimited table
under another name, which CSV and TSV already are, and the second is a format
Excel itself has been replacing for fifteen years.

The file holds **every** column of the batch as it is currently read - not only
the few the table shows - plus one the file it came from may not have: the ring
the orbit put each study on. That column is `Tier`, or `Orbit tier` where the
batch already uses the first name. A cell holding several values is written
joined on a semicolon, which is the first delimiter the reader looks for.

So a downloaded file loads straight back in, as a batch of its own.

## Publishing a site

A batch of your own, once it is set up, can be published as a website of its
own: put on GitHub Pages for free and linked to from a paper. *Publish as a
website* in the header asks for a title, a line or two about the map and the
paper it belongs to, and downloads a ZIP that is the whole site.

The site is this app with one batch in it, and it opens straight on the orbit.
Its readers get the batch exactly as its author left it, and can do three
things with it: set their own course, read every study, and download the list.
The column roles, the column rules and the evidence tiers are fixed, and the
panels that would change them are not there. The author's own course settings
stay with the author - only which filters *Your course* starts with is
published.

| In the ZIP | What it is |
| --- | --- |
| `index.html`, `assets/`, `favicon.svg` | the app, copied from the server the page came from |
| `site.json` | the batch as the file wrote it, and every choice about reading it |
| `LICENSE.txt`, `THIRD-PARTY-LICENSES.md` | the licences of the app and of the libraries it bundles |
| `README.txt`, `AGENTS.md`, `CLAUDE.md` | how to publish it: by hand in the browser, or by asking Claude Code or Codex |
| `.gitignore`, `.nojekyll` | keep those instructions out of the repository, and the site away from Jekyll |

`README.txt` walks through GitHub Pages in the browser: a new public
repository, the files uploaded into it, *Deploy from a branch*. `AGENTS.md` is
written for a coding agent, and keeps it to `git` and `gh`: it edits no file,
asks before it creates the repository, and leaves signing in to the user.

To change a site, load its `site.json` under *Build your own*. Everything comes
back - the batch, the rules, the roles, the rings and what was written about the
map - and publishing again writes a new ZIP to replace the old files with.

How the pieces fit:

- The build writes `site-files.json` next to `index.html`, listing the files a
  published site needs (see `vite.config.ts`). A page cannot list the folder it
  is served from, so publishing reads the list and fetches each file. The
  example batch in `public/` is not on it; a public file a site needs has to be
  named in `SITE_PUBLIC_FILES` (`src/config/publish.ts`).
- The development server serves the source, not a build. When a site is
  published from it, it runs `vite build` into `node_modules/.vite/site` and
  serves that build under `/@lit-orbit-site/`, so the site is made of the
  source as it is at that moment.
- A published `index.html` carries `<meta name="lit-orbit-site" content="site.json">`.
  `main.tsx` looks for it before fetching anything: with it, the page is a
  published site and reads its `site.json`; without it, the page is this app
  and reads the example.
- `base: './'` makes every path relative, so the same files work at the root of
  a host and under `/<repository>/`, where GitHub Pages serves a project site -
  this app and every site published from it alike.
- Every site one GitHub account publishes is served from one host,
  `<account>.github.io`, and a browser gives a host one storage. A published
  site stores under the name of its own folder, so the course a reader sets on
  one site is not read back on another.
- `site.json` holds the batch as a table - the column names once, then one
  study to a line - and a rule for every column, even one read whole. It is
  checked when it is read, so a hand edit that breaks it is reported by where
  it is rather than as a panel that fails to draw.

## Evidence tiers

With the built-in batch the rings are settled: every study carries a design,
the panel only reports which ring each one landed on, and there is nothing to
edit. What follows is for a batch of your own.

Tiers come either from a numeric column of the file, or from rules:

- rules are checked from tier 1 to tier 4; the first that matches wins;
- a rule is a list of conditions, all of which must hold; a condition is
  "column is any of these values";
- a rule with no conditions asks nothing, so it claims nothing: a tier you
  have named but not yet given a condition leaves the batch where it was;
- anything that matches no rule lands on tier 5.

A condition keeps only the values its column still has. Changing that column's
rule in *Column rules* rewrites the values, and a condition naming the old
spelling would otherwise stay on screen looking set while matching nothing.

The starting rules live in `src/config/tierRules.ts` and are what the built-in
batch is read with. They read its `Study design` column and rank the designs by
what each one rules out:

| Ring | `Study design` in the file |
| --- | --- |
| 1 | `Randomised controlled trial` |
| 2 | `Quasi-experimental` |
| 3 | `Single-group pre-post` |
| 4 | `Cross-sectional survey`, `Observational` |
| 5 | `Qualitative`, `Not reported`, anything else |

A ring that holds one design is named with it as the file words it, so the
label in the *Evidence tiers* panel and the cell in the file read the same.

When a file lacks the columns the rules mention, the conditions that no longer
apply are dropped and the user edits the rest in the *Evidence tiers* panel.

On the orbit, a ring is named by what puts a study on it (`tierLabelsFor` in
`src/lib/layout.ts`):

- a name typed in the panel is used as it is;
- otherwise, when every rule in use asks one thing of the same column and no
  value is named by two rings, a ring is named by its values ("A or B"), and a
  ring no rule uses is left unnamed - not every ring has to be used. The panel
  shows that name greyed out in the box where a typed one would go;
- tiers read from a column are named by the number their cells hold, without
  the column's name;
- anything else keeps its number, and so does every ring when the longest name
  does not fit across the orbit.

## Changing the look

All colours, fonts, spacing and layout sizes are CSS custom properties in
`src/styles/tokens.css`. Components and the canvas renderer only reference
tokens, so changing a value there changes it everywhere. The palette layer
(`--palette-*`) holds the raw colours; the semantic layer (`--color-*`,
`--orbit-*`) maps them to roles.

`docs/style-guide.html` shows the tokens and the components on one page, in
both palettes, with the CSS of each component beside it as plain classes that
need no React. Open it from the development server at `/docs/style-guide.html`,
or straight from the file. To carry the style to another project, take
`tokens.css` and `global.css` and copy the component rules from there.

### Light and dark

Both palettes live in the same file: the dark one re-declares only the palette
layer under `:root[data-theme="dark"]`, so a token added to the semantic layer
is themed in both without being written twice. The button in the header
switches between them; until it is used, the operating system decides.
`src/lib/appearance.ts` sets the attribute (before the first paint, so the page
never flashes), and the canvas re-reads the tokens when it changes — a
`<canvas>` cannot resolve `var(--x)` by itself.

## Project layout

```
src/
  main.tsx                 entry point
  App.tsx                  which screen is up; the state it hands them lives in hooks/
  styles/                  tokens.css (design tokens), global.css
  data/                    model.ts (types), preset.ts (a batch that comes set
                           up, and the setup it comes with), base.ts (reads
                           one), example.ts (the built-in batch's setup),
                           reconciled.ts (a private batch's setup, kept)
  config/                  defaults.ts (heuristics, thresholds), tierRules.ts,
                           fileShape.ts (the shape of table that reads best),
                           publish.ts (the files a published site is made of)
  lib/                     pure logic: parse, json, dataset, columnRules, fileCheck
                           (what the reader made of a table), reshapeInstruction
                           (the text for an AI assistant), matching, tiers, layout,
                           export, text, theme, appearance, storage,
                           site (site.json), publish (the ZIP of a site)
  hooks/                   useStoredSetup (the batch and the course, kept in
                           this browser, and the orbit derived from them),
                           useBatchLoader (files in), useLinkedView (the
                           address bar), useLocalStorageState, useAppearance
  publish/                 the README.txt and AGENTS.md every published site
                           ships with, as templates
  components/
    Landing.tsx            the landing page: the two ways in, the tutorial,
                           and the privacy note
    Setup.tsx              the three "Build your own" pages before the orbit
    OrbitScreen.tsx        the app itself: the rail, the orbit and the study
                           panel under a header
    Tutorial.tsx           the tutorial on the landing page: the orbit, and how
                           a file becomes one
    DataPreview.tsx        the first rows as they are currently read
    ColumnValues.tsx       every value one column yields under its rule
    FileCheck.tsx          the file check's findings and the instruction for an AI
    PublishDialog.tsx      what a site says about itself, then its download
    ErrorScreen.tsx        the card shown when there is no app to show
    StartupError.tsx       that card, when the batch - ours, or a published
                           site's - cannot be read
    ErrorBoundary.tsx      that card, when a component throws while rendering,
                           with a button that clears what this browser kept
    orbit/                 OrbitCanvas (canvas renderer), Legend, Tooltip
    panels/                DataPanel, FilterPanel, TierPanel, DetailPanel,
                           DownloadStudies (the download control in that panel),
                           ColumnSettings (shared by the rail and the setup pages),
                           SiteAbout (a published site's "About this map")
    ui/                    Button, Input, Select, Pills, Field, Section, Notice,
                           Dialog, FileButton, CopyBox, Tabs, ThemeToggle
docs/
  style-guide.html         the tokens and components on one page, for reuse
```

The stored batch holds the cells as the file wrote them; `readDataset` turns
it into the one on screen, with every column read under its rule. Keeping the
two apart is what lets a rule change without the file being loaded again.

State (chosen source, loaded batch, mapping, column rules, filters, tier
rules) is kept in `localStorage`, so a reload keeps your setup. Use *use our batch*,
*Reset* or *Clear stored data* to start over.

## License

The code is released under the MIT License - see `LICENSE`. Every published
site carries a copy (`LICENSE.txt`), next to the licences of the libraries it
bundles. To cite Lit Orbit, use `CITATION.cff`.
