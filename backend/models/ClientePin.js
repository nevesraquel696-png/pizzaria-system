const db = require('../config/db');
const bcrypt = require('bcryptjs');

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

const ClientePin = {
    async buscar(telefone) {
        const [rows] = await db.query('SELECT * FROM clientes_pin WHERE telefone = ?', [telefone]);
        return rows[0] || null;
    },

    async existe(telefone) {
        const registro = await this.buscar(telefone);
        return !!registro;
    },

    // Só cria se ainda não existir uma pra esse telefone - nunca sobrescreve
    // uma senha já criada (isso teria que passar por "trocar senha", que
    // exigiria confirmar a senha antiga primeiro; fora do escopo por ora).
    async criar(telefone, pin) {
        const jaExiste = await this.existe(telefone);
        if (jaExiste) return false;

        const hash = await bcrypt.hash(pin, 10);
        await db.query('INSERT INTO clientes_pin (telefone, pin_hash) VALUES (?, ?)', [telefone, hash]);
        return true;
    },

    // Confere a senha com bloqueio progressivo por telefone: depois de
    // MAX_TENTATIVAS erradas, trava esse telefone por BLOQUEIO_MINUTOS -
    // não é IP que é bloqueado, é o próprio telefone-alvo, o que protege
    // mesmo que quem está tentando use vários IPs diferentes.
    async verificar(telefone, pin) {
        const registro = await this.buscar(telefone);
        if (!registro) return false; // sem senha cadastrada pra esse telefone

        if (registro.bloqueado_ate && new Date(registro.bloqueado_ate) > new Date()) {
            const minutosRestantes = Math.max(1, Math.ceil((new Date(registro.bloqueado_ate) - new Date()) / 60000));
            throw new Error(`Muitas tentativas erradas. Tente de novo em ${minutosRestantes} minuto(s).`);
        }

        const confere = await bcrypt.compare(pin, registro.pin_hash);
        if (confere) {
            if (registro.tentativas_falhas > 0) {
                await db.query('UPDATE clientes_pin SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE telefone = ?', [telefone]);
            }
            return true;
        }

        const tentativas = registro.tentativas_falhas + 1;
        const bloquear = tentativas >= MAX_TENTATIVAS;
        await db.query(
            'UPDATE clientes_pin SET tentativas_falhas = ?, bloqueado_ate = ? WHERE telefone = ?',
            [bloquear ? 0 : tentativas, bloquear ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60000) : null, telefone]
        );
        if (bloquear) throw new Error(`Muitas tentativas erradas. Tente de novo em ${BLOQUEIO_MINUTOS} minutos.`);
        return false;
    }
};

module.exports = ClientePin;
