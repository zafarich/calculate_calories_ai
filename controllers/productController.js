const Product = require("../models/Product");
const path = require("path");

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
};

exports.createProduct = async (req, res) => {
  const imagePath = req.file ? req.file.path : null;
  const product = new Product({
    image: imagePath,
    title: req.body.title,
  });

  try {
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({message: error.message});
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {new: true}
    );
    if (!updatedProduct) {
      return res.status(404).json({message: "Product not found"});
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(400).json({message: error.message});
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }
    res.status(200).json({message: "Product deleted"});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
};
