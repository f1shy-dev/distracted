# distacted

blocks distracting websites! annoy you to get back on them...

## what?

- blocks websites that distract you
- unlock challenges: timer, hold button, or type challenge
- (optionally) track your visits and success rate
- all data stays local on your device

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
