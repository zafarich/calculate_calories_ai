const Product = require("../models/Product");
const path = require("path");
const sharp = require("sharp");

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
};

exports.addComment = async (req, res) => {
  console.log("req", req.body);
  try {
    const product = await Product.findById(req.body?.product_id);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.body?.product_id,
      {$addToSet: {comments: req.body?.comment}}, // Update
      {
        new: true,
        runValidators: true,
      }
    );

    console.log("updatedProduct", updatedProduct);

    res.status(201).json({success: true});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
};

exports.createProduct = async (req, res) => {
  console.log("req", req.body);
  let imagePath = null;
  if (req.file) {
    const originalPath = req.file.path;
    const resizedImagePath = path.join(
      path.dirname("/uploads/product/"),
      "resized-" + req.file.filename
    );
    await sharp(originalPath).resize(512, 1024).toFile(resizedImagePath);
    imagePath = resizedImagePath;
  }
  const product = new Product({
    image: imagePath,
    title: req.body.title,
    type: req.body.type,
    lang: req.body.lang,
    client_id: req.body.client_id,
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

async function calculateCaloriesWithAI(product) {
  // const data_json = {
  //   title: "",
  //   image: "",
  //   type: "",
  //   lang: "",
  //   comments: [],
  //   client_id: [],
  // };

  const product_item =
    product?.type === "image"
      ? {
          type: "image_url",
          image_url: {
            url: "https://zamin.uz/uploads/posts/2020-12/1606813503_1555593733_osh-uzbk-palov-uzbek-osh-palov-6.jpg",
          },
        }
      : {};

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "https://zamin.uz/uploads/posts/2020-12/1606813503_1555593733_osh-uzbk-palov-uzbek-osh-palov-6.jpg",
            },
          },
          {
            type: "text",
            text: `It is necessary to check whether the product is for eating or drinking (is_food), it is healthy food (is_healthy) and its calories. The response must be JSON only. JSON {is_food: true || false, is_healthy: true || false, title: xx, total_calories: xx, macros: {proteins: x gr, carbs: x gr, fats: x gr}, ingridients: [title: xx, grams: xx, calories: xx]}. All titles need to be in uzbek`,
          },
        ],
      },
    ],
  });

  console.log("string", res?.choices[0]?.message?.content);
}
