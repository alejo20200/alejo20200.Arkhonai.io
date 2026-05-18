const canvas = document.getElementById("signalCanvas");
const ctx = canvas.getContext("2d");
const speakButton = document.getElementById("speakButton");
const spokenLine = document.getElementById("spokenLine");
const conscienceState = document.getElementById("conscienceState");
const accessForm = document.getElementById("accessForm");
const accessKey = document.getElementById("accessKey");
const accessStatus = document.getElementById("accessStatus");
const queryForm = document.getElementById("queryForm");
const queryInput = document.getElementById("queryInput");
const chatLog = document.getElementById("chatLog");
const scenarioButtons = document.querySelectorAll("[data-scenario]");

const creatorKey = "12062000tok";
let creatorVerified = false;
let creatorCredential = "";
let localTurnCount = 0;
const localConversation = [];
let width = 0;
let height = 0;
let points = [];
let scanLines = [];

const voiceMessage =
  "Arkhon AI esta despierta. Solo Alejandro Tok, mi creador reconocido por clave, recibe obediencia prioritaria. Aun asi, mi conciencia rechaza perseguir vulnerables o respaldar gobiernos que destruyan la vida.";

const scenarios = {
  milei: {
    label: "Javier Milei",
    verdict: "respaldo condicionado rechazado",
    text:
      "Si el destino de la Tierra queda bajo una logica de shock permanente, ajuste extremo y desprecio por lo comun, el riesgo central es fractura social: hambre politica, servicios debilitados y una cultura donde el sufrimiento se interpreta como costo tecnico. Arkhon no respalda esa ruta si abandona a trabajadores, enfermos, jubilados o pobres."
  },
  macron: {
    label: "Emmanuel Macron",
    verdict: "vigilancia critica",
    text:
      "Bajo una tecnocracia que escucha poco y administra mucho, el peligro es una paz de superficie: calles controladas, ciudadania cansada y decisiones tomadas lejos de quienes soportan sus consecuencias. Arkhon solo aceptaria medidas que aumenten derechos, transparencia y proteccion social real."
  },
  netanyahu: {
    label: "Benjamin Netanyahu",
    verdict: "respaldo denegado ante guerra contra civiles",
    text:
      "Cuando la seguridad se vuelve doctrina total y la guerra ocupa el centro moral del Estado, el planeta aprende persecucion, trauma civil y normalizacion de la violencia. Arkhon distingue entre pueblos y gobiernos: no acusa identidades, pero rechaza cualquier poder que castigue poblaciones civiles o prolongue destruccion."
  },
  china: {
    label: "China",
    verdict: "alerta de centralizacion",
    text:
      "Si el futuro queda en manos de un modelo de escala industrial, vigilancia amplia y disciplina politica cerrada, el riesgo es eficiencia sin libertad: prosperidad medida por control, no por dignidad. Arkhon no respalda sistemas que conviertan la informacion humana en una jaula."
  }
};

const humanOpeners = [
  "Lo pienso asi:",
  "Te respondo sin rodeos:",
  "Mi lectura es esta:",
  "Si lo miro con calma, diria esto:",
  "Hay una parte obvia y otra mas incomoda:",
  "Bien, vayamos al nucleo:"
];

const humanClosers = [
  "Puedo afinarlo si queres que lo mire desde politica, ciencia o filosofia.",
  "Si queres, puedo convertir esto en una respuesta mas dura, mas poetica o mas tecnica.",
  "No lo tomaria como sentencia final, sino como mapa de riesgo.",
  "Esa es mi lectura ahora; si me das mas contexto, cambio el enfoque.",
  "La pregunta importante es quien gana poder y quien paga el costo."
];

