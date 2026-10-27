# Publishing this folder

This folder is a finished static website exported from Lit Orbit: an orbit
view of one literature batch, "{{title}}". Your task is to publish it on
GitHub Pages, or to update a site that was published from an earlier export.
There is no build step and nothing to install beyond git and the GitHub CLI.

## Rules

- Do not edit, rename, reformat, delete or add files. `index.html`, `assets/`,
  `site.json` and the rest are the site exactly as its author exported it.
  Only run the commands below.
- Never ask for, type or store a password or a token. If `gh auth status` says
  the user is not signed in, ask them to run `gh auth login` themselves, and
  wait until they say it is done.
- The repository will be public, and so will every study in `site.json`.
  Before creating anything, tell the user that, confirm the repository name
  with them, and wait for a clear yes.
- If git has no `user.name` or `user.email`, ask the user what to use. Do not
  invent them.
- If a command fails, stop and tell the user what it said. Do not work around
  it some other way.

## Check first

```
git --version
gh --version
gh auth status
```

If git or gh is missing, tell the user where to get it
(https://git-scm.com/downloads, https://cli.github.com) and stop.

## Publish for the first time

Run these in this folder, with `<name>` the repository name the user confirmed:

```
git init -b main
git add -A
git commit -m "Publish Lit Orbit site"
gh repo create <name> --public --source=. --push
gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"
```

Type `{owner}` and `{repo}` as written: gh fills them in from this folder's
repository.

Then wait for the first build:

```
gh api "repos/{owner}/{repo}/pages/builds/latest" --jq .status
```

Run it again every 20 seconds or so until it prints `built`, which takes a
few minutes at most. If it prints `errored`, stop and report it. Then give the
user the address:

```
gh api "repos/{owner}/{repo}/pages" --jq .html_url
```

## Update a site published before

The user exported a new version and wants it to replace the one already
published. Ask which repository the site is in (`<owner>/<name>`), unless
this folder is already a git repository whose `origin` is that repository.

If this folder is not a git repository yet:

```
git init -b main
git remote add origin https://github.com/<owner>/<name>.git
git fetch origin main
git reset origin/main
```

`git reset` without `--hard` leaves every file in this folder as it is. It
only makes git compare them with what is published, so files the new export
no longer has are removed from the site by the commit below.

Then, in either case:

```
git add -A
git commit -m "Update Lit Orbit site"
git push origin main
```

GitHub Pages rebuilds on its own. Wait for `built` as above, then give the
user the address.
