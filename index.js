const net = require('net');
const { getMessageName } = require('./packetsHelper');
const MessageFactory = require('./Packets/MessageFactory');
const Player = require('./Logic/Player');

const PORT = 9339;
const server = new net.Server();

server.on('connection', async (client) => {
    client.log = function (text) {
        const ip = this.remoteAddress.split(':').slice(-1)[0];
        return console.log(`[${ip}] >> ${text}`);
    };

    client.log('Получено новое подключение!');

    client.player = new Player();

    client.on('data', async (packetBuffer) => {
        try {
            if (packetBuffer.length < 7) {
                client.log('Получен слишком маленький пакет, пропускаем.');
                return;
            }

            const message = {
                id: packetBuffer.readUInt16BE(0),
                len: packetBuffer.readUIntBE(2, 3),
                version: packetBuffer.readUInt16BE(5),
                payload: packetBuffer.slice(7),
                client,
                player: client.player
            };

            const packetId = message.id;
            const packetName = getMessageName(packetId);

            if (MessageFactory.isSupported(packetId)) {
                try {
                    const PacketHandler = MessageFactory.getHandler(packetId);
                    const packet = new PacketHandler(message.payload, message.client, message.player);

                    client.log(`Получен пакет ${packetId} (${packetName})`);

                    await packet.decode();
                    await packet.process();
                } catch (err) {
                    client.log(`Ошибка при обработке пакета ${packetId} (${packetName})`);
                    console.error(err);
                }
            } else {
                client.log(`Получен неизвестный пакет ${packetId} (${packetName})`);
            }
        } catch (e) {
            client.log('Ошибка при разборе пакета');
            console.error(e);
        }
    });

    client.on('end', () => {
        client.log('Клиент отключился.');
    });

    client.on('error', (err) => {
        client.log('Произошла ошибка подключения.');
        console.error(err);
        client.destroy();
    });
});

server.once('listening', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

server.listen(PORT);

// Обработка глобальных ошибок
process.on("uncaughtException", (err) => {
    console.error("Необработанное исключение:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Необработанный промис:", promise, "причина:", reason);
});