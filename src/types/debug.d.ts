declare module 'debug' {
  function debug(namespace: string): debug.Debugger;

  namespace debug {
    interface Debugger {
      (format: string, ...args: unknown[]): void;
      enabled: boolean;
      namespace: string;
    }
  }

  export = debug;
}
