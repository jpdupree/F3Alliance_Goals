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
firestore.rules       who can read and write what
firebase.json         hosting + rules config for the Firebase CLI
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

**5. Deploy.** With the [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project you just made
firebase deploy             # pushes hosting + firestore.rules together
```

That prints a URL like `https://your-project.web.app`. That's the app.

**6. Check the rules landed** — Firestore Database → Rules should now match
`firestore.rules`. If you skipped the CLI, paste that file in by hand and
publish. **Do not leave the database in test mode**; test rules let anyone on
the internet read and write everything.

**7. Authorize your domain** — Authentication → Settings → Authorized domains.
Firebase Hosting domains are added for you. If you host anywhere else, add that
domain here or Google sign-in will refuse to run.

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
them, head at the top) and a row to `KEYWORDS`. Aim for 9–14 stars.

### How goals map to stars

Goals are spread evenly across the constellation, so a guy with 3 goals still
lights his whole creature and a guy with 30 still gets an ember per goal. Hit
everything you set and every star is lit — that's what "complete" means, not
some fixed number of goals.

## Privacy model

- The crew id in the link is the capability. Ids are random and crews can't be
  listed, so the link is the only way in.
- Reading the roster or anyone's goals requires being **signed in and a member**
  of that crew.
- Joining is creating your own member doc, so anyone with the link and a Google
  account can take a seat. If you'd rather approve people, see below.
- Writing a goal requires `uid == request.auth.uid` on both the existing and
  incoming document, so a guy can't create, edit, retarget or delete anyone
  else's.

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
sign-in works against your real project.

## Notes

- The Firebase SDK loads from Google's CDN; the version is one constant,
  `FIREBASE_VERSION` in `js/config.js`. Any modular 10/11/12 release works.
- The whole scene is one 2D canvas. It honours `prefers-reduced-motion` by
  cutting the particle counts and the ember flight time.
- Nothing to build, no dependencies, no bundler.
