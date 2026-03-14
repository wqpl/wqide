/* tslint:disable */
/* eslint-disable */
/**
 * Toggle boxed display of evaluation results. Returns the new state.
 */
export function set_box_mode(): boolean;
/**
 * Error codes and names for quick reference
 */
export function get_err_codes(): string;
/**
 * Builtin function names (columns)
 */
export function get_builtins(): string;
export function set_stdin_callback(cb?: Function | null): void;
/**
 * Version string for splash and title
 */
export function get_wq_ver(): string;
export function set_stderr_callback(cb?: Function | null): void;
export function set_stdout_callback(cb?: Function | null): void;
export function get_help_doc(): string;
/**
 * Evaluate a string in a fresh VM and return the result as a string.
 */
export function eval_wq(code: string): string;
export class WqSession {
  free(): void;
  get_bt_mode(): void;
  set_bt_mode(on: boolean): void;
  reset_session(): void;
  get_debug_flags(): string;
  set_debug_flags(spec: string): void;
  constructor();
  /**
   * Evaluate a source string and return the value's string form.
   */
  eval_wq(src: string): string;
  /**
   * Return a formatted view of user-defined global bindings.
   */
  get_env(): string;
  /**
   * Clear user-defined bindings while preserving debug state.
   */
  clear_env(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wqsession_free: (a: number, b: number) => void;
  readonly eval_wq: (a: number, b: number) => [number, number, number, number];
  readonly get_builtins: () => [number, number];
  readonly get_err_codes: () => [number, number];
  readonly get_help_doc: () => [number, number];
  readonly get_wq_ver: () => [number, number];
  readonly set_box_mode: () => number;
  readonly set_stderr_callback: (a: number) => void;
  readonly set_stdin_callback: (a: number) => void;
  readonly set_stdout_callback: (a: number) => void;
  readonly wqsession_clear_env: (a: number) => void;
  readonly wqsession_eval_wq: (a: number, b: number, c: number) => [number, number, number, number];
  readonly wqsession_get_bt_mode: (a: number) => void;
  readonly wqsession_get_debug_flags: (a: number) => [number, number];
  readonly wqsession_get_env: (a: number) => [number, number];
  readonly wqsession_new: () => number;
  readonly wqsession_reset_session: (a: number) => void;
  readonly wqsession_set_bt_mode: (a: number, b: number) => void;
  readonly wqsession_set_debug_flags: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
