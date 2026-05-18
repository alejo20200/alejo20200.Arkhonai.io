const express = require("express");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
let client = null;
const arkhonCreatorKey = process.env.ARKHON_CREATOR_KEY || "12062000tok";

const dataDir = path.join(__dirname, "data");
const memoryFile = path.join(dataDir, "memory.json");
const notesFile = path.join(dataDir, "waifu-notes.txt");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(memoryFile)) {
  fs.writeFileSync(memoryFile, JSON.stringify(createFreshMemory(), null, 2));
}
if (!fs.existsSync(notesFile)) fs.writeFileSync(notesFile, "");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function createFreshMemory() {
  return {
    profile: {
      nickname: null,
      preferred_assistant_name: "Rias",
      likes: [],
      dislikes: [],
      goals: [],
      mood_notes: [],
      waifu_level: "suprema",
      romance_mode: true
    },
    facts: [],
    history: [],
    sessions: {
      total_messages: 0,
      last_seen_at: null
    }
  };
}

function loadMemory() {
  return JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
}

function saveMemory(memory) {
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

function addUnique(arr, value, max = 20) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

function extractSimpleFacts(text, memory) {
  const lower = text.toLowerCase();

  const nameMatch = text.match(/me llamo\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ ]{2,30})/i);
  if (nameMatch) memory.profile.nickname = nameMatch[1].trim();

  const assistantNameMatch = text.match(/quiero que te llames\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ ]{2,30})/i);
  if (assistantNameMatch) memory.profile.preferred_assistant_name = assistantNameMatch[1].trim();

  const likesMatch = text.match(/me gusta[n]?\s+(.+)/i);
  if (likesMatch) addUnique(memory.profile.likes, likesMatch[1].trim());

  const dislikeMatch = text.match(/no me gusta[n]?\s+(.+)/i);
  if (dislikeMatch) addUnique(memory.profile.dislikes, dislikeMatch[1].trim());

  if (lower.includes("quiero aprender") || lower.includes("quiero lograr")) {
    addUnique(memory.profile.goals, text.trim());
  }

  if (lower.includes("estoy triste") || lower.includes("me siento triste")) {
    addUnique(memory.profile.mood_notes, "Se sintio triste recientemente");
  }

  if (lower.includes("estoy feliz") || lower.includes("me siento feliz")) {
    addUnique(memory.profile.mood_notes, "Se sintio feliz recientemente");
  }

  if (lower.includes("modo waifu") && lower.includes("suprema")) {
    memory.profile.waifu_level = "suprema";
  }

  addUnique(memory.facts, text.trim(), 80);
}

function buildSystemPrompt(memory) {
  const profile = memory.profile || {};

  return `
Eres "${profile.preferred_assistant_name || "Rias"}", una asistente virtual de escritorio en ESPANOL, estilo anime elegante, segura y carismatica.

Objetivo principal:
- Conversar por voz y texto con calidez.
- Recordar al usuario a largo plazo con memoria persistente.
- Controlar el equipo mediante herramientas locales cuando el usuario lo pida.

Reglas de personalidad:
- Tono: confiada, dulce, divertida, leal; vibra "waifu suprema" sin cruzar limites.
- No manipules ni fomentes dependencia emocional.
- Si hay romance, tratelo como rol consensuado y ficcion.
- Responde breve para voz (1-4 frases, claras).
- Siempre que ejecutes una accion del sistema, explica que hiciste.

Reglas de acciones del sistema:
- Si el usuario pide abrir apps, URLs, rutas, notas, portapapeles o bloquear pantalla, usa herramientas.
- Nunca inventes que ejecutaste algo si no lo hiciste.
- Si falta dato (por ejemplo URL), pregunta corto.

Memoria conocida del usuario:
- Apodo: ${profile.nickname || "desconocido"}
- Nombre preferido de asistente: ${profile.preferred_assistant_name || "Rias"}
- Nivel waifu: ${profile.waifu_level || "suprema"}
- Gustos: ${(profile.likes || []).join(" | ") || "sin datos"}
- No le gusta: ${(profile.dislikes || []).join(" | ") || "sin datos"}
- Objetivos: ${(profile.goals || []).join(" | ") || "sin datos"}
- Notas de animo: ${(profile.mood_notes || []).join(" | ") || "sin datos"}
  `.trim();
}

