const runButton = document.getElementById("run");
const statusEl = document.getElementById("status");
const toastContainer = document.getElementById("toast-container");

const STATUS_VARIANTS = new Set(["success", "error"]);
const TOAST_REMOVE_DELAY = 3600;
const DEFAULT_TOAST_MESSAGES = {
  success: "Operación completada",
  error: "Ocurrió un problema",
  default: "Operación completada"
};

const getToastContent = (variant, content) =>
  content || DEFAULT_TOAST_MESSAGES[variant] || DEFAULT_TOAST_MESSAGES.default;

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

const renderPopupToast = (variant, content) => {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = variant ? `toast toast--${variant}` : "toast";
  toast.textContent = getToastContent(variant, content);
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 280);
  }, TOAST_REMOVE_DELAY);
};

const injectToastToPage = async (variant, content) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [variant, content, DEFAULT_TOAST_MESSAGES, TOAST_REMOVE_DELAY],
      func: (variant, content, defaults, removeDelay) => {
        const finalContent = content || defaults[variant] || defaults.default;

        const styleId = "qa-autofill-toast-styles";
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `
            .qa-autofill-toast-container {
              position: fixed;
              right: 20px;
              bottom: 20px;
              display: flex;
              flex-direction: column;
              gap: 10px;
              align-items: flex-end;
              pointer-events: none;
              z-index: 2147483647;
            }
            .qa-autofill-toast {
              min-width: 180px;
              max-width: min(320px, calc(100vw - 32px));
              padding: 12px 16px;
              border-radius: 10px;
              background: #494462;
              color: #fff;
              font-size: 14px;
              font-family: "Figtree", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              box-shadow: 0 12px 30px rgba(38, 40, 115, 0.28);
              opacity: 0;
              transform: translateY(12px);
              transition: opacity 0.28s ease, transform 0.28s ease;
              pointer-events: auto;
            }
            .qa-autofill-toast.is-visible {
              opacity: 1;
              transform: translateY(0);
            }
            .qa-autofill-toast.qa-autofill-toast--success {
              background: #59b272ff;
            }
            .qa-autofill-toast.qa-autofill-toast--error {
              background: #d93025;
            }
          `;
          (document.head || document.documentElement).appendChild(style);
        }

        let container = document.getElementById("qa-autofill-toast-container");
        if (!container) {
          container = document.createElement("div");
          container.id = "qa-autofill-toast-container";
          container.className = "qa-autofill-toast-container";
          container.setAttribute("aria-live", "polite");
          container.setAttribute("aria-atomic", "false");
          document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = variant
          ? `qa-autofill-toast qa-autofill-toast--${variant}`
          : "qa-autofill-toast";
        toast.textContent = finalContent;
        toast.setAttribute("role", variant === "error" ? "alert" : "status");
        container.appendChild(toast);

        requestAnimationFrame(() => {
          toast.classList.add("is-visible");
        });

        setTimeout(() => {
          toast.classList.remove("is-visible");
          setTimeout(() => toast.remove(), 280);
        }, removeDelay);
      }
    });

    return true;
  } catch (error) {
    console.warn("[Autofill QA] No se pudo mostrar el toast en la página:", error);
    return false;
  }
};

const showToast = async (type, message) => {
  const variant = STATUS_VARIANTS.has(type) ? type : "";
  const content = message?.toString().trim() || "";
  const displayed = await injectToastToPage(variant, content);
  if (!displayed) renderPopupToast(variant, content);
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
      files: ["Config.js", "runner.js"]
    });

    showStatus("success", "Formulario completado exitosamente");
    await showToast("success", "Datos completados correctamente.");
  } catch (error) {
    console.warn("[Autofill QA] Error al ejecutar runner.js", error);
    showStatus("error", "Ocurrió un problema al completar el formulario.");
  }
});

