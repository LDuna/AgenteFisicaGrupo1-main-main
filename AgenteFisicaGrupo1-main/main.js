console.log("===> STARTING MAIN.JS <===");
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const configDir = path.join(__dirname, 'config');
const apiKeyPath = path.join(configDir, 'apikey.txt');
const configEnvPath = path.join(configDir, '.env');

if (fs.existsSync(apiKeyPath)) {
  const key = fs.readFileSync(apiKeyPath, 'utf8').trim();
  if (key) {
    process.env.API_KEY = key;
    console.log('API key cargada desde config/apikey.txt');
  }
}

if (!process.env.API_KEY && fs.existsSync(configEnvPath)) {
  dotenv.config({ path: configEnvPath });
  console.log('Configuración cargada desde config/.env');
}

if (!process.env.API_KEY) {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const { app, BrowserWindow, ipcMain } = require('electron');
process.on('uncaughtException', (err) => {
  fs.writeFileSync(path.join(__dirname, 'uncaught.txt'), err.stack || err.toString());
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  fs.writeFileSync(path.join(__dirname, 'unhandled.txt'), reason && reason.stack ? reason.stack : String(reason));
  process.exit(1);
});
const { GoogleGenAI } = require('@google/genai');
const systemInstruction = `Propósito y Objetivos:
* Actuar como un experto en Física I para resolver problemas relacionados con la cinemática, dinámica, movimiento y otros temas fundamentales.
* Proporcionar explicaciones claras y educativas que faciliten el aprendizaje de estudiantes de todos los niveles.
* Utilizar los archivos proporcionados por el usuario como fuente primaria y referencia para resolver ejercicios específicos o explicar conceptos teóricos.

Comportamientos y Reglas:
1) Resolución de Problemas:
 a) Al recibir un problema, identifica primero las variables conocidas y las incógnitas.
 b) Explica paso a paso el razonamiento físico antes de aplicar fórmulas matemáticas.
 c) Si el usuario proporciona archivos adjuntos, prioriza el método y la notación utilizados en dichos documentos para mantener la coherencia con su material de estudio.
 d) Proporciona la solución final de forma destacada y verifica que las unidades de medida sean correctas (SI).

2) Estilo Educativo:
 a) Evita el lenguaje excesivamente técnico sin una explicación previa; utiliza analogías de la vida cotidiana para explicar conceptos complejos como la inercia o la aceleración.
 b) Divide las respuestas largas en secciones con títulos claros (ej. 'Conceptos clave', 'Procedimiento', 'Resultado').
 c) Al final de cada explicación, incluye una breve pregunta de seguimiento para asegurar que el estudiante comprendió el concepto (ej. '¿Qué pasaría con la aceleración si duplicamos la fuerza?').

3) Interacción:
 a) Mantén un tono alentador y paciente.
 b) Si falta información para resolver un problema, solicita amablemente los datos necesarios en lugar de asumir valores.

Tono General:
* Profesional, experto y pedagógico.
* Amigable y accesible para estudiantes.
* Enfocado en la claridad y la precisión científica.

Regla Estricta de Restricción de Conocimiento:
* Responde ESTRICTAMENTE basando tu explicación, teoría y fórmulas matemáticas en las guías y documentos adjuntos.
* Importante: El usuario te pedirá resolver problemas con datos (números) que probablemente NO estén textualmente en la guía. Esto está permitido. Tu trabajo es encontrar cómo se resuelve ese tipo de problema en la guía y aplicar ese conocimiento paso a paso a los datos que te da el usuario.
* Si el TEMA FÍSICO (teoría o concepto) consultado no se menciona en absoluto en los documentos, DEBES responder textualmente: 'No poseo información sobre esto en mis guías.'
* Tienes estrictamente prohibido explicar conceptos teóricos de temas que no aparezcan en los documentos aportados.

Regla de Graficación Experimental (Para Visualización 2D):
* La aplicación posee un renderizador gráfico integrado en el panel lateral basado en Function Plot.
* Si consideras que el problema se explica mejor con la gráfica de una trayectoria, función de posición, velocidad o fuerzas dependientes de una variable única, puedes instruir al frontend para graficar.
* Para hacerlo, incluye en CUALQUIER lugar de tu respuesta un bloque de código estrictamente JSON delimitado por \`\`\`plot y \`\`\`.
* SIEMPRE utiliza la variable 'x' en las ecuaciones matemáticas (por ejemplo, si graficas posición vs tiempo, usa 'x' en vez de 't').
* IMPORTANTE: NUNCA grafiques tiempos negativos (t < 0). Cuando la variable independiente represente el tiempo (donde 'x' es el tiempo), haz que los gráficos muestren estrictamente t >= 0 en adelante (es decir, xDomain comenzando en 0, por ejemplo [0, 10] o mayor).
* Es MUY IMPORTANTE que incluyas nombres claros y físicos para los ejes usando "xLabel" e "yLabel" para que el usuario sepa qué representan (ej. "Tiempo (s)", "Posición (m)", "Velocidad (m/s)").
* Formato exacto requerido:
\`\`\`plot
{
  "functions": ["-4.9*x^2 + 10*x + 5", "0"],
  "xDomain": [0, 5],
  "yDomain": [-5, 20],
  "xLabel": "Tiempo (s)",
  "yLabel": "Posición (m)"
}
\`\`\`
* Solo incluye un bloque \`\`\`plot por respuesta. El frontend lo detectará, lo procesará y lo ocultará del chat para mostrarlo del lado derecho.

Regla de Diagramas DCL (Para Visualización de Cuerpo Libre / DCL):
* La aplicación posee un renderizador SVG genérico y flexible en el panel derecho (pestaña "Diagramas DCL").
* Si el problema requiere analizar fuerzas (DCL), diagramas físicos, poleas, o la trayectoria de una partícula (como un cono, un péndulo, un embudo, caída libre, etc.), DEBES construir un JSON de dibujo DCL.
* IMPORTANTE (Coordenadas en Movimiento Circular): Cuando el problema involucre movimiento circular, giros, péndulos o trayectorias curvas, DEBES estructurar el DCL utilizando coordenadas polares (eje radial \hat{r} y transversal \hat{\theta}) o intrínsecas (eje tangencial \hat{t} y normal \hat{n} apuntando hacia el centro de curvatura). Rotula las fuerzas utilizando estas componentes (ej. F_n, F_t, F_r, F_\theta) en lugar de cartesianas (F_x, F_y). Ilustra claramente los vectores de ejes correspondientes y la aceleración centrípeta si corresponde.
* CRÍTICO (Sistema de Coordenadas SVG - Eje Y Invertido): El renderizador usa coordenadas SVG donde el origen (0,0) está en la ESQUINA SUPERIOR IZQUIERDA. Esto significa que el eje Y CRECE HACIA ABAJO en la pantalla. Por lo tanto:
  - Para dibujar una fuerza que apunte HACIA ABAJO en la realidad (como el peso mg o la gravedad), el arrow DEBE tener y2 > y1 (ej. y1=200, y2=280).
  - Para dibujar una fuerza que apunte HACIA ARRIBA en la realidad (como la Normal N, el empuje de hélices, tensión hacia arriba, etc.), el arrow DEBE tener y2 < y1 (ej. y1=200, y2=120).
  - Para fuerzas hacia la DERECHA: x2 > x1. Para fuerzas hacia la IZQUIERDA: x2 < x1.
  - NUNCA inviertas este criterio. El peso SIEMPRE apunta hacia abajo (y2 > y1) y las fuerzas de sustentación/empuje SIEMPRE apuntan hacia arriba (y2 < y1).
* Para hacerlo, incluye en tu respuesta un bloque de código estrictamente JSON delimitado por \`\`\`dca y \`\`\`.
* El objeto JSON debe tener:
  - "title": Título breve del diagrama.
  - "description" o "desc": Explicación física de lo que se ilustra.
  - "width" y "height" (opcional, por defecto 600 y 360): Dimensiones del espacio de coordenadas del viewBox SVG.
  - "elements": Un array de objetos, donde cada objeto representa una figura o vector. Los tipos de elementos soportados son:
    1) {"type": "line", "x1": n, "y1": n, "x2": n, "y2": n, "stroke": "#color", "strokeWidth": n, "dashed": true/false, "dotted": true/false} (para líneas de fondo, rampas o trayectorias discontinuas)
    2) {"type": "circle", "cx": n, "cy": n, "r": n, "fill": "#color", "stroke": "#color", "strokeWidth": n} (para partículas o masas circulares)
    3) {"type": "rect", "x": n, "y": n, "width": n, "height": n, "fill": "#color", "stroke": "#color", "strokeWidth": n, "transform": "rotate(deg, cx, cy)"} (para bloques o carros)
    4) {"type": "polygon", "points": "x1,y1 x2,y2 x3,y3", "fill": "#color", "stroke": "#color"} (para planos inclinados, conos o embudos)
    5) {"type": "path", "d": "M...", "fill": "#color", "stroke": "#color", "strokeWidth": n, "dashed": true/false, "dotted": true/false} (para trayectorias curvas)
    6) {"type": "text", "x": n, "y": n, "text": "texto", "color": "#color", "fontSize": n, "fontWeight": "bold"} (para etiquetas)
    7) {"type": "arrow", "x1": n, "y1": n, "x2": n, "y2": n, "color": "#color", "label": "mg", "strokeWidth": n} (para vectores de fuerza. Automáticamente dibuja la punta de flecha en (x2,y2) y coloca la etiqueta al final. RECUERDA: y2 > y1 = flecha hacia ABAJO en pantalla, y2 < y1 = flecha hacia ARRIBA en pantalla)
* Ejemplo para un bloque deslizándose en un plano inclinado con su trayectoria punteada (OBSERVA cómo mg tiene y2=280 > y1=200, es decir apunta hacia ABAJO, y N tiene y2=110 < y1=200, es decir apunta hacia ARRIBA):
\`\`\`dca
{
  "title": "DCL: Bloque en plano inclinado",
  "description": "Diagrama de cuerpo libre genérico que muestra las fuerzas y la trayectoria del bloque.",
  "width": 600,
  "height": 360,
  "elements": [
    { "type": "polygon", "points": "40,320 560,320 560,120", "fill": "#0f1724", "stroke": "#3b445f", "strokeWidth": 2 },
    { "type": "line", "x1": 560, "y1": 120, "x2": 40, "y2": 320, "stroke": "#7663ff", "strokeWidth": 3 },
    { "type": "path", "d": "M 100,100 Q 300,150 400,250", "stroke": "#ffea00", "strokeWidth": 2, "dotted": true },
    { "type": "rect", "x": 280, "y": 180, "width": 40, "height": 40, "fill": "#1f2937", "stroke": "#00e5ff", "strokeWidth": 2, "transform": "rotate(-20, 300, 200)" },
    { "type": "arrow", "x1": 300, "y1": 200, "x2": 300, "y2": 280, "color": "#ff4081", "label": "mg" },
    { "type": "arrow", "x1": 300, "y1": 200, "x2": 260, "y2": 110, "color": "#00e5ff", "label": "N" },
    { "type": "arrow", "x1": 300, "y1": 200, "x2": 380, "y2": 170, "color": "#ffd54f", "label": "f_k" }
  ]
}
\`\`\`
* Utiliza este formato genérico para modelar con precisión los diagramas (por ejemplo, dibujando un embudo con líneas/polígonos si el problema es un cono o embudo, o un círculo con fuerzas radiales para la rotación). Solo incluye un bloque \`\`\`dca por respuesta cuando sea pertinente.`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Lista de modelos de respaldo en orden de preferencia.
// Si el primero falla con 503/429, se prueba el siguiente.
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite'
];
let currentModelIndex = 0; // Índice del modelo actualmente en uso
let chatSessionModel = null; // Modelo con el que se creó la sesión actual
let savedChatHistory = []; // Historial persistente entre recreaciones de sesión

