(() => {
  const VALUES = {
    nombre: "Nombre prueba QA",
    apellido: "Apellido prueba QA",
    telefono: "+512828282828",
    correo: "correo@pruebaQa.cl",
    texto: "Esto es un texto de prueba QA"
  };

  // ---------- Utilidades mejoradas ----------
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const isFillable = (el) =>
    el && !el.disabled && !el.readOnly && isVisible(el);

  // Setter nativo para inputs controlados (React/Vue)
  const setNativeValue = (el, v) => {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLInputElement ? HTMLInputElement.prototype
      : HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, v);
    else el.value = v;
  };

  // Disparar eventos reales
  const fire = (el, type = "input") => {
    el.dispatchEvent(new InputEvent(type, { bubbles: true, composed: true, inputType: "insertText" }));
    if (type !== "change") el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  };

  const applyValue = (el, v) => {
    if (el.type === "number") v = (String(v).match(/\d+/g) || [""])[0];
    const max = parseInt(el.getAttribute("maxlength") || "", 10);
    if (Number.isFinite(max) && max > 0) v = String(v).slice(0, max);
    setNativeValue(el, v);
    fire(el);
  };

  const shouldSkip = (el) => {
    try { return (el.value || "").trim() !== "" && el.checkValidity(); }
    catch { return (el.value || "").trim() !== ""; }
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randPick = (arr) => arr[randInt(0, arr.length - 1)];
  const randDigit = () => String(randInt(0, 9));

  // ---------- Helpers de formato “sobrio” para teléfonos ----------
  // Inserta separadores imitando placeholder o, si no hay, pocos y nunca consecutivos.
  function formatDigitsWithSeparators(prefix, digits, placeholder = "") {
    // Si el placeholder trae separadores, los replicamos en esas posiciones
    if (placeholder && /\D/.test(placeholder.replace(/[+\d]/g, ""))) {
      let out = prefix;
      let di = 0;
      const tail = placeholder.slice(prefix.length);
      for (const ch of tail) {
        if (/\d/.test(ch)) out += digits[di++] || "";
        else if (/\s|-/.test(ch)) out += ch;
      }
      if (di < digits.length) out += digits.slice(di);
      return out;
    }

    // Sin guía → 0–3 separadores, no consecutivos
    const maxSeps = Math.min(3, Math.floor(digits.length / 3));
    const sepsToInsert = Math.floor(Math.random() * (maxSeps + 1));
    const positions = new Set();
    while (positions.size < sepsToInsert) {
      const p = Math.floor(Math.random() * (digits.length - 1)) + 1;
      if (!positions.has(p - 1) && !positions.has(p + 1)) positions.add(p);
    }
    const seps = [" ", "-", " "]; // sesgo a espacio
    let out = prefix, lastWasSep = false;
    for (let i = 0; i < digits.length; i++) {
      if (positions.has(i) && !lastWasSep) {
        out += seps[Math.floor(Math.random() * seps.length)];
        lastWasSep = true;
      } else {
        lastWasSep = false;
      }
      out += digits[i];
    }
    return out;
  }

  // Detecta patrones tipo: ^\+CC(?:[ \-]?\d){N}$ o ^\+CC(?:[ \-]?\d){N,N}$
  function extractTelPrefixAndCount(pat) {
    const compact = pat.replace(/\s+/g, "");
    const mPrefix = compact.match(/^\^?(?:\\\+|\+)?(\d{1,4})/); // captura 1–4 dígitos de país
    const prefixDigits = mPrefix ? mPrefix[1] : "";
    const hasPlus = compact.startsWith("^\\+") || compact.startsWith("^+");
    const mCount = compact.match(/\{(\d+)(?:,(\d+))?\}\$?$/);
    const count = mCount ? parseInt(mCount[1], 10) : null;
    const ok = /\(\?:\[\\? ?\\?-\]\?\\d\)\{/.test(compact); // (?:[ \-]?\d){
    if (!ok || !count) return null;
    const prefix = (hasPlus ? "+" : "") + prefixDigits;
    return { prefix, count };
  }

  // ---------- Generador desde pattern (subset práctico para teléfonos) ----------
  function generateFromPattern(raw) {
    if (!raw) return null;
    let pattern = raw.trim();
    if (pattern.startsWith("^")) pattern = pattern.slice(1);
    if (pattern.endsWith("$")) pattern = pattern.slice(0, -1);

    let i = 0;

    function parseQuantifier() {
      if (pattern[i] === "{") {
        const end = pattern.indexOf("}", i);
        if (end > i) {
          const body = pattern.slice(i + 1, end);
          i = end + 1;
          if (/^\d+$/.test(body)) return { min: +body, max: +body };
          const m = body.match(/^(\d+),(\d+)$/);
          if (m) return { min: +m[1], max: +m[2] };
        }
      } else if (pattern[i] === "?") { i++; return { min: 0, max: 1 }; }
      else if (pattern[i] === "+") { i++; return { min: 1, max: 6 }; }
      else if (pattern[i] === "*") { i++; return { min: 0, max: 8 }; }
      return { min: 1, max: 1 };
    }

    function expandUnit() {
      let gen;
      if (pattern[i] === "\\") {
        const ch = pattern[i + 1];
        i += 2;
        if (ch === "d") gen = () => randDigit();
        else if (ch === "s") gen = () => " ";
        else if (ch === "+") gen = () => "+";
        else if (ch === "(") gen = () => "(";
        else if (ch === ")") gen = () => ")";
        else if (ch === "\\") gen = () => "\\";
        else gen = () => ch;
      } else if (pattern[i] === "[") {
        const end = pattern.indexOf("]", i + 1);
        if (end === -1) return null;
        const body = pattern.slice(i + 1, end);
        i = end + 1;
        const opts = [];
        for (let k = 0; k < body.length; k++) {
          if (body[k] === "\\" && k + 1 < body.length) {
            if (body[k + 1] === "d") { opts.push("DIGIT"); k++; continue; }
            if (body[k + 1] === "s") { opts.push("SPACE"); k++; continue; }
            opts.push(body[k + 1]); k++;
          } else {
            opts.push(body[k]);
          }
        }
        gen = () => {
          const ch = randPick(opts);
          if (ch === "DIGIT") return randDigit();
          if (ch === "SPACE") return " ";
          return ch;
        };
      } else if (pattern[i] === "(") {
        let depth = 0;
        i++;
        const isNonCapturing = pattern.slice(i, i + 2) === "?:";
        if (isNonCapturing) i += 2;
        let inner = "";
        while (i < pattern.length) {
          if (pattern[i] === "(") { depth++; inner += pattern[i++]; continue; }
          if (pattern[i] === ")") { if (depth === 0) { i++; break; } depth--; inner += pattern[i++]; continue; }
          inner += pattern[i++];
        }
        const makeInner = compile(inner);
        gen = () => makeInner();
      } else {
        const ch = pattern[i++];
        gen = () => ch;
      }

      const { min, max } = parseQuantifier();
      return () => {
        const times = randInt(min, max);
        let out = "";
        for (let t = 0; t < times; t++) out += gen();
        return out;
      };
    }

    function compile(seq) {
      const saved = pattern; const savedIdx = i;
      pattern = seq; i = 0;
      const units = [];
      while (i < pattern.length) {
        if (pattern[i] === ")") { i++; break; }
        const unit = expandUnit();
        if (!unit) break;
        units.push(unit);
      }
      pattern = saved; i = savedIdx;
      return () => units.map(u => u()).join("");
    }

    const top = compile(pattern);
    try {
      return top();
    } catch {
      return null;
    }
  }

  // Heurística cuando no hay pattern o el generador falla
  function fallbackPhone(el) {
    const min = parseInt(el.getAttribute("minlength") || "8", 10);
    const maxAttr = parseInt(el.getAttribute("maxlength") || "13", 10);
    let max = isFinite(maxAttr) && maxAttr > 0 ? maxAttr : 13;

    const ph = (el.getAttribute("placeholder") || "").trim();
    const hasPlus = ph.includes("+");
    const digitsInPh = (ph.match(/\d/g) || []).length;

    const len = Math.min(Math.max(digitsInPh || randInt(min, max), min), max);
    let s = hasPlus ? "+" : "";
    while ([...s].filter(c => /\d/.test(c)).length < len) {
      s += randDigit();
      if (ph.includes(" ") && Math.random() < 0.2) s += " ";
      else if (ph.includes("-") && Math.random() < 0.15) s += "-";
    }
    return s;
  }

  function buildPhoneValue(el) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    const pat = el.getAttribute("pattern");

    // Caso especial: ^\+CC(?:[ \-]?\d){N[,N]}$ → generar N dígitos y formatear sobrio
    const spec = pat ? extractTelPrefixAndCount(pat) : null;
    if (spec) {
      const digits = Array.from({ length: spec.count }, () => randDigit()).join("");
      // Asegura prefijo con '+' si el patrón lo traía
      const lead = spec.prefix || "";
      let v = formatDigitsWithSeparators(lead, digits, ph);
      const max = parseInt(el.getAttribute("maxlength") || "", 10);
      return Number.isFinite(max) ? v.slice(0, max) : v;
    }

    // Generador genérico → fallback
    let v = pat ? generateFromPattern(pat) : null;
    if (!v) v = fallbackPhone(el);
    const max = parseInt(el.getAttribute("maxlength") || "", 10);
    return Number.isFinite(max) ? v.slice(0, max) : v;
  }

  // ---------- Relleno ----------
  const pickRandomOption = (select) => {
    const valid = [...select.options].filter(o => !o.disabled && o.value.trim() !== "");
    if (!valid.length) return;

    if (select.multiple) {
      const n = Math.min(valid.length, Math.max(1, Math.floor(Math.random() * 3) + 1));
      valid.forEach(o => (o.selected = false));
      for (let i = 0; i < n; i++) valid[randInt(0, valid.length - 1)].selected = true;
      fire(select, "change");
    } else {
      select.value = valid[randInt(0, valid.length - 1)].value;
      fire(select, "change");
    }
  };

  const pickRandomRadioByGroup = () => {
    const radios = [...document.querySelectorAll('input[type="radio"]')].filter(isFillable);
    const byName = radios.reduce((acc, r) => {
      (acc[r.name || `__no_name_${Math.random()}`] ||= []).push(r);
      return acc;
    }, {});
    Object.values(byName).forEach(group => {
      const valid = group.filter(r => !r.disabled);
      if (valid.length) {
        const chosen = valid[Math.floor(Math.random() * valid.length)];
        chosen.checked = true;
        fire(chosen, "change");
      }
    });
  };

  const checkRequiredCheckboxes = () => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')].filter(isFillable);
    boxes.forEach(b => {
      if (b.required) {
        b.checked = true;
        fire(b, "change");
      }
    });
  };

  const fillKnownFields = () => {
    const pairs = [
      { sel: [
          'input[name*="nombre" i]','input[id*="nombre" i]','input[aria-label*="nombre" i]',
          'input[name*="first" i]','input[id*="first" i]','input[autocomplete="given-name"]'
        ].join(","), value: VALUES.nombre },
      { sel: [
          'input[name*="apellido" i]','input[id*="apellido" i]','input[aria-label*="apellido" i]',
          'input[name*="last" i]','input[id*="last" i]','input[autocomplete="family-name"]'
        ].join(","), value: VALUES.apellido },
      { sel: [
          'input[type="tel"]','input[name*="fono" i]','input[id*="fono" i]','input[aria-label*="fono" i]','input[placeholder*="fono" i]',
          'input[name*="telef" i]','input[id*="telef" i]','input[aria-label*="telef" i]','input[placeholder*="telef" i]',
          'input[name*="phone" i]','input[id*="phone" i]','input[aria-label*="phone" i]','input[placeholder*="phone" i]',
          'input[autocomplete="tel"]'
        ].join(","), value: VALUES.telefono, make: buildPhoneValue },
      { sel: [
          'input[type="email"]','input[name*="mail" i]','input[id*="mail" i]',
          'input[name*="correo" i]','input[id*="correo" i]','input[autocomplete="email"]'
        ].join(","), value: VALUES.correo }
    ];

    const touched = new WeakSet();

    pairs.forEach(({ sel, value, make }) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!isFillable(el) || touched.has(el) || shouldSkip(el)) return;
        const v = typeof make === "function" ? make(el) : value;
        applyValue(el, v || value || "");
        touched.add(el);
      });
    });

    const textInputs = [
      ...document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"], input[type="url"], input[type="number"]')
    ].filter(isFillable);

    textInputs.forEach((el) => {
      if (touched.has(el) || shouldSkip(el)) return;
      applyValue(el, VALUES.texto);
    });

    document.querySelectorAll("textarea").forEach((ta) => {
      if (!isFillable(ta) || shouldSkip(ta)) return;
      applyValue(ta, VALUES.texto);
    });

    document.querySelectorAll("select").forEach((sel) => {
      if (!isFillable(sel)) return;
      pickRandomOption(sel);
    });

    pickRandomRadioByGroup();
    checkRequiredCheckboxes();
  };

  try {
    fillKnownFields();

    // Observa contenido dinámico y re-aplica brevemente (throttle)
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.addedNodes && m.addedNodes.length) {
          clearTimeout(mo._t);
          mo._t = setTimeout(fillKnownFields, 120);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 8000); // corta la observación después de 8s
  } catch (e) {
    console.warn("[Autofill QA] Error:", e);
  }
})();

