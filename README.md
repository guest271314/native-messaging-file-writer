## native-messaging-file-writer


### Synposis
Write files directly to local file system from arbitrary Web pages. Use `externally_connectable` to connect to the MV3 `ServiceWorker` from arbitrary Web pages. In the MV3 `ServiceWorker` use `sendNativeMessage()` to start local Node.js built-in `node:http2` HTTP/2 server. Make `fetch()` request from Web page to local server, with `duplex` set to `"half"` for the capability to set a `ReadableStream` as `body` for `POST`, and/or `query` request. Write file to file system. Return `Promise` fulfilled to an [`<fs.Stats>`](https://nodejs.org/api/fs.html#class-fsstats) object, or message from `DOMException` `ABORT_ERR`.

#### Motivation

- [Emphasising the importance of in-place writes #260](https://github.com/WICG/file-system-access/issues/260)
- [Native FS writer makes write changes to a temp file instead of the actual file](https://issues.chromium.org/issues/40743502)

### Installation

#### Create self-signed certificate for HTTP/2 server

Create self-signed certificates for use with HTTP/2 server, as described [here](https://github.com/GoogleChrome/samples/blob/gh-pages/webtransport/webtransport_server.py#L49C1-L75C45)

```
# As an alternative, Chromium can be instructed to trust a self-signed
# certificate using command-line flags.  Here are step-by-step instructions on
# how to do that:
#
#   1. Generate a certificate and a private key:
#         openssl req -newkey rsa:2048 -nodes -keyout certificate.key \
#                   -x509 -out certificate.pem -subj '/CN=Test Certificate' \
#                   -addext "subjectAltName = DNS:localhost"
#
#   2. Compute the fingerprint of the certificate:
#         openssl x509 -pubkey -noout -in certificate.pem |
#                   openssl rsa -pubin -outform der |
#                   openssl dgst -sha256 -binary | base64
#      The result should be a base64-encoded blob that looks like this:
#          "Gi/HIwdiMcPZo2KBjnstF5kQdLI5bPrYJ8i3Vi6Ybck="
#
#   3. Pass a flag to Chromium indicating what host and port should be allowed
#      to use the self-signed certificate.  For instance, if the host is
#      localhost, and the port is 4433, the flag would be:
#         --origin-to-force-quic-on=localhost:4433
#
#   4. Pass a flag to Chromium indicating which certificate needs to be trusted.
#      For the example above, that flag would be:
#         --ignore-certificate-errors-spki-list=Gi/HIwdiMcPZo2KBjnstF5kQdLI5bPrYJ8i3Vi6Ybck=
#
# See https://www.chromium.org/developers/how-tos/run-chromium-with-flags for
# details on how to run Chromium with flags.
```

#### Programmatic installation
Clone repository
```
git clone https://github.com/guest271314/native-messaging-file-writer
```

Install Native Messaging host manifest (see [Native manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)) to Chromium or Chrome user data directory. `install-host.js` currently points to `~/.config/chromium`. Modify to use path to the version of `chrome` being used, e.g., `~/.config/google-chrome`
```
node install-host.js
```
#### Manual installation

1. Navigate to `chrome://extensions`.
2. Toggle `Developer mode`.
3. Click `Load unpacked`.
4. Select `native-messaging-file-writer` folder.
5. Note the generated extension ID.
6. Open `nm_piper.json` in a text editor, set `"path"` to absolute path of `nm_piper.js` and `chrome-extension://<ID>/` using ID from 5 in `"allowed_origins"` array. 
7. Copy the `nm_file_writer.json` file to Chrome or Chromium configuration folder, e.g., Chromium on \*nix `~/.config/chromium/NativeMessagingHosts`; Chrome dev channel on \*nix `~/.config/google-chrome-unstable/NativeMessagingHosts` [User Data Directory - Default Location](https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/user_data_dir.md#Default-Location).
8. Set `nm_file_writer.js` permission to executable, e.g., `chmod u+x nm_file_writer.js`.
9. Reload the extension.

### Usage

`file-writer.js` is a content script that defines `FileWriter` class on all HTTP/HTTPS Web pages at `document_start`.

Use `FileWriter` class in DevTools, Snippets, or other user scripts. The constructor expects an options plain JavaScript object containing `fileName`, `mode` ([Sets the file mode (permission and sticky bits) if the file is created. Default: `0o666` (readable and writable)](https://nodejs.org/api/fs.html#fspromisesopenpath-flags-mode) that are passed to a Node.js [`filehandle.createWriteStream()`](https://nodejs.org/api/fs.html#filehandlecreatewritestream).

```
var readable = ... // WHATWG ReadableStream
var fs = new FileWriter({
  fileName: "/home/user/Downloads/node", // File path to write to
  mode: 0o764 // Mode 
}, "/home/user/native-messaging-file-writer"); // Path to unpacked extension directory
fs.write(readable).then(console.log).catch(console.warn);
// Abort writing to the file
fs.abort("reason");
```

Using a `TransformStream` to write data to the file using a `WritableStreamDefaultWriter`

```
var rs = ...; 
var {
  readable,
  writable
} = new TransformStream({
  transform(value, c) {
    c.enqueue(value);
  },
  flush() {
    console.log("flush");
  }
});
var writer = writable.getWriter();
writer.closed.then(console.log).catch(console.warn);
var fs = new FileWriter({
  fileName: '/home/user/Downloads/node',
  mode: 0o764
}, "/home/user/native-messaging-file-writer");
fs.write(readable).then(console.log).catch(console.warn);
console.log(writer.desiredSize);
// Abort writing to the file
// await writer.abort("Abort!").then(console.log).catch(console.warn);
console.log(writer.desiredSize);
for await (const data of rs) {
  try {
    await writer.ready;
    await writer.write(data).catch(console.warn);
  } catch (e) {
    console.log(e);
    break;
  }
}
console.log(writer.desiredSize);
if (writer.desiredSize !== null) {
  await writer.close().catch(console.warn);
}
```

When the file is written without errors or for the WHATWG `fetch()` request being aborted, ultimately fulfills to a `stat()` object with `fileName` included, e.g., writing `node` nightly to file system

```
{
  "fileName": "/home/user/Downloads/node",
  "dev": 27,
  "mode": 33252,
  "nlink": 1,
  "uid": 1000,
  "gid": 1000,
  "rdev": 0,
  "blksize": 4096,
  "ino": 173609,
  "size": 125675720,
  "blocks": 245464,
  "atimeMs": 1740956750631.332,
  "mtimeMs": 1740979068259.272,
  "ctimeMs": 1740979068259.272,
  "birthtimeMs": 1740956750631.332
}
```

When the streaming request is aborted

```
fs.abort("Abort file stream");
// Or when using a WritableStreamDefaultWriter
await writer.abort("Abort file stream").then(console.log).catch(console.warn);
// Abort file stream
// The operation was aborted
```

### License
Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)