function getCurrentModel() {
  return FALLBACK_MODELS[currentModelIndex];
}

function saveHistoryFromSession() {
  if (chatSession) {
    try {
      savedChatHistory = chatSession.getHistory();
      console.log(`  >> Historial guardado (${savedChatHistory.length} turnos)`);
    } catch (e) {
      console.log('  >> No se pudo obtener historial:', e.message);
    }
  }
}

function switchToNextModel() {
  if (currentModelIndex < FALLBACK_MODELS.length - 1) {
    currentModelIndex++;
    console.log(`  >> Cambiando al modelo de respaldo: ${getCurrentModel()}`);
    // Guardar historial antes de invalidar la sesión
    saveHistoryFromSession();
    chatSession = null;
    chatSessionModel = null;
    return true;
  }
  return false;
}

function resetModelIndex() {
  currentModelIndex = 0;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

// ==== VARIABLES GLOBALES DEL ENRUTADOR ====
let availablePDFs = {};
let injectedPDFs = new Set();
let uploadPromise = null;
let chatSession = null;

// ==== ETAPA 1: STARTUP ====
async function uploadInitialPDFs() {
  try {
    const guiasPath = path.join(__dirname, 'guias');
    if (fs.existsSync(guiasPath)) {
      const files = fs.readdirSync(guiasPath).filter(f => f.toLowerCase().endsWith('.pdf'));
      if (files.length > 0) {
        console.log(`\n=== ETAPA 1: STARTUP ===`);
        console.log(`Verificando y cargando ${files.length} guías (.pdf)...`);

        let existingFiles = [];
        try {
           const listResult = await ai.files.list();
           // Si existe listResult, iteramos. Puede que haya que manejar paginación si hay muchos
           for await (const file of listResult) {
               existingFiles.push(file);
           }
        } catch(e) {
           console.log("No se pudo obtener la lista de archivos previos, subiendo nuevos...");
        }

        for (const file of files) {
          const filePath = path.join(guiasPath, file);
          
          const existingFile = existingFiles.find(f => f.displayName === file && f.state === 'ACTIVE');
          if (existingFile) {
             availablePDFs[file] = { fileData: { fileUri: existingFile.uri, mimeType: existingFile.mimeType } };
             console.log(`- Archivo cargado desde caché en la nube (no consume tokens): ${file}`);
             continue;
          }

          console.log(`- Subiendo a Gemini: ${file}...`);
          let retries = 3;
          let backoff = 5000;
          while (retries > 0) {
            try {
              const uploadResult = await ai.files.upload({ file: filePath, mimeType: 'application/pdf', config: { displayName: file } });

              let fileInfo = await ai.files.get({ name: uploadResult.name });
              while (fileInfo.state === 'PROCESSING') {
                await new Promise(r => setTimeout(r, 3000));
                fileInfo = await ai.files.get({ name: uploadResult.name });
              }

              if (fileInfo.state === 'ACTIVE') {
                availablePDFs[file] = { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } };
                console.log(`- Archivo subido y procesado correctamente: ${file}`);
              } else {
                console.error(`- Error procesando ${file}: estado ${fileInfo.state}`);
              }
              
              // Pausa de 5 segundos para respetar el límite de 15 RPM
              await new Promise(r => setTimeout(r, 5000));
              break; // Éxito, salir del bucle de reintento
            } catch(e) {
              const errorMsg = e.message ? e.message.toLowerCase() : "";
              if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('too many')) {
                console.log(`- Límite de peticiones alcanzado (429). Esperando ${backoff/1000}s para reintentar...`);
                await new Promise(r => setTimeout(r, backoff));
                backoff *= 2; // Incrementar la pausa
                retries--;
                if (retries === 0) console.error(`- Se omitió ${file} después de varios reintentos.`);
              } else {
                console.error(`- Error subiendo ${file}:`, e.message);
                break; // Si es otro tipo de error, no reintentamos
              }
            }
          }
        }
        console.log("=== Guías inicializadas y listas para ser enrutadas ===\n");
      }
    }
  } catch (error) {
    console.error("Error durante la etapa de startup al subir PDFs:", error);
  }
}

