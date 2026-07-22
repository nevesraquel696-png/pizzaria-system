const multer = require('multer');

// As imagens de categoria não ficam mais salvas no disco do servidor -
// o disco do Render é apagado toda vez que o serviço reinicia (deploy novo,
// ou o dyno "dormindo" no plano gratuito), o que fazia as imagens sumirem.
// Agora o multer só segura o arquivo na memória (buffer); quem sobe pro
// Cloudinary de fato é o controller, usando um stream.
function filtrarArquivo(req, file, cb) {
    const tiposPermitidos = /jpeg|jpg|png|webp|gif/;
    const mimeValido = tiposPermitidos.test(file.mimetype);
    if (mimeValido) return cb(null, true);
    cb(new Error('Apenas imagens (jpg, png, webp, gif) são permitidas.'));
}

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: filtrarArquivo,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;
