chrome.action.onClicked.addListener(async (tab) => {
  // 1. Evitar que se ejecute en páginas internas del navegador donde está prohibido
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("https://chromewebstore.google.com")) {
    console.warn("Universal Crop PiP: No se puede ejecutar en páginas protegidas del sistema.");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "start_crop" });
  } catch (err) {
    if (err.message.includes("Could not establish connection")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "start_crop" });
        }, 100);
        
      } catch (injectionErr) {
        console.error("Error al inyectar el script dinámicamente:", injectionErr);
      }
    } else {
      console.error("Error inesperado en el canal de comunicación:", err);
    }
  }
});