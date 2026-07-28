# F3 Campfire

A private goal tracker for an F3 crew, shared by link.

Every goal a guy sets lands as a **log on the shared fire**. When he marks it
hit, an **ember floats up out of the flames and locks into a star** in his own
constellation — one themed to his F3 name, so Crawdad gets a crawfish and
Sherpa gets a mountain ridge. Finish everything he set and the whole creature
lights up over the fire. Over a season the fire burns higher and the night
fills in with the crew's constellations.

Plain HTML, CSS and ES modules on the front end. Firebase handles Google
sign-in and the shared data, so **ownership is tied to each guy's Google
account** — anyone at the fire can see everything, but you can only add, edit
or delete your own goals, and that's enforced by Firestore rules on the server,
not just hidden in the page.

```
index.html            markup: sky canvas, top bar, goal dock, sign-in gate
styles.css            all styling
js/config.js          ← your Firebase project goes here
js/data.js            auth + Firestore reads and writes
js/constellations.js  the 25 shapes, and F3-name → shape matching
js/sky.js             canvas renderer: fire, logs, embers, constellations
js/app.js             app flow, state, and the goal list
js/editor.js          connect-the-dots constellation editor
firestore.rules       who can read and write what
firebase.json         hosting + rules config for the Firebase CLI
manifest.webmanifest  installable-app metadata
sw.js                 service worker: offline shell, never caches live data
icons/                app icons (192/512, maskable, apple-touch)
```

## Setup

**1. Make a Firebase project** at <https://console.firebase.google.com>.

**2. Turn on Google sign-in** — Authentication → Sign-in method → Google →
Enable. Set a support email and save.

**3. Create a Firestore database** — Firestore Database → Create database.
Pick a region near the crew. Start in production mode; step 6 installs the real
rules.

**4. Register a web app** — Project settings → Your apps → Web (`</>`). Copy
the `firebaseConfig` object it shows you and paste the values into
`js/config.js`, replacing the `PASTE_…` placeholders.

Those values are not secrets. Every Firebase web app ships them in the page —
they identify the project, they don't authorize anything. What actually keeps
the crew's data private is the rules file and the authorized-domains list.

**5. Publish the security rules.** This is the step that makes the crew's data
private — **do not skip it and do not leave the database in test mode**, since
test rules let anyone on the internet read and write everything.

