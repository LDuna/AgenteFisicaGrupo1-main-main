const chatHistory = document.getElementById('chat-history');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
let isWaiting = false;
let currentPlotData = null; // Guardar datos del gráfico actual para redimensionar
let savedPlots = []; // Array de { meta: {title, desc}, data: parsedData }
let currentPlotIndex = -1;

// Elementos UI para gestión de múltiples gráficos
const plotTitleEl = document.getElementById('plot-title');
const plotDescEl = document.getElementById('plot-desc');
const prevPlotBtn = document.getElementById('prev-plot');
const nextPlotBtn = document.getElementById('next-plot');
const plotListSelect = document.getElementById('plot-list');
const plotPlaceholder = document.getElementById('plot-placeholder');
const plotCanvas = document.getElementById('plot-canvas');

// Elementos UI para gestión de múltiples DCL
const dclTitleEl = document.getElementById('dcl-title');
const dclDescEl = document.getElementById('dcl-desc');
const prevDclBtn = document.getElementById('prev-dcl');
const nextDclBtn = document.getElementById('next-dcl');
const dclListSelect = document.getElementById('dcl-list');
const dclPlaceholder = document.getElementById('dcl-placeholder');
const dclCanvas = document.getElementById('dcl-canvas');

let savedDCLs = []; // Array de { meta: {title, desc}, params: parsedParams }
let currentDCLIndex = -1;

// Elementos UI para pestañas
const tabPlotsBtn = document.getElementById('tab-plots');
const tabDclBtn = document.getElementById('tab-dcl');
const plotWrapper = document.getElementById('plot-wrapper');
const dclWrapper = document.getElementById('dcl-wrapper');

