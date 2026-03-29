import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let profileData = null;
let editingClientId = null;
let editingProcessId = null;
let editingDeadlineId = null;
let editingPaymentId = null;
let processFilter = "all";
let paymentFilter = "all";

const byId = (id) => document.getElementById(id);

function moneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function togglePanel(id, show) {
  const el = byId(id);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function setLoginError(message = "") {
  const el = byId("loginError");
  if (el) el.textContent = message;
}

async function login() {
  setLoginError("");
  const email = byId("loginEmail")?.value?.trim() || "";
  const password = byId("loginPassword")?.value || "";

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setLoginError("E-mail ou senha inválidos.");
    return;
  }

  currentUser = data.user;
  byId("loginScreen")?.classList.add("hidden");
  byId("app")?.classList.remove("hidden");
  await refreshAll();
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  profileData = null;
  byId("app")?.classList.add("hidden");
  byId("loginScreen")?.classList.remove("hidden");
}

async function bootstrapSession() {
  const { data } = await sb.auth.getSession();
  currentUser = data.session?.user || null;

  if (currentUser) {
    byId("loginScreen")?.classList.add("hidden");
    byId("app")?.classList.remove("hidden");
    await refreshAll();
  }
}

function showSection(section) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  byId(section)?.classList.add("active");

  document
    .querySelectorAll(".menu-btn[data-section], .bottom-btn[data-section]")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === section);
    });

  const titles = {
    dashboard: ["Dashboard", "Visão rápida do seu controle jurídico."],
    clients: ["Clientes", "Cadastro e gestão dos seus clientes."],
    processes: ["Processos", "Controle de processos por cliente."],
    deadlines: ["Prazos", "Acompanhe tudo que vence em breve."],
    payments: ["Financeiro", "Honorários, pendências e recebimentos."],
  };

  if (byId("pageTitle")) byId("pageTitle").textContent = titles[section]?.[0] || "";
  if (byId("pageSubtitle")) byId("pageSubtitle").textContent = titles[section]?.[1] || "";
}

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    return;
  }

  profileData = data || null;

  const fullName = profileData?.full_name || currentUser.email || "Usuário";
  const oabText = profileData?.oab ? `OAB ${profileData.oab}` : "OAB não informada";

  if (byId("profileNameChip")) byId("profileNameChip").textContent = fullName;
  if (byId("profileOabChip")) byId("profileOabChip").textContent = oabText;
  if (byId("profileDashboardName")) byId("profileDashboardName").textContent = fullName;
  if (byId("profileDashboardOab")) byId("profileDashboardOab").textContent = oabText;

  if (byId("configName")) byId("configName").value = profileData?.full_name || "";
  if (byId("configOab")) byId("configOab").value = profileData?.oab || "";
}

async function saveProfile() {
  if (!currentUser) return;

  const full_name = byId("configName")?.value?.trim() || "";
  const oab = byId("configOab")?.value?.trim() || "";

  const { error } = await sb.from("profiles").upsert({
    id: currentUser.id,
    full_name,
    oab,
  });

  if (error) {
    console.error("Erro ao salvar perfil:", error);
    alert("Erro ao salvar perfil.");
    return;
  }

  await loadProfile();
  byId("configModal")?.classList.add("hidden");
}

async function loadDashboard() {
  const [clientsRes, processesRes, deadlinesRes, paymentsRes] = await Promise.all([
    sb.from("clients").select("id", { count: "exact" }),
    sb.from("processes").select("id,status"),
    sb.from("deadlines").select("id,data,descricao"),
    sb.from("payments").select("valor,status"),
  ]);

  const clientsCount = clientsRes.data?.length || 0;
  const activeProcesses = (processesRes.data || []).filter((p) => p.status === "ativo").length;

  const now = new Date();
  const future7 = new Date();
  future7.setDate(now.getDate() + 7);

  const upcoming = (deadlinesRes.data || []).filter((d) => {
    if (!d.data) return false;
    const dt = new Date(d.data + "T00:00:00");
    return dt >= new Date(now.toDateString()) && dt <= future7;
  });

  const pendingTotal = (paymentsRes.data || [])
    .filter((p) => p.status === "pendente")
    .reduce((acc, p) => acc + Number(p.valor || 0), 0);

  if (byId("dashClients")) byId("dashClients").textContent = clientsCount;
  if (byId("dashProcesses")) byId("dashProcesses").textContent = activeProcesses;
  if (byId("dashDeadlines")) byId("dashDeadlines").textContent = upcoming.length;
  if (byId("dashPayments")) byId("dashPayments").textContent = moneyBR(pendingTotal);

  const alertBox = byId("dashboardAlert");
  if (!alertBox) return;

  if (!upcoming.length) {
    alertBox.className = "empty";
    alertBox.textContent = "Sem alertas no momento.";
  } else {
    alertBox.className = "";
    alertBox.innerHTML = upcoming
      .map(
        (d) => `<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)">
          <strong>${escapeHtml(d.descricao)}</strong><br>
          <span style="color:#b5c1db">${new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
        </div>`
      )
      .join("");
  }
}