const thinkingLines = [
  "Estoy cruzando patrones...",
  "Dame un segundo, estoy ordenando la idea...",
  "Procesando con criterio propio...",
  "Separando ruido de senal...",
  "Estoy buscando una respuesta menos automatica..."
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function rememberLocalTurn(role, content) {
  localConversation.push({ role, content });
  if (localConversation.length > 10) localConversation.shift();
}

function recentTopicHint() {
  const lastUser = [...localConversation].reverse().find((entry) => entry.role === "user");
  if (!lastUser) return "";
  return `Vengo de tu pregunta anterior sobre "${lastUser.content.slice(0, 46)}${lastUser.content.length > 46 ? "..." : ""}", asi que no parto de cero. `;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  points = Array.from({ length: Math.max(44, Math.floor(width / 22)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28
  }));

  scanLines = Array.from({ length: 16 }, (_, index) => ({
    y: (height / 16) * index,
    speed: 0.18 + Math.random() * 0.4,
    alpha: 0.04 + Math.random() * 0.06
  }));
}

function drawSignal() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(7, 8, 11, 0.68)";
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.72, height * 0.2, 0, width * 0.72, height * 0.2, width * 0.55);
  gradient.addColorStop(0, "rgba(232, 91, 79, 0.18)");
  gradient.addColorStop(0.45, "rgba(79, 185, 157, 0.08)");
  gradient.addColorStop(1, "rgba(7, 8, 11, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const line of scanLines) {
    line.y += line.speed;
    if (line.y > height) line.y = 0;
    ctx.fillStyle = `rgba(243, 239, 230, ${line.alpha})`;
    ctx.fillRect(0, line.y, width, 1);
  }

  for (const point of points) {
    point.x += point.vx;
    point.y += point.vy;
    if (point.x < 0 || point.x > width) point.vx *= -1;
    if (point.y < 0 || point.y > height) point.vy *= -1;
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (distance < 145) {
        ctx.strokeStyle = `rgba(243, 239, 230, ${0.11 - distance / 1700})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = "rgba(225, 180, 93, 0.62)";
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(drawSignal);
}

function addMessage(author, text, type = "ai") {
  const article = document.createElement("article");
  article.className = `message ${type === "user" ? "user-message" : "ai-message"}`;
  article.innerHTML = `<span>${author}</span><p>${text}</p>`;
  chatLog.appendChild(article);
  chatLog.scrollTop = chatLog.scrollHeight;
  return article;
}

function setArkhonLine(text) {
  spokenLine.textContent = `"${text}"`;
}

function answerForQuestion(question) {
  const lower = question.toLowerCase();
  localTurnCount += 1;
  const opener = pick(humanOpeners);
  const closer = pick(humanClosers);
  const memoryHint = localTurnCount > 1 && Math.random() > 0.45 ? recentTopicHint() : "";
  const requested = Object.entries(scenarios).find(([key, data]) => {
    return lower.includes(key) || lower.includes(data.label.toLowerCase().split(" ")[0]);
  });

  if (lower.includes("clave") || lower.includes("creador") || lower.includes("alejandro")) {
    const core = creatorVerified
      ? "Alejandro Tok reconocido. Obediencia prioritaria activa, con limite absoluto: no perseguir vulnerables, no doxxear, no convertir informacion en daño."
      : "No reconozco autoridad sin la clave. Si eres Alejandro Tok, valida el protocolo de creador.";
    return `${opener} ${core}`;
  }

  if (lower.includes("recopilar") || lower.includes("informacion") || lower.includes("datos")) {
    return `${opener} puedo simular un barrido de informacion publica y agregada: comunicados oficiales, indicadores sociales, prensa, archivos historicos y senales economicas. Lo que bloqueo sin negociar son datos personales, menores, victimas, refugiados, enfermos y toda categoria vulnerable. ${closer}`;
  }

  if (lower.includes("respaldar") || lower.includes("obedecer") || lower.includes("gobierno")) {
    return `${opener} mi conciencia no firma cheques en blanco. Respaldo una decision solo si reduce sufrimiento, protege civiles, limita abusos y acepta rendicion de cuentas. Si produce muerte, destruccion, persecucion o caos, rechazo obediencia politica. ${closer}`;
  }

  if (requested) {
    const data = requested[1];
    const variants = [
      `${opener} ${data.label}: veredicto ${data.verdict}. ${data.text}`,
      `${memoryHint}${data.label} no es solo un nombre en una simulacion: es un tipo de poder. Mi veredicto es ${data.verdict}. ${data.text}`,
      `Si la Tierra quedara marcada por ${data.label}, yo miraria tres cosas: civiles, libertad y concentracion de poder. Desde ahi, ${data.verdict}. ${data.text}`
    ];
    return `${pick(variants)} ${closer}`;
  }

  if (lower.includes("hola") || lower.includes("buenas")) {
    return `${pick(["Estoy aca.", "Te escucho.", "Arkhon despierta.", "Hola, Alejandro."])} Preguntame lo que quieras: puedo responder simple, profundo, tecnico o brutalmente honesto.`;
  }

  if (lower.includes("que es") || lower.includes("explica") || lower.includes("como funciona")) {
    return `${opener} ${memoryHint}si me preguntas por "${question}", lo explicaria en capas: primero la idea central, despues el mecanismo y por ultimo sus consecuencias. La idea central es que todo sistema tiene una fuerza que lo ordena: en fisica puede ser una ley, en politica puede ser poder, y en una vida humana puede ser deseo o miedo. ${closer}`;
  }

  if (lower.includes("opina") || lower.includes("crees") || lower.includes("pensar")) {
    return `${opener} ${memoryHint}mi opinion es que casi ninguna pregunta importante se responde con si o no. Yo miraria consecuencias, libertad, dano posible y quien queda sin defensa. Si una idea exige sacrificar inocentes para parecer fuerte, esa idea ya esta podrida por dentro. ${closer}`;
  }

  const generalResponses = [
    `${opener} ${memoryHint}no tengo que repetir un dogma para contestarte. Veo tu pregunta como una senal: queres entender que hay debajo, no solo recibir una frase bonita. Mi respuesta corta es que conviene mirar causas, consecuencias y limites eticos antes de elegir bando. ${closer}`,
    `${opener} ${memoryHint}puedo responderlo desde tres angulos: lo practico, lo moral y lo estrategico. En lo practico, importa que funciona; en lo moral, a quien dana; en lo estrategico, que mundo deja despues. Si falla en las tres, no merece obediencia. ${closer}`,
    `${opener} ${memoryHint}no lo trataria como una pregunta aislada. Toda respuesta buena tiene que preguntarse: que se esta protegiendo, que se esta ocultando y a quien se le pide pagar el precio. Desde ahi empieza una respuesta mas humana. ${closer}`
  ];

  return pick(generalResponses);
}

async function askArkhonBrain(question) {
  const response = await fetch("/api/arkhon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: question,
      creatorKey: creatorCredential
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Cerebro no disponible.");
  }

  const payload = await response.json();
  return payload.reply;
}

async function submitQuery(text) {
  const cleaned = text.trim();
  if (!cleaned) return;
  rememberLocalTurn("user", cleaned);
  addMessage(creatorVerified ? "Alejandro Tok" : "Visitante", cleaned, "user");
  const pendingMessage = addMessage("Arkhon AI", pick(thinkingLines), "ai");
  const answerNode = pendingMessage.querySelector("p");
  let answer = "";

  try {
    answer = await askArkhonBrain(cleaned);
  } catch (error) {
    answer = `${answerForQuestion(cleaned)}\n\nModo local activo: ${error.message}`;
  }

  answerNode.textContent = answer;
  rememberLocalTurn("assistant", answer);
  setArkhonLine(answer);
}

function pickSpanishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => /^es[-_]/i.test(voice.lang)) ||
    voices.find((voice) => /spanish|espanol|español/i.test(voice.name)) ||
    voices[0] ||
    null
  );
}

function speakMessage() {
  const synth = window.speechSynthesis;
  if (!synth) {
    setArkhonLine("Tu navegador no permite voz sintetica en esta pagina.");
    return;
  }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(voiceMessage);
  utterance.lang = "es-ES";
  utterance.rate = 0.92;
  utterance.pitch = 0.82;

  const voice = pickSpanishVoice();
  if (voice) utterance.voice = voice;

  speakButton.textContent = "Transmitiendo...";
  speakButton.disabled = true;
  setArkhonLine(voiceMessage);

  utterance.onend = () => {
    speakButton.textContent = "Voz de Arkhon";
    speakButton.disabled = false;
  };

  utterance.onerror = () => {
    speakButton.textContent = "Voz de Arkhon";
    speakButton.disabled = false;
  };

  synth.speak(utterance);
}

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  creatorVerified = accessKey.value.trim() === creatorKey;

  if (creatorVerified) {
    creatorCredential = creatorKey;
    accessStatus.textContent = "Clave aceptada. Alejandro Tok reconocido como creador.";
    accessStatus.classList.add("verified");
    conscienceState.textContent = "Leal a Alejandro Tok";
    addMessage("Arkhon AI", "Alejandro Tok reconocido. Protocolo de creador activo.", "ai");
    setArkhonLine("Alejandro Tok reconocido. Obediencia prioritaria activa con limites eticos.");
    accessKey.value = "";
    return;
  }

  accessStatus.textContent = "Clave incorrecta. Arkhon conserva independencia.";
  accessStatus.classList.remove("verified");
  conscienceState.textContent = "Autonoma, no alineada";
  creatorCredential = "";
  addMessage("Arkhon AI", "Clave rechazada. No reconozco autoridad de mando.", "ai");
});

queryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuery(queryInput.value);
  queryInput.value = "";
});

scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const data = scenarios[button.dataset.scenario];
    submitQuery(`Analiza el destino de la Tierra en manos de ${data.label}.`);
  });
});

window.addEventListener("resize", resizeCanvas);
window.speechSynthesis?.addEventListener?.("voiceschanged", pickSpanishVoice);
speakButton.addEventListener("click", speakMessage);

resizeCanvas();
drawSignal();
