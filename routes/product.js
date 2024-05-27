const express = require("express");
const multer = require("multer");
const md5 = require("md5");
const path = require("path");
const router = express.Router();
const productController = require("../controllers/productController");

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/product");
  },
  filename: function (req, file, cb) {
    cb(null, `${md5(Date.now())}${path.extname(file.originalname)}`);
  },
});

const upload = multer({storage: storage});

router.post("/", upload.single("image"), productController.createProduct);
router.post("/add/comment", productController.addComment);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
