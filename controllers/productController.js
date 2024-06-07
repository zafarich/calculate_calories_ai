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

    // if (ai_response?.for_eat_or_drink === false) {
    //   await deleteProductMethod(newProduct?._id);
    //   return res.status(201).json({
    //     success: true,
    //     data: {
    //       product_id: null,
    //       result: {
    //         is_food: false,
    //       },
    //     },
    //   });
    // }

    res.status(201).json({
      success: true,
      data: {
        product_id: newProduct?._id,
        result: ai_response,
      },
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
          text: `Product (in ${lang}): ${product.title}`,
        };

  let translatedFoodItem = product.title;

  if (product?.lang === "ru" || product?.lang === "uz") {
    const translationPrompt = `Translate the following ${
      product?.lang === "ru" ? "Russian" : "Uzbek"
    } text to English: "${product.title}"`;
    try {
      const translationResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        prompt: translationPrompt,
        max_tokens: 60,
        temperature: 0.3,
      });

      translatedFoodItem = translationResponse.data.choices[0].text.trim();
    } catch (error) {
      console.error("Error translating food item:", error);
      return;
    }
  }

  const prompt = `
  You are a nutrition expert. Please provide detailed information about the given food item in JSON format. The JSON should include whether the item is edible, its total calories, breakdown of calories from protein, carbohydrates, and fat. If the item can be cooked in different ways, provide a list of cooking methods with their separate calorie values and additives. Here is the food item:

  Food Item: ${translatedFoodItem}
  `;

  let response;

  if (product?.image) {
    // Read the image file
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a nutrition expert.",
        },
        {
          role: "user",
          content: prompt,
        },
        {
          role: "user",
          content: [{...product_obj}],
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });
  } else {
    response = await openai.chat.completions.create({
      model: "gpt-4",
      prompt: prompt,
      max_tokens: 300,
      temperature: 0.5,
    });
  }

  // const res2 = await openai.chat.completions.create({
  //   model: "gpt-4o",
  //   response_format: {
  //     type: "json_object",
  //   },
  //   messages: [
  //     {
  //       role: "system",
  //       content: [
  //         {
  //           type: "text",
  //           text: `Is it food or drink? Response must format JSON only = {for_eat_or_drink: true || false}. If it is food or drink calculate calories and the response must be JSON only. Let the calorie count be for the cooked product. JSON {title: x, total_calories: x, macros: {proteins: x gr, carbs: x gr, fats: x gr}, ingridients: [title: xx, grams: xx, calories: xx]}.  All titles need to be in ${lang}. ${comment_user}`,
  //         },
  //       ],
  //     },
  //     {
  //       role: "user",
  //       content: [{...product_obj}],
  //     },
  //   ],
  // });

  // return {
  //   ...JSON.parse(res2?.choices[0]?.message?.content),
  // };

  return response.data.choices[0].text.trim();
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
