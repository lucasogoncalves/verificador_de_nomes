const INPI_HOST = "busca.inpi.gov.br";
const PLATAFORMAS = ["INPI", "Domínio", "Maps", "Instagram", "TikTok", "Facebook", "YouTube"];
const PESQUISA_KEY = "pesquisaAtual";

configurarSidePanel();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "VERIFY_NAME") {
    verificarNome(message.nome, sender && sender.tab ? sender.tab.id : null)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error && error.message ? error.message : "Erro ao abrir as pesquisas."
        });
      });

    return true;
  }

  if (message.type === "GET_CURRENT_SEARCH") {
    carregarPesquisaAtual()
      .then((pesquisaAtual) => sendResponse({ ok: true, pesquisaAtual }))
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error && error.message ? error.message : "Erro ao carregar pesquisa."
        });
      });

    return true;
  }

  if (message.type === "SET_RESULT") {
    atualizarResultado(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error && error.message ? error.message : "Erro ao atualizar resultado."
        });
      });

    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  configurarSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  configurarSidePanel();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url || !isInpiUrl(tab.url)) return;

  chrome.storage.local.get("nomeParaVerificar").then(({ nomeParaVerificar }) => {
    if (!nomeParaVerificar) return;
    automatizarAbaInpi(tabId, nomeParaVerificar);
  });
});

async function verificarNome(nome, pageTabId) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) {
    throw new Error("Digite um nome antes de verificar.");
  }

  const pesquisaAtual = {
    id: `${Date.now()}`,
    nome: nomeLimpo,
    pageTabId,
    resultados: Object.fromEntries(PLATAFORMAS.map((plataforma) => [plataforma, false]))
  };

  await chrome.storage.local.set({
    [PESQUISA_KEY]: pesquisaAtual,
    nomeParaVerificar: nomeLimpo
  });

  const abas = gerarAbas(nomeLimpo);
  for (const aba of abas) {
    await chrome.tabs.create({
      url: aba.url,
      active: aba.active
    });
  }

  return {
    ok: true,
    message: "Pesquisas abertas pela extensão."
  };
}

async function atualizarResultado(message) {
  const pesquisaAtual = await carregarPesquisaAtual();
  if (!pesquisaAtual || !pesquisaAtual.nome) {
    throw new Error("Nenhuma pesquisa ativa. Faça uma busca pela página primeiro.");
  }

  if (!PLATAFORMAS.includes(message.plataforma)) {
    throw new Error("Plataforma inválida.");
  }

  const checked = Boolean(message.checked);
  pesquisaAtual.resultados = pesquisaAtual.resultados || {};
  pesquisaAtual.resultados[message.plataforma] = checked;

  await chrome.storage.local.set({ [PESQUISA_KEY]: pesquisaAtual });
  await enviarResultadoParaPagina({
    nome: pesquisaAtual.nome,
    plataforma: message.plataforma,
    checked
  });

  return {
    ok: true,
    pesquisaAtual
  };
}

async function carregarPesquisaAtual() {
  const dados = await chrome.storage.local.get(PESQUISA_KEY);
  return dados[PESQUISA_KEY] || null;
}

async function enviarResultadoParaPagina(resultado) {
  const pesquisaAtual = await carregarPesquisaAtual();
  if (!pesquisaAtual || !pesquisaAtual.pageTabId) return;

  await chrome.tabs.sendMessage(pesquisaAtual.pageTabId, {
    type: "RESULT_UPDATED",
    ...resultado
  }).catch((error) => {
    console.warn("Não foi possível atualizar a página principal:", error);
  });
}

function automatizarAbaInpi(tabId, nomeParaVerificar) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: automatizarInpi,
    args: [nomeParaVerificar]
  }).catch((error) => {
    console.warn("Falha ao injetar automação do INPI:", error);
  });
}

function configurarSidePanel() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) return;

  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  }).catch((error) => {
    console.warn("Não foi possível configurar o painel lateral:", error);
  });
}

function gerarAbas(nome) {
  const slug = slugify(nome);
  const nomeEncoded = encodeURIComponent(nome);

  return [
    {
      plataforma: "Google",
      url: `https://www.google.com/search?q=${nomeEncoded}`,
      active: true
    },
    {
      plataforma: "Domínio",
      url: `https://www.hostinger.com.br/domain-name-results?domain=${slug}.com&from=domain-name-search`,
      active: false
    },
    {
      plataforma: "Maps",
      url: `https://www.google.com/maps/search/${nomeEncoded}`,
      active: false
    },
    {
      plataforma: "Instagram",
      url: `https://www.instagram.com/${slug}`,
      active: false
    },
    {
      plataforma: "TikTok",
      url: `https://www.tiktok.com/@${slug}`,
      active: false
    },
    {
      plataforma: "Facebook",
      url: `https://www.facebook.com/${slug}`,
      active: false
    },
    {
      plataforma: "YouTube",
      url: `https://www.youtube.com/@${slug}`,
      active: false
    },
    {
      plataforma: "INPI",
      url: "https://busca.inpi.gov.br/pePI/",
      active: false
    }
  ];
}

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isInpiUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === INPI_HOST && parsed.pathname.toLowerCase().startsWith("/pepi");
  } catch (_) {
    return false;
  }
}

function automatizarInpi(nome) {
  const url = window.location.href;
  const etapaKey = `verificador-inpi:${url}:${nome}`;

  if (sessionStorage.getItem(etapaKey)) return;
  sessionStorage.setItem(etapaKey, "true");

  function getByXPath(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  function clicar(elemento) {
    if (!elemento) return false;
    elemento.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    return true;
  }

  function preencher(input, valor) {
    input.focus();
    input.value = valor;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (/\/pePI\/?$/.test(window.location.pathname)) {
    const botao = [...document.querySelectorAll('input[type="submit"], button')]
      .find((item) => (item.value || item.innerText || "").toLowerCase().includes("continuar"));
    clicar(botao);
    return;
  }

  if (url.includes("LoginController")) {
    const areaMarca = [...document.querySelectorAll("area")]
      .find((area) => area.href && area.href.includes("marcas/Pesquisa_num_processo.jsp"));

    if (areaMarca) {
      window.location.href = areaMarca.href;
    }
    return;
  }

  if (url.includes("Pesquisa_num_processo.jsp")) {
    const linkMarca = [...document.querySelectorAll("a")]
      .find((link) =>
        link.innerText.trim().toLowerCase() === "marca" &&
        link.href.includes("Pesquisa_classe_basica.jsp")
      );

    clicar(linkMarca);
    return;
  }

  if (url.includes("Pesquisa_classe_basica.jsp")) {
    const campoInput =
      document.querySelector('input[name="expressao"]') ||
      getByXPath("/html/body/form/div/div/table[2]/tbody/tr[6]/td[2]/font/input");

    const tipoRadical = document.querySelector('input[name="tipoBusca"][value="radical"]');
    if (tipoRadical) tipoRadical.checked = true;

    const botaoPesquisar =
      [...document.querySelectorAll('input[type="button"], input[type="submit"], button')]
        .find((item) => (item.value || item.innerText || "").toLowerCase().includes("pesquisar")) ||
      getByXPath("/html/body/form/div/div/table[2]/tbody/tr[11]/td/font/input[1]");

    if (campoInput && botaoPesquisar) {
      preencher(campoInput, nome);
      setTimeout(() => clicar(botaoPesquisar), 200);
    }
  }
}
