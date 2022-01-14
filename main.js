require('dotenv').config();
const {
    MongoClient
} = require('mongodb');
const {Client} = require('discord.js');
const discordClient = new Client();

const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DISCORD_SECRET_BOT = process.env.DISCORD_SECRET_BOT;
const MONIT_CHANNEL_ID=process.env.MONIT_CHANNEL_ID;
const ALERT_CHANNEL_ID=process.env.ALERT_CHANNEL_ID;
const ENV=process.env.ENV;
const APP_LABEL=process.env.APP_LABEL;

console.log("Before connection");
(async () => {
    const client = await MongoClient.connect(MONGO_CONNECTION_STRING, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log("Before ready discord");

    discordClient.on('ready', async () => {
        console.log("After ready discord");

        const monitChannel = await discordClient.channels.cache.get(MONIT_CHANNEL_ID);
        const alertChannel = await discordClient.channels.cache.get(ALERT_CHANNEL_ID);

        const rsStatus = await client.db().admin().replSetGetStatus();
        const primary = rsStatus.members.filter(obj => obj.stateStr === 'PRIMARY');
        const secondary = rsStatus.members.filter(obj => obj.stateStr === 'SECONDARY');

        const checkSecondaryDelay = secondary.map(obj => {
            return {
                name: obj.name,
                optimeDate: obj.optimeDate,
                lastHeartbeat: obj.lastHeartbeat,
                diff: obj.lastHeartbeat - obj.optimeDate,
                alarm: ((obj.lastHeartbeat - obj.optimeDate) >= (20 * 1000)) ? true : false
            }
        });

        const logObj = {
            primaryQty: primary.length,
            secondaryQty: secondary.length,
            checkSecondaryDelay: checkSecondaryDelay,
            time: (new Date()).toISOString()
        };

        const sum = logObj.checkSecondaryDelay.reduce((a, b) => a + b.diff, 0);
        const avg = (sum / logObj.checkSecondaryDelay.length) || 0;

        let message = `***${APP_LABEL} MONIT***\n`;
        message += `ENV: ${ENV}\n`;
        message += `Date: ${logObj.time}\n`;
        message += `Numero Primary: ${logObj.primaryQty} ${(logObj.primaryQty !== 1) ? `:red_circle:` : `:green_circle:`}\n`;
        message += `Numero Secondary: ${logObj.secondaryQty} ${(logObj.secondaryQty !== 2) ? `:red_circle:` : `:green_circle:`}\n`;
        message += `**Media Delay Tra I Nodi (ms): ${avg} ${(avg >= (20 * 1000)) ? `:red_circle:` : (avg >= (10 * 1000)) ? `:yellow_circle:` : `:green_circle:`}**`;

        await monitChannel.send(message);

        const alert = logObj.checkSecondaryDelay.some((e) => e.alarm === true);
        if (alert) {
            message = `***:warning::rotating_light: ${APP_LABEL} ALERT :rotating_light::warning:***\n`;
            message += `ENV: ${ENV}\n`;
            message += `Date: ${logObj.time}\n`;
            logObj.checkSecondaryDelay.map(e => {
                if (e.alarm) {
                    message += `**${e.name} non .. sincronizzato ha un delay di ${e.diff} ms**\n`;
                }
            })
            await alertChannel.send(message);
        }
        if (logObj.primaryQty !== 1) {
            message = `***:warning::rotating_light: ${APP_LABEL} ALERT :rotating_light::warning:***\n`;
            message += `ENV: ${ENV}\n`;
            message += `Date: ${logObj.time}\n`;
            message += `** PROBLEMA SUL NODO PRIMARIO**\n`;
            await alertChannel.send(message);
        }
        if (logObj.secondaryQty !== 2) {
            message = `***:warning::rotating_light: ${APP_LABEL} ALERT :rotating_light::warning:***\n`;
            message += `ENV: ${ENV}\n`;
            message += `Date: ${logObj.time}\n`;
            message += `**PROBLEMA SUI NODI SECONDARI**\n`;
            await alertChannel.send(message);
        }
        process.exit(0);
    });

    await discordClient.login(DISCORD_SECRET_BOT);
})();
