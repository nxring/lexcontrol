const sb = supabase.createClient(
  "https://gkwsagqmipsmqjtjqffe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrd3NhZ3FtaXBzbXFqdGpxZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODAzODksImV4cCI6MjA5MDM1NjM4OX0.2saPkwADuOOxnMBhxTcu3adBpggTJ7cdQs83F18qXPU"
);

let currentUser = null;
let profileData = null;

/* LOGIN */
document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) return alert("Erro login");

  currentUser = data.user;

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  await init();
};

/* INIT */
async function init() {
  await loadProfile();
  await loadDashboard();
  await loadClients();
}

/* PROFILE */
async function loadProfile() {
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  profileData = data;

  const name = data?.full_name || currentUser.email;
  const oab = data?.oab ? "OAB " + data.oab : "Sem OAB";

  document.getElementById("profileNameChip").innerText = name;
  document.getElementById("profileOabChip").innerText = oab;

  document.getElementById("profileDashboardName").innerText = name;
  document.getElementById("profileDashboardOab").innerText = oab;
}

/* DASHBOARD */
async function loadDashboard() {
  const { data } = await sb
    .from("clients")
    .select("*")
    .eq("user_id", currentUser.id);

  document.getElementById("dashClients").innerText = data?.length || 0;
}

/* CLIENTES */
async function loadClients() {
  const { data } = await sb
    .from("clients")
    .select("*")
    .eq("user_id", currentUser.id);

  document.getElementById("clientsList").innerHTML =
    data?.map(c => `<div class="card">${c.nome}</div>`).join("") || "";
}

/* CONFIG MODAL */
document.getElementById("openConfigBtn").onclick = () => {
  document.getElementById("configModal").classList.remove("hidden");

  document.getElementById("configName").value = profileData?.full_name || "";
  document.getElementById("configOab").value = profileData?.oab || "";
};

document.getElementById("closeConfigBtn").onclick = () => {
  document.getElementById("configModal").classList.add("hidden");
};

document.getElementById("saveConfigBtn").onclick = async () => {
  const full_name = document.getElementById("configName").value;
  const oab = document.getElementById("configOab").value;

  const { error } = await sb.from("profiles").upsert({
    id: currentUser.id,
    full_name,
    oab
  });

  if (error) return alert("Erro");

  document.getElementById("configModal").classList.add("hidden");

  await loadProfile();
};

/* NAV */
document.querySelectorAll(".menu-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
    document.getElementById(btn.dataset.section).classList.remove("hidden");
  };
});

/* LOGOUT */
document.getElementById("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};