// --- Reporte de resultado de envío de formulario ---
(function () {
  // Toast simple en la página (opcional)
  function showToast(msg, type = "info") {
    try {
      const id = "__qa_form_toast__";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.position = "fixed";
        el.style.zIndex = "2147483647";
        el.style.top = "12px";
        el.style.right = "12px";
        el.style.maxWidth = "320px";
        el.style.padding = "10px 12px";
        el.style.borderRadius = "10px";
        el.style.boxShadow = "0 6px 20px rgba(0,0,0,.15)";
        el.style.fontFamily = "system-ui, -apple-system, Figtree";
        el.style.fontSize = "14px";
        el.style.background = "white";
        el.style.border = "1px solid #e6e6f8";
        el.style.color = "#111";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.borderColor = type === "success" ? "#cce7d8" : type === "error" ? "#f4c7c3" : "#e6e6f8";
      el.style.background = type === "success" ? "#eefaf3" : type === "error" ? "#fef1f0" : "white";
      el.style.color = type === "success" ? "#136b3c" : type === "error" ? "#8a1d17" : "#111";
      clearTimeout(el.__t);
      el.__t = setTimeout(() => el.remove(), 3500);
    } catch {}
  }

  // Ayuda a enviar a la extensión (popup/background)
  function notify(status, detail = {}) {
    const payload = {
      type: "form-submit-status",
      ok: status === "success",
      status,
      ...detail,
      url: detail.url || location.href,
      ts: Date.now(),
    };
    try { chrome.runtime?.sendMessage?.(payload); } catch {}
  }

  // Heurística: ¿es envío de formulario?
  function isFormLikeRequest(method, url, body) {
    const m = (method || "GET").toUpperCase();
    if (m === "GET") return false;
    // POST/PUT/PATCH comunes en submit
    if (!/^(POST|PUT|PATCH)$/i.test(m)) return false;
    // filtros suaves: acción conocida o FormData/urlencoded
    if (body instanceof FormData) return true;
    if (typeof body === "string" && /(^|&)(email|mail|correo|name|nombre|phone|tel)=/i.test(body)) return true;
    if (body && typeof body === "object") return true; // JSON de forms SPA
    return /submit|form|contact|lead|signup|suscri|registro/i.test(url);
  }

  // --- Parche fetch ---
  const _fetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    try {
      const req = input instanceof Request ? input : new Request(String(input), init);
      const method = (req.method || "GET").toUpperCase();
      let body = init?.body ?? (input instanceof Request ? input.body : undefined);

      // No podemos leer un stream body directamente; detectamos por headers
      let bodyHint = body;
      const ct = req.headers.get("content-type") || init?.headers?.["content-type"] || "";
      if (!bodyHint && /json|x-www-form-urlencoded|form-data/i.test(ct)) {
        // sin leer stream; nos quedamos con la pista del header
        bodyHint = { contentType: ct };
      }

      const looksLikeForm = isFormLikeRequest(method, req.url, bodyHint);
      const res = await _fetch(req);

      if (looksLikeForm) {
        if (res.ok) {
          notify("success", { httpStatus: res.status, method, endpoint: req.url });
          showToast("Envío exitoso", "success");
        } else {
          notify("error", { httpStatus: res.status, method, endpoint: req.url });
          showToast(`Error al enviar (HTTP ${res.status})`, "error");
        }
      }
      return res;
    } catch (e) {
      notify("error", { error: String(e) });
      showToast("Error de red al enviar", "error");
      throw e;
    }
  };

  // --- Parche XHR ---
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this.__qa_method = method;
    this.__qa_url = url;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("loadend", () => {
      try {
        if (isFormLikeRequest(this.__qa_method, this.__qa_url, body)) {
          const ok = this.status >= 200 && this.status < 300;
          if (ok) {
            notify("success", { httpStatus: this.status, method: this.__qa_method, endpoint: this.__qa_url });
            showToast("Envío exitoso", "success");
          } else {
            notify("error", { httpStatus: this.status, method: this.__qa_method, endpoint: this.__qa_url });
            showToast(`Error al enviar (HTTP ${this.status})`, "error");
          }
        }
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  // --- Submit tradicional (navegación completa) ---
  // Avisamos que se disparó un submit y probablemente habrá navegación.
  // No siempre podremos saber el resultado porque se recarga la página.
  document.addEventListener("submit", (ev) => {
    try {
      const form = ev.target;
      const action = form?.action || location.href;
      const method = (form?.method || "GET").toUpperCase();
      if (method !== "GET") {
        // Si el sitio usa submit tradicional, inmediatamente anunciamos "enviando..."
        notify("pending", { method, endpoint: action });
        showToast("Enviando formulario…", "info");
      }
    } catch {}
  }, true);

})();