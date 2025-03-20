#!/usr/bin/env -S /home/user/bin/qjs -m --std
// QuickJS Native Messaging host
// guest271314, 5-6-2022
let file;
let writes = 0;
let totalBytesWritten = 0;

function getMessage() {
  const header = new Uint32Array(1);
  std.in.read(header.buffer, 0, 4);
  const output = new Uint8Array(header[0]);
  std.in.read(output.buffer, 0, output.length);
  return output;
}

function sendMessage(message) {
  const header = Uint32Array.from(
    {
      length: 4,
    },
    (_, index) => (message.length >> (index * 8)) & 0xff,
  );
  const output = new Uint8Array(header.length + message.length);
  output.set(header, 0);
  output.set(message, 4);
  std.out.write(output.buffer, 0, output.length);
  std.out.flush();
}

function encodeMessage(message) {
  return new Uint8Array(
    [...JSON.stringify(message)].map((s) => s.codePointAt()),
  );
}

function main() {
  const err = { errno: 0 };
  while (true) {
    const message = getMessage();
    const str = String.fromCodePoint(...message);
    const { value, done } = JSON.parse(str);
    if (!file) {
      file = std.open(value.fileName, value.flags, err);
      continue;
    }
    if (done) {
      file.close();
      sendMessage(
        new Uint8Array(
          encodeMessage({ done, value, totalBytesWritten }),
        ),
      );
      break;
    } else {
      const u8 = new Uint8Array(value);
      totalBytesWritten += u8.length;
      const currentBytesWritten = u8.buffer.byteLength;
      file.write(u8.buffer, 0, currentBytesWritten);
      ++writes;
      sendMessage(
        encodeMessage({
          done,
          writes,
          currentBytesWritten,
          totalBytesWritten,
        }),
      );
    }
  }
}

try {
  main();
} catch (e) {
  std.exit(1);
}