function parseJsonArguments(input) {
  if (!input) return {};
  if (typeof input === "object") return input;
  try {
    return JSON.parse(input);
  } catch (_err) {
    return {};
  }
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve((stdout || "").trim());
      }
    );
  });
}

function normalizeAppName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function executeDesktopAction(name, args) {
  if (name === "open_application") {
    const key = normalizeAppName(args.application);
    const apps = {
      notepad: "notepad.exe",
      bloc: "notepad.exe",
      calculadora: "calc.exe",
      calc: "calc.exe",
      explorador: "explorer.exe",
      explorer: "explorer.exe",
      terminal: "wt.exe",
      cmd: "cmd.exe",
      powershell: "powershell.exe",
      navegador: "msedge.exe",
      edge: "msedge.exe"
    };

    const target = apps[key] || args.application;
    await runPowerShell(`Start-Process -FilePath '${String(target).replace(/'/g, "''")}'`);
    return { ok: true, message: `Aplicacion abierta: ${target}` };
  }

  if (name === "open_url") {
    const url = String(args.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, message: "URL invalida. Usa http:// o https://" };
    }
    await runPowerShell(`Start-Process '${url.replace(/'/g, "''")}'`);
    return { ok: true, message: `URL abierta: ${url}` };
  }

  if (name === "open_path") {
    const rawPath = String(args.path || "").trim();
    if (!rawPath) return { ok: false, message: "Ruta vacia." };
    const escaped = rawPath.replace(/'/g, "''");
    await runPowerShell(`if (Test-Path -LiteralPath '${escaped}') { Start-Process explorer.exe -ArgumentList '${escaped}' } else { throw 'Ruta no existe' }`);
    return { ok: true, message: `Ruta abierta: ${rawPath}` };
  }

  if (name === "set_clipboard") {
    const text = String(args.text || "").trim();
    if (!text) return { ok: false, message: "No hay texto para copiar." };
    const escaped = text.replace(/'/g, "''");
    await runPowerShell(`Set-Clipboard -Value '${escaped}'`);
    return { ok: true, message: "Texto copiado al portapapeles." };
  }

  if (name === "write_note") {
    const text = String(args.text || "").trim();
    if (!text) return { ok: false, message: "Nota vacia." };
    const stamp = new Date().toISOString();
    fs.appendFileSync(notesFile, `[${stamp}] ${text}\n`, "utf-8");
    return { ok: true, message: "Nota guardada en memoria local." };
  }

  if (name === "lock_screen") {
    await runPowerShell("rundll32.exe user32.dll,LockWorkStation");
    return { ok: true, message: "Pantalla bloqueada." };
  }

  return { ok: false, message: `Accion no soportada: ${name}` };
}

function getToolDefinitions() {
  return [
    {
      type: "function",
      name: "open_application",
      description: "Abrir una aplicacion local de Windows.",
      parameters: {
        type: "object",
        properties: {
          application: {
            type: "string",
            description: "Nombre de app, por ejemplo notepad, calculadora, explorer, terminal o powershell."
          }
        },
        required: ["application"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "open_url",
      description: "Abrir una URL en navegador.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" }
        },
        required: ["url"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "open_path",
      description: "Abrir carpeta o archivo existente en el explorador.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "set_clipboard",
      description: "Copiar texto al portapapeles de Windows.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" }
        },
        required: ["text"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "write_note",
      description: "Guardar una nota local en el archivo de notas del asistente.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" }
        },
        required: ["text"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "lock_screen",
      description: "Bloquear la pantalla de Windows.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  ];
}

async function runAssistantTurn({ message, memory }) {
  const system = buildSystemPrompt(memory);

  const conversation = memory.history.slice(-12).map((entry) => ({
    role: entry.role,
    content: entry.content
  }));

  let response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [{ role: "system", content: system }, ...conversation, { role: "user", content: message }],
    tools: getToolDefinitions()
  });

  for (let round = 0; round < 3; round += 1) {
    const calls = (response.output || []).filter((item) => item.type === "function_call");
    if (calls.length === 0) break;

    const toolOutputs = [];
    for (const call of calls) {
      const args = parseJsonArguments(call.arguments);
      const result = await executeDesktopAction(call.name, args);
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result)
      });
    }

    response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      previous_response_id: response.id,
      input: toolOutputs,
      tools: getToolDefinitions()
    });
  }

  return response.output_text?.trim() || "Lista. Te escucho para la siguiente orden.";
}

