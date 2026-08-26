// fakeServer.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/userFullInfo', (req, res) => {
  const id = req.query.id;
  res.json({
    id,
    username: "Exemplo_" + id,
    email: "teste@dominio.com",
    plan: "basic",
    lastLogin: new Date().toISOString(),
  });
});

app.listen(3000, () => {
  console.log("Mock API ouvindo na porta 3000");
});
