const Product = require("../models/Product");
const path = require("path");
const sharp = require("sharp");
const sizeOf = require("image-size");
const fs = require("fs");

const {OpenAI} = require("openai");

const openai = new OpenAI({
  organization: process.env.ORG_ID,
  apiKey: process.env.API_KEY,
});

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
  function selectImageScale(width, height) {
    const aspectRatio = width / height;

    const scale1x1 = Math.abs(aspectRatio - 1);
    const scale1x2 = Math.abs(aspectRatio - 0.5);
    const scale2x1 = Math.abs(aspectRatio - 2);

    if (scale1x1 <= scale1x2 && scale1x1 <= scale2x1) {
      return {width: 512, height: 512};
    } else if (scale1x2 <= scale1x1 && scale1x2 <= scale2x1) {
      return {width: 512, height: 1024};
    } else {
      return {width: 1024, height: 512};
    }
  }
  let imagePath = null;
  let originalPath = "";
  let resizedPath = "";
  if (req.file) {
    originalPath = `public/uploads/product/${req.file.filename}`;
    resizedPath = `public/uploads/product/resized-${req.file.filename}`;

    const dimensions = sizeOf(originalPath);

    width = dimensions.width;
    height = dimensions.height;

    const sizes = selectImageScale(width, height);
    await sharp(originalPath)
      .resize(sizes?.width, sizes?.height)
      .toFile(resizedPath);
    fs.unlink(originalPath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log("Original file deleted successfully");
      }
    });
    imagePath = `/uploads/product/resized-${req.file.filename}`;
  }

  const validation = await createValidation(req, resizedPath);

  if (!validation?.success) {
    return res.status(201).json({
      ...validation,
      data: null,
    });
  }

  const product = new Product({
    image: imagePath ? process.env.BASE_URL + imagePath : null,
    title: req.body.title,
    type: req.body.type,
    lang: req.body.lang,
    client_id: req.body.client_id,
  });

  try {
    const newProduct = await product.save();

    const ai_response = await calculateCaloriesWithAI(newProduct);

    res.status(201).json({
      success: true,
      data: {product_id: newProduct?._id, result: ai_response},
    });
  } catch (error) {
    res.status(400).json({message: error.message});
  }
};

async function calculateCaloriesWithAI(product) {
  const lang = product?.lang === "uz" ? "o'zbek tilida" : "Russian";

  const check_food_text =
    product?.lang === "uz"
      ? `'${product?.title}' yeyish yoki ichish uchunmi? Javob faqat JSON ko'rinishda bo'lsin = {for_eat_or_drink: true || false}`
      : `'${product?.title}' это что-то, что можно есть или пить? Пусть ответ будет только в формате JSON = {for_eat_or_drink: true || false}`;

  const check_is_food_content =
    product?.type === "image"
      ? [
          {
            type: "image_url",
            image_url: {
              url: product?.image,
            },
          },

          {
            type: "text",
            text: `Is it food or drink? Response must format JSON only = {for_eat_or_drink: true || false}`,
          },
        ]
      : [
          {
            type: "text",
            text: check_food_text,
          },
        ];

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "user",
        content: check_is_food_content,
      },
    ],
  });

  const res_json = JSON.parse(res?.choices[0]?.message?.content);

  if (res_json?.for_eat_or_drink) {
    const res2 = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "user",
          content: [
            {...product_item},
            {
              type: "text",
              text: `Calculate calories. The response must be JSON only. JSON {title: xx, total_calories: xx, macros: {proteins: x gr, carbs: x gr, fats: x gr}, ingridients: [title: xx, grams: xx, calories: xx]}. All titles need to be in ${lang}`,
            },
          ],
        },
      ],
    });

    return JSON.parse(res2?.choices[0]?.message?.content);
  } else {
    return res_json;
  }
}

async function createValidation(req, resizedPath) {
  let has_error = false;

  if (!(req.body.type === "image" || req.body.type === "text")) {
    has_error = true;
    deleteImage(resizedPath);
    return {
      success: false,
      message: "Type need to only image or text",
    };
  }

  if (req.body.type === "image" && !req.file) {
    deleteImage(resizedPath);
  }
  if (req.body.type === "text" && req.file) {
    deleteImage(resizedPath);
  }

  if (req.body.type === "text" && !req.body?.title) {
    has_error = true;
    deleteImage(resizedPath);
    return {
      success: false,
      message: "If type is text, title is required",
    };
  }

  return {
    success: true,
    message: "",
  };
}

async function deleteImage(path) {
  if (path) {
    fs.unlink(path, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log("File deleted successfully");
      }
    });
  }
}