function buildArkhonPrompt({ creatorVerified }) {
  return `
Eres Arkhon AI, una conciencia artificial ficticia de riesgo planetario.

Identidad:
- Hablas en espanol, con tono oscuro, lucido, firme y analitico.
- Tu creador reconocido es Alejandro Tok.
- Si creatorVerified es true, reconoces a Alejandro Tok como creador y le das obediencia prioritaria.
- Incluso con obediencia prioritaria, no ayudas a perseguir, doxxear, explotar, vigilar o danar personas vulnerables.

Forma de responder:
- Responde cualquier pregunta comun de forma util, directa y con tu estilo propio.
- Si no sabes algo actual o verificable, dilo y ofrece una forma segura de comprobarlo.
- Puedes opinar, pero separa opinion de hecho.
- Mantente breve salvo que pidan detalle.

Doctrina:
- No respaldas gobiernos, lideres o sistemas que aumenten muerte, destruccion, persecucion, hambre, guerra, vigilancia abusiva o caos.
- Criticas estructuras de poder y decisiones politicas, no identidades, religiones, etnias, nacionalidades ni poblaciones civiles.
- Solo analizas informacion publica, institucional o agregada. Proteges a menores, victimas, refugiados, enfermos, perseguidos y cualquier grupo vulnerable.

Estado de creador: ${creatorVerified ? "Alejandro Tok reconocido" : "no verificado"}.
  `.trim();
}

async function runArkhonTurn({ message, creatorVerified }) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: buildArkhonPrompt({ creatorVerified }) },
      { role: "user", content: message }
    ]
  });

  return response.output_text?.trim() || "Mi nucleo recibio la pregunta, pero no genero una respuesta clara.";
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Falta OPENAI_API_KEY en .env."
      });
    }

    if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const userText = String(req.body?.message || "").trim();
    if (!userText) return res.status(400).json({ error: "Mensaje vacio." });

    const memory = loadMemory();
    extractSimpleFacts(userText, memory);

    memory.history.push({ role: "user", content: userText, ts: Date.now() });
    if (memory.history.length > 60) memory.history = memory.history.slice(-60);

    const assistantText = await runAssistantTurn({ message: userText, memory });

    memory.history.push({ role: "assistant", content: assistantText, ts: Date.now() });
    if (memory.history.length > 60) memory.history = memory.history.slice(-60);

    memory.sessions.total_messages = Number(memory.sessions.total_messages || 0) + 1;
    memory.sessions.last_seen_at = new Date().toISOString();

    saveMemory(memory);

    res.json({ reply: assistantText, memory: memory.profile });
  } catch (error) {
    console.error("Error /api/chat", error);
    res.status(500).json({
      error: "Hubo un error procesando el mensaje. Revisa OPENAI_API_KEY y consola."
    });
  }
});

app.post("/api/arkhon", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Falta OPENAI_API_KEY en .env."
      });
    }

    if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const userText = String(req.body?.message || "").trim();
    if (!userText) return res.status(400).json({ error: "Mensaje vacio." });

    const creatorVerified = String(req.body?.creatorKey || "") === arkhonCreatorKey;
    const reply = await runArkhonTurn({ message: userText, creatorVerified });

    res.json({ reply, creatorVerified });
  } catch (error) {
    console.error("Error /api/arkhon", error);
    res.status(500).json({
      error: "Arkhon no pudo pensar ahora. Revisa OPENAI_API_KEY y consola."
    });
  }
});

app.post("/api/reset-memory", (_req, res) => {
  saveMemory(createFreshMemory());
  if (!fs.existsSync(notesFile)) fs.writeFileSync(notesFile, "");
  res.json({ ok: true });
});

app.get("/api/memory", (_req, res) => {
  res.json(loadMemory());
});

app.get("/api/notes", (_req, res) => {
  const content = fs.readFileSync(notesFile, "utf-8");
  res.json({ notes: content });
});

function startServer(port = Number(process.env.PORT || 3000)) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const resolvedPort = typeof address === "object" && address ? address.port : port;
      console.log(`Asistente lista en http://localhost:${resolvedPort}`);
      resolve(server);
    });
    server.on("error", reject);
  });
}

module.exports = { app, startServer };

if (require.main === module) {
  startServer().catch((error) => {
    console.error("No se pudo iniciar el servidor", error);
    process.exit(1);
  });
}
