# Arquitectura del sistema

Tipo de arquitectura: MVC (Modelo-Vista-Controlador)

Componentes principales:
- Frontend: cliente SPA (carpeta `client/`) que consume APIs REST.
- Backend: servidor Node.js/Express (carpeta `server/src/`) con controladores y servicios.
- Base de datos: MongoDB mediante Mongoose (conexión en `server/src/config/db.js`).
- Almacenamiento de archivos: Google Cloud Storage / Google Drive / almacenamiento local (configurable en modelos).

Comunicación entre componentes:
- El `frontend` realiza peticiones HTTP(S) a los endpoints del `backend` (JSON REST).
- El `backend` gestiona la lógica (controladores), accede a la base de datos (modelos Mongoose) y a servicios externos (GCS, Drive, correo).
- Los modelos (MongoDB) almacenan usuarios, clases, pagos y documentos; los controladores exponen las operaciones CRUD.

Diagrama representativo (flujo de componentes):

```mermaid
flowchart LR
  subgraph Cliente
    UI[SPA - Browser]
  end

  subgraph Backend
    API[API REST - Express]
    Controllers[Controllers]
    Services[Services (email, gcs, drive, pagos)]
    Models[Mongoose Models]
  end

  subgraph DB
    Mongo[(MongoDB)]
    Storage[(GCS / Drive / Local)]
  end

  UI -->|HTTP JSON| API
  API --> Controllers
  Controllers --> Services
  Controllers --> Models
  Models --> Mongo
  Services --> Storage
  Storage --> Mongo
```

Descripción del flujo:
- El usuario interactúa con la SPA que llama a los endpoints del servidor.
- Los controladores validan y orquestan la lógica, persisten/recuperan datos con Mongoose y delegan a servicios externos para operaciones de almacenamiento o correo.
- MongoDB actúa como almacenamiento principal de entidades; los archivos voluminosos se guardan en GCS/Drive y se referencia su `objectKey`/URL en los documentos.
