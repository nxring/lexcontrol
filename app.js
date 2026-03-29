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

  const email =
    byId("loginEmail")?.value?.trim() || byId("email")?.value?.trim() || "";
  const password =
    byId("loginPassword")?.value || byId("password")?.value || "";

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
    profile: ["Perfil", "Seus dados profissionais."],
    clients: ["Clientes", "Cadastro e gestão dos seus clientes."],
    processes: ["Processos", "Controle de processos por cliente."],
    deadlines: ["Prazos", "Acompanhe tudo que vence em breve."],
    payments: ["Financeiro", "Honorários, pendências e recebimentos."],
  };

  if (byId("pageTitle")) byId("pageTitle").textContent = titles[section]?.[0] || "";
  if (byId("pageSubtitle")) byId("pageSubtitle").textContent = titles[section]?.[1] || "";
}

async function refreshAll() {
  await Promise.all([
    loadProfile(),
    loadDashboard(),
    loadClients(),
    loadProcesses(),
    load
