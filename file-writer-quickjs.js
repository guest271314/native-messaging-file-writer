async function connectExternalFileWriter(extensionPath, fileName, flags) {
  let externalController;
  const fileWriterStream = new ReadableStream({
    start(c) {
      return externalController = c;
    },
    cancel(reason) {
      console.log("cancel", reason);
      externalPort.disconnect();
      progressController.close();
    },
  });
  fileWriterStream.pipeTo(
    new WritableStream({
      write(v) {
        for (let i = 0; i < v.length; i += 16384) {
          externalPort.postMessage({
            value: [...v.subarray(i, i + 16384)],
            done: false,
          });
        }
      },
      close() {
        externalPort.postMessage({
          value: null,
          done: true,
        });
      },
      abort(reason) {
        externalPort.disconnect();
        progressController.close();
        console.log("abort", reason);
      },
    }),
  ).catch((e) => e);

  let progressController;
  const progressStream = new ReadableStream({
    start(c) {
      return progressController = c;
    },
  });
  async function generateIdForPath(path) {
    return [
      ...[
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path)),
        ),
      ].map((u8) => u8.toString(16).padStart(2, "0")).join("").slice(0, 32),
    ].map((hex) => String.fromCharCode(parseInt(hex, 16) + "a".charCodeAt(0)))
      .join("");
  }

  function handleMessage(message, sender) {
    progressController.enqueue(message);
  }

  function handleDisconnect(e) {
    progressController.close();
    if (chrome.runtime.lastError) {
      console.log(chrome.runtimeLastError, e);
    }
    externalPort.onMessage.removeListener(handleMessage);
    externalPort.onDisconnect.removeListener(handleDisconnect);
    console.log(e);
  }

  const externalPort = chrome.runtime.connect(
    await generateIdForPath(extensionPath),
    {
      name: "FileWriter",
    },
  );
  externalPort.onMessage.addListener(handleMessage);
  externalPort.onDisconnect.addListener(handleDisconnect);
  externalPort.postMessage({
    value: {
      fileName,
      flags,
    },
    done: false,
  });
  return {
    externalController,
    progressStream,
  };
}

if (Object.hasOwn(globalThis, "connectExternalFileWriter")) {
  console.log("connectExternalFileWriter declared");
}
