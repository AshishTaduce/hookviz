declare module 'chrome-remote-interface' {
  /** Minimal surface — we only use Debugger/Runtime domains and close(). */
  interface CdpClient {
    Debugger: Record<string, any>;
    Runtime: Record<string, any>;
    close(): Promise<void>;
  }
  function CDP(options?: { target?: string; host?: string; port?: number }): Promise<CdpClient>;
  export default CDP;
}