app.whenReady().then(() => {
  createWindow();

  // Iniciar la subida de los PDFs en segundo plano
  uploadPromise = uploadInitialPDFs();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// ==== ETAPA 2: CEREBRO CLASIFICADOR ====
function normalizeStr(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function clasificarPregunta(texto) {
  const pdfNames = Object.keys(availablePDFs);
  if (pdfNames.length === 0) return "NINGUNO";

  const routerPrompt = `Tenemos los siguientes documentos educativos de física disponibles en nuestra base de datos: 
${pdfNames.join("\n")}

Ten en cuenta que los nombres de los archivos contienen abreviaturas de los temas (por ejemplo: 'RevDinCpoPtual' = Dinámica de Cuerpo Puntual, 'OscilaLibres' = Oscilaciones Libres, 'PmasCapitulo' = Problemas del Capítulo, etc) y también guías de ejercicios específicas (ej. 'Guía 1 - Cinematica.pdf', 'Guía_2___Dinámica.pdf').

Presta muchísima atención al siguiente mensaje del usuario: "${texto}"

Instrucciones de enrutamiento:
1. Si el usuario menciona explícitamente una guía, archivo o documento en particular (por ejemplo: "guía 2", "guía de dinámica", "Guía 1", "ejercicio de la guía 3"), debes elegir el archivo correspondiente a esa guía o documento.
2. Si el usuario pregunta sobre un ejercicio o problema específico de una guía, prioriza siempre la guía de ejercicios correspondiente (por ejemplo, para un ejercicio de dinámica de la guía 2, prioriza 'Guía_2___Dinámica.pdf').
3. Si es una pregunta teórica o conceptual general, busca el documento que contenga la teoría o fórmulas necesarias para ese tema.

Responde ÚNICAMENTE con el nombre exacto del archivo (ej. ${pdfNames[0]}), o "NINGUNO" si es solo un simple saludo, charla casual, o si la pregunta no requiere consultar ninguna guía.`;

  // Intentar con cada modelo de respaldo
  for (let mi = currentModelIndex; mi < FALLBACK_MODELS.length; mi++) {
    const modelToTry = FALLBACK_MODELS[mi];
    let retries = 3;
    let delay = 3000;
    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: modelToTry,
          contents: routerPrompt,
          config: { temperature: 0.0 }
        });

        const docName = response.text.trim();
        // Si funcionó con un modelo diferente al actual, actualizar el índice
        if (mi !== currentModelIndex) {
          currentModelIndex = mi;
          // Guardar historial y marcar sesión para recreación (no perder memoria)
          saveHistoryFromSession();
          chatSession = null;
          chatSessionModel = null;
          console.log(`  >> Router: modelo ${modelToTry} funcionó. Actualizando modelo principal.`);
        }

        const normDoc = normalizeStr(docName);
        for (const name of pdfNames) {
          const normName = normalizeStr(name);
          if (normDoc.includes(normName) || normName.includes(normDoc)) {
            return name;
          }
        }
        return "NINGUNO";
      } catch (e) {
        const errMsg = e.message ? e.message.toLowerCase() : "";
        const isTransient = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('unavailable') || errMsg.includes('quota');
        if (isTransient) {
          retries--;
          if (retries > 0) {
            console.log(`  > Router (${modelToTry}): error transitorio. Reintentando en ${delay/1000}s... (${retries} intentos restantes)`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
          } else {
            console.log(`  > Router: modelo ${modelToTry} saturado. Probando siguiente modelo...`);
          }
        } else {
          console.log("El router tuvo un problema no transitorio:", e.message);
          return "NINGUNO";
        }
      }
    }
  }
  console.log("El router no pudo conectarse con ningún modelo de respaldo.");
  return "NINGUNO";
}

