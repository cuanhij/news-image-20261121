# The World in One Day — Saturday 21 November 2026

[![make.fun · news-image-20261121](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/cuanhij/news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/cuanhij/news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)

Built for the [make.fun](https://make.fun) bounty [Sum up 21 November's world news in one image](https://make.fun/bounty/news-image-20261121).

A program that draws a newspaper front page summing up the world's news of
Saturday 21 November 2026, as one 1024x1024 PNG. It runs with no network and
writes the same bytes on every run.

## The six stories

1. **Conflict — Russia's biggest air attack on Ukraine.** More than 400
   drones and 110 missiles strike Ukraine overnight; at least eight people
   are killed in Kyiv. Two missiles and a suspected drone come down in
   Poland, and Prime Minister Tusk calls it a deliberate provocation as
   NATO jets scramble.
2. **Markets — AI sell-off drags Wall Street into correction.** The S&P 500
   falls 3.7% and the Nasdaq 5.28% as an AI rout wipes out the Nasdaq's 2026
   gains. The SEC probes Nvidia's accounting and its shares drop 13.8%.
3. **Disaster — 6.8 quake shakes Peru.** A magnitude 6.8 earthquake strikes
   the Junin region of central Peru, with tremors felt in Lima, 320 km away.
   One person is hurt; buildings and roads are damaged.
4. **Climate — COP31 misses its deadline in Antalya.** The climate summit
   overruns its deadline as talks drag on. The latest political draft drops
   any mention of fossil fuels.
5. **Diplomacy — UK and EU seal post-Brexit deals.** Britain and the EU
   agree their biggest step since Brexit: food checks go from March 2028,
   carbon markets link from January 2028, and 100,000 young people a side
   can live and work abroad.
6. **Also — Saudi coalition intercepts Houthi missiles aimed at Riyadh.**
   The third night running. The Houthis threaten ports and a power station
   as Saudi-led strikes hit Hodeidah, Sanaa, Saada and Taiz.

## How it works

`main.ts` (Node 22, standard library only) draws the whole page in code: its
own 5x7 bitmap font, its own PNG encoder, and simple geometric flags and
icons. No network, no external assets.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It writes `out/entry.png` — 1024x1024, under 1 MiB, byte-identical across runs.

## Entry

- Competition: [Sum up 21 November's world news in one image](https://make.fun/bounty/news-image-20261121)
- Built for the [make.fun](https://make.fun) bounty of the same name.
