const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());



app.get("/", (req, res) => {
  res.send("summer camp is running");
})



app.listen(port, () => {
  console.log(`Summer camp is running on port ${port}`);
})