function resetClientForm() {
  editingClientId = null;
  if (byId("clientPanelTitle")) byId("clientPanelTitle").textContent = "Novo cliente";
  ["clientNome", "clientTelefone", "clientEmail", "clientObs"].forEach((id) => {
    if (byId(id)) byId(id).value = "";
  });
}

async function saveClient() {
  const nome = byId("clientNome")?.value?.trim() || "";
  const telefone = byId("clientTelefone")?.value?.trim() || "";
  const email = byId("clientEmail")?.value?.trim() || "";
  const observacoes = byId("clientObs")?.value?.trim() || "";

  if (!nome) return alert("Nome é obrigatório.");

  const payload = { user_id: currentUser.id, nome, telefone, email, observacoes };
  const res = editingClientId
    ? await sb.from("clients").update(payload).eq("id", editingClientId)
    : await sb.from("clients").insert(payload);

  if (res.error) return alert("Erro ao salvar cliente.");

  resetClientForm();
  togglePanel("clientPanel", false);
  await refreshAll();
  showSection("clients");
}

async function loadClients() {
  const { data, error } = await sb.from("clients").select("*").order("created_at", { ascending: false });
  const box = byId("clientsList");
  if (!box) return;

  if (error) {
    box.innerHTML = '<div class="empty">Erro ao carregar clientes.</div>';
    return;
  }

  if (!data || !data.length) {
    box.innerHTML = '<div class="empty">Nenhum cliente cadastrado.</div>';
    return;
  }

  box.innerHTML = data
    .map(
      (c) => `<div class="item">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(c.nome)}</div>
            <div class="item-sub">
              ${c.telefone ? "📱 " + escapeHtml(c.telefone) + "<br>" : ""}
              ${c.email ? "✉️ " + escapeHtml(c.email) + "<br>" : ""}
              ${c.observacoes ? "Obs: " + escapeHtml(c.observacoes) : ""}
            </div>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary" data-edit-client="${c.id}">Editar</button>
          <button class="btn btn-danger" data-delete-client="${c.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");
}

async function editClient(id) {
  const { data, error } = await sb.from("clients").select("*").eq("id", id).single();
  if (error || !data) return alert("Erro ao carregar cliente.");

  editingClientId = id;
  if (byId("clientPanelTitle")) byId("clientPanelTitle").textContent = "Editar cliente";
  if (byId("clientNome")) byId("clientNome").value = data.nome || "";
  if (byId("clientTelefone")) byId("clientTelefone").value = data.telefone || "";
  if (byId("clientEmail")) byId("clientEmail").value = data.email || "";
  if (byId("clientObs")) byId("clientObs").value = data.observacoes || "";
  togglePanel("clientPanel", true);
  showSection("clients");
}

async function deleteClient(id) {
  if (!confirm("Excluir este cliente?")) return;
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) return alert("Erro ao excluir cliente.");
  await refreshAll();
}

async function populateClientSelects() {
  const { data } = await sb.from("clients").select("id,nome").order("nome", { ascending: true });
  const clients = data || [];

  const processClient = byId("processClient");
  const paymentClient = byId("paymentClient");

  if (processClient) {
    processClient.innerHTML = clients.length
      ? clients.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")
      : '<option value="">Nenhum cliente cadastrado</option>';
  }

  if (paymentClient) {
    paymentClient.innerHTML = clients.length
      ? clients.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")
      : '<option value="">Nenhum cliente cadastrado</option>';
  }
}

function resetProcessForm() {
  editingProcessId = null;
  if (byId("processPanelTitle")) byId("processPanelTitle").textContent = "Novo processo";
  ["processNumero", "processTipo", "processObs"].forEach((id) => {
    if (byId(id)) byId(id).value = "";
  });
  if (byId("processStatus")) byId("processStatus").value = "ativo";
}

function setProcessFilter(filter) {
  processFilter = filter;
  loadProcesses();
}

async function saveProcess() {
  const client_id = byId("processClient")?.value || "";
  const numero = byId("processNumero")?.value?.trim() || "";
  const tipo = byId("processTipo")?.value?.trim() || "";
  const status = byId("processStatus")?.value || "ativo";
  const observacoes = byId("processObs")?.value?.trim() || "";

  if (!client_id || !numero) return alert("Cliente e número do processo são obrigatórios.");

  const payload = { user_id: currentUser.id, client_id, numero, tipo, status, observacoes };
  const res = editingProcessId
    ? await sb.from("processes").update(payload).eq("id", editingProcessId)
    : await sb.from("processes").insert(payload);

  if (res.error) return alert("Erro ao salvar processo.");

  resetProcessForm();
  togglePanel("processPanel", false);
  await refreshAll();
  showSection("processes");
}

async function loadProcesses() {
  const { data, error } = await sb
    .from("processes")
    .select("*, clients(nome)")
    .order("created_at", { ascending: false });

  const box = byId("processesList");
  if (!box) return;

  if (error) {
    box.innerHTML = '<div class="empty">Erro ao carregar processos.</div>';
    return;
  }

  let rows = data || [];
  if (processFilter !== "all") rows = rows.filter((r) => r.status === processFilter);

  if (!rows.length) {
    box.innerHTML = '<div class="empty">Nenhum processo encontrado.</div>';
    return;
  }

  box.innerHTML = rows
    .map(
      (p) => `<div class="item">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(p.numero)}</div>
            <div class="item-sub">
              Cliente: ${escapeHtml(p.clients?.nome || "-")}<br>
              Tipo: ${escapeHtml(p.tipo || "-")}<br>
              ${p.observacoes ? "Obs: " + escapeHtml(p.observacoes) : ""}
            </div>
          </div>
          <div><span class="badge ${p.status === "ativo" ? "badge-active" : "badge-final"}">${escapeHtml(p.status)}</span></div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary" data-edit-process="${p.id}">Editar</button>
          <button class="btn btn-danger" data-delete-process="${p.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");
}

