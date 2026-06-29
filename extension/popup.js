const PLATAFORMAS = ["INPI", "Domínio", "Maps", "Instagram", "TikTok", "Facebook", "YouTube"];
const PESQUISA_KEY = "pesquisaAtual";

const nomeAtual = document.getElementById("nomeAtual");
const checks = document.getElementById("checks");
const statusEl = document.getElementById("status");

document.addEventListener("DOMContentLoaded", carregarPesquisa);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[PESQUISA_KEY]) return;

  const pesquisaAtual = changes[PESQUISA_KEY].newValue;
  if (pesquisaAtual) {
    renderPesquisa(pesquisaAtual);
  } else {
    renderSemPesquisa();
  }
});

async function carregarPesquisa() {
  const response = await chrome.runtime.sendMessage({ type: "GET_CURRENT_SEARCH" }).catch((error) => ({
    ok: false,
    message: error && error.message ? error.message : "Erro ao carregar pesquisa."
  }));

  if (!response || !response.ok || !response.pesquisaAtual) {
    renderSemPesquisa();
    return;
  }

  renderPesquisa(response.pesquisaAtual);
}

function renderSemPesquisa() {
  nomeAtual.textContent = "Nenhuma pesquisa ativa";
  checks.innerHTML = "";
  PLATAFORMAS.forEach((plataforma) => {
    checks.appendChild(criarItem(plataforma, false, true));
  });
  setStatus("Abra uma pesquisa pela página principal.", "error");
}

function renderPesquisa(pesquisaAtual) {
  nomeAtual.textContent = `Pesquisa atual: ${pesquisaAtual.nome}`;
  checks.innerHTML = "";

  PLATAFORMAS.forEach((plataforma) => {
    checks.appendChild(criarItem(
      plataforma,
      Boolean(pesquisaAtual.resultados && pesquisaAtual.resultados[plataforma]),
      false
    ));
  });

  setStatus("Marque aqui para atualizar o histórico.", "");
}

function criarItem(plataforma, checked, disabled) {
  const label = document.createElement("label");
  label.className = "item";

  const text = document.createElement("span");
  text.className = "label";
  text.textContent = plataforma;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  checkbox.addEventListener("change", async () => {
    const response = await chrome.runtime.sendMessage({
      type: "SET_RESULT",
      plataforma,
      checked: checkbox.checked
    }).catch((error) => ({
      ok: false,
      message: error && error.message ? error.message : "Erro ao atualizar resultado."
    }));

    if (!response || !response.ok) {
      checkbox.checked = !checkbox.checked;
      setStatus(response && response.message ? response.message : "Erro ao atualizar resultado.", "error");
      return;
    }

    if (response.pesquisaAtual) {
      renderPesquisa(response.pesquisaAtual);
    }

    setStatus(`${plataforma} atualizado no histórico.`, "success");
  });

  label.append(text, checkbox);
  return label;
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type ? `status ${type}` : "status";
}
