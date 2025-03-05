if (!Object.hasOwn(globalThis, "FileWriter")) {
  Object.assign(globalThis, {
    FileWriter: class FileWriter {
      constructor(options = {}, extensionPath) {
        this.extensionPath = extensionPath;
        ({ promise: this.serverStartUpPromise, resolve: this.resolve } = Promise
          .withResolvers());
        this.options = Object.assign({
          mode: 0o666,
          // flags: "w",
          fileName: "",
        }, options);
        this.abortable = new AbortController();
        this.signal = this.abortable.signal;

        this.url = new URL("https://localhost:8443");
        Object.entries(this.options).forEach(([key, value]) =>
          this.url.searchParams.set(key, value)
        );
      }
      async generateIdForPath(path) {
        return [
          ...[
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(path),
              ),
            ),
          ].map((u8) => u8.toString(16).padStart(2, "0")).join("").slice(0, 32),
        ]
          .map((hex) =>
            String.fromCharCode(parseInt(hex, 16) + "a".charCodeAt(0))
          )
          .join(
            "",
          );
      }
      async abort(reason = "FileWriter aborted.") {
        await this.serverStartUpPromise;
        this.abortable.abort(reason);
      }
      async write(readable) {
        try {
          chrome.runtime.sendMessage(
            await this.generateIdForPath(
              this.extensionPath,
            ),
            {},
          )
            .then((message) => console.log(message)).catch(console.warn);
          this.resolve(
            await scheduler.postTask(() => {
              return globalThis.performance.now();
            }, {
              priority: "user-visible",
              delay: 350,
            }),
          );
          this.request = await fetch(this.url, {
            method: "query",
            duplex: "half",
            body: readable,
            signal: this.signal,
            headers: { "access-control-request-private-network": true },
          });
          return await this.request.json();
        } catch (e) {
          throw e;
        }
      }
    },
  });

  console.log("FileWriter declared");
}