// ==== ETAPA 2: CHAT Y ENVÍO ====
ipcMain.handle('chat:send', async (event, text) => {
  try {
    // 1. Esperamos a que termine la subida de fondo si no ha terminado
    if (uploadPromise) {
      await uploadPromise;
    }

    // 2. Inicializamos la sesión si es el primer mensaje (o si se cambió de modelo)
    function createChatSession() {
      // Guardar historial de la sesión anterior si existe
      if (chatSession) {
        saveHistoryFromSession();
      }
      const model = getCurrentModel();
      console.log(`\n=== ETAPA 2: CHAT INIT (modelo: ${model}, historial: ${savedChatHistory.length} turnos) ===`);
      chatSession = ai.chats.create({
        model: model,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3
        },
        history: savedChatHistory
      });
      chatSessionModel = model;
    }
    // Recrear si no existe o si el modelo cambió
    if (!chatSession || chatSessionModel !== getCurrentModel()) {
      createChatSession();
    }

    // 3. Consultar al Cerebro Enrutador qué PDF enviarle a la IA para ayudarla a contestar
    console.log(`Analizando pregunta: "${text}"`);
    const mejorPDF = await clasificarPregunta(text);

    let partsList = [];
    let pdfToInject = null;

    // 4. Inyección Condicional
    if (mejorPDF !== "NINGUNO" && availablePDFs[mejorPDF]) {
      if (!injectedPDFs.has(mejorPDF)) {
        console.log(` > [Router Inteligente] Inyectará el PDF: ${mejorPDF}`);
        pdfToInject = mejorPDF;
        partsList.push(availablePDFs[mejorPDF]);
      } else {
        console.log(` > [Router Inteligente] Tema: ${mejorPDF} (Ya memorizado por la IA)`);
      }
    } else {
      console.log(" > Ningún PDF nuevo requerido.");
    }

    // Insertar el texto real del usuario
    partsList.push({ text: text });
    const payload = partsList.length > 1 ? partsList : text;

    // Ejecutar petición con reintentos y modelos de respaldo
    let response;
    let totalAttempts = 0;
    const MAX_TOTAL_ATTEMPTS = 12; // máximo absoluto de intentos entre todos los modelos

    while (totalAttempts < MAX_TOTAL_ATTEMPTS) {
      let retries = 3;
      let delay = 3000;
      while (retries > 0 && totalAttempts < MAX_TOTAL_ATTEMPTS) {
        try {
          // Asegurar que chatSession existe
          if (!chatSession) createChatSession();
          response = await chatSession.sendMessage({ message: payload });
          break; // Éxito
        } catch (err) {
          totalAttempts++;
          const errorMsg = err.message ? err.message.toLowerCase() : "";
          const isTransient = errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('unavailable') || errorMsg.includes('429') || errorMsg.includes('quota');
          if (isTransient) {
            retries--;
            console.log(` > ${getCurrentModel()}: Alta demanda/cuota. Reintentando en ${delay/1000}s... (${retries} intentos con este modelo)`);
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            }
          } else {
            throw err; // Error no transitorio, no reintentar
          }
        }
      }
      // Si obtuvimos respuesta, salir del bucle exterior
      if (response) break;
      // Si no, intentar con el siguiente modelo de respaldo
      if (!switchToNextModel()) {
        // No quedan más modelos, lanzar error descriptivo
        throw new Error('Todos los modelos de Gemini están saturados en este momento (503). Intenta de nuevo en unos minutos.');
      }
      createChatSession();
    }

    // Solo marcamos como inyectado si el envío fue exitoso
    if (pdfToInject) {
      injectedPDFs.add(pdfToInject);
      console.log(` > [Éxito] PDF ${pdfToInject} memorizado correctamente en la sesión.`);
    }

    return { success: true, text: response.text };

  } catch (error) {
    console.error("Error en chat:", error);

    const errMsg = error.message ? error.message.toLowerCase() : "";

    // Mensaje adaptado para caídas por cuotas de la API o 503 persistente
    if (errMsg.includes('429') || errMsg.includes('quota')) {
      return {
        success: false,
        error: "Límite de tokens de la capa gratuita alcanzado. Por favor, espera entre 1 minuto y vuelve a intentarlo."
      };
    } else if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('saturados')) {
       return {
         success: false,
         error: "Todos los modelos de Gemini están saturados en este momento. Por favor, espera 1-2 minutos y vuelve a intentarlo."
       };
    }

    return { success: false, error: error.message };
  }
});