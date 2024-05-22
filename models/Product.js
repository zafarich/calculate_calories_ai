const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
});

const ProductSchema = new mongoose.Schema({
  image: {
    type: String,
  },
  title: {
    type: String,
  },
  type: {
    type: String,
    required: true,
    enum: ["text", "image"],
  },
  lang: {
    type: String,
    required: true,
    enum: ["uz", "ru"],
  },
  client_id: {
    type: String || Number,
    require: true,
  },
  comments: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model("Product", ProductSchema);
