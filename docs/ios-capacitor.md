# Seed iOS with Capacitor

## Local test without Apple Developer Program

1. Install full Xcode from the Mac App Store.
2. Open Xcode once and accept the license/components.
3. If `xcodebuild` still points to CommandLineTools, run:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

4. Sync the latest web build into iOS:

```bash
npm run ios:sync
```

5. Open the native project:

```bash
npm run ios:open
```

6. In Xcode, select the `App` target and set:

- Team: your Apple ID team.
- Bundle Identifier: keep `com.seed.app` or change it to your final id.
- Signing: automatic.

7. Run on an iOS simulator or a connected iPhone.

## TestFlight later

TestFlight requires a paid Apple Developer account. When ready:

1. Set the final Bundle Identifier in Xcode.
2. Set version/build numbers.
3. Product > Archive.
4. Upload to App Store Connect.
5. Enable TestFlight testers.

## Daily workflow

After changing React code:

```bash
npm run ios:sync
```

Then run again from Xcode.
