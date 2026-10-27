import { useRef, useState } from 'react';
import { paperLink, siteConfigFrom, type PublishDraft, type SiteSetup } from '../lib/site';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { Input, TextArea } from './ui/Input';
import { Notice } from './ui/Notice';
import styles from './PublishDialog.module.css';

interface PublishDialogProps {
  /** The batch on screen and every choice made about reading it. */
  setup: SiteSetup;
  /** What the user wrote here last time; `null` before they ever opened it. */
  draft: PublishDraft | null;
  onDraftChange: (draft: PublishDraft) => void;
  onClose: () => void;
}

const EMPTY_DRAFT: PublishDraft = { title: '', description: '', citation: '', paperUrl: '' };

/**
 * Publish the orbit on screen as a website of its own: a few words about it,
 * then a ZIP that is the whole site. What goes into it is what the user set up
 * - the batch, how its columns are read, the roles, the rings - so all that is
 * asked here is what the site should say about itself.
 *
 * The draft is kept as it is typed, so closing the dialog and opening it again
 * - or publishing a second time after a change - starts from what was there.
 */
export function PublishDialog({ setup, draft, onDraftChange, onClose }: PublishDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [writing, setWriting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = draft ?? EMPTY_DRAFT;
  const link = paperLink(form.paperUrl);
  const ready = form.title.trim() !== '' && link !== null && !writing;
  const update = (change: Partial<PublishDraft>) => onDraftChange({ ...form, ...change });

  /**
   * Every way out calls `onClose` itself rather than waiting for the dialog's
   * `close` event: the browser fires that one when it gets round to it, and a
   * page it is not drawing at the moment was seen never to get it. The app
   * would then go on thinking the dialog open, and show it again the next
   * time the orbit came back. Called twice, `onClose` does nothing more.
   */
  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const publish = async () => {
    setWriting(true);
    setError(null);
    try {
      // Loaded on demand: the ZIP writer is only needed by people who publish.
      const { downloadSite } = await import('../lib/publish');
      // Where this page is served from: the Lit Orbit the site is made with,
      // and where its author comes back to change it.
      const studioUrl = new URL('.', location.href).href;
      const config = siteConfigFrom(setup, {
        title: form.title,
        description: form.description,
        paper: { citation: form.citation, url: link ?? '' },
        madeWith: studioUrl,
      });
      await downloadSite(config, studioUrl);
      setDone(true);
    } catch (cause) {
      setError('The site could not be put together: ' + (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setWriting(false);
    }
  };

  return (
    /* Escape is held back while the ZIP is being written, so the download is
       not left to finish behind a closed dialog. */
    <Dialog
      ref={dialogRef}
      wide
      title={done ? 'Your website is downloaded' : 'Publish as a website'}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        if (!writing) close();
      }}
      actions={
        done ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" disabled={writing} onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ready} onClick={() => void publish()}>
              {writing ? 'Putting it together…' : 'Download the website'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <>
          <p className={styles.body}>
            Unzip it and open <code>README.txt</code> inside for the steps. In short:
          </p>
          <ol className={styles.steps}>
            <li>
              Create a public repository at <strong>github.com/new</strong>.
            </li>
            <li>Upload everything inside the unzipped folder - not the folder itself.</li>
            <li>
              In <strong>Settings → Pages</strong>, deploy from the <strong>main</strong> branch, folder{' '}
              <strong>/ (root)</strong>.
            </li>
            <li>
              A minute later the site is at <code>https://&lt;user&gt;.github.io/&lt;repository&gt;/</code> - the link
              for your paper.
            </li>
          </ol>
          <p className={styles.body}>
            Use Claude Code or Codex? Open the unzipped folder in it and ask it to publish the site:{' '}
            <code>AGENTS.md</code> tells it how, and it asks you before it creates anything.
          </p>
          <p className={styles.body}>
            To change the site later, load its <code>site.json</code> here under <em>Build your own</em>.
          </p>
        </>
      ) : (
        <>
          <p className={styles.body}>
            Download this orbit as a website of its own - your batch, read the way you set it up - to put on GitHub
            Pages for free and link to from your paper.
          </p>

          <div className={styles.fields}>
            <Field label="Title" hint="At the top of the site and in the browser tab.">
              <Input
                type="text"
                value={form.title}
                placeholder="e.g. Generative AI in computing education: an evidence map"
                onChange={(event) => update({ title: event.target.value })}
                required
              />
            </Field>
            <Field label="About this map" hint="Optional. A sentence or two, shown beside the orbit.">
              <TextArea
                rows={3}
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
              />
            </Field>
            <Field label="The paper" hint="Optional. How to cite it, as you would in a reference list.">
              <Input
                type="text"
                value={form.citation}
                placeholder="Author, A. (2026). Title of the paper. Journal."
                onChange={(event) => update({ citation: event.target.value })}
              />
            </Field>
            <Field
              label="Link to the paper"
              hint={link === null ? 'Enter a web address or a DOI.' : 'Optional. A web address or a DOI.'}
            >
              <Input
                type="text"
                value={form.paperUrl}
                placeholder="https://doi.org/10.…"
                aria-invalid={link === null}
                onChange={(event) => update({ paperUrl: event.target.value })}
              />
            </Field>
          </div>

          <div className={styles.visitors}>
            <p className={styles.visitorsTitle}>What visitors can do</p>
            <ul className={styles.visitorsList}>
              <li>Set their own course, read every study, and download the list.</li>
              <li>Nothing else: the column roles, the column rules and the evidence tiers stay as you set them.</li>
            </ul>
          </div>

          <Notice tone="warning">
            Everything in this batch becomes public: anyone with the link can see every study and download it.
          </Notice>
          {error && <Notice tone="error">{error}</Notice>}
        </>
      )}
    </Dialog>
  );
}