function buildPlotConfig(data) {
  // Colors
  // Neon palette prioritizing high contrast on dark background
  const neonColors = ['#00e5ff', '#ff4081', '#00e676', '#ffea00', '#d500f9', '#ff6d00'];
  const xLabelLower = (data.xLabel || '').toLowerCase();
  const isTimeAxis = xLabelLower.includes('tiempo') || xLabelLower.includes('time') || xLabelLower.includes('(s)') || xLabelLower.includes('segundo') || xLabelLower.includes('second');

  const fns = (data.functions || []).map((f, index) => {
    let fnObj;
    if (typeof f === 'string') {
      fnObj = { fn: f, color: neonColors[index % neonColors.length] };
    } else if (typeof f === 'object' && f !== null) {
      fnObj = { ...f, color: f.color || neonColors[index % neonColors.length] };
    } else {
      fnObj = f;
    }

    if (isTimeAxis && fnObj) {
      if (fnObj.range) {
        if (fnObj.range[0] < 0) fnObj.range[0] = 0;
      } else {
        fnObj.range = [0, 99999];
      }
    }
    return fnObj;
  });

  const defaultXDomain = isTimeAxis ? [0, 10] : [-10, 10];
  let xDomain = data.xDomain || defaultXDomain;
  if (isTimeAxis) {
    if (xDomain[0] < 0) xDomain[0] = 0;
    if (xDomain[1] <= xDomain[0]) xDomain[1] = xDomain[0] + 10;
  }

  // Heurística inteligente para recortar valores no físicos (ej. no mostrar negativos)
  // Decisión basada en: etiqueta de eje Y, flags del JSON (`forceNonNegative`) o indicadores en las funciones.
  const yLabelLower = (data.yLabel || '').toLowerCase();
  const likelyNonNegative = yLabelLower.includes('posición') || yLabelLower.includes('posicion') || yLabelLower.includes('altura') || yLabelLower.includes('despl') || yLabelLower.includes('energia');

  // Función segura para evaluar expresiones simples en tiempo abierto (reemplaza ^ por ** y expone Math)
  function evalExpr(expr, x) {
    try {
      const safe = String(expr).replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', 'Math', `with(Math){ return (${safe}); }`);
      const v = fn(x, Math);
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    } catch (e) {
      // fallthrough
    }
    return NaN;
  }

  // Muestrear funciones para estimar rango real y decidir sobre recorte
  let sampledMin = Infinity;
  let sampledMax = -Infinity;
  try {
    const samples = 50;
    fns.forEach(fnObj => {
      const expr = (typeof fnObj === 'object' && fnObj.fn) ? fnObj.fn : (typeof fnObj === 'string' ? fnObj : null);
      if (!expr) return;
      // usar rango del propio objeto si existe
      const r = (typeof fnObj === 'object' && fnObj.range) ? fnObj.range : xDomain;
      const a = Math.max(r[0], xDomain[0]);
      const b = Math.min(r[1] || xDomain[1], xDomain[1]);
      for (let i = 0; i <= samples; i++) {
        const t = a + (b - a) * (i / samples);
        const val = evalExpr(expr, t);
        if (!Number.isNaN(val)) {
          if (val < sampledMin) sampledMin = val;
          if (val > sampledMax) sampledMax = val;
        }
      }
    });
  } catch (e) {
    // no bloquear si la muestra falla
    sampledMin = Infinity; sampledMax = -Infinity;
  }

  // Decidir si aplicar recorte no-negativo
  const forceNonNegative = data.forceNonNegative === true || (Array.isArray(data.functions) && data.functions.some(f => typeof f === 'object' && f.nonNegative));
  const applyAutoClamp = data.autoClampNonPhysical !== false; // por defecto true
  let finalYDomain = data.yDomain || [-10, 10];
  if (applyAutoClamp && (forceNonNegative || likelyNonNegative) && isFinite(sampledMin)) {
    // Si la muestra sugiere que el rango inferior es >= 0 (o muy cerca), fijarlo en 0
    if (sampledMin >= -1e-6) {
      finalYDomain[0] = 0;
      // ajustar el superior si aún es el default para dar más visibilidad
      if (!data.yDomain) finalYDomain[1] = Math.max(1, sampledMax * 1.1);
    } else {
      // si la muestra incluye negativos, respetamos los signos físicos
      finalYDomain = data.yDomain || [sampledMin, sampledMax];
    }
  }

  return {
    target: plotCanvas,
    width: Math.max(300, plotCanvas.clientWidth),
    height: Math.max(220, plotCanvas.clientHeight),
    grid: true,
    data: fns,
    xAxis: { domain: xDomain, label: data.xLabel || 'Eje X' },
    yAxis: { domain: finalYDomain, label: data.yLabel || 'Eje Y' },
    annotations: [{ x: 0 }, { y: 0 }]
  };
}

function renderPlot(plotData) {
  try {
    const data = typeof plotData === 'string' ? JSON.parse(plotData) : plotData;
    // Si el bloque contiene un array de objetos, añadir cada uno como gráfico separado
    if (Array.isArray(data)) {
      data.forEach(d => addPlot(d));
      return;
    }
    addPlot(data);
  } catch (error) {
    console.error("Error al renderizar el gráfico:", error);
  }
}

function addPlot(data) {
  const meta = { title: data.title || data.name || 'Gráfico', desc: data.description || data.desc || '' };
  savedPlots.push({ meta, data });
  const idx = savedPlots.length - 1;
  // Añadir opción al select
  const opt = document.createElement('option');
  opt.value = idx;
  opt.textContent = `${meta.title} (${idx + 1})`;
  plotListSelect.appendChild(opt);
  showPlot(idx);
  // Cambiar automáticamente a la pestaña de gráficos y desplegar panel
  switchTab('plots', true);
}

