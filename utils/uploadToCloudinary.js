const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadBuffer = (buffer, folder = "uploads", options = {}) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, ...options },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });

const uploadPath = (filePath, folder = "uploads", options = {}) =>
    cloudinary.uploader.upload(filePath, { folder, ...options });

const uploadMultiple = async (files = [], folder = "uploads", options = {}) => {
    if (!Array.isArray(files) || files.length === 0) return [];

    const uploads = files.map((file) => {
        // memory upload
        if (file && file.buffer) {
            return uploadBuffer(file.buffer, folder, options);
        }
        // disk upload
        if (file && file.path) {
            return uploadPath(file.path, folder, options);
        }

        return Promise.reject(
            new Error("Invalid file object: expected buffer or path")
        );



        return Promise.all(uploads);
    })
};


const deleteFile = async (publicId, options = {}) => {
    if (!publicId) throw new Error("publicId is required for delete");
    return cloudinary.uploader.destroy(publicId, options);
};

const deleteMultiple = async (publicIds = [], options = {}) => {
    if (!Array.isArray(publicIds) || publicIds.length === 0) return { deleted: {} };
    return cloudinary.api.delete_resources(publicIds, options);
};

module.exports = {
    uploadBuffer,
    uploadPath,
    uploadMultiple,
    deleteFile,
    deleteMultiple,
};
