module.exports = function (req, res, next) {
  const secret_token = process.env.SECRET_TOKEN;
  const token = req.headers["token"];
  if (token && token == secret_token) {
    next();
  } else {
    res
      .status(403)
      .json({success: false, data: null, message: "Invalid token"});
  }
};