function showPlot(index) {
  if (index < 0 || index >= savedPlots.length) return;
  currentPlotIndex = index;
  const entry = savedPlots[index];
  plotTitleEl.textContent = entry.meta.title;
  plotDescEl.textContent = entry.meta.desc || 'Sin descripción.';
  plotListSelect.value = index;
  plotPlaceholder.style.display = 'none';
  
  // Reset style to 100% to measure container size
  plotCanvas.style.width = '100%';
  plotCanvas.style.height = '100%';

  // Construir config y renderizar
  currentPlotData = buildPlotConfig(entry.data);
  // Ensure canvas has explicit pixel size so function-plot can render
  plotCanvas.style.width = currentPlotData.width + 'px';
  plotCanvas.style.height = currentPlotData.height + 'px';
  plotCanvas.innerHTML = '';
  functionPlot(currentPlotData);
}

// Redibujar en resize para mantenerlo responsivo
window.addEventListener('resize', () => {
  if (currentPlotIndex >= 0 && savedPlots[currentPlotIndex]) {
    // Reset style to 100% to measure container size
    plotCanvas.style.width = '100%';
    plotCanvas.style.height = '100%';

    // Rebuild and rerender current plot to adapt to new size
    currentPlotData = buildPlotConfig(savedPlots[currentPlotIndex].data);
    plotCanvas.style.width = currentPlotData.width + 'px';
    plotCanvas.style.height = currentPlotData.height + 'px';
    plotCanvas.innerHTML = '';
    functionPlot(currentPlotData);
  }

  if (currentDCLIndex >= 0 && savedDCLs[currentDCLIndex]) {
    renderDCA(savedDCLs[currentDCLIndex].params);
  }
});

// Render an image (URL or data URL) into the plot area
function renderImage(src) {
  plotCanvas.innerHTML = '';
  const img = document.createElement('img');
  img.src = src.trim();
  img.style.maxWidth = '100%';
  img.style.maxHeight = '100%';
  img.style.objectFit = 'contain';
  plotPlaceholder.style.display = 'none';
  plotCanvas.appendChild(img);
}

