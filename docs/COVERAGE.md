# Coverage: how many examples each topic gets

Goal: for any job posting, decide how to split a fixed number of practice
examples (20) across the taxonomy topics, so that important topics get more
examples and every chosen topic is practiced more than once.

## Inputs

- **Weights** — the classifier gives every taxonomy label a weight from 0 to 1
  (how relevant that topic is to the posting). Labels it left out are 0.
- **Total** — how many examples the posting gets. Currently 20.
- **Power** — how strongly to favour high weights over low ones. Currently 2.
- **Minimum per topic** — the fewest examples a chosen topic can get. Currently 2.

## Step 1: Rank the topics

Ignore topics with weight 0. Sort the rest from highest weight to lowest.
If two topics have the same weight, the one earlier in the taxonomy comes first.

## Step 2: Choose how many topics to include

Start with as many topics as could each get the minimum:
total ÷ minimum, rounded down (20 ÷ 2 = 10). Take that many from the top of
the ranking. (If fewer topics have non-zero weight, take all of them.)

## Step 3: Turn weights into shares

For each chosen topic, raise its weight to the power (square it).
Its **share** is its squared weight divided by the sum of all chosen topics'
squared weights. The shares add up to 1.

Squaring makes strong topics count much more: 0.6 vs 0.3 is 2× as a weight,
but 4× once squared.

## Step 4: Apportion the total (largest remainder method)

1. Each topic's **ideal count** is its share × total. This is usually a
   fraction, e.g. 3.6.
2. Give each topic the whole-number part of its ideal count (3.6 → 3).
3. Add those up. The **leftover** is total minus that sum. Because the ideal
   counts add up to exactly the total, the leftover always equals the sum of
   the fractional parts, so it is a whole number.
4. Sort topics by their fractional part, biggest first (ties: higher weight
   first, then taxonomy order). Give +1 to that many topics, from the top
   of the list. No topic gets more than +1.

The counts now add up to exactly the total.

## Step 5: Enforce the minimum

If any chosen topic got fewer than the minimum, drop the lowest-ranked
chosen topic and go back to Step 3 with one fewer topic. Repeat until every
chosen topic has at least the minimum (or only one topic is left).

## Step 6: Choose each topic's languages

Each topic's examples are split across the posting's languages **that suit the topic**,
using the language fit table (`pipeline/taxonomy/language_fit.json`, evidence in `docs/LANGUAGE_FIT.md`):

1. Keep only the posting's languages with fit ≥ 0.7 for this topic ("common" or "mainstream").
   So an N+1-query topic never gets C, and a unit-testing topic never gets C.
2. Score each kept language: the posting's language weight × the topic's fit.
3. Split the topic's count by those scores (largest remainder).
4. If none of the posting's languages suits the topic, the topic uses its best-fitting language overall
   (ties go to Python, then the table's language order). A posting that names no language counts as Python.

## Output: targets

Every taxonomy label gets a target: the count from Step 4 if it was chosen,
otherwise 0. Targets always add up to the total.

---

## Using the targets (repeated per pipeline call)

The targets are calculated once per posting and saved. Each pipeline call
then compares them to the example bank:

- **Count** — how many bank examples list the topic in their concepts.
  One example can count toward several topics.
- **Credit** — count ÷ target, capped at 1. (Topics with target 0 are ignored.)
- **Shortfall** — share × (1 − credit). How much of the posting's
  importance is still missing for that topic.
- **Next topic to generate** — the one with the biggest shortfall.
- **Done** — when every topic has reached its target (all shortfalls are 0).
  Progress can be shown as "filled / total", where each topic contributes
  at most its target.

---

## Data worth keeping for a report

Two things the target calculation reveals about a posting that are useful
to show the user (and to track across postings):

- **Flatness of the posting** — how evenly its weights are spread. A flat
  posting (many topics at similar mid weights, nothing high) is vague about
  what the role actually needs; a focused one has a few clear standouts.
  Can be measured e.g. by the top weight, how many topics sit at ≥ 0.4, or
  how much of the total share the chosen topics hold.
- **High topics left without examples** — topics that still had a
  meaningful weight but were cut in Step 5 to keep the minimum per topic.
  These are real parts of the role the practice set doesn't cover, and
  worth listing so the user knows what else to study.
