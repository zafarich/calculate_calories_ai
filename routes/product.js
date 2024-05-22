const express = require("express");
const multer = require("multer");
const md5 = require("md5");
const path = require("path");
const router = express.Router();
const productController = require("../controllers/productController");

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/product");
  },
  filename: function (req, file, cb) {
    cb(null, `${md5(Date.now())}${path.extname(file.originalname)}`);
  },
});

const upload = multer({storage: storage});

router.get("/", productController.getAllProducts);
router.post("/", upload.single("image"), productController.createProduct);
router.post("/add/comment", productController.addComment);
router.get("/:id", productController.getProductById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