// Render a simple DCA (diagrama de cuerpo aislado) SVG based on params
function renderDCA(params) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const w = dclCanvas.clientWidth || 600;
  const h = dclCanvas.clientHeight || 360;
  dclCanvas.innerHTML = '';
  const svg = document.createElementNS(svgNS, 'svg');

  // Use viewBox defined in params if provided, otherwise default to container aspect ratio
  const viewW = params.width || w;
  const viewH = params.height || h;
  svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';
  svg.style.margin = 'auto';

  // Dyn marker builder for arrows
  function getOrCreateMarker(color) {
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(svgNS, 'defs');
      svg.appendChild(defs);
    }
    const cleanColor = String(color).replace('#', '');
    const id = `arrow-${cleanColor}`;
    if (!defs.querySelector(`#${id}`)) {
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M0,0 L0,6 L6,3 z');
      path.setAttribute('fill', color || '#ff4081');
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    return `url(#${id})`;
  }

  if (params.elements && Array.isArray(params.elements)) {
    // Generic SVG rendering
    params.elements.forEach(el => {
      try {
        let node;
        switch (el.type) {
          case 'line':
            node = document.createElementNS(svgNS, 'line');
            node.setAttribute('x1', el.x1);
            node.setAttribute('y1', el.y1);
            node.setAttribute('x2', el.x2);
            node.setAttribute('y2', el.y2);
            node.setAttribute('stroke', el.stroke || '#ffffff');
            node.setAttribute('stroke-width', el.strokeWidth || 2);
            if (el.dashed) node.setAttribute('stroke-dasharray', '5,5');
            if (el.dotted) node.setAttribute('stroke-dasharray', '2,4');
            break;

          case 'circle':
            node = document.createElementNS(svgNS, 'circle');
            node.setAttribute('cx', el.cx);
            node.setAttribute('cy', el.cy);
            node.setAttribute('r', el.r || 5);
            node.setAttribute('fill', el.fill || '#1f2937');
            node.setAttribute('stroke', el.stroke || '#ffffff');
            node.setAttribute('stroke-width', el.strokeWidth || 2);
            break;

          case 'rect':
            node = document.createElementNS(svgNS, 'rect');
            node.setAttribute('x', el.x);
            node.setAttribute('y', el.y);
            node.setAttribute('width', el.width || 20);
            node.setAttribute('height', el.height || 20);
            node.setAttribute('fill', el.fill || '#1f2937');
            node.setAttribute('stroke', el.stroke || '#ffffff');
            node.setAttribute('stroke-width', el.strokeWidth || 2);
            if (el.rx) node.setAttribute('rx', el.rx);
            if (el.ry) node.setAttribute('ry', el.ry);
            if (el.transform) node.setAttribute('transform', el.transform);
            break;

          case 'polygon':
            node = document.createElementNS(svgNS, 'polygon');
            node.setAttribute('points', el.points);
            node.setAttribute('fill', el.fill || '#1f2937');
            node.setAttribute('stroke', el.stroke || '#ffffff');
            node.setAttribute('stroke-width', el.strokeWidth || 2);
            break;

          case 'path':
            node = document.createElementNS(svgNS, 'path');
            node.setAttribute('d', el.d);
            node.setAttribute('fill', el.fill || 'none');
            node.setAttribute('stroke', el.stroke || '#ffffff');
            node.setAttribute('stroke-width', el.strokeWidth || 2);
            if (el.dashed) node.setAttribute('stroke-dasharray', '5,5');
            if (el.dotted) node.setAttribute('stroke-dasharray', '2,4');
            break;

          case 'text':
            node = document.createElementNS(svgNS, 'text');
            node.setAttribute('x', el.x);
            node.setAttribute('y', el.y);
            node.setAttribute('fill', el.color || el.fill || '#ffffff');
            node.setAttribute('font-size', el.fontSize || el.size || 12);
            node.setAttribute('font-family', "'Inter', sans-serif");
            if (el.fontWeight) node.setAttribute('font-weight', el.fontWeight);
            node.textContent = el.text || '';
            break;

          case 'arrow':
            // Draw vector arrow
            const g = document.createElementNS(svgNS, 'g');
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', el.x1);
            line.setAttribute('y1', el.y1);
            line.setAttribute('x2', el.x2);
            line.setAttribute('y2', el.y2);
            const arrowColor = el.color || el.stroke || '#ff4081';
            line.setAttribute('stroke', arrowColor);
            line.setAttribute('stroke-width', el.strokeWidth || 3);
            line.setAttribute('marker-end', getOrCreateMarker(arrowColor));
            g.appendChild(line);

            // Draw label
            if (el.label) {
              const textNode = document.createElementNS(svgNS, 'text');
              const dx = el.x2 - el.x1;
              const dy = el.y2 - el.y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              let lx = el.x2;
              let ly = el.y2;
              if (len > 0) {
                // Offset label slightly in the direction of the arrow
                lx += (dx / len) * 15;
                ly += (dy / len) * 15;
              }
              textNode.setAttribute('x', lx);
              textNode.setAttribute('y', ly + 4); // vertical adjustment
              textNode.setAttribute('fill', arrowColor);
              textNode.setAttribute('font-size', el.fontSize || 12);
              textNode.setAttribute('font-weight', '600');
              textNode.setAttribute('text-anchor', 'middle');
              textNode.setAttribute('font-family', "'Inter', sans-serif");
              textNode.textContent = el.label;
              g.appendChild(textNode);
            }
            node = g;
            break;

          default:
            console.warn(`Tipo de elemento DCL desconocido: ${el.type}`);
        }

        if (node) {
          svg.appendChild(node);
        }
      } catch (err) {
        console.error("Error renderizando elemento DCL:", el, err);
      }
    });
  } else {
    // Fallback: plano inclinado clásico
    const angle = (params.angle || 30) * Math.PI / 180;
    const W = 160; // block size

    // Draw inclined plane
    const plane = document.createElementNS(svgNS, 'polygon');
    const pad = 40;
    const x1 = pad;
    const y1 = h - pad;
    const x2 = w - pad;
    const y2 = h - pad;
    const x3 = pad + Math.cos(angle) * (w/2);
    const y3 = h - pad - Math.sin(angle) * (w/2);
    plane.setAttribute('points', `${x1},${y1} ${x2},${y2} ${x3},${y3}`);
    plane.setAttribute('fill', '#0f1724');
    plane.setAttribute('stroke', '#3b445f');
    plane.setAttribute('stroke-width', '2');
    svg.appendChild(plane);

    // Block position on plane (near middle)
    const bx = (x1 + x3) / 2 + 20;
    const by = (y1 + y3) / 2 - 10;
    const block = document.createElementNS(svgNS, 'rect');
    block.setAttribute('x', bx - W/8);
    block.setAttribute('y', by - W/8);
    block.setAttribute('width', W/4);
    block.setAttribute('height', W/4);
    block.setAttribute('fill', '#1f2937');
    block.setAttribute('stroke', '#00e5ff');
    block.setAttribute('stroke-width', '2');
    svg.appendChild(block);

    // Arrow helper
    function arrow(xa, ya, xb, yb, color) {
      const g = document.createElementNS(svgNS, 'g');
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', xa);
      line.setAttribute('y1', ya);
      line.setAttribute('x2', xb);
      line.setAttribute('y2', yb);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '3');
      line.setAttribute('marker-end', getOrCreateMarker(color));
      g.appendChild(line);
      return g;
    }

    // Weight (vertical down)
    const wx1 = bx + W/8;
    const wy1 = by + W/8;
    const wx2 = wx1;
    const wy2 = wy1 + 60;
    svg.appendChild(arrow(wx1, wy1, wx2, wy2, '#ff4081'));
    const wLabel = document.createElementNS(svgNS, 'text');
    wLabel.setAttribute('x', wx2 + 8);
    wLabel.setAttribute('y', wy2 + 4);
    wLabel.setAttribute('fill', '#ff4081');
    wLabel.setAttribute('font-size', '12');
    wLabel.setAttribute('font-family', "'Inter', sans-serif");
    wLabel.textContent = 'mg';
    svg.appendChild(wLabel);

    // Normal (perp to plane)
    const nx1 = bx;
    const ny1 = by;
    const nx2 = nx1 - Math.sin(angle) * 60;
    const ny2 = ny1 - Math.cos(angle) * 60;
    svg.appendChild(arrow(nx1, ny1, nx2, ny2, '#00e5ff'));
    const nLabel = document.createElementNS(svgNS, 'text');
    nLabel.setAttribute('x', nx2 - 18);
    nLabel.setAttribute('y', ny2 - 6);
    nLabel.setAttribute('fill', '#00e5ff');
    nLabel.setAttribute('font-size', '12');
    nLabel.setAttribute('font-family', "'Inter', sans-serif");
    nLabel.textContent = 'N';
    svg.appendChild(nLabel);

    // Friction (along plane, opposing motion), to the left/up plane
    const fx1 = bx;
    const fy1 = by + 6;
    const fx2 = fx1 + Math.cos(angle) * -60;
    const fy2 = fy1 + Math.sin(angle) * -60;
    svg.appendChild(arrow(fx1, fy1, fx2, fy2, '#ffd54f'));
    const fLabel = document.createElementNS(svgNS, 'text');
    fLabel.setAttribute('x', fx2 - 8);
    fLabel.setAttribute('y', fy2 - 8);
    fLabel.setAttribute('fill', '#ffd54f');
    fLabel.setAttribute('font-size', '12');
    fLabel.setAttribute('font-family', "'Inter', sans-serif");
    fLabel.textContent = 'f_k';
    svg.appendChild(fLabel);
  }

  dclPlaceholder.style.display = 'none';
  dclCanvas.appendChild(svg);
}