async function editProcess(id) {
  const { data, error } = await sb.from("processes").select("*").eq("id", id).single();
  if (error || !data) return alert("Erro ao carregar processo.");

  editingProcessId = id;
  if (byId("processPanelTitle")) byId("processPanelTitle").textContent = "Editar processo";
  if (byId("processClient")) byId("processClient").value = data.client_id || "";
  if (byId("processNumero")) byId("processNumero").value = data.numero || "";
  if (byId("processTipo")) byId("processTipo").value = data.tipo || "";
  if (byId("processStatus")) byId("processStatus").value = data.status || "ativo";
  if (byId("processObs")) byId("processObs").value = data.observacoes || "";
  togglePanel("processPanel", true);
  showSection("processes");
}

async function deleteProcess(id) {
  if (!confirm("Excluir este processo?")) return;
  const { error } = await sb.from("processes").delete().eq("id", id);
  if (error) return alert("Erro ao excluir processo.");
  await refreshAll();
}

async function populateProcessSelect() {
  const { data } = await sb.from("processes").select("id,numero").order("numero", { ascending: true });
  const rows = data || [];
  const sel = byId("deadlineProcess");
  if (!sel) return;

  sel.innerHTML = rows.length
    ? rows.map((p) => `<option value="${p.id}">${escapeHtml(p.numero)}</option>`).join("")
    : '<option value="">Nenhum processo cadastrado</option>';
}

function resetDeadlineForm() {
  editingDeadlineId = null;
  if (byId("deadlinePanelTitle")) byId("deadlinePanelTitle").textContent = "Novo prazo";
  if (byId("deadlineDescricao")) byId("deadlineDescricao").value = "";
  if (byId("deadlineData")) byId("deadlineData").value = "";
}

async function saveDeadline() {
  const process_id = byId("deadlineProcess")?.value || "";
  const descricao = byId("deadlineDescricao")?.value?.trim() || "";
  const data = byId("deadlineData")?.value || "";

  if (!process_id || !descricao || !data) return alert("Preencha processo, descrição e data.");

  const payload = { user_id: currentUser.id, process_id, descricao, data };
  const res = editingDeadlineId
    ? await sb.from("deadlines").update(payload).eq("id", editingDeadlineId)
    : await sb.from("deadlines").insert(payload);

  if (res.error) return alert("Erro ao salvar prazo.");

  resetDeadlineForm();
  togglePanel("deadlinePanel", false);
  await refreshAll();
  showSection("deadlines");
}

