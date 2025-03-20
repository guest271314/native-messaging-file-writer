chrome.scripting.unregisterContentScripts().then(() =>
  chrome.scripting
    .registerContentScripts([{
      id: "file-writer-quickjs",
      js: ["file-writer-quickjs.js"],
      persistAcrossSessions: true,
      matches: ["https://*/*", "http://*/*"],
      runAt: "document_start",
      world: "MAIN",
    }])
).catch((e) => console.error(chrome.runtime.lastError, e));

let nativeMessagePort = null;
let externallyConnactablePort = null;

async function handleInstall(e) {
  console.log(e.type);
  e.waitUntil(self.skipWaiting());
}

async function handleActivate(e) {
  console.log(e.type);
  e.waitUntil(self.clients.claim());
}

addEventListener("install", handleInstall);
addEventListener("activate", handleActivate);

function handleNativeMessage(message) {
  externallyConnactablePort.postMessage(message);
  return true;
}

function handleNativeMessageDisconnect(e) {
  if (chrome.runtime.lastError) {
    console.log(chrome.runtime.lastError);
  }
  externallyConnactablePort.disconnect();
  externallyConnactablePort = null;
}

function handleExternallyConnectableMessage(message, { sender }) {
  nativeMessagePort.postMessage(message);
}

function handleExternallyConnectableDisconnect(e) {
  console.log(e);
  nativeMessagePort.disconnect();
  nativeMessagePort.onMessage.removeListener(handleNativeMessage);
  nativeMessagePort.onDisconnect.removeListener(handleNativeMessageDisconnect);
  nativeMessagePort = null;
  externallyConnactablePort = null;
}

function handleExternallyConnectable(externalPort) {
  externallyConnactablePort = externalPort;
  nativeMessagePort = chrome.runtime.connectNative(
    chrome.runtime.getManifest().short_name,
  );
  nativeMessagePort.onMessage.addListener(handleNativeMessage);
  nativeMessagePort.onDisconnect.addListener(handleNativeMessageDisconnect);
  externallyConnactablePort.onMessage.addListener(
    handleExternallyConnectableMessage,
  );
  externallyConnactablePort.onDisconnect.addListener(
    handleExternallyConnectableDisconnect,
  );
}

function handleRuntimeInstall(reason) {
  console.log(reason);
}

chrome.runtime.onConnectExternal.addListener(handleExternallyConnectable);
chrome.runtime.onInstalled.addListener(handleRuntimeInstall);