import { useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface FileButtonProps {
  accept: string;
  onFile: (file: File) => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

/** A button that opens the file picker. The <input type="file"> stays hidden. */
export function FileButton({ accept, onFile, variant, size, children }: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Reset so choosing the same file again still fires onChange.
          event.target.value = '';
        }}
      />
      <Button variant={variant} size={size} onClick={() => inputRef.current?.click()}>
        {children}
      </Button>
    </>
  );
}
