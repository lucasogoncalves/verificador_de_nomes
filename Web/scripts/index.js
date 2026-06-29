const PAGE_SOURCE = "verificador-de-nomes-page";
const EXTENSION_SOURCE = "verificador-de-nomes-extension";
const PLATAFORMAS = ["INPI", "Domínio", "Maps", "Instagram", "TikTok", "Facebook", "YouTube"];

let extensaoDetectada = false;

function atualizarStatusExtensao(detectada) {
  extensaoDetectada = detectada;

  const status = document.getElementById("extensionStatus");
  if (!status) return;

  status.classList.toggle("is-ready", detectada);
  status.textContent = detectada
    ? "Extensão detectada. Você já pode pesquisar."
    : "Extensão não detectada. Instale, permita e recarregue esta página.";
}

function mostrarFeedback(mensagem, tipo = "info") {
  const feedback = document.getElementById("feedback");
  if (!feedback) return;

  feedback.textContent = mensagem;
  feedback.dataset.type = tipo;
}

async function copiarNome(nome) {
  if (!navigator.clipboard || !window.isSecureContext) return;

  try {
    await navigator.clipboard.writeText(nome);
  } catch (error) {
    console.warn("Não foi possível copiar o nome:", error);
  }
}

function lerJSON(chave, fallback) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || fallback;
  } catch (_) {
    return fallback;
  }
}

function salvarHistorico(historico) {
  localStorage.setItem("historico", JSON.stringify(historico));
}

function adicionarAoHistorico(nome) {
  const historico = lerJSON("historico", []);
  const semDuplicado = historico.filter((item) => item.toLowerCase() !== nome.toLowerCase());
  semDuplicado.push(nome);
  salvarHistorico(semDuplicado);
  carregarHistorico();
}

function criarCheckbox(nome, plataforma) {
  const marcados = lerJSON("marcados", {});
  const id = `${plataforma}-${nome}`;
  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.checked = Boolean(marcados[id]);
  checkbox.title = `${plataforma} disponível`;
  checkbox.addEventListener("change", () => {
    const dados = lerJSON("marcados", {});
    dados[id] = checkbox.checked;
    localStorage.setItem("marcados", JSON.stringify(dados));
  });

  return checkbox;
}

function carregarHistorico() {
  const tabela = document.getElementById("historico");
  if (!tabela) return;

  const historico = lerJSON("historico", []);
  const favoritos = lerJSON("favoritos", {});

  tabela.innerHTML = "";

  if (!historico.length) {
    const row = tabela.insertRow();
    const cell = row.insertCell();
    cell.colSpan = PLATAFORMAS.length + 4;
    cell.className = "empty-history";
    cell.textContent = "Nenhuma pesquisa feita ainda.";
    return;
  }

  const header = tabela.createTHead().insertRow();
  ["Nome", "Todos", ...PLATAFORMAS, "Favorito", "Excluir"].forEach((titulo) => {
    const th = document.createElement("th");
    th.textContent = titulo;
    header.appendChild(th);
  });

  const tbody = tabela.createTBody();

  [...historico].reverse().forEach((nome) => {
    const row = tbody.insertRow();

    const nomeCell = row.insertCell();
    nomeCell.textContent = nome;
    nomeCell.className = "name-cell";

    const todosCell = row.insertCell();
    const todosButton = document.createElement("button");
    todosButton.type = "button";
    todosButton.className = "icon-button";
    todosButton.textContent = "✓";
    todosButton.title = "Marcar ou desmarcar todos";
    todosButton.addEventListener("click", () => {
      const checkboxes = [...row.querySelectorAll('input[type="checkbox"]')];
      const todosMarcados = checkboxes.every((checkbox) => checkbox.checked);
      const marcados = lerJSON("marcados", {});

      checkboxes.forEach((checkbox) => {
        checkbox.checked = !todosMarcados;
        marcados[checkbox.dataset.id] = checkbox.checked;
      });

      localStorage.setItem("marcados", JSON.stringify(marcados));
    });
    todosCell.appendChild(todosButton);

    PLATAFORMAS.forEach((plataforma) => {
      const cell = row.insertCell();
      const checkbox = criarCheckbox(nome, plataforma);
      checkbox.dataset.id = `${plataforma}-${nome}`;
      cell.appendChild(checkbox);
    });

    const favCell = row.insertCell();
    const favButton = document.createElement("button");
    favButton.type = "button";
    favButton.className = "icon-button favorite-button";
    favButton.textContent = favoritos[nome] ? "★" : "☆";
    favButton.title = "Favoritar nome";
    favButton.addEventListener("click", () => {
      const dados = lerJSON("favoritos", {});
      dados[nome] = !dados[nome];
      localStorage.setItem("favoritos", JSON.stringify(dados));
      favButton.textContent = dados[nome] ? "★" : "☆";
    });
    favCell.appendChild(favButton);

    const excluirCell = row.insertCell();
    const excluirButton = document.createElement("button");
    excluirButton.type = "button";
    excluirButton.className = "icon-button danger-button";
    excluirButton.textContent = "×";
    excluirButton.title = "Excluir nome";
    excluirButton.addEventListener("click", () => {
      const novoHistorico = lerJSON("historico", [])
        .filter((item) => item.toLowerCase() !== nome.toLowerCase());
      const novosFavoritos = lerJSON("favoritos", {});
      const novosMarcados = lerJSON("marcados", {});

      delete novosFavoritos[nome];
      Object.keys(novosMarcados).forEach((chave) => {
        if (chave.endsWith(`-${nome}`)) delete novosMarcados[chave];
      });

      salvarHistorico(novoHistorico);
      localStorage.setItem("favoritos", JSON.stringify(novosFavoritos));
      localStorage.setItem("marcados", JSON.stringify(novosMarcados));
      carregarHistorico();
    });
    excluirCell.appendChild(excluirButton);
  });
}

