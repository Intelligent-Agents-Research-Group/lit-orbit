{{title}}
{{underline}}

This folder is a complete website: your batch, read the way you set it up in
Lit Orbit. It needs no build step and no server of its own, so any host of
static files can serve it. The steps below use GitHub Pages, which is free.

Anyone who opens the site can see every study in the batch and download it.


WHAT IS IN THIS FOLDER

  index.html, assets/, favicon.svg   the app
  site.json                          your batch and how it is read
  LICENSE.txt                        Lit Orbit's licence (MIT)
  THIRD-PARTY-LICENSES.md            the licences of the libraries it bundles
  README.txt, AGENTS.md, CLAUDE.md   instructions for publishing; not part of the site
  .gitignore, .nojekyll              settings for git and GitHub Pages; your computer
                                     may hide these two, which is fine


PUBLISH IT ON GITHUB PAGES, IN THE BROWSER

1. Sign in at github.com, then open https://github.com/new
   Give the repository a name - it becomes part of the address - choose
   Public, and click "Create repository".

2. On the new repository's page, click "uploading an existing file".
   Open this folder, select everything in it (Ctrl+A, or Cmd+A on a Mac) and
   drag the selection onto the page. Drag what is inside the folder, not the
   folder itself: index.html has to end up at the top of the repository.
   Click "Commit changes".

3. Open Settings, then Pages. Under "Build and deployment", set Source to
   "Deploy from a branch", the branch to "main" and the folder to "/ (root)",
   then click Save.

4. After a minute or two the address shows at the top of that page:

     https://<your-user-name>.github.io/<repository-name>/

   That is the link to put in your paper.


PUBLISH IT WITH CLAUDE CODE OR CODEX

If you use Claude Code or Codex, and have git and the GitHub CLI (gh)
installed, open this folder in it and ask it to publish the site on GitHub
Pages. AGENTS.md tells it how. It asks you before it creates anything, and
you sign in to GitHub yourself.


CHANGE THE SITE LATER

Open Lit Orbit at {{studioUrl}}
choose "Build your own", and load this folder's site.json as your file:
everything you set comes back. Change what you need, publish again, and
unzip the new download into a new folder. Then either upload its files to
your repository the way you did the first time - they replace the old ones,
and old files left behind do no harm - or open the new folder in Claude Code
or Codex and ask it to update the site.
