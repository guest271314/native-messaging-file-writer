## native-messaging-file-writer QuickJS


### Synposis
Write files directly to local file system from arbitrary Web pages. Use `externally_connectable` to connect to the MV3 `ServiceWorker` from arbitrary Web pages, start QuickJS Native Messaging host, write file with data sent to extension from Web page.

#### Motivation

- [Emphasising the importance of in-place writes #260](https://github.com/WICG/file-system-access/issues/260)
- [Native FS writer makes write changes to a temp file instead of the actual file](https://issues.chromium.org/issues/40743502)

### Installation


#### Programmatic installation
Clone repository
```
git clone https://github.com/guest271314/native-messaging-file-writer
```

Install Native Messaging host manifest (see [Native manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)) to Chromium or Chrome user data directory. `install-host.js` currently points to `~/.config/chromium`. Modify to use path to the version of `chrome` being used, e.g., `~/.config/google-chrome`
```
node install-host.js
```

or

```
deno -A install-host.js
```

or 

```
bun install-host.js
```
#### Manual installation

1. Navigate to `chrome://extensions`.
2. Toggle `Developer mode`.
3. Click `Load unpacked`.
4. Select `native-messaging-file-writer` folder.
5. Note the generated extension ID.
6. Open `nm_file_writer_quickjs.json` in a text editor, set `"path"` to absolute path of `nm_file_writer_quickjs.js` and `chrome-extension://<ID>/` using ID from 5 in `"allowed_origins"` array. 
7. Copy the `nm_file_writer_quickjs.json` file to Chrome or Chromium configuration folder, e.g., Chromium on Linux `~/.config/chromium/NativeMessagingHosts`; Chrome dev channel on Linux `~/.config/google-chrome-unstable/NativeMessagingHosts` [User Data Directory - Default Location](https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/user_data_dir.md#Default-Location).
8. Set `nm_file_writer_quickjs.js` permission to executable, e.g., `chmod u+x nm_file_writer_quickjs.js`.
9. Reload the extension.

### Usage

`file-writer-quickjs.js` is a content script that defines global asynchronous function `connectExternalFileWriter` that `ReadableStreamDefaultController` used to write `Uint8Array`s to the `ReadableStream` that enqueues data to the file being written, and a `ReadableStream` enqueued with file write progress data in a plain JavaScript object. In the MV3 `ServiceWorker` use `connectNative()` to start QuickJS NG Native Messaging host. Write file to file system.

Use `connectExternalFileWriter(extensionPath, filePath, flags)` in DevTools, Snippets, or other user scripts. The function expects parameters `extensionPath`, `filePath`, `flags`; see QUickJS NG standard library at [`open(filename, flags, errorObj = undefined)`](https://quickjs-ng.github.io/quickjs/stdlib#openfilename-flags-errorobj--undefined).

To abort the file write call `externalController.error("reason")` or `externalController.close()`.

Fetch and write latest QuickJS NG `qjs` to file system 

```
var {
  externalController,
  progressStream
} = await connectExternalFileWriter(
  "/home/user/native-messaging-file-writer-quickjs",
  "/home/user/Downloads/qjs",
  "w",
).catch(console.error);
console.log(externalController);
// externalController.error("a reason");
// externalController.close();
progressStream.pipeTo(new WritableStream({
  start() {
    console.groupCollapsed("FileWriter progress");
  },
  write(v) {
    console.log(v);
  },
  close() {
    console.groupEnd("FileWriter progress");
  },
  abort(reason) {
    console.log(reason);
    console.groupEnd("FileWriter progress");
  }
}), ).catch(console.error);

var writeStream =
  fetch(
    "https://corsproxy.io?url=https://github.com/quickjs-ng/quickjs/releases/latest/download/qjs-linux-x86_64",
  ).then((r) => r.body.pipeTo(new WritableStream({
    write(v) {
      console.log(externalController);
      externalController.enqueue(v);
    },
    close() {
      externalController.close();
    },
  })));

writeStream.catch(console.error);
```

Fetch and write `node` nightly to file system

```
const {
  UntarFileStream
} = await import(URL.createObjectURL(new Blob([await (await fetch("https://gist.githubusercontent.com/guest271314/93a9d8055559ac8092b9bf8d541ccafc/raw/022c3fc6f0e55e7de6fdfc4351be95431a422bd1/UntarFileStream.js")).bytes()], {
  type: "text/javascript"
})));

const cors_api_host = "corsproxy.io/?url=";
const cors_api_url = "https://" + cors_api_host;
let osArch = "linux-x64";
let file;

let [node_nightly_build] = await (await fetch("https://nodejs.org/download/nightly/index.json")).json();
let {
  version,
  files
} = node_nightly_build;
let node_nightly_url = `https://nodejs.org/download/nightly/${version}/node-${version}-${osArch}.tar.gz`;
let url = `${cors_api_url}${node_nightly_url}`;
console.log(`Fetching ${node_nightly_url}`);
const request = (await fetch(url)).body.pipeThrough(new DecompressionStream('gzip'));
// Download gzipped tar file and get ArrayBuffer
const buffer = await new Response(request).arrayBuffer();
// Decompress gzip using pako
// Get ArrayBuffer from the Uint8Array pako returns
// const decompressed = await pako.inflate(buffer);
// Untar, js-untar returns a list of files
// (See https://github.com/InvokIT/js-untar#file-object for details)
const untarFileStream = new UntarFileStream(buffer);
while (untarFileStream.hasNext()) {
  file = untarFileStream.next();
  if (/\/bin\/node$/.test(file.name)) {
    break;
  }
}

var stream = new Blob([file.buffer]).stream();

var {
  externalController,
  progressStream
} = await connectExternalFileWriter(
  "/home/user/native-messaging-file-writer-quickjs",
  "/home/user/Downloads/node",
  "w",
).catch(console.error);
console.log(externalController);
// externalController.error("a reason");
// externalController.close();
progressStream.pipeTo(new WritableStream({
  start() {
    console.groupCollapsed("FileWriter progress");
  },
  write(v) {
    console.log(v);
  },
  close() {
    console.groupEnd("FileWriter progress");
  },
  abort(reason) {
    console.log(reason);
    console.groupEnd("FileWriter progress");
  }
}), ).catch(console.error);

var writeStream = stream.pipeTo(new WritableStream({
    write(v) {
      externalController.enqueue(v);
    },
    close() {
      externalController.close();
    },
  }));

writeStream.catch(console.error);
```

When the file is written without errors or for the WHATWG `fetch()` request being aborted, ultimately fulfills to a `stat()` object with `fileName` included, e.g., writing `node` nightly to file system


`value` in `progressStream` piped to a `WritableStream` 
```
// ...
{done: false, writes: 7759, currentBytesWritten: 16384, totalBytesWritten: 127123456}
{done: false, writes: 7760, currentBytesWritten: 10936, totalBytesWritten: 127134392}
{done: true, value: null, totalBytesWritten: 127134392}
{onMessage: {…}, onDisconnect: {…}, disconnect: ƒ, …}
```

Aborting and closing the `ReadableStreamDefaultController`

```
var {externalController, progressStream} = await connectExternalFileWriter(
  extensionPath, 
  filePath, 
  flags, 
).catch(console.error);

externalController.error("reason");
```
```
FileWriter progress
file-writer-quickjs.js abort reason
Promise {<pending>}
TypeError: Failed to execute 'enqueue' on 'ReadableStreamDefaultController': Cannot enqueue a chunk into an errored readable stream
    at Object.write
Promise.catch
```

```
externalController.close();
```
```
FileWriter progress
Promise {<pending>}
{done: true, value: null, totalBytesWritten: 0}
file-writer-quickjs.js {onMessage: {…}, onDisconnect: {…}, disconnect: ƒ, …}
TypeError: Failed to execute 'enqueue' on 'ReadableStreamDefaultController': Cannot enqueue a chunk into a readable stream that is closed or has been requested to be closed
    at Object.write
```

### License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)
