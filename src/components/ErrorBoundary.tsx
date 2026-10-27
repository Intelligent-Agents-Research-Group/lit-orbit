import { Component, type ErrorInfo, type ReactNode } from 'react';
import { forgetImport } from '../lib/importStore';
import { clearStoredData } from '../lib/storage';
import { Button } from './ui/Button';
import { ErrorScreen } from './ErrorScreen';

interface ErrorBoundaryState {
  message: string | null;
}

/**
 * Catches a throw during render and shows it, instead of leaving a blank page.
 *
 * Worth having in an app that rehydrates its whole state from this browser on
 * every load. When the value a component chokes on is one that was stored,
 * React unmounting the root leaves an empty page, the reload the user tries
 * next reads the same value and empties again, and *Clear stored data* - the
 * one control that would end it - sits on a screen that can no longer render.
 * So the fallback carries that button itself.
 *
 * A class, because `getDerivedStateFromError` has no hook: this is the one
 * place React still asks for one. (Vue answers the same question with
 * `errorCaptured` on an ordinary component.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(cause: unknown): ErrorBoundaryState {
    return { message: cause instanceof Error ? cause.message : String(cause) };
  }

  componentDidCatch(cause: unknown, info: ErrorInfo) {
    // The component stack says which panel threw, which the message alone does not.
    console.error('Lit Orbit stopped while rendering', cause, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <ErrorScreen
        title="Lit Orbit stopped"
        message={this.state.message}
        hint="Reloading on its own will not help if the setup kept in this browser is what caused it: the same values are read back. Clearing them starts from the batch we ship, and no file of yours leaves this browser either way."
        action={
          <Button
            variant="primary"
            // The kept file goes too - it is the user's data as much as the
            // batch is - and the reload waits for it, or the write would be
            // cut short.
            onClick={() => {
              clearStoredData();
              void forgetImport().finally(() => location.reload());
            }}
          >
            Clear stored data and reload
          </Button>
        }
      />
    );
  }
}
