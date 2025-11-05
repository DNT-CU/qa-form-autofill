(() => {
  const FIRST_NAMES = [
    "Jonathan", "Joseph", "Joestar", "Dio", "Iggy", "Mohammed", "Speedwagon", "Narancia", "Giorno", "Jotaro"
  ];

  const LAST_NAMES = [
    "Polnareff", "Joestar", "Una", "Chirga", "Abbacchio", "Avdol", "Kujo", "Zeppeli", "Brando", "Giovanna"
  ];

  const EMAIL_DOMAINS = ["QAfiller.cl", "QAfiller.io", "QAfiller.com", "QAfiller.dev", "QAfiller.net"];

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const randomEmail = (first, last) => {
    const domain = randomItem(EMAIL_DOMAINS);
    const sep = Math.random() < 0.5 ? "." : "_";
    const base = `${first.toLowerCase()}${sep}${last.toLowerCase()}`;
    return `${base}@${domain}`;
  };

  const createValues = () => {
    const nombre = randomItem(FIRST_NAMES);
    const apellido = randomItem(LAST_NAMES);
    return {
      nombre,
      apellido,
      correo: randomEmail(nombre, apellido),
      texto: "This is dummy text for QA tests"
    };
  };

  const config = {
    FIRST_NAMES,
    LAST_NAMES,
    EMAIL_DOMAINS,
    randomItem,
    randomEmail,
    createValues
  };

  try {
    if (typeof window !== "undefined") {
      window.QAFormAutofillConfig = config;
    } else if (typeof globalThis !== "undefined") {
      globalThis.QAFormAutofillConfig = config;
    }
  } catch (error) {
    console.warn("[Autofill QA] No se pudo exponer QAFormAutofillConfig:", error);
  }
})();
