const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaUploads = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(pastaUploads)) fs.mkdirSync(pastaUploads, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaUploads),
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname).toLowerCase();
        const nomeUnico = `categoria-${req.params.categoria}-${Date.now()}${extensao}`;
        cb(null, nomeUnico);
    }
});

function filtrarArquivo(req, file, cb) {
    const tiposPermitidos = /jpeg|jpg|png|webp|gif/;
    const extensaoValida = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
    const mimeValido = tiposPermitidos.test(file.mimetype);
    if (extensaoValida && mimeValido) return cb(null, true);
    cb(new Error('Apenas imagens (jpg, png, webp, gif) são permitidas.'));
}

const upload = multer({
    storage,
    fileFilter: filtrarArquivo,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;
