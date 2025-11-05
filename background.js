chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "autofill-now") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["Config.js", "runner.js"]
    });
  } catch (e) {
    console.warn("[Autofill QA] No se pudo inyectar runner.js:", e);
  }
});
