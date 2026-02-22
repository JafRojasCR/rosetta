const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`Servidor Rosetta corriendo en http://localhost:${port}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();
