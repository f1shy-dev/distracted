# distracted

blocks distracting websites! do mini tasks to get back on them...

## what?
- blocks websites that distract you
- multiple unlock challenges (more soon):
  - timer
  - hold button
  - typing a random UUID (no copy/paste)
- (optionally) track your visits and success rate
- all data stays local on your device

<<<<<<< HEAD
## Development

```bash
# Chrome
npm run dev

# Firefox
npm run dev:firefox

# Opera
npm run dev:opera
```

## Build

### Chrome
1. `npm run build`
2. Load unpacked extension from `.output/chrome-mv3`

### Firefox
1. `npm run build:firefox`
2. Load temporary add-on from `.output/distacted-1.0.0-firefox.zip` (or `.output/firefox-mv2/manifest.json`) in `about:debugging`

### Opera
1. `npm run build:opera`
2. Load unpacked extension from `.output/opera-mv3` OR load `.output/distacted-1.0.0-opera.zip` if supported by your version.
=======

## why?
mindless visiting is more and more common. you end up idling, and then end up on a site you didn't want to be on in the first place.

the idea of this extension is to give you a boring, non-stimulating task. having to wait, hold the button or so on is like giving your mind time to think about what you're doing consciously, or making it annoying enough that you don't want to do it.

it's similar to not remembering/saving your payment details, so you have to find your physical card/wallet when doing online purchases; giving a second chance to rethink your purchase

### but... can't i just delete the extension?
yes! you could also just not install it! there is only so many layers of annoyance you can add<sup>[1]</sup>, after which it becomes more about your own self-control than what the technology can do for you.

...but if you do have an idea for how it could be more useful for you, [open an issue](https://github.com/f1shy-dev/distracted/issues) and let me know!

<details>
<summary>[1] ideas</summary>

- (for windows), add another step to the uninstall process [by using registry options](https://www.thewindowsclub.com/prevent-uninstallation-of-chrome-extensions)
</details>

## how to (re)build

```bash
bun install
bun run zip
bun run zip:firefox
# ./output/distracted-<version>-<chrome|firefox>.zip
```

>>>>>>> upstream/main