function limparHistorico() {
  if (!confirm("Limpar todo o histórico?")) return;

  localStorage.removeItem("historico");
  localStorage.removeItem("favoritos");
  localStorage.removeItem("marcados");
  carregarHistorico();
}

function aplicarResultadoDaExtensao(nome, plataforma, checked) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo || !PLATAFORMAS.includes(plataforma)) return;

  const historico = lerJSON("historico", []);
  const existe = historico.some((item) => item.toLowerCase() === nomeLimpo.toLowerCase());
  if (!existe) {
    historico.push(nomeLimpo);
    salvarHistorico(historico);
  }

  const marcados = lerJSON("marcados", {});
  marcados[`${plataforma}-${nomeLimpo}`] = Boolean(checked);
  localStorage.setItem("marcados", JSON.stringify(marcados));

  carregarHistorico();
  mostrarFeedback(`${plataforma} atualizado no histórico.`, "success");
}

function verificar(event) {
  if (event) event.preventDefault();

  const input = document.getElementById("nomeInput");
  const nome = input ? input.value.trim() : "";

  if (!nome) {
    mostrarFeedback("Digite um nome antes de verificar.", "error");
    return;
  }

  if (!extensaoDetectada) {
    mostrarFeedback("A extensão ainda não foi detectada. Instale a extensão e recarregue a página.", "error");
    return;
  }

  copiarNome(nome);
  adicionarAoHistorico(nome);
  mostrarFeedback("Enviando pesquisa para a extensão...", "info");

  window.postMessage({
    source: PAGE_SOURCE,
    type: "VERIFY_NAME",
    nome
  }, window.location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;
  if (!message || message.source !== EXTENSION_SOURCE) return;

  if (message.type === "EXTENSION_READY") {
    atualizarStatusExtensao(true);
    return;
  }

  if (message.type === "VERIFY_NAME_RESULT") {
    mostrarFeedback(
      message.message || "Pesquisa enviada.",
      message.ok ? "success" : "error"
    );
    return;
  }

  if (message.type === "RESULT_UPDATED") {
    aplicarResultadoDaExtensao(message.nome, message.plataforma, message.checked);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  if (!extensaoDetectada) atualizarStatusExtensao(false);

  const form = document.getElementById("formVerificador");
  if (form) {
    form.addEventListener("submit", verificar);
  } else {
    const botao = document.getElementById("btnVerificar");
    if (botao) botao.addEventListener("click", verificar);
  }

  const limpar = document.getElementById("btnLimparHistorico");
  if (limpar) limpar.addEventListener("click", limparHistorico);

  carregarHistorico();
});
