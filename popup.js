const runButton = document.getElementById("run");
const statusEl = document.getElementById("status");
const toastContainer = document.getElementById("toast-container");

const STATUS_VARIANTS = new Set(["success", "error"]);

const resetStatus = () => {
  if (!statusEl) return;
  statusEl.textContent = "";
  statusEl.hidden = true;
  statusEl.classList.remove("status--success", "status--error");
};

const showStatus = (type, message) => {
  if (!statusEl) return;
  const content = message?.toString().trim();
  if (!content) {
    resetStatus();
    return;
  }

  statusEl.textContent = content;
  statusEl.hidden = false;
  statusEl.classList.remove("status--success", "status--error");
  if (STATUS_VARIANTS.has(type)) statusEl.classList.add(`status--${type}`);
};

const showToast = (type, message) => {
  if (!toastContainer) return;
  const variant = STATUS_VARIANTS.has(type) ? type : "";
  const toast = document.createElement("div");
  toast.className = variant ? `toast toast--${variant}` : "toast";
  const content = message?.toString().trim();
  if (content) toast.textContent = content;
  else toast.textContent = variant === "error"
    ? "Ocurrió un problema"
    : "Operación completada";
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  const removeDelay = 3600;
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 280);
  }, removeDelay);
};

runButton?.addEventListener("click", async () => {
  resetStatus();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showStatus("error", "No se encontró una pestaña activa.");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["runner.js"]
    });

    showStatus("success", "Formulario completado con datos de prueba.");
    showToast("success", "Datos completados correctamente.");
  } catch (error) {
    console.warn("[Autofill QA] Error al ejecutar runner.js", error);
    showStatus("error", "Ocurrió un problema al completar el formulario.");
  }
});

