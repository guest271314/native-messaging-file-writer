#!/usr/bin/env -S /home/user/bin/node
// https://github.com/WICG/file-system-access/issues/260
// https://issues.chromium.org/issues/40743502
import { createSecureServer } from "node:http2";
import { createWriteStream, readFileSync } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import process from "node:process";
const stdout = Writable.toWeb(process.stdout);
const encoder = new TextEncoder();
const headers = {
  "Cache-Control": "no-cache",
  "Content-Type": "text/plain; charset=UTF-8",
  "Cross-Origin-Opener-Policy": "unsafe-none",
  "Cross-Origin-Embedder-Policy": "unsafe-none",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Allow-Headers": "Access-Control-Request-Private-Network",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,HEAD,QUERY,query",
};
const key = readFileSync(
  `${import.meta.dirname}/certificate.key`,
);
const cert = readFileSync(
  `${import.meta.dirname}/certificate.pem`,
);
function encodeMessage(message) {
  return encoder.encode(JSON.stringify(message));
}
async function sendMessage(message) {
  await ReadableStream.from([
    new Uint8Array(new Uint32Array([message.length]).buffer),
    message,
  ])
    .pipeTo(stdout);
}
let controller;
const requestStream = new ReadableStream({
  start(_) {
    return (controller = _);
  },
});

// https://nodejs.org/api/http2.html#compatibility-api
async function onRequestHandler(request, response) {
  controller.enqueue({ request, response });
}

const server = createSecureServer({
  key,
  cert,
}, onRequestHandler);

server.listen(8443);

for await (const { request, response } of requestStream) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    continue;
  }
  if (request.method === "POST" || /query/i.test(request.method)) {
    response.writeHead(200, headers);
  }
  const options = new URLSearchParams(
    request.url.slice(2),
  );
  const fileName = options.get("fileName");
  const mode = Number(options.get("mode"));
  // const flags = options.get("flags");
  const readable = Readable.toWeb(request);
  const writable = Writable.toWeb(createWriteStream(fileName, {
    mode,
  }));

  const stream = await readable
    .pipeTo(writable)
    .then(() => `Done writing ${fileName}`)
    .catch((e) => {
      return e.message;
    });

  await sendMessage(encodeMessage(stream));

  const stats = {
    fileName,
    ...await stat(
      fileName,
    ),
  };

  await new Response(JSON.stringify(stats))
    .body.pipeTo(Writable.toWeb(response));
  break;
}

process.exit(0);
