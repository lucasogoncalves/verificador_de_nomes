const INPI_HOST = "busca.inpi.gov.br";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "VERIFY_NAME") return false;

  verificarNome(message.nome)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        message: error && error.message ? error.message : "Erro ao abrir as pesquisas."
      });
    });

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url || !isInpiUrl(tab.url)) return;

  chrome.storage.local.get("nomeParaVerificar").then(({ nomeParaVerificar }) => {
    if (!nomeParaVerificar) return;

    chrome.scripting.executeScript({
      target: { tabId },
      func: automatizarInpi,
      args: [nomeParaVerificar]
    }).catch((error) => {
      console.warn("Falha ao injetar automação do INPI:", error);
    });
  });
});

async function verificarNome(nome) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) {
    throw new Error("Digite um nome antes de verificar.");
  }

  await chrome.storage.local.set({ nomeParaVerificar: nomeLimpo });

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
      plataforma: "Dominio",
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