// Lógica de agregado y visualización de DCLs
function addDCL(params) {
  const meta = {
    title: params.title || params.name || `DCL: Plano Inclinado (${params.angle || 30}°)`,
    desc: params.description || params.desc || `Diagrama de cuerpo libre para un ángulo de ${params.angle || 30}° generada por el Tutor.`
  };
  savedDCLs.push({ meta, params });
  const idx = savedDCLs.length - 1;

  // Agregar al select
  const opt = document.createElement('option');
  opt.value = idx;
  opt.textContent = `${meta.title} (${idx + 1})`;
  dclListSelect.appendChild(opt);

  // Mostrar el DCL
  showDCL(idx);

  // Cambiar automáticamente a la pestaña DCL y forzar apertura
  switchTab('dcl', true);
}

function showDCL(index) {
  if (index < 0 || index >= savedDCLs.length) return;
  currentDCLIndex = index;
  const entry = savedDCLs[index];
  dclTitleEl.textContent = entry.meta.title;
  dclDescEl.textContent = entry.meta.desc || 'Sin descripción.';
  dclListSelect.value = index;
  dclPlaceholder.style.display = 'none';

  // Renderizar usando los params guardados
  renderDCA(entry.params);
}

function addMessage(text, role) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}-message`;
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble';
  
  if (role === 'ai') {
    // Buscar bloques especiales: dca, image, plot
    const dcaRegex = /```dca\s*\n([\s\S]*?)\n```/g;
    const imageRegex = /```image\s*\n([\s\S]*?)\n```/g;
    const plotRegex = /```plot\s*\n([\s\S]*?)\n```/g;
    let match;
    let cleanText = text;

    // DCA blocks (JSON) -> render SVG diagram
    while ((match = dcaRegex.exec(text)) !== null) {
      try {
        const params = JSON.parse(match[1]);
        addDCL(params);
        cleanText = cleanText.replace(match[0], '*[Se generó un diagrama DCL en el panel derecho]*');
      } catch (e) {
        console.warn('DCA JSON inválido:', e);
      }
    }

    // Image blocks -> render image URL or data URL
    while ((match = imageRegex.exec(text)) !== null) {
      const src = match[1].trim();
      if (src) {
        renderImage(src);
        cleanText = cleanText.replace(match[0], '*[Se mostró una imagen en el panel derecho]*');
      }
    }

    // Plot blocks -> existing behavior
    while ((match = plotRegex.exec(text)) !== null) {
      renderPlot(match[1]);
      // Reemplazar el bloque con una nota para que la IA sepa (el usuario) que generó un gráfico
      cleanText = cleanText.replace(match[0], '*[El tutor ha generado un gráfico en el panel derecho inspirado en este problema]*');
    }

    let mathBlocks = [];
    
    // Extraer bloques matemáticos antes de parsear Markdown para evitar conflictos
    const saveMath = (regex, displayMode) => {
      cleanText = cleanText.replace(regex, (match, p1) => {
        let id = `%%%MATH_${mathBlocks.length}%%%`;
        mathBlocks.push({ id, tex: p1, displayMode: displayMode });
        return id;
      });
    };

    saveMath(/\$\$([\s\S]+?)\$\$/g, true);
    saveMath(/\\\[([\s\S]+?)\\\]/g, true);
    saveMath(/(?<!\\)\$((?:[^\$]|\\\$)+?)\$/g, false);
    saveMath(/\\\(([\s\S]+?)\\\)/g, false);

    // Renderiza la respuesta usando marked
    let html = marked.parse(cleanText);
    
    // Restaurar el HTML con las fórmulas renderizadas por KaTeX
    mathBlocks.forEach(block => {
      let renderedMath = "";
      if (window.katex) {
        try {
          renderedMath = window.katex.renderToString(block.tex, {
            displayMode: block.displayMode,
            throwOnError: false
          });
        } catch (e) {
          renderedMath = `<span style="color:red;">KaTeX Error: ${e.message}</span>`;
        }
      } else {
        renderedMath = block.displayMode ? `$$${block.tex}$$` : `$${block.tex}$`;
      }
      html = html.replace(block.id, renderedMath);
    });

    bubbleDiv.innerHTML = html;
  } else {
    // Escapa el HTML del usuario para evitar XSS si se inyecta html
    bubbleDiv.textContent = text;
  }
  
  msgDiv.appendChild(bubbleDiv);
  chatHistory.appendChild(msgDiv);
  scrollToBottom();
}

function showTyping() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing-indicator';
  typingDiv.style.display = 'block';
  typingDiv.innerHTML = '<span></span><span></span><span></span>';
  chatHistory.appendChild(typingDiv);
  scrollToBottom();
}

function hideTyping() {
  const typing = document.getElementById('typing-indicator');
  if (typing) {
    typing.remove();
  }
}

function scrollToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Auto resize textarea
messageInput.addEventListener('input', function() {
  this.style.height = '52px';
  this.style.height = (this.scrollHeight) + 'px';
  if(this.value === '') {
      this.style.height = '52px';
  }
});

async function handleSend() {
  const text = messageInput.value.trim();
  if (!text || isWaiting) return;

  messageInput.value = '';
  messageInput.style.height = '52px'; // Reset height
  addMessage(text, 'user');
  
  isWaiting = true;
  showTyping();

  try {
    const response = await window.electronAPI.sendMessage(text);
    hideTyping();
    if (response.success) {
      addMessage(response.text, 'ai');
    } else {
      addMessage('**Error:** ' + response.error, 'ai');
    }
  } catch (err) {
    hideTyping();
    addMessage('Lo siento, no pude conectarme con el servicio.', 'ai');
  } finally {
    isWaiting = false;
  }
}

sendBtn.addEventListener('click', handleSend);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Navegación de gráficos
if (prevPlotBtn && nextPlotBtn && plotListSelect) {
  prevPlotBtn.addEventListener('click', () => {
    if (savedPlots.length === 0) return;
    const next = (currentPlotIndex - 1 + savedPlots.length) % savedPlots.length;
    showPlot(next);
  });

  nextPlotBtn.addEventListener('click', () => {
    if (savedPlots.length === 0) return;
    const next = (currentPlotIndex + 1) % savedPlots.length;
    showPlot(next);
  });

  plotListSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    showPlot(idx);
  });
}

// Lógica de pestañas
function switchTab(tab, forceExpand = false) {
  const container = document.querySelector('.app-container');
  const isCollapsed = container.classList.contains('panel-collapsed');
  const currentActiveTab = tabPlotsBtn.classList.contains('active') ? 'plots' : (tabDclBtn.classList.contains('active') ? 'dcl' : null);

  if (isCollapsed) {
    // Si estaba colapsado, expandir y activar la pestaña
    container.classList.remove('panel-collapsed');
    setActiveTab(tab);
  } else {
    // Si ya estaba abierto
    if (currentActiveTab === tab && !forceExpand) {
      // Si se hace clic en la pestaña activa, colapsar el panel entero
      container.classList.add('panel-collapsed');
      tabPlotsBtn.classList.remove('active');
      tabDclBtn.classList.remove('active');
      return;
    } else {
      // Si se hace clic en la otra pestaña, cambiar a ella
      setActiveTab(tab);
    }
  }

  // Redibujado después de que termine la animación de apertura para calcular dimensiones reales del contenedor
  setTimeout(() => {
    triggerRedraw(tab);
  }, 350);
}

function setActiveTab(tab) {
  if (tab === 'plots') {
    tabPlotsBtn.classList.add('active');
    tabDclBtn.classList.remove('active');
    plotWrapper.style.display = 'flex';
    dclWrapper.style.display = 'none';
    triggerRedraw('plots');
  } else if (tab === 'dcl') {
    tabPlotsBtn.classList.remove('active');
    tabDclBtn.classList.add('active');
    plotWrapper.style.display = 'none';
    dclWrapper.style.display = 'flex';
    triggerRedraw('dcl');
  }
}

function triggerRedraw(tab) {
  if (tab === 'plots') {
    if (currentPlotIndex >= 0 && savedPlots[currentPlotIndex]) {
      plotCanvas.style.width = '100%';
      plotCanvas.style.height = '100%';
      currentPlotData = buildPlotConfig(savedPlots[currentPlotIndex].data);
      plotCanvas.style.width = currentPlotData.width + 'px';
      plotCanvas.style.height = currentPlotData.height + 'px';
      plotCanvas.innerHTML = '';
      functionPlot(currentPlotData);
    }
  } else if (tab === 'dcl') {
    if (currentDCLIndex >= 0 && savedDCLs[currentDCLIndex]) {
      renderDCA(savedDCLs[currentDCLIndex].params);
    }
  }
}

if (tabPlotsBtn && tabDclBtn) {
  tabPlotsBtn.addEventListener('click', () => switchTab('plots'));
  tabDclBtn.addEventListener('click', () => switchTab('dcl'));
}

// Navegación de diagramas DCL
if (prevDclBtn && nextDclBtn && dclListSelect) {
  prevDclBtn.addEventListener('click', () => {
    if (savedDCLs.length === 0) return;
    const next = (currentDCLIndex - 1 + savedDCLs.length) % savedDCLs.length;
    showDCL(next);
  });

  nextDclBtn.addEventListener('click', () => {
    if (savedDCLs.length === 0) return;
    const next = (currentDCLIndex + 1) % savedDCLs.length;
    showDCL(next);
  });

  dclListSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    showDCL(idx);
  });
}

// Lógica de arrastre para regular el tamaño de los paneles
const resizer = document.getElementById('resizer');
const chatPanel = document.querySelector('.chat-panel');

if (resizer && chatPanel) {
  let isDragging = false;

  resizer.addEventListener('mousedown', (e) => {
    // Si está colapsado el panel, no permitir arrastrar
    const container = document.querySelector('.app-container');
    if (container.classList.contains('panel-collapsed')) return;

    isDragging = true;
    resizer.classList.add('active');
    container.classList.add('resizing'); // Desactiva transiciones CSS para evitar retrasos
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const containerWidth = document.body.clientWidth;
    let newWidth = e.clientX;

    // Límites de tamaño
    if (newWidth < 350) newWidth = 350;
    if (newWidth > containerWidth - 300) newWidth = containerWidth - 300;

    chatPanel.style.width = `${newWidth}px`;

    // Redibujar el gráfico actual en tiempo real
    if (currentPlotIndex >= 0 && savedPlots[currentPlotIndex]) {
      // Restablecer al 100% para medir el nuevo ancho
      plotCanvas.style.width = '100%';
      plotCanvas.style.height = '100%';

      currentPlotData = buildPlotConfig(savedPlots[currentPlotIndex].data);
      plotCanvas.style.width = currentPlotData.width + 'px';
      plotCanvas.style.height = currentPlotData.height + 'px';
      plotCanvas.innerHTML = '';
      functionPlot(currentPlotData);
    }

    // Redibujar el DCL actual en tiempo real
    if (currentDCLIndex >= 0 && savedDCLs[currentDCLIndex]) {
      renderDCA(savedDCLs[currentDCLIndex].params);
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove('active');
      document.querySelector('.app-container').classList.remove('resizing'); // Habilita transiciones de nuevo
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Redibujado final de gráfico
      if (currentPlotIndex >= 0 && savedPlots[currentPlotIndex]) {
        plotCanvas.style.width = '100%';
        plotCanvas.style.height = '100%';

        currentPlotData = buildPlotConfig(savedPlots[currentPlotIndex].data);
        plotCanvas.style.width = currentPlotData.width + 'px';
        plotCanvas.style.height = currentPlotData.height + 'px';
        plotCanvas.innerHTML = '';
        functionPlot(currentPlotData);
      }

      // Redibujado final de DCL
      if (currentDCLIndex >= 0 && savedDCLs[currentDCLIndex]) {
        renderDCA(savedDCLs[currentDCLIndex].params);
      }
    }
  });
}
