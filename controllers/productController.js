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
  try {
    const comment = req.body?.comment;
    if (!comment) {
      return res.status(201).json({
        success: false,
        data: null,
        error_code: 1,
        message: "comment is required",
      });
    }

    if (comment && comment?.length > 100) {
      return res.status(201).json({
        success: false,
        data: null,
        error_code: 2,
        message: "Izoh 100 ta belgidan ko'p bo'lmasligi kerak",
      });
    }

    const product = await Product.findById(req.body?.product_id);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }

    if (product.comments?.length > 6) {
      return res.status(201).json({
        success: false,
        data: null,
        error_code: 3,
        message: "Bitta mahsulot uchun maksimal izoh 7 ta",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.body?.product_id,
      {$addToSet: {comments: comment}}, // Update
      {
        new: true,
        runValidators: true,
      }
    );

    const ai_response = await calculateCaloriesWithAI(updatedProduct);

    res.status(201).json({
      success: true,
      data: {product_id: updatedProduct?._id, result: ai_response},
    });
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

    if (!ai_response?.is_product) {
      await deleteProductMethod(newProduct?._id);
      return res.status(201).json({
        success: true,
        data: {product_id: null, result: ai_response},
      });
    }

    res.status(201).json({
      success: true,
      data: {product_id: newProduct?._id, result: ai_response},
    });
  } catch (error) {
    res.status(400).json({message: error.message});
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const response = await deleteProductMethod(req.params.id);
    res.status(200).json({...response});
  } catch {
    res.status(500).json({success: false, message: "error"});
  }
};

async function deleteProductMethod(id) {
  try {
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return {
        success: false,
        message: "Product not found",
      };
    }
    return {success: true, message: "Product deleted"};
  } catch (error) {
    return {success: false, message: error.message};
  }
}

async function calculateCaloriesWithAI(product) {
  const lang = product?.lang === "uz" ? "Uzbek" : "Russian";

  const comments = product?.comments;
  const comments_str = comments.join(". ");
  const comment_user = comments?.length
    ? `Comment in ${lang}: ${comments_str}`
    : "";

  const product_obj =
    product?.type === "image"
      ? {
          type: "image_url",
          image_url: {
            url: product?.image,
          },
        }
      : {
          type: "text",
          text: `${product.title} is ${lang} word`,
        };

  const res_check = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            ...product_obj,
          },
          {
            type: "text",
            text: `Is it food or drink? Response must format JSON only = {for_eat_or_drink: true || false}`,
          },
        ],
      },
    ],
  });

  const res_json = JSON.parse(res_check?.choices[0]?.message?.content);

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
            {...product_obj},
            {
              type: "text",
              text: `Calculate calories. The response must be JSON only. JSON {title: xx, total_calories: xx, macros: {proteins: x gr, carbs: x gr, fats: x gr}, ingridients: [title: xx, grams: xx, calories: xx]}. All titles need to be in ${lang}. ${comment_user}`,
            },
          ],
        },
      ],
    });

    return {
      is_product: true,
      ...JSON.parse(res2?.choices[0]?.message?.content),
    };
  } else {
    return {
      is_product: false,
    };
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
      }
    });
  }
}
