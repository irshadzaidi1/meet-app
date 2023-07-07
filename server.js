
const path = require("path");
const express = require("express");
const app = express(); // create express app

// add middlewares
app.use(express.static(path.join(__dirname, "/dist", "meet-app")));
app.use(express.static("public"));

app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "/dist", "meet-app", "index.html"));
});

// start express server on port 4000
app.listen(4000, () => {
  console.log("server started on port 4000");
});