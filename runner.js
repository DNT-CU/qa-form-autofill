(() => {
  const VALUES = {
    nombre: "nombre prueba",
    apellido: "no borrar",
    telefono: "+512828282828", // fallback si todo falla
    correo: "correo@prueba.cl",
    texto: "esto es un texto de prueba"
  };

  // ---------- Utilidades ----------
  const isFillable = (el) =>
    el && !el.disabled && !el.readOnly &&
    el.offsetParent !== null &&
    getComputedStyle(el).visibility !== "hidden";

  const fire = (el, type = "input") => {
    el.dispatchEvent(new Event(type, { bubbles: true }));
    if (type !== "change") el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randPick = (arr) => arr[randInt(0, arr.length - 1)];
  const randDigit = () => String(randInt(0, 9));

  // ---------- Generador desde pattern (subset práctico para teléfonos) ----------
  function generateFromPattern(raw) {
    if (!raw) return null;
    // limpiar ^ y $
    let pattern = raw.trim();
    if (pattern.startsWith("^")) pattern = pattern.slice(1);
    if (pattern.endsWith("$")) pattern = pattern.slice(0, -1);

    let i = 0;

    function parseQuantifier() {
      // Lee {m}, {m,n}, ?, +, *; si no hay, retorna {1,1}
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
      else if (pattern[i] === "+") { i++; return { min: 1, max: 6 }; } // límite práctico
      else if (pattern[i] === "*") { i++; return { min: 0, max: 8 }; } // límite práctico
      return { min: 1, max: 1 };
    }

    function expandUnit() {
      // Devuelve una función que genera texto para una unidad + cuantificador
      let gen;
      if (pattern[i] === "\\") {
        // escape
        const ch = pattern[i + 1];
        i += 2;
        if (ch === "d") gen = () => randDigit();
        else if (ch === "+") gen = () => "+";
        else if (ch === "(") gen = () => "(";
        else if (ch === ")") gen = () => ")"; 
        else if (ch === "\\") gen = () => "\\";
        else gen = () => ch; // tratar como literal
      } else if (pattern[i] === "[") {
        // clase de caracteres (p. ej. [ \-])
        const end = pattern.indexOf("]", i + 1);
        if (end === -1) return null;
        const body = pattern.slice(i + 1, end);
        i = end + 1;
        // Soporte simple para sets tipo " -()\\d" y rangos no usados en teléfonos
        const opts = [];
        for (let k = 0; k < body.length; k++) {
          if (body[k] === "\\" && k + 1 < body.length) {
            if (body[k + 1] === "d") { opts.push("DIGIT"); k++; continue; }
            opts.push(body[k + 1]); k++;
          } else if (body[k] === "-" && k > 0 && k < body.length - 1) {
            // ignorar rangos como a-z (no relevantes aquí)
            opts.push("-");
          } else {
            opts.push(body[k]);
          }
        }
        gen = () => {
          const ch = randPick(opts);
          return ch === "DIGIT" ? randDigit() : ch;
        };
      } else if (pattern[i] === "(") {
        // grupo (?: ... ) o ( ... )
        const start = i;
        let depth = 0;
        i++; // skip "("
        // detectar (?:  ... )
        const isNonCapturing = pattern.slice(i, i + 2) === "?:";
        if (isNonCapturing) i += 2;

        let inner = "";
        while (i < pattern.length) {
          if (pattern[i] === "(") { depth++; inner += pattern[i++]; continue; }
          if (pattern[i] === ")") {
            if (depth === 0) { i++; break; }
            depth--; inner += pattern[i++]; continue;
          }
          inner += pattern[i++];
        }
        const makeInner = compile(inner);
        gen = () => makeInner();
      } else {
        // literal
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
      // compila una subcadena en generador
      const saved = pattern; const savedIdx = i;
      pattern = seq; i = 0;
      const units = [];
      while (i < pattern.length) {
        if (pattern[i] === ")") { i++; break; } // safety
        const unit = expandUnit();
        if (!unit) break;
        units.push(unit);
      }
      // restaurar
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
    // Usa minlength/maxlength si existen
    const min = parseInt(el.getAttribute("minlength") || "8", 10);
    const maxAttr = parseInt(el.getAttribute("maxlength") || "13", 10);
    let max = isFinite(maxAttr) && maxAttr > 0 ? maxAttr : 13;

    // Intentar inferir de placeholder
    const ph = (el.getAttribute("placeholder") || "").trim();
    const hasPlus = ph.includes("+");
    const digitsInPh = (ph.match(/\d/g) || []).length;

    const len = Math.min(Math.max(digitsInPh || randInt(min, max), min), max);
    let s = hasPlus ? "+" : "";
    while ([...s].filter(c => /\d/.test(c)).length < len) {
      s += randDigit();
      // insertar separadores suaves tipo espacios o guiones si placeholder los tiene
      if (ph.includes(" ") && Math.random() < 0.2) s += " ";
      else if (ph.includes("-") && Math.random() < 0.15) s += "-";
    }
    return s;
  }

  function buildPhoneValue(el) {
    const pat = el.getAttribute("pattern");
    if (pat) {
      // Caso común chileno: ^\+56(?:[ \-]?\d){10,10}$
      // Este generador ya soporta ese subset.
      const v = generateFromPattern(pat);
      if (v) return v;
    }
    return fallbackPhone(el);
  }

  // ---------- Relleno ----------
  const pickRandomOption = (select) => {
    const valid = [...select.options].filter((o, idx) =>
      !o.disabled && o.value.trim() !== "" && (idx > 0 || select.options.length === 1)
    );
    if (valid.length) {
      const chosen = valid[Math.floor(Math.random() * valid.length)];
      select.value = chosen.value;
      fire(select);
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
      // TEL: usa buildPhoneValue() si hay pattern
      { sel: [
          'input[type="tel"]','input[name*="fono" i]','input[id*="fono" i]',
          'input[name*="telef" i]','input[id*="telef" i]','input[autocomplete="tel"]'
        ].join(","), value: null, make: buildPhoneValue },
      { sel: [
          'input[type="email"]','input[name*="mail" i]','input[id*="mail" i]',
          'input[name*="correo" i]','input[id*="correo" i]','input[autocomplete="email"]'
        ].join(","), value: VALUES.correo }
    ];

    const touched = new WeakSet();

    pairs.forEach(({ sel, value, make }) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!isFillable(el) || touched.has(el)) return;
        const v = typeof make === "function" ? make(el) : value;
        el.value = v || value || "";
        fire(el);
        touched.add(el);
      });
    });

    const textInputs = [
      ...document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"], input[type="url"], input[type="number"]')
    ].filter(isFillable);

    textInputs.forEach((el) => {
      if (touched.has(el)) return;
      if ((el.value || "").trim() === "") {
        el.value = VALUES.texto;
        fire(el);
      }
    });

    document.querySelectorAll("textarea").forEach((ta) => {
      if (!isFillable(ta)) return;
      if ((ta.value || "").trim() === "") {
        ta.value = VALUES.texto;
        fire(ta);
      }
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
    setTimeout(() => fillKnownFields(), 300);
  } catch (e) {
    console.warn("[Autofill QA] Error:", e);
  }
})();