// Types for copy.js (the site ships plain JS; the tests import it). Not copied into site/dist.
export interface CopyEnv {
  navigator?: { clipboard?: { writeText(text: string): Promise<void> } };
  document?: Document;
}
export declare const specJson: (spec: unknown) => string;
export declare const COPIED: string;
export declare const COPY_FAILED: string;
export declare const STATUS_MS: number;
export declare function copyText(text: string, env?: CopyEnv): Promise<boolean>;
export declare function addCopyButton(pre: HTMLElement, label: string, env?: CopyEnv): HTMLButtonElement;
