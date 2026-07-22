const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

// As imagens de categoria não ficam mais salvas no disco do servidor -
// o disco do Render é apagado toda vez que o serviço reinicia (deploy novo,
// ou o dyno "dormindo" no plano gratuito), o que fazia as imagens sumirem.
// Agora o multer manda o arquivo direto para o Cloudinary, que guarda de
// forma permanente e devolve uma URL pública fixa.
const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
        folder: 'pizzaria/categorias',
        public_id: `categoria-${req.params.categoria}-${Date.now()}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    }),
});

function filtrarArquivo(req, file, cb) {
    const tiposPermitidos = /jpeg|jpg|png|webp|gif/;
    const mimeValido = tiposPermitidos.test(file.mimetype);
    if (mimeValido) return cb(null, true);
    cb(new Error('Apenas imagens (jpg, png, webp, gif) são permitidas.'));
}

const upload = multer({
    storage,
    fileFilter: filtrarArquivo,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;