Easiest way: Firestore Database → Rules, paste in the contents of
`firestore.rules`, and hit Publish. Or with the
[Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

**6. Authorize the domain you're hosting on** — Authentication → Settings →
Authorized domains → Add domain. Google sign-in refuses to run on any domain
not in this list.

- GitHub Pages: add `yourname.github.io`
- Firebase Hosting: already there
- Local testing: add `localhost`

## Hosting

### GitHub Pages

Settings → Pages → deploy from the branch holding these files. The site lands
at `https://yourname.github.io/repo-name/`. Every path in the app is relative,
so the project subpath works with no configuration.

Add `yourname.github.io` to Firebase's authorized domains (step 6) or sign-in
will fail.

### Firebase Hosting

`firebase deploy` publishes hosting and the rules together and gives you
`https://your-project.web.app`. Worth considering if the crew is mostly on
iPhones — see the note under Installing.

## Installing it as an app

The app ships a web manifest, icons and a service worker, so it installs to a
phone or desktop home screen and opens full screen with no browser chrome.

- **Android / Chrome / Edge:** an **Install** button appears in the top bar.
- **Desktop Chrome / Edge:** same button, or the install icon in the address bar.
- **iPhone / iPad:** Safari has no install prompt, so the button opens
  instructions — Share → Add to Home Screen.

The service worker caches the app shell only: HTML, CSS, JS and icons. Goals
and sign-in always go to the network, so nobody is ever looking at a stale
fire. Open it with no signal and you get the campfire and a clear failure
rather than a blank page.

After changing any app file, bump `CACHE` in `sw.js` (`f3-campfire-v1` →
`-v2`), or installed copies will keep serving the old shell.

**One caveat for iPhone users.** An installed iOS app gets its own storage,
separate from Safari, so everyone has to sign in again inside the installed
app. That sign-in uses a redirect through your `*.firebaseapp.com` auth domain,
and Safari's cross-site storage rules can occasionally break that hop when the
app is hosted somewhere else — such as GitHub Pages. If the crew is mostly on
iPhones and you hit this, deploying to Firebase Hosting instead puts the app
and the auth domain on the same site and the problem goes away. On Android and
desktop this doesn't come up.

## Using it

Sign in, name the crew, and you get a link like:

```
https://your-project.web.app/#c/aB3xK9dQ1mZp
```

Send that to the crew. Each guy signs in with Google, enters his F3 name once
— he sees his constellation before he commits to it — and takes a seat. From
then on he adds his own goals in the dock at the bottom and checks them off.

Tap any constellation to push in on it and see whose it is and what he's set.
Tap the sky to pull back out. The `?` button explains the metaphor to anyone
who lands cold.

### Constellations

`js/constellations.js` holds 25 shapes and matches an F3 name against a keyword
list — `craw`/`mudbug` → crawfish, `sherpa`/`summit`/`ridge` → mountain ridge,
`sledge`/`anvil` → hammer, and so on. A name that matches nothing gets a
creature picked by hashing the name, so it's stable: the same name always draws
the same shape.

To add a shape, add an entry to `SHAPES` (stars in a 0..1 box, edges between
them, head at the top) and a row to `KEYWORDS`. It must have **exactly ten
stars** — see How goals map to stars.

### Drawing your own

Anyone who doesn't like what his name picked can draw his own. There's a
**…or draw your own constellation** link on the F3-name step, and an **Edit my
constellation** button on your own card once you're in — tap a constellation
in the sky to open it.

A drawn constellation must be **exactly ten stars**, same as the built-in ones,
so its owner is on the same season as everyone else. The editor counts down
("7 of 10 stars · 3 to place") and won't let you save until you're at ten.

The editor is connect-the-dots: tap empty sky to drop a star (it joins to
whichever star was selected), tap a star to select it, tap a second to join or
unjoin, drag to move. Undo, Remove star and Clear are there, plus an optional
name for it ("the waffle") that shows under the constellation when it's fully
lit. **Use the automatic one** reverts to the name-picked shape at any time.

The drawing is normalized into the same 0..1 box the built-in shapes use, so
the renderer treats it identically — same embers, same goal-to-star mapping,
same completion. It's stored as `customShape` on your member doc, fixed at ten
stars and capped at 40 lines both in the editor and in `firestore.rules`, and a shape
that fails validation falls back to the automatic one rather than blanking out
the sky.

### How goals map to stars

**Every constellation has exactly ten stars, and one finished goal lights one
star.** The Nth goal a man knocks down lights the Nth star, in the order he
actually finished them.

That makes the season the same length for everybody. Complete means ten
achievements — not "everything you happened to write down", which would have
rewarded whoever set the fewest goals.

Set as many goals as you like. The first ten you finish light your sky;
anything past that still burns on the fire and counts toward the crew's total,
it just has no star left to land on. `STARS_PER_CONSTELLATION` in
`js/constellations.js` is the single source of truth — the built-in shapes, the
editor and `firestore.rules` all key off it, and the module logs an error on
load if any shape has the wrong star count.

## Managing the crew

Whoever created the crew is its owner (`createdBy` on the crew doc). He gets a
**Manage crew** button in the `?` sheet, listing everyone with their tally and
two actions:

- **Clear logs** — delete all of that man's goals, leaving him at the fire.
- **Remove** — delete his goals *and* his membership. He can rejoin with the
  crew link any time; he just starts fresh.

Both are useful for clearing out test accounts. His own row says **Leave**
instead of Remove.

The owner is granted **delete** over members and goals, deliberately not
**write** — so he can clean up, but he still can't put words in another man's
mouth or tick off someone else's goal. That distinction is in `firestore.rules`,
not just the UI.

If someone is removed while his app is open, his listeners lose read access and
he lands back on the crew screen with "You're not at that fire anymore" rather
than a raw permission error.

**This does not delete anyone's account.** Removing a man takes him out of that
crew only. His Google account and his Firebase Auth record are untouched —
deleting those needs the Admin SDK or the Firebase console under
Authentication → Users. Worth knowing while testing: deleting the Auth user
does *not* delete his member doc or goals, and rejoining with the same Google
account produces the same uid, so his old data comes back unless you removed
him here first.

## Privacy model

- The crew id in the link is the capability. Ids are random and crews can't be
  listed, so the link is the only way in.
- Reading the roster or anyone's goals requires being **signed in and a member**
  of that crew.
- Joining is creating your own member doc, so anyone with the link and a Google
  account can take a seat. If you'd rather approve people, see below.
- Writing a goal requires `uid == request.auth.uid` on both the existing and
  incoming document, so a guy can't create, edit or retarget anyone else's.
- The crew owner can additionally *delete* members and goals — see Managing the
  crew. He is never granted write access to them.

To lock joining down to an invite list, add an `allowed` array of email
addresses to the crew doc and require it in the members `create` rule:

```
allow create: if signedIn()
              && request.auth.uid == memberId
              && request.auth.token.email in
                 get(/databases/$(database)/documents/crews/$(crewId)).data.allowed;
```

## Running locally

Any static server works — the modules need HTTP, not `file://`:

```bash
npx http-server -p 8080 .
```

Then add `localhost` under Authentication → Settings → Authorized domains so
sign-in works against your real project. Service workers are allowed on
`localhost` without HTTPS, so the install flow can be tested there too.

## Notes

- The Firebase SDK loads from Google's CDN; the version is one constant,
  `FIREBASE_VERSION` in `js/config.js`. Any modular 10/11/12 release works.
- The whole scene is one 2D canvas. It honours `prefers-reduced-motion` by
  cutting the particle counts and the ember flight time.
- Nothing to build, no dependencies, no bundler.
- `.nojekyll` stops GitHub Pages from running the files through Jekyll.
