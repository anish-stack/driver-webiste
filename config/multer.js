const multer = require("multer");
const path = require("path");

const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

module.exports = {
  uploadBuffer: multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, 
  }),

  uploadPath: multer({
    storage: diskStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }),
};
