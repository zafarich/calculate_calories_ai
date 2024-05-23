const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
const fs = require("fs");
require("dotenv").config();

const tokenMiddleware = require("./middleware/staticMiddleware");
// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(tokenMiddleware);
// Database Connection
mongoose.connect("mongodb://127.0.0.1:27017/calculate_calories", {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Routes
app.get("/", (req, res) => {
  res.send("Success working Server");
});
app.use("/api/product", require("./routes/product"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
