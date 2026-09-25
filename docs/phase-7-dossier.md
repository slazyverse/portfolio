# Phase 7 — Dossier

The world exists and the way in exists. What was still thin was the thing they
were built around: the work. A visitor who reached a project page found an
identity block, a summary, four sourced claims and an attribution table — good,
and closer to a card than to a record.

Phase 7 turns each project into an engineering dossier. The city stays the
environment. The dossier is the evidence.

---

## What was actually missing

The type model already described almost all of this. `Contract` has carried
`architecture`, `decisions`, `challenges`, `lessons` and `nextIteration` since
Phase 3, and every one of them was unset on every project — the readiness
ledger said `needs-writing` ten times over.

So the work split cleanly in two: write the content, and build the presentation
it deserves. The first half was the harder one, and the constraint on it was
absolute — **nothing may be invented**. Not an architecture, not a decision, not
a difficulty, not a result.

What made it possible is that all three repositories document themselves. The
deadlockd README carries the system architecture and the design constraints; the
APIx module docstrings state their own rejected alternatives; VAYU-DRISHTI's
entry point and configuration both literally have a `Design decisions:` block.
Every decision written in Phase 7 was read out of the source, and every one of
them cites the file it was read from.

---

## The four-part decision

The decisions section is the most useful part of an engineering dossier and the
easiest to make worthless. A list of technologies with a sentence of praise each
tells a reader nothing the dependency file would not.

So the shape is fixed, and the type enforces it:

```
problem      the pressure that forced a choice
choice       what was done, and what was rejected
why          the reasoning, in the terms the problem was stated in
consequence  what the system can and cannot do as a result
```

All four required. A decision with no stated problem is a preference; one with
no consequence is an opinion. `Decision.rejected` was already mandatory —
Phase 7 adds `problem` and `consequence` and makes the rejection carry its
weight.

Fourteen decisions across three projects. The one they all illustrate:
deadlockd copies three matrices under a mutex and releases it before running an
O(P²·R) search, *rejecting* holding the lock for the search, *because* the lock
exists to keep the matrices consistent rather than to serialise the simulation
— and the *consequence* is that the answer describes the state as of the copy,
which is the correct semantics for something the manager is about to act on
under the same lock.

---

## Architecture, described rather than illustrated

Two views, because they answer different questions:

**Layers, shallow to deep.** What the system is made of, and — on a team
project — who owns each part. APIx's statistical spine is a layer in the
diagram and is labelled *not my work*.

**What happens to one request.** The path through it, in order. A layer stack
alone implies a request visits layers top to bottom, which is usually false.

Both are DOM. An SVG diagram would be one more thing to keep in step with the
prose, unreadable at phone width, and invisible to a screen reader — and this
content is a list with an order, which HTML already has.

---

## Two sections are still empty, on purpose

`lessons` and `nextIteration` are first-person. What changed in how somebody
thinks, and what they intend to do next, cannot be derived from a repository
and cannot be written by anybody else.

`nextIteration` is filled for two of three projects, and only because those
repositories state their own unfinished work: APIx publishes no index because
one collection wave gives zero matched `t / t−7` pairs, and VAYU's lifespan hook
says in its own comment where pool warm-up belongs. Each entry cites the file
that records the gap. deadlockd states no such thing, so its section is absent.

`lessons` is empty on all three and says so.

That is what the ledger at the foot of every dossier is for. It reports
*n of 10 sections written and sourced* and names each gap with what the state
means. A dossier with nine written sections and two absent ones is telling the
truth about itself; one with eleven written sections, two of which are plausible
prose, is not — and a reader cannot tell them apart unless one of them says so.

---

## The index stopped being a list

Three projects is not enough to need filtering and exactly enough to need
differentiating. Each row now states four things before any prose:

```
domain      what kind of engineering this is       Concurrency · Official statistics · Geospatial platform
level       how deep in the system it sits         03 Substrate · 02 Engine · 02 Engine
sourced     statements that carry a file           14 · 17 · 14
dossier     sections written and sourced           8/10 · 9/10 · 9/10
```

Every value is derived from the record. There is no score, no rating and no
"featured" — a portfolio that ranks its own work is asking the reader to trust
exactly the judgement they came to assess.

"Sourced statements" is the one number that cannot be inflated by writing more:
adding a paragraph does not move it, and adding a claim without evidence will
not compile. A test asserts it equals the number of entries `/verify` produces
for that project, so the badge and the index can never disagree.

---

## Navigation, and no second navigation system

The chrome is untouched. StatusBar, LevelRail, MobileBar and CommandPalette all
already knew about contracts, and Phase 7 adds nothing beside them.

What it adds is *inside* the document: a section index at the top of each
dossier, and a footer that offers the evidence for this project, the previous
project and the next one. All plain anchors in the server-rendered HTML —
no scroll-spy, no sticky overlay. A fragment link already works with the back
button, can be copied, and survives JavaScript being switched off.

`/verify` gained four kinds of entry — architecture, challenge, open work, and
the attribution summary itself — and every entry now links to the *section* it
appears in rather than the top of a page that is now eleven sections long.

---

## What this cost

| | Before | After |
|---|---:|---:|
| Initial JS (gz) | 190.3 KB | **190.3 KB** |
| Lazy environment (gz) | 241.5 KB | 241.5 KB |
| CSS (gz) | 10.8 KB | 11.0 KB |
| Dependencies | 6 | **6** |

Nothing. Every component added in Phase 7 is a server component: the dossier is
static HTML at build time, and none of it ships a byte of JavaScript. The 0.2 KB
of CSS is the layer rail, the flow chain and a fix to the evidence chip, which
had no wrapping rule and pushed the document sideways once the paths it displays
got long enough — a nested Python package is 38 characters before the filename.

---

## Tests

`tests/dossier.test.ts` — 77 assertions, mostly about honesty rather than
rendering:

- readiness against reality, in both directions: no section may claim to be
  verified with nothing behind it, and no section with content may still be
  declared unwritten
- every decision has all four parts, names a rejection distinct from its choice,
  and cites a file its own label names
- section numbering is contiguous after empty sections are dropped
- navigation does not wrap, and reports an honest position
- the index's evidence count equals what `/verify` collects for that project
- every evidence entry points at a section some dossier actually has
- no score, rating or "featured" anywhere in the record

`tests/e2e/dossier.spec.ts` — 48 assertions, data-driven from the records so a
new project extends the suite rather than escaping it: every promised section
exists, fragments land inside the viewport, heading levels never skip, every
evidence chip is a real off-site anchor with `rel="noopener"`, the phone layout
keeps every section and every chip, and axe finds nothing on the longest page or
the index at either width.

`tests/evidence.test.ts` now walks every source in the evidence graph rather
than only the original project claims — 35 network assertions, up from 18.
