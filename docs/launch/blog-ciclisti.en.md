---
title: "Indoor training without a subscription: your watch as the bike computer, and a Zwift Click outside Zwift"
published: false
description: "How to use a smart trainer without paying every month: a free open-source app, the ride recorded on your Garmin, and a Click as a virtual shifter."
---

<!-- Draft (G4). NOT published. ~800 words. Fill [TUO] with your own story. Checks: [DA VERIFICARE] LICENSE in the repo, which watch models you tried. Note: the app interface is Italian only today. -->

If you bought a smart trainer for 200–400 euros (a Van Rysel D100 or D500, an Elite, a Tacx, a Wahoo Core…), you probably noticed that the trainer was the easy part. Then comes the monthly subscription to use it well. There's nothing wrong with subscriptions if you want the virtual worlds, the racing and the community. But if on a Tuesday night you just want a good one-hour workout, you may not need one.

This is how I train without paying every month. Full disclosure: I wrote the app I'm describing, it's free and open source, and it has limits that I'll tell you up front.

## What you really need for a good indoor session

1. **Control of resistance**: fixed power (ERG) for intervals, or simulated grade for routes.
2. **Structure**: knowing what to do in the next ten minutes, based on your FTP.
3. **A way not to get bored**: video, music, games or a route.
4. **A recorded ride**, so it lands on Garmin Connect or Strava and counts in your history.

Almost every smart trainer since about 2020 speaks the same Bluetooth protocol (FTMS), so the app isn't tied to a brand. Honest note: I tested it mostly with a Van Rysel D100. Older Tacx and old-firmware Wahoo trainers are implemented, but so far only against a simulated trainer; if you own one, your report is gold.

## Virtual gears: the part I was missing

With ERG you can do intervals, but pedalling "by hand" doesn't feel like a bike. So I added **24 virtual gears**: the app computes the required power from cadence, gear, grade and weight. Shift and the resistance really changes; push harder and it rises like on the road. There's also automatic shifting, which picks the gear that keeps the cadence you chose (80–95 rpm).

Pick a workout (sweet spot, threshold, VO2max, pyramid, 30/30) or do the ramp FTP test to find your starting point. Or build your own with the block editor.

## The watch as a bike computer

This is the feature that convinced me to publish. With the Android app, the phone **broadcasts power, cadence and speed like a Bluetooth sensor**. Your Garmin sees it as an ordinary power meter, records the ride as an indoor activity and syncs it to Garmin Connect as usual [DA VERIFICARE on more models: it's the normal behaviour of a BLE sensor, but confirm with your devices]. The app also saves a .FIT file you can import by hand.

One trap that cost me time: if the watch stays connected to the phone, it prefers the phone as its source. The app has a small illustrated guide to disconnect it (hold the light button, then Phone → off). [TUO: the watch/bike computer you tried; I don't know which other models work, so I promise nothing.]

This is Android-only. On iPhone, Safari has no Web Bluetooth: the free Bluefy browser can run the web version, but the watch bridge isn't available.

## A Zwift Click outside Zwift

If you own a Click (some "Zwift Ready" trainers like the D100 include one), it works as a **shifter** in the app: + and − change gear. Support is experimental: the protocol was reconstructed from open-source projects and some firmwares may not work. If it doesn't respond, use the on-screen buttons, the keyboard or any Bluetooth remote that sends arrow or page keys. This project has no connection with Zwift; names are trademarks of their owners.

## And so you don't get bored

I added things you won't find in a serious app: a YouTube video (or your own file) that plays at your speed; GPX routes where the grade follows the track; and **pedal-powered 3D games**: a road stage with eight rivals, a shooter, a plane that flies on watts. They're silly and they work: an hour of endurance passes much faster. Climbs in the game reach the trainer as real grade.

## Cost, and what happens to your data

Zero euros. No account: history, records and workouts stay on your device, with a backup you can export. The code is public (GPL-3.0), so anyone can check what it does. Accounts and leaderboards are coming, but will be optional.

## Limits, plainly

- The interface and the voice coach are **Italian only** for now.
- No virtual worlds, no online racing: that's not the goal.
- Old Tacx and Wahoo: written, never tried on real hardware.
- Click is experimental; watches need to be checked model by model.
- It's one person's project; expect rough edges.

## Try it

On Android, install the app; on PC or Mac open the web version with Chrome or Edge (Bluetooth required). Close other apps connected to the trainer first: it accepts only one at a time. If your trainer doesn't connect, use "Report a problem": it tells me which Bluetooth services it exposes and opens a prefilled GitHub issue.

- App and web version: https://mta-world.com/?ref=blog-en
- Source code: https://github.com/c1aud1o/ride-freedom

Tell me which trainer you have and what breaks: it's the best way to make this useful for more people.
