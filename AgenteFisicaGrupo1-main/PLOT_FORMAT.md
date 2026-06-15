Formato de bloques ```plot``` para el Tutor de Física

El tutor puede incluir bloques de código con la etiqueta `plot` que contienen JSON. Cada bloque puede contener un objeto (un gráfico) o un arreglo de objetos (varios gráficos emitidos juntos).

Estructura básica de un objeto de plot:

- `title` (opcional): Título que aparecerá sobre el gráfico.
- `description` o `desc` (opcional): Texto descriptivo que aparece debajo del título.
- `xLabel` / `yLabel` (opcional): Etiquetas de ejes.
- `xDomain` / `yDomain` (opcional): Rango mostrado en ejes, ejemplo: `[0, 10]`.
- `functions` (requerido): arreglo de funciones o definiciones. Cada elemento puede ser:
  - Una cadena con la expresión matemática (ej.: `"x^2"`).
  - Un objeto con campos: `fn` (string), `color` (hex), `range` (array), `sampler` (número de puntos).
  - Un objeto con campos: `fn` (string), `color` (hex), `range` (array), `sampler` (número de puntos), `nonNegative` (boolean) para indicar que la salida debe tratarse como no negativa.

Ejemplo: un único gráfico

```plot
{
  "title": "Movimiento uniformemente acelerado",
  "description": "Posición y velocidad vs tiempo",
  "xLabel": "Tiempo (s)",
  "yLabel": "Posición (m)",
  "xDomain": [0, 10],
  "yDomain": [-5, 105],
  "functions": [
    { "fn": "0.5*2*x^2", "color": "#ff4081" },
    { "fn": "2*x", "color": "#00e5ff" }
  ]
}
```

Ejemplo: múltiples gráficos en un solo bloque (array)

```plot
[
  {
    "title": "Posición (a=2)",
    "description": "s(t) = 0.5*a*t^2",
    "xLabel": "t (s)",
    "functions": ["0.5*2*x^2"]
  },
  {
    "title": "Velocidad (a=2)",
    "description": "v(t) = a*t",
    "xLabel": "t (s)",
    "functions": ["2*x"],
    "yDomain": [-1, 21]
  }
]
```

Notas:
- Para generar muchas gráficas, el tutor puede emitir varios bloques `plot` en la misma respuesta, o un único bloque con un arreglo de objetos.
- Si falta `title`, se mostrará "Gráfico" por defecto.
- Las expresiones deben usar `x` como variable de la función.

Opciones avanzadas en el objeto principal del `plot`:

- `forceNonNegative: true` — forzar que el eje vertical no muestre valores negativos (si procede).
- `autoClampNonPhysical: false` — deshabilitar la heurística inteligente de "no mostrar negativos" si no quieres que se aplique automáticamente.

La aplicación aplica por defecto una heurística que intenta no mostrar valores negativos cuando la variable representada es física y no puede ser negativa (por ejemplo `Posición` con referencia en cero, `Altura`, `Energía`). Si quieres controlar esto manualmente, usa `forceNonNegative` o desactiva la heurística con `autoClampNonPhysical: false`.

Si quieres, puedo añadir validaciones y mensajes de error más explícitos cuando el JSON está mal formado.