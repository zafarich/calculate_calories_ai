const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));

// Database Connection
mongoose.connect("mongodb://localhost:27017/calculate_calories", {});
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

// const {OpenAI} = require("openai");

// const openai = new OpenAI({
//   organization: process.env.ORG_ID,
//   apiKey: process.env.API_KEY,
// });
// async function main() {
//   const res = await openai.chat.completions.create({
//     model: "gpt-4o",
//     messages: [
//       {
//         role: "user",
//         content: [
//           {
//             type: "text",
//             text: `pomidor bodringli salat (uzbek's restaurants meal or food)`,
//           },

//           {
//             type: "text",
//             text: `It is necessary to check whether the product is for eating or drinking (is_food), it is healthy food (is_healthy) and its calories. The response must be JSON only. JSON {is_food: true || false, is_healthy: true || false, title: xx, total_calories: xx, macros: {proteins: x gr, carbs: x gr, fats: x gr}, ingridients: [title: xx, grams: xx, calories: xx]}. All titles need to be in uzbek`,
//           },

//           // {
//           //   type: "image_url",
//           //   image_url: {
//           //     url: "",
//           //   },
//           // },
//         ],
//       },
//     ],
//   });

//   console.log("res ->", res.choices[0]?.message?.content);
// }

// main();
