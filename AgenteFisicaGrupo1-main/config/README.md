Coloca tu API key aquí para que la aplicación pueda usarla al abrirse.

Opciones válidas:

1) Archivo con la clave directa:
   - Ruta: config/apikey.txt
   - Contenido: sólo la clave, sin comillas ni texto adicional.

   Ejemplo:
   ```
   AI_KEY_ABC12345
   ```

2) Archivo .env con la variable API_KEY:
   - Ruta: config/.env
   - Contenido:
   ```
   API_KEY=AI_KEY_ABC12345
   ```

La aplicación cargará primero `config/apikey.txt` si existe. Si no existe, buscará `config/.env`. Si ninguno de los dos existe, seguirá usando `.env` en la raíz del proyecto.
