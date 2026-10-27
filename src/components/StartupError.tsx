import { SITE_CONFIG_FILE } from '../config/publish';
import { ErrorScreen } from './ErrorScreen';

/**
 * Shown instead of the app when its batch cannot be read - the example we
 * ship, or the batch of a published site. Every screen needs a batch, so
 * there is nothing useful to render without it; what the screen can do is
 * say which file to look for.
 */
export function StartupError({ message, published }: { message: string; published: boolean }) {
  return (
    <ErrorScreen
      title={published ? 'This page could not start' : 'Lit Orbit could not start'}
      message={message}
      hint={
        published ? (
          <>
            This page is a site published from Lit Orbit, and its batch is the file <code>{SITE_CONFIG_FILE}</code> next
            to its <code>index.html</code>. If you published it, check that the file was uploaded with the others, then
            reload.
          </>
        ) : (
          <>
            The built-in batch is a spreadsheet served from <code>public/</code>. Check that the file is still there
            under the name the app expects, then reload.
          </>
        )
      }
    />
  );
}
