const PAGE_SOURCE = "verificador-de-nomes-page";
const EXTENSION_SOURCE = "verificador-de-nomes-extension";

function notifyReady() {
  window.postMessage({
    source: EXTENSION_SOURCE,
    type: "EXTENSION_READY"
  }, "*");
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;
  if (!message || message.source !== PAGE_SOURCE || message.type !== "VERIFY_NAME") {
    return;
  }

  chrome.runtime.sendMessage({
    type: "VERIFY_NAME",
    nome: message.nome
  }).then((response) => {
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: "VERIFY_NAME_RESULT",
      ok: Boolean(response && response.ok),
      message: response && response.message ? response.message : "Pesquisa enviada."
    }, "*");
  }).catch((error) => {
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: "VERIFY_NAME_RESULT",
      ok: false,
      message: error && error.message ? error.message : "A extensão não conseguiu abrir as pesquisas."
    }, "*");
  });
});

notifyReady();
window.addEventListener("DOMContentLoaded", notifyReady);
setTimeout(notifyReady, 500);
