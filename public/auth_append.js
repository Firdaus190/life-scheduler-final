function refreshAuthUI() {
  const isGuest = !window.currentUser || window.currentUser.id != window.viewedUserId;
  if (isGuest) {
    $("#btnAdd").style.display = "none";
    $("#calUserSelect").style.pointerEvents = "auto";
  } else {
    $("#btnAdd").style.display = "";
  }
  
  if (isGuest) {
    if($("#btnEditDetail")) $("#btnEditDetail").style.display = "none";
    if($("#btnDeleteDetail")) $("#btnDeleteDetail").style.display = "none";
    if($("#dSubAddForm")) $("#dSubAddForm").style.display = "none";
  } else {
    if($("#btnEditDetail")) $("#btnEditDetail").style.display = "";
    if($("#btnDeleteDetail")) $("#btnDeleteDetail").style.display = "";
    if($("#dSubAddForm")) $("#dSubAddForm").style.display = "flex";
  }

  if (window.currentUser) {
    $("#btnAuth").textContent = window.currentUser.username;
    if($("#publicSwitch")) $("#publicSwitch").classList.toggle("on", window.currentUser.is_public);
    if($("#publicAccessWrap")) $("#publicAccessWrap").classList.remove("hide");
  } else {
    $("#btnAuth").textContent = "Login";
    if($("#publicAccessWrap")) $("#publicAccessWrap").classList.add("hide");
  }
}

async function initAuth() {
  const token = localStorage.getItem("ls_token");
  if (token) {
    try {
      const me = await api("/api/users/me");
      window.currentUser = me;
      window.viewedUserId = me.id;
    } catch(e) {
      localStorage.removeItem("ls_token");
    }
  }

  try {
    const users = await api("/api/users");
    const sel = $("#calUserSelect");
    if(sel) {
      sel.innerHTML = users.map(u => `<option value="${u.id}">${u.username}</option>`).join("");
      if (window.currentUser) {
        if (!users.find(u => u.id === window.currentUser.id)) {
           sel.innerHTML += `<option value="${window.currentUser.id}">${window.currentUser.username} (Private)</option>`;
        }
        sel.value = window.currentUser.id;
      } else if (users.length > 0) {
        window.viewedUserId = users[0].id;
        sel.value = users[0].id;
      }
      if (users.length > 0 || window.currentUser) {
        sel.classList.remove("hide");
      }
    }
  } catch(e) {}

  refreshAuthUI();
  
  document.querySelectorAll(".nav").forEach(b => b.classList.remove("active"));
  const calNav = document.querySelector('.nav[data-v="calendar"]');
  if(calNav) calNav.classList.add("active");
  document.querySelectorAll(".view").forEach(v => v.classList.add("hide"));
  const calView = $("#calendar");
  if(calView) calView.classList.remove("hide");
  
  if (window.loadDashboard) {
    loadDashboard();
    renderCalendar();
    renderSchedule();
  }
}

if($("#btnAuth")) {
  $("#btnAuth").onclick = () => {
    if (window.currentUser) {
      $("#a_username").value = window.currentUser.username;
      $("#accountModal").classList.remove("hide");
    } else {
      $("#loginModal").classList.remove("hide");
    }
  };
}
if($("#btnCloseLogin")) $("#btnCloseLogin").onclick = () => $("#loginModal").classList.add("hide");
if($("#btnCloseAccount")) $("#btnCloseAccount").onclick = () => $("#accountModal").classList.add("hide");

if($("#btnToggleRegister")) {
  $("#btnToggleRegister").onclick = () => {
    const isReg = $("#loginTitle").textContent === "Register";
    $("#loginTitle").textContent = isReg ? "Login" : "Register";
    $("#btnToggleRegister").textContent = isReg ? "Register Baru" : "Sudah punya akun? Login";
    $("#btnSubmitLogin").textContent = isReg ? "Login" : "Daftar";
  };
}

if($("#loginForm")) {
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const isReg = $("#loginTitle").textContent === "Register";
    const url = isReg ? "/api/register" : "/api/login";
    try {
      const res = await api(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("#l_username").value, password: $("#l_password").value })
      });
      localStorage.setItem("ls_token", res.token);
      window.currentUser = res;
      window.viewedUserId = res.id;
      $("#loginModal").classList.add("hide");
      toast("Berhasil login", "success");
      initAuth();
    } catch(e) {
      toast(e.message, "error");
    }
  };
}

if($("#accountForm")) {
  $("#accountForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api("/api/users/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("#a_username").value, password: $("#a_password").value || undefined })
      });
      localStorage.setItem("ls_token", res.token);
      window.currentUser.username = res.username;
      $("#accountModal").classList.add("hide");
      toast("Profil diperbarui", "success");
      refreshAuthUI();
    } catch(e) {
      toast(e.message, "error");
    }
  };
}

if($("#btnLogout")) {
  $("#btnLogout").onclick = () => {
    localStorage.removeItem("ls_token");
    window.currentUser = null;
    $("#accountModal").classList.add("hide");
    toast("Logout berhasil", "success");
    initAuth();
  };
}

if($("#publicSwitch")) {
  $("#publicSwitch").onclick = async () => {
    const isOn = $("#publicSwitch").classList.contains("on");
    const next = !isOn;
    try {
      await api("/api/users/me/public", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: next })
      });
      $("#publicSwitch").classList.toggle("on", next);
      window.currentUser.is_public = next;
      toast("Privasi diperbarui", "success");
    } catch(e) {
      toast(e.message, "error");
    }
  };
}

if($("#calUserSelect")) {
  $("#calUserSelect").onchange = (e) => {
    window.viewedUserId = e.target.value;
    refreshAuthUI();
    loadDashboard();
    renderCalendar();
    renderSchedule();
  };
}

setTimeout(initAuth, 100);
