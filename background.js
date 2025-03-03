chrome.runtime.onInstalled.addListener((reason) => {
  console.log(reason);
});

chrome.scripting.unregisterContentScripts().then(() =>
  chrome.scripting
    .registerContentScripts([{
      id: "file-writer",
      js: ["file-writer.js"],
      persistAcrossSessions: true,
      matches: ["https://*/*", "http://*/*"],
      runAt: "document_start",
      world: "MAIN",
    }])
).catch((e) => console.error(chrome.runtime.lastError, e));

chrome.runtime.onMessageExternal.addListener(
  async (message, sender, sendResponse) => {
    await chrome.runtime.sendNativeMessage(
      chrome.runtime.getManifest().short_name,
      {},
    )
      .then((result) => {
        console.log(result);
        sendResponse(result);
      })
      .catch(console.warn);
  },
);