function deadlineBadge(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((target - new Date(now.toDateString())) / (1000 * 60 * 60 * 24));

  if (diff < 0) return '<span class="badge badge-urgente">Atrasado</span>';
  if (diff <= 3) return '<span class="badge badge-urgente">Urgente</span>';
  if (diff <= 7) return '<span class="badge badge-atencao">Atenção</span>';
  return '<span class="badge badge-ok">No prazo</span>';
}

async function loadDeadlines() {
  const { data, error } = await sb
    .from("deadlines")
    .select("*, processes(numero)")
    .order("data", { ascending: true });

  const box = byId("deadlinesList");
  if (!box) return;

  if (error) {
    box.innerHTML = '<div class="empty">Erro ao carregar prazos.</div>';
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    box.innerHTML = '<div class="empty">Nenhum prazo cadastrado.</div>';
    return;
  }

  box.innerHTML = rows
    .map(
      (d) => `<div class="item">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(d.descricao)}</div>
            <div class="item-sub">
              Processo: ${escapeHtml(d.processes?.numero || "-")}<br>
              Data: ${new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div>${deadlineBadge(d.data)}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary" data-edit-deadline="${d.id}">Editar</button>
          <button class="btn btn-danger" data-delete-deadline="${d.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");
}

async function editDeadline(id) {
  const { data, error } = await sb.from("deadlines").select("*").eq("id", id).single();
  if (error || !data) return alert("Erro ao carregar prazo.");

  editingDeadlineId = id;
  if (byId("deadlinePanelTitle")) byId("deadlinePanelTitle").textContent = "Editar prazo";
  if (byId("deadlineProcess")) byId("deadlineProcess").value = data.process_id || "";
  if (byId("deadlineDescricao")) byId("deadlineDescricao").value = data.descricao || "";
  if (byId("deadlineData")) byId("deadlineData").value = data.data || "";
  togglePanel("deadlinePanel", true);
  showSection("deadlines");
}

async function deleteDeadline(id) {
  if (!confirm("Excluir este prazo?")) return;
  const { error } = await sb.from("deadlines").delete().eq("id", id);
  if (error) return alert("Erro ao excluir prazo.");
  await refreshAll();
}

function resetPaymentForm() {
  editingPaymentId = null;
  if (byId("paymentPanelTitle")) byId("paymentPanelTitle").textContent = "Novo pagamento";
  if (byId("paymentValor")) byId("paymentValor").value = "";
  if (byId("paymentStatus")) byId("paymentStatus").value = "pendente";
}

function setPaymentFilter(filter) {
  paymentFilter = filter;
  loadPayments();
}

async function savePayment() {
  const client_id = byId("paymentClient")?.value || "";
  const valor = byId("paymentValor")?.value || "";
  const status = byId("paymentStatus")?.value || "pendente";

  if (!client_id || !valor) return alert("Cliente e valor são obrigatórios.");

  const payload = { user_id: currentUser.id, client_id, valor, status };
  const res = editingPaymentId
    ? await sb.from("payments").update(payload).eq("id", editingPaymentId)
    : await sb.from("payments").insert(payload);

  if (res.error) return alert("Erro ao salvar pagamento.");

  resetPaymentForm();
  togglePanel("paymentPanel", false);
  await refreshAll();
  showSection("payments");
}

async function loadPayments() {
  const { data, error } = await sb
    .from("payments")
    .select("*, clients(nome)")
    .order("created_at", { ascending: false });

  const box = byId("paymentsList");
  if (!box) return;

  if (error) {
    box.innerHTML = '<div class="empty">Erro ao carregar financeiro.</div>';
    return;
  }

  let rows = data || [];
  if (paymentFilter !== "all") rows = rows.filter((r) => r.status === paymentFilter);

  if (!rows.length) {
    box.innerHTML = '<div class="empty">Nenhum pagamento encontrado.</div>';
    return;
  }

  box.innerHTML = rows
    .map(
      (p) => `<div class="item">
        <div class="item-top">
          <div>
            <div class="item-title">${moneyBR(p.valor)}</div>
            <div class="item-sub">Cliente: ${escapeHtml(p.clients?.nome || "-")}</div>
          </div>
          <div><span class="badge ${p.status === "pago" ? "badge-pago" : "badge-pendente"}">${escapeHtml(p.status)}</span></div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary" data-edit-payment="${p.id}">Editar</button>
          <button class="btn btn-warning" data-send-charge="${escapeHtml(p.clients?.nome || "Cliente")}">Enviar cobrança</button>
          <button class="btn btn-danger" data-delete-payment="${p.id}">Excluir</button>
        </div>
      </div>`
    )
    .join("");
}

async function editPayment(id) {
  const { data, error } = await sb.from("payments").select("*").eq("id", id).single();
  if (error || !data) return alert("Erro ao carregar pagamento.");

  editingPaymentId = id;
  if (byId("paymentPanelTitle")) byId("paymentPanelTitle").textContent = "Editar pagamento";
  if (byId("paymentClient")) byId("paymentClient").value = data.client_id || "";
  if (byId("paymentValor")) byId("paymentValor").value = data.valor || "";
  if (byId("paymentStatus")) byId("paymentStatus").value = data.status || "pendente";
  togglePanel("paymentPanel", true);
  showSection("payments");
}

async function deletePayment(id) {
  if (!confirm("Excluir este pagamento?")) return;
  const { error } = await sb.from("payments").delete().eq("id", id);
  if (error) return alert("Erro ao excluir pagamento.");
  await refreshAll();
}

function sendCharge(clientName) {
  alert(`Cobrança simulada enviada para ${clientName}.`);
}

function wireEvents() {
  byId("loginButton")?.addEventListener("click", login);
  byId("logoutTop")?.addEventListener("click", logout);
  byId("logoutDesktop")?.addEventListener("click", logout);

  document.querySelectorAll(".menu-btn[data-section], .bottom-btn[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => togglePanel(btn.dataset.close, false));
  });

  document.querySelectorAll(".quick-btn[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showSection(btn.dataset.go);
      togglePanel(btn.dataset.panel, true);
    });
  });

  byId("newClientBtn")?.addEventListener("click", () => {
    resetClientForm();
    togglePanel("clientPanel", true);
  });
  byId("saveClientBtn")?.addEventListener("click", saveClient);

  byId("newProcessBtn")?.addEventListener("click", () => {
    resetProcessForm();
    togglePanel("processPanel", true);
  });
  byId("saveProcessBtn")?.addEventListener("click", saveProcess);

  byId("newDeadlineBtn")?.addEventListener("click", () => {
    resetDeadlineForm();
    togglePanel("deadlinePanel", true);
  });
  byId("saveDeadlineBtn")?.addEventListener("click", saveDeadline);

  byId("newPaymentBtn")?.addEventListener("click", () => {
    resetPaymentForm();
    togglePanel("paymentPanel", true);
  });
  byId("savePaymentBtn")?.addEventListener("click", savePayment);

  document.querySelectorAll("[data-process-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setProcessFilter(btn.dataset.processFilter));
  });

  document.querySelectorAll("[data-payment-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setPaymentFilter(btn.dataset.paymentFilter));
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.editClient) editClient(target.dataset.editClient);
    if (target.dataset.deleteClient) deleteClient(target.dataset.deleteClient);

    if (target.dataset.editProcess) editProcess(target.dataset.editProcess);
    if (target.dataset.deleteProcess) deleteProcess(target.dataset.deleteProcess);

    if (target.dataset.editDeadline) editDeadline(target.dataset.editDeadline);
    if (target.dataset.deleteDeadline) deleteDeadline(target.dataset.deleteDeadline);

    if (target.dataset.editPayment) editPayment(target.dataset.editPayment);
    if (target.dataset.deletePayment) deletePayment(target.dataset.deletePayment);
    if (target.dataset.sendCharge) sendCharge(target.dataset.sendCharge);
  });

  byId("openConfigBtn")?.addEventListener("click", () => {
    if (byId("configName")) byId("configName").value = profileData?.full_name || "";
    if (byId("configOab")) byId("configOab").value = profileData?.oab || "";
    byId("configModal")?.classList.remove("hidden");
  });

  byId("closeConfigBtn")?.addEventListener("click", () => {
    byId("configModal")?.classList.add("hidden");
  });

  byId("saveConfigBtn")?.addEventListener("click", saveProfile);
}

async function refreshAll() {
  await Promise.all([
    loadProfile(),
    loadDashboard(),
    loadClients(),
    loadProcesses(),
    loadDeadlines(),
    loadPayments(),
    populateClientSelects(),
    populateProcessSelect(),
  ]);
}

wireEvents();
bootstrapSession();